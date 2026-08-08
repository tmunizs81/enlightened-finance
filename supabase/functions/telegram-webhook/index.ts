import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY já são injetados automaticamente pela plataforma.
// A chave universal de IA (fallback da plataforma) vem de public.platform_secrets,
// não de um Secret de Edge Function — ver getPlatformKeys() abaixo. Cada usuário
// pode cadastrar sua própria chave em Configurações (profiles.gemini_api_key /
// groq_api_key), que tem prioridade sobre esse valor global.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Chave universal de IA: guardada em public.platform_secrets (só o
// service_role enxerga essa tabela) em vez de Deno.env, porque esta plataforma
// não expõe os Secrets de Edge Functions para o dono do app. Cacheada em
// memória por alguns minutos para não bater no banco a cada mensagem.
let platformKeysCache: { gemini: string; groq: string; fetchedAt: number } | null = null;
const PLATFORM_KEYS_TTL_MS = 5 * 60 * 1000;

async function getPlatformKeys() {
  if (platformKeysCache && Date.now() - platformKeysCache.fetchedAt < PLATFORM_KEYS_TTL_MS) {
    return platformKeysCache;
  }
  const { data, error } = await supabase
    .from("platform_secrets")
    .select("gemini_api_key, groq_api_key")
    .eq("id", true)
    .maybeSingle();
  if (error) console.error("Erro ao buscar platform_secrets:", error.message);
  platformKeysCache = {
    gemini: data?.gemini_api_key || Deno.env.get("GEMINI_API_KEY") || "",
    groq: data?.groq_api_key || Deno.env.get("GROQ_API_KEY") || "",
    fetchedAt: Date.now(),
  };
  return platformKeysCache;
}

// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Cada usuário conecta o SEU PRÓPRIO bot do Telegram (criado via BotFather) em
// Configurações. Por isso nunca existe um "token global": toda resposta usa o
// token salvo no profile do chat que originou a mensagem.
// ---------------------------------------------------------------------------
function telegramApi(botToken: string) {
  const base = `https://api.telegram.org/bot${botToken}`;
  return {
    sendMessage: async (chatId: string | number, text: string, extra: Json = {}) => {
      try {
        await fetch(`${base}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
        });
      } catch (e) {
        console.error("sendMessage falhou:", e);
      }
    },
    editMessageText: async (chatId: string | number, messageId: number, text: string, extra: Json = {}) => {
      try {
        await fetch(`${base}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown", ...extra }),
        });
      } catch (e) {
        console.error("editMessageText falhou:", e);
      }
    },
    answerCallbackQuery: async (callbackQueryId: string, text?: string) => {
      try {
        await fetch(`${base}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
      } catch (e) {
        console.error("answerCallbackQuery falhou:", e);
      }
    },
    getFile: async (fileId: string): Promise<Json> => {
      const res = await fetch(`${base}/getFile?file_id=${fileId}`);
      return res.json();
    },
    fileUrl: (filePath: string) => `https://api.telegram.org/file/bot${botToken}/${filePath}`,
  };
}
type TelegramApi = ReturnType<typeof telegramApi>;

async function getProfileByChatId(chatId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, telegram_bot_token, gemini_api_key, groq_api_key")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (error) console.error("Erro ao buscar profile por chat_id:", error.message);
  return data;
}

// Casa o nome de categoria sugerido pela IA (texto livre) com a categoria real
// mais próxima cadastrada pelo usuário. Retorna null se não achar nada parecido.
function resolveCategoryId(suggested: string | null | undefined, type: string, categories: Json[]) {
  if (!suggested) return null;
  const target = suggested.trim().toLowerCase();
  if (!target) return null;
  const pool = categories.filter((c) => c.type === type);
  const exact = pool.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact.id;
  const partial = pool.find(
    (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase()),
  );
  return partial ? partial.id : null;
}

// ---------------------------------------------------------------------------
// Integração Gemini — o "cérebro" do bot para texto e imagem.
// ---------------------------------------------------------------------------

// Interpreta uma mensagem em linguagem natural e extrai um lançamento financeiro.
async function extractTransactionFromText(apiKey: string, text: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction:
      "Você é o motor de interpretação financeira de um bot de Telegram brasileiro. Leia a mensagem " +
      "do usuário e extraia um lançamento financeiro (despesa ou receita), se houver um. Responda " +
      "SEMPRE em JSON estrito, sem markdown, seguindo o schema: " +
      '{"is_transaction": boolean, "tipo": "despesa"|"receita", "valor": number, "descricao": string, ' +
      '"categoria": string|null, "data": "YYYY-MM-DD", "reply": string}. ' +
      'O campo "reply" só é usado quando is_transaction=false, para responder ao usuário educadamente. ' +
      "Valores podem vir com vírgula (10,50) — converta para ponto (10.50). " +
      "Se a mensagem citar uma data relativa (hoje, ontem, anteontem), calcule a data absoluta a partir da data de hoje informada.",
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });

  const result = await model.generateContent(`Data de hoje: ${todayISO()}\nMensagem do usuário: "${text}"`);
  return JSON.parse(result.response.text());
}

type ReceiptResult = {
  amount: number;
  description: string;
  date: string | null;
  category: string | null;
  type: "income" | "expense";
  provider: "gemini" | "groq";
};

// Analisa uma foto/documento de comprovante. Tenta Gemini primeiro e cai para
// Groq (visão) se a chave estiver configurada e o Gemini falhar.
async function analyzeReceipt(
  geminiKey: string,
  groqKey: string,
  fileUrl: string,
  forceProvider?: "gemini" | "groq",
): Promise<ReceiptResult> {
  const prompt =
    "Extraia os dados desta nota fiscal/comprovante no formato JSON estrito, sem markdown: " +
    '{"valor": number, "descricao": string, "data": "YYYY-MM-DD"|null, "estabelecimento": string, ' +
    '"categoria": string|null, "tipo": "despesa"|"receita"}. ' +
    `Se a data não estiver visível, use null. Hoje é ${todayISO()}.`;

  if (geminiKey && (!forceProvider || forceProvider === "gemini")) {
    try {
      const imageResponse = await fetch(fileUrl);
      if (!imageResponse.ok) throw new Error(`Download da imagem falhou: ${imageResponse.status}`);
      const buffer = await imageResponse.arrayBuffer();
      const base64Data = arrayBufferToBase64(buffer);
      const mimeType = fileUrl.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";

      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      });
      const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType } }]);
      const parsed = JSON.parse(result.response.text());
      return {
        amount: Number(parsed.valor) || 0,
        description: parsed.descricao || parsed.estabelecimento || "Comprovante via Telegram",
        date: parsed.data || null,
        category: parsed.categoria || null,
        type: parsed.tipo === "receita" ? "income" : "expense",
        provider: "gemini",
      };
    } catch (e) {
      console.error("OCR via Gemini falhou:", e);
      if (forceProvider === "gemini") throw e;
    }
  }

  if (groqKey && (!forceProvider || forceProvider === "groq")) {
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) throw new Error(`Download da imagem falhou: ${imageResponse.status}`);
    const buffer = await imageResponse.arrayBuffer();
    const base64Data = arrayBufferToBase64(buffer);

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`Groq respondeu ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      amount: Number(parsed.valor) || 0,
      description: parsed.descricao || parsed.estabelecimento || "Comprovante via Telegram",
      date: parsed.data || null,
      category: parsed.categoria || null,
      type: parsed.tipo === "receita" ? "income" : "expense",
      provider: "groq",
    };
  }

  throw new Error("Nenhum provedor de IA disponível (configure GEMINI_API_KEY ou GROQ_API_KEY).");
}

// ---------------------------------------------------------------------------
// Cartão de confirmação (rascunho em telegram_drafts) e teclado inline.
// Prefixos de callback_data são propositalmente curtos (< 10 bytes) por causa
// do limite de 64 bytes do Telegram para callback_data.
// ---------------------------------------------------------------------------

function buildDraftKeyboard(draftId: string, lastFileId?: string) {
  const keyboard = [
    [
      { text: "✅ Confirmar", callback_data: `c|${draftId}` },
      { text: "❌ Cancelar", callback_data: `x|${draftId}` },
    ],
    [
      { text: "✏️ Categoria", callback_data: `cat|${draftId}` },
      { text: "✏️ Conta", callback_data: `acc|${draftId}` },
    ],
    [
      { text: "✏️ Valor", callback_data: `val|${draftId}` },
      { text: "✏️ Descrição", callback_data: `desc|${draftId}` },
    ],
  ];
  if (lastFileId) {
    keyboard.push([{ text: "🔄 Reanalisar com outra IA", callback_data: `ref|${lastFileId}` }]);
  }
  return { inline_keyboard: keyboard };
}

async function draftCardText(draft: Json) {
  let catName = "Sem categoria";
  if (draft.category_id) {
    const { data: c } = await supabase.from("categories").select("name").eq("id", draft.category_id).maybeSingle();
    if (c?.name) catName = c.name;
  }
  let accName = "Sem conta";
  if (draft.account_id) {
    const { data: a } = await supabase.from("accounts").select("name").eq("id", draft.account_id).maybeSingle();
    if (a?.name) accName = a.name;
  }
  const providerTag = draft.metadata?.ocr_provider ? ` 🤖 (${String(draft.metadata.ocr_provider).toUpperCase()})` : "";
  return (
    `${draft.type === "income" ? "📈 *Receita*" : "📉 *Despesa*"} detectada${providerTag} — Confirme:\n\n` +
    `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\n` +
    `📝 *Descrição:* ${draft.description}\n` +
    `📅 *Data:* ${draft.date || todayISO()}\n` +
    `🏷️ *Categoria:* ${catName}\n` +
    `🏦 *Conta:* ${accName}`
  );
}

async function sendDraftCard(api: TelegramApi, chatId: string, draft: Json) {
  await api.sendMessage(chatId, await draftCardText(draft), buildDraftKeyboard(draft.id, draft.metadata?.file_id));
}

async function updateDraftCard(api: TelegramApi, chatId: string, messageId: number, draft: Json) {
  await api.editMessageText(
    chatId,
    messageId,
    await draftCardText(draft),
    buildDraftKeyboard(draft.id, draft.metadata?.file_id),
  );
}

// ---------------------------------------------------------------------------
// Callback queries (cliques nos botões do cartão de confirmação)
// ---------------------------------------------------------------------------

async function handleCallbackQuery(cb: Json) {
  const chatId = String(cb.message.chat.id).trim();
  const messageId = cb.message.message_id;
  const data = String(cb.data || "");

  const profile = await getProfileByChatId(chatId);
  if (!profile?.telegram_bot_token) {
    console.log(`Callback de chat_id ${chatId} sem bot vinculado. Ignorando.`);
    return;
  }

  const api = telegramApi(profile.telegram_bot_token);
  await api.answerCallbackQuery(cb.id);

  const [action, payloadId] = data.split("|");
  const directDraftActions = ["c", "x", "val", "desc", "cat", "acc", "back"];

  let draft: Json | null = null;
  if (directDraftActions.includes(action) && payloadId) {
    const { data: d } = await supabase.from("telegram_drafts").select("*").eq("id", payloadId).maybeSingle();
    draft = d;
  } else if (action !== "ref") {
    const { data: d } = await supabase
      .from("telegram_drafts")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    draft = d;
  } else {
    // "ref" (reanalisar) pode se referir a um rascunho já confirmado/cancelado;
    // buscamos o mais recente deste chat só para saber qual foi o último provedor usado.
    const { data: d } = await supabase
      .from("telegram_drafts")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    draft = d;
  }

  if (!draft && action !== "ref") {
    await api.editMessageText(chatId, messageId, "⚠️ *Rascunho expirado ou já processado.* Envie uma nova mensagem.");
    return;
  }

  if (action === "c") {
    const { error } = await supabase.from("transactions").insert({
      user_id: draft!.user_id,
      type: draft!.type,
      amount: draft!.amount,
      description: draft!.description,
      category_id: draft!.category_id,
      account_id: draft!.account_id,
      date: draft!.date || todayISO(),
      status: "paid",
    });
    if (error) {
      await api.editMessageText(chatId, messageId, `❌ *Erro ao salvar:* ${error.message}`);
    } else {
      await supabase.from("telegram_drafts").delete().eq("id", draft!.id);
      await api.editMessageText(
        chatId,
        messageId,
        `✅ *Lançamento confirmado!*\n\n💰 R$ ${Number(draft!.amount).toFixed(2)} — ${draft!.description}`,
      );
    }
    return;
  }

  if (action === "x") {
    await supabase.from("telegram_drafts").delete().eq("id", draft!.id);
    await api.editMessageText(chatId, messageId, "🗑️ *Lançamento cancelado.*");
    return;
  }

  if (action === "val") {
    await supabase.from("telegram_drafts").update({ status: "waiting_amount" }).eq("id", draft!.id);
    await api.sendMessage(chatId, "💰 Envie o novo *valor* (ex: 45.90):");
    return;
  }

  if (action === "desc") {
    await supabase.from("telegram_drafts").update({ status: "waiting_description" }).eq("id", draft!.id);
    await api.sendMessage(chatId, "📝 Envie a nova *descrição*:");
    return;
  }

  if (action === "cat") {
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", draft!.user_id)
      .eq("type", draft!.type);
    if (!categories || categories.length === 0) {
      await api.answerCallbackQuery(cb.id, "Nenhuma categoria cadastrada.");
      return;
    }
    const rows: Json[] = [];
    for (let i = 0; i < categories.length; i += 2) {
      const row = [{ text: `🏷️ ${categories[i].name}`, callback_data: `sct|${categories[i].id}` }];
      if (categories[i + 1]) row.push({ text: `🏷️ ${categories[i + 1].name}`, callback_data: `sct|${categories[i + 1].id}` });
      rows.push(row);
    }
    rows.push([{ text: "⬅️ Voltar", callback_data: `back|${draft!.id}` }]);
    await api.editMessageText(chatId, messageId, "🏷️ *Selecione a categoria:*", { inline_keyboard: rows });
    return;
  }

  if (action === "acc") {
    const { data: accounts } = await supabase.from("accounts").select("id, name").eq("user_id", draft!.user_id);
    if (!accounts || accounts.length === 0) {
      await api.answerCallbackQuery(cb.id, "Nenhuma conta cadastrada.");
      return;
    }
    const rows: Json[] = [];
    for (let i = 0; i < accounts.length; i += 2) {
      const row = [{ text: `🏦 ${accounts[i].name}`, callback_data: `sac|${accounts[i].id}` }];
      if (accounts[i + 1]) row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `sac|${accounts[i + 1].id}` });
      rows.push(row);
    }
    rows.push([{ text: "⬅️ Voltar", callback_data: `back|${draft!.id}` }]);
    await api.editMessageText(chatId, messageId, "🏦 *Selecione a conta:*", { inline_keyboard: rows });
    return;
  }

  if (action === "sct" || action === "sac") {
    if (!draft) return;
    const field = action === "sct" ? "category_id" : "account_id";
    await supabase.from("telegram_drafts").update({ [field]: payloadId, status: "active" }).eq("id", draft.id);
    const { data: updated } = await supabase.from("telegram_drafts").select("*").eq("id", draft.id).single();
    if (updated) await updateDraftCard(api, chatId, messageId, updated);
    return;
  }

  if (action === "back") {
    await supabase.from("telegram_drafts").update({ status: "active" }).eq("id", draft!.id);
    const { data: updated } = await supabase.from("telegram_drafts").select("*").eq("id", draft!.id).single();
    if (updated) await updateDraftCard(api, chatId, messageId, updated);
    return;
  }

  if (action === "ref") {
    const fileId = payloadId;
    const platformKeys = await getPlatformKeys();
    const geminiKey = profile.gemini_api_key || platformKeys.gemini;
    const groqKey = profile.groq_api_key || platformKeys.groq;
    const lastProvider = draft?.metadata?.ocr_provider || "gemini";
    const nextProvider = lastProvider === "gemini" ? "groq" : "gemini";

    await api.editMessageText(chatId, messageId, `🔄 *Reanalisando com ${nextProvider.toUpperCase()}...*`);
    try {
      const fileData = await api.getFile(fileId);
      if (!fileData.ok) throw new Error(fileData.description || "arquivo não encontrado no Telegram");

      const result = await analyzeReceipt(geminiKey, groqKey, api.fileUrl(fileData.result.file_path), nextProvider);
      const updateData = {
        type: result.type,
        amount: result.amount,
        description: result.description,
        date: result.date || todayISO(),
        status: "active",
        metadata: { file_id: fileId, ocr_provider: result.provider },
      };

      if (draft) {
        const { data: updated } = await supabase.from("telegram_drafts").update(updateData).eq("id", draft.id).select().single();
        if (updated) await updateDraftCard(api, chatId, messageId, updated);
      } else {
        const { data: created } = await supabase
          .from("telegram_drafts")
          .insert({ ...updateData, user_id: profile.user_id, chat_id: chatId })
          .select()
          .single();
        if (created) await sendDraftCard(api, chatId, created);
      }
    } catch (e: any) {
      await api.editMessageText(chatId, messageId, `❌ *Falha ao reanalisar com ${nextProvider.toUpperCase()}:* ${e.message || e}`);
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Mensagens (texto e foto/documento)
// ---------------------------------------------------------------------------

async function handleMessage(message: Json) {
  const chatId = String(message.chat.id).trim();
  const profile = await getProfileByChatId(chatId);

  if (!profile?.telegram_bot_token) {
    // Sem profile vinculado a este chat_id não há como saber qual bot usar para
    // responder com segurança (cada usuário tem o seu). Apenas registramos e ignoramos.
    console.log(`Mensagem de chat_id ${chatId} sem profile/bot vinculado. Ignorando.`);
    return;
  }

  const api = telegramApi(profile.telegram_bot_token);
  const platformKeys = await getPlatformKeys();
  const geminiKey = profile.gemini_api_key || platformKeys.gemini;
  const groqKey = profile.groq_api_key || platformKeys.groq;
  const text = (message.text || "").trim();

  if (text === "/start" || text === "/help" || text === "/ajuda") {
    await api.sendMessage(
      chatId,
      "👋 *Bem-vindo ao SimplyFin Bot!*\n\nEnvie algo como _\"gastei 54,90 no uber\"_ ou uma *foto de um comprovante* que eu registro para você.",
    );
    return;
  }

  // --- Continuação de edição de valor/descrição de um rascunho existente ---
  const { data: waitingDraft } = await supabase
    .from("telegram_drafts")
    .select("*")
    .eq("chat_id", chatId)
    .in("status", ["waiting_amount", "waiting_description"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (waitingDraft && text) {
    if (waitingDraft.status === "waiting_amount") {
      const parsedAmount = Number(text.replace(/[^\d,.-]/g, "").replace(",", "."));
      if (!parsedAmount || isNaN(parsedAmount)) {
        await api.sendMessage(chatId, "❌ Valor inválido. Envie um número, ex: 45.90");
        return;
      }
      await supabase.from("telegram_drafts").update({ amount: parsedAmount, status: "active" }).eq("id", waitingDraft.id);
    } else {
      await supabase.from("telegram_drafts").update({ description: text.slice(0, 100), status: "active" }).eq("id", waitingDraft.id);
    }
    const { data: updated } = await supabase.from("telegram_drafts").select("*").eq("id", waitingDraft.id).single();
    if (updated) await sendDraftCard(api, chatId, updated);
    return;
  }

  // --- Foto ou documento de imagem: OCR via Gemini/Groq ---
  const photo = message.photo;
  const document = message.document;
  const isImageDocument = document?.mime_type?.startsWith("image/");

  if (photo?.length || isImageDocument) {
    if (!geminiKey && !groqKey) {
      await api.sendMessage(chatId, "⚠️ IA não configurada. Adicione sua chave do Gemini em Configurações.");
      return;
    }
    await api.sendMessage(chatId, "🔍 Analisando comprovante...");
    try {
      // a) pega o file_id da foto de maior resolução (Telegram ordena do menor pro maior)
      const fileId = photo?.length ? photo[photo.length - 1].file_id : document.file_id;
      // b) resolve o file_path via getFile
      const fileData = await api.getFile(fileId);
      if (!fileData.ok) {
        const desc = fileData.description || "erro desconhecido";
        await api.sendMessage(
          chatId,
          desc.includes("too big") ? "⚠️ Imagem muito grande (limite 20MB)." : `❌ Não consegui baixar a imagem (${desc}).`,
        );
        return;
      }
      // c) e d) baixa e converte para base64 dentro de analyzeReceipt
      const fileUrl = api.fileUrl(fileData.result.file_path);
      // e) envia para o Gemini pedindo JSON estrito
      const result = await analyzeReceipt(geminiKey, groqKey, fileUrl);

      const { data: categories } = await supabase.from("categories").select("id, name, type").eq("user_id", profile.user_id);
      const categoryId = resolveCategoryId(result.category, result.type, categories || []);
      const { data: accounts } = await supabase.from("accounts").select("id").eq("user_id", profile.user_id).limit(1);
      const accountId = accounts?.[0]?.id ?? null;

      const { data: draft, error } = await supabase
        .from("telegram_drafts")
        .insert({
          user_id: profile.user_id,
          chat_id: chatId,
          type: result.type,
          amount: result.amount,
          description: result.description,
          date: result.date || todayISO(),
          category_id: categoryId,
          account_id: accountId,
          status: "active",
          metadata: { file_id: fileId, ocr_provider: result.provider },
        })
        .select()
        .single();

      if (error || !draft) {
        console.error("Erro ao criar rascunho de OCR:", error);
        await api.sendMessage(chatId, "❌ Erro interno ao salvar o rascunho. Tente novamente.");
        return;
      }
      await sendDraftCard(api, chatId, draft);
    } catch (e: any) {
      console.error("Falha no processamento de OCR:", e);
      await api.sendMessage(chatId, `❌ Não consegui ler o comprovante: ${e.message || e}`);
    }
    return;
  }

  // --- Texto livre: interpretação via Gemini ---
  if (!text) return;

  if (!geminiKey) {
    await api.sendMessage(chatId, "⚠️ IA não configurada. Adicione sua chave do Gemini em Configurações, ou envie uma foto do comprovante.");
    return;
  }

  try {
    const extracted = await extractTransactionFromText(geminiKey, text);

    if (!extracted.is_transaction) {
      await api.sendMessage(chatId, extracted.reply || '🤔 Não entendi. Tente algo como _"gastei 50 no mercado"_.');
      return;
    }

    const amount = Number(extracted.valor);
    if (!amount || isNaN(amount) || amount <= 0) {
      await api.sendMessage(chatId, '🤔 Não identifiquei o valor. Tente: _"gastei 45,90 no almoço"_');
      return;
    }

    const type = extracted.tipo === "receita" ? "income" : "expense";
    const { data: categories } = await supabase.from("categories").select("id, name, type").eq("user_id", profile.user_id);
    const categoryId = resolveCategoryId(extracted.categoria, type, categories || []);
    const { data: accounts } = await supabase.from("accounts").select("id").eq("user_id", profile.user_id).limit(1);
    const accountId = accounts?.[0]?.id ?? null;

    const { data: draft, error } = await supabase
      .from("telegram_drafts")
      .insert({
        user_id: profile.user_id,
        chat_id: chatId,
        type,
        amount,
        description: extracted.descricao || text.slice(0, 100),
        date: extracted.data || todayISO(),
        category_id: categoryId,
        account_id: accountId,
        status: "active",
        metadata: { source: "text" },
      })
      .select()
      .single();

    if (error || !draft) {
      console.error("Erro ao criar rascunho de texto:", error);
      await api.sendMessage(chatId, "❌ Erro interno ao salvar o rascunho. Tente novamente.");
      return;
    }
    await sendDraftCard(api, chatId, draft);
  } catch (e: any) {
    console.error("Falha na interpretação via Gemini:", e);
    await api.sendMessage(chatId, "📸 Não consegui interpretar sua mensagem. Envie uma foto do comprovante ou tente reformular.");
  }
}

async function handleUpdate(body: Json) {
  if (body.callback_query) {
    await handleCallbackQuery(body.callback_query);
    return;
  }
  const message = body.message || body.edited_message;
  if (!message) return;
  await handleMessage(message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("SimplyFin Bot API Active", { status: 200, headers: corsHeaders });

  let body: Json = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  // Processa em segundo plano e responde 200 imediatamente, para o Telegram não
  // ficar reenviando a mesma atualização por timeout enquanto a IA processa.
  const task = handleUpdate(body).catch((e) => console.error("Erro não tratado em handleUpdate:", e));
  // deno-lint-ignore no-explicit-any
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
  } else {
    await task;
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
