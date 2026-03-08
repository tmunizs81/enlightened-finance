import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update).slice(0, 800));

    // --- HANDLE CALLBACK QUERY (button presses) ---
    if (update.callback_query) {
      return await handleCallbackQuery(update.callback_query, supabase);
    }

    const message = update.message;
    if (!message) return new Response("ok");

    const chatId = String(message.chat.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token")
      .eq("telegram_chat_id", chatId)
      .single();

    if (!profile) {
      console.log("No profile for chat_id:", chatId);
      return new Response("ok");
    }

    const userId = profile.user_id;
    const botToken = profile.telegram_bot_token;

    const sendTg = async (text: string, extra: any = {}) => {
      if (!botToken) return;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });
    };

    // --- Check if user is in edit mode for a pending transaction ---
    const { data: pendingEdit } = await supabase
      .from("pending_ocr_transactions")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "editing")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingEdit && message.text && !message.text.startsWith("/")) {
      return await handleEditResponse(pendingEdit, message.text, supabase, botToken, chatId);
    }

    // --- HANDLE TEXT COMMANDS ---
    if (message.text) {
      const cmd = message.text.trim().toLowerCase().split(" ")[0];
      const args = message.text.trim().slice(cmd.length).trim();

      if (cmd === "/start" || cmd === "/help" || cmd === "/ajuda") {
        await sendTg(
`🤖 *T2-FinAI Bot — Comandos disponíveis:*

💰 /saldo — Saldo atual de todas as contas
📊 /extrato — Últimas 10 transações
📉 /despesas — Resumo de despesas do mês
📈 /receitas — Resumo de receitas do mês
➕ /despesa \`valor descrição\` — Lançar despesa rápida
➕ /receita \`valor descrição\` — Lançar receita rápida
🎯 /metas — Progresso das metas
💳 /contas — Lista de contas
🏷️ /categorias — Lista de categorias
📸 *Envie uma foto* — OCR de comprovante

_Exemplo: /despesa 45.90 Almoço restaurante_`
        );
        return new Response("ok");
      }

      if (cmd === "/cancelar") {
        if (pendingEdit) {
          await supabase.from("pending_ocr_transactions").update({ status: "pending", edit_field: null }).eq("id", pendingEdit.id);
          await sendTg("↩️ Edição cancelada.");
        } else {
          await sendTg("Nenhuma edição em andamento.");
        }
        return new Response("ok");
      }

      if (cmd === "/saldo") {
        return await handleSaldo(supabase, userId, sendTg);
      }
      if (cmd === "/extrato") {
        return await handleExtrato(supabase, userId, sendTg);
      }
      if (cmd === "/despesas") {
        return await handleResumoMes(supabase, userId, "expense", sendTg);
      }
      if (cmd === "/receitas") {
        return await handleResumoMes(supabase, userId, "income", sendTg);
      }
      if (cmd === "/despesa") {
        return await handleLancamentoRapido(supabase, userId, "expense", args, sendTg);
      }
      if (cmd === "/receita") {
        return await handleLancamentoRapido(supabase, userId, "income", args, sendTg);
      }
      if (cmd === "/metas") {
        return await handleMetas(supabase, userId, sendTg);
      }
      if (cmd === "/contas") {
        return await handleContas(supabase, userId, sendTg);
      }
      if (cmd === "/categorias") {
        return await handleCategorias(supabase, userId, sendTg);
      }

      // Unknown text — show help hint
      await sendTg("📸 Envie uma *foto de comprovante* ou digite /ajuda para ver os comandos.");
      return new Response("ok");
    }

    // --- HANDLE PHOTO ---
    const photo = message.photo;
    if (!photo || photo.length === 0) {
      return new Response("ok");
    }

    await sendTg("🔍 Analisando comprovante... Aguarde um momento.");

    // Download image
    const fileId = photo[photo.length - 1].file_id;
    const fileResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileResp.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      await sendTg("❌ Não consegui baixar a imagem. Tente novamente.");
      return new Response("ok");
    }

    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const imageResp = await fetch(imageUrl);
    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    const base64Image = btoa(String.fromCharCode(...imageBytes));
    const mimeType = fileData.result.file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    // Get categories & accounts
    const [catRes, accRes] = await Promise.all([
      supabase.from("categories").select("id, name, type").eq("user_id", userId),
      supabase.from("accounts").select("id, name, type").eq("user_id", userId),
    ]);

    const categories = catRes.data || [];
    const accounts = accRes.data || [];
    const expenseCategories = categories.filter((c: any) => c.type === "expense");

    const categoryList = expenseCategories.map((c: any) => `- "${c.name}" (id: ${c.id})`).join("\n");
    const accountList = accounts.map((a: any) => `- "${a.name}" tipo: ${a.type} (id: ${a.id})`).join("\n");

    // AI OCR
    const aiPrompt = `Você é um assistente financeiro que analisa comprovantes de pagamento.
Analise esta imagem e extraia:
- valor (número decimal, ex: 150.50)
- descrição curta (máximo 50 caracteres)
- data (YYYY-MM-DD, se não visível use: ${new Date().toISOString().split("T")[0]})

Categorias de despesa:
${categoryList || "Nenhuma"}

Contas:
${accountList || "Nenhuma"}

Responda APENAS JSON:
{"amount":150.50,"description":"Compra supermercado","date":"2026-03-08","category_id":"uuid-ou-null","account_id":"uuid-ou-null","confidence":"high|medium|low"}

Se não conseguir ler: {"error":"Não foi possível ler o comprovante"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: aiPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        }],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
      await sendTg("❌ Erro ao analisar o comprovante. Tente novamente.");
      return new Response("ok");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    console.log("AI response:", rawContent);

    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      await sendTg("❌ Não consegui interpretar. Envie uma foto mais nítida.");
      return new Response("ok");
    }

    if (parsed.error) {
      await sendTg(`❌ ${parsed.error}`);
      return new Response("ok");
    }

    const amount = Number(parsed.amount);
    if (!amount || isNaN(amount)) {
      await sendTg("❌ Não identifiquei o valor. Tente novamente.");
      return new Response("ok");
    }

    // Upload receipt
    const receiptPath = `${userId}/${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(receiptPath, imageBytes, { contentType: mimeType, upsert: false });

    let receiptUrl: string | null = null;
    if (!uploadErr) {
      const { data: publicData } = supabase.storage.from("receipts").getPublicUrl(receiptPath);
      receiptUrl = publicData?.publicUrl || null;
    }

    // Save as PENDING (not confirmed yet)
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_ocr_transactions")
      .insert({
        user_id: userId,
        chat_id: chatId,
        amount,
        description: parsed.description || "Despesa via Telegram",
        date: parsed.date || new Date().toISOString().split("T")[0],
        category_id: parsed.category_id || null,
        account_id: parsed.account_id || null,
        confidence: parsed.confidence || "medium",
        receipt_url: receiptUrl,
        receipt_path: receiptPath,
        status: "pending",
      })
      .select("id")
      .single();

    if (pendingErr || !pending) {
      console.error("Pending insert error:", pendingErr);
      await sendTg("❌ Erro interno. Tente novamente.");
      return new Response("ok");
    }

    const catName = categories.find((c: any) => c.id === parsed.category_id)?.name || "Sem categoria";
    const accName = accounts.find((a: any) => a.id === parsed.account_id)?.name || "Sem conta";

    const previewMsg = `📋 *Despesa detectada — Confirme os dados:*

💰 *Valor:* R$ ${amount.toFixed(2)}
📝 *Descrição:* ${parsed.description}
📅 *Data:* ${parsed.date}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}
🔒 *Confiança:* ${parsed.confidence || "medium"}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `ocr_confirm:${pending.id}` },
          { text: "❌ Cancelar", callback_data: `ocr_cancel:${pending.id}` },
        ],
        [
          { text: "✏️ Valor", callback_data: `ocr_edit:${pending.id}:amount` },
          { text: "✏️ Descrição", callback_data: `ocr_edit:${pending.id}:description` },
        ],
        [
          { text: "✏️ Data", callback_data: `ocr_edit:${pending.id}:date` },
          { text: "✏️ Categoria", callback_data: `ocr_edit:${pending.id}:category` },
        ],
      ],
    };

    await sendTg(previewMsg, { reply_markup: inlineKeyboard });

    return new Response("ok");
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("ok");
  }
});

// ---- Handle callback query (inline button presses) ----
async function handleCallbackQuery(cbq: any, supabase: any) {
  const data = cbq.data as string;
  const chatId = String(cbq.message.chat.id);
  const messageId = cbq.message.message_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, telegram_bot_token")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!profile) return new Response("ok");
  const botToken = profile.telegram_bot_token;

  const answerCbq = async (text: string) => {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbq.id, text }),
    });
  };

  const sendTg = async (text: string, extra: any = {}) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
    });
  };

  const editMsg = async (text: string) => {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown" }),
    });
  };

  // Parse action
  const parts = data.split(":");
  const action = parts[0];
  const pendingId = parts[1];

  const { data: pending } = await supabase
    .from("pending_ocr_transactions")
    .select("*")
    .eq("id", pendingId)
    .single();

  if (!pending || pending.status === "confirmed" || pending.status === "cancelled") {
    await answerCbq("Esta despesa já foi processada.");
    return new Response("ok");
  }

  // --- CONFIRM ---
  if (action === "ocr_confirm") {
    const txData: any = {
      user_id: pending.user_id,
      type: "expense",
      amount: pending.amount,
      description: pending.description,
      date: pending.date,
      status: "completed",
      notes: `Lançado via Telegram OCR (confiança: ${pending.confidence})`,
      receipt_url: pending.receipt_url,
    };
    if (pending.category_id) txData.category_id = pending.category_id;
    if (pending.account_id) txData.account_id = pending.account_id;

    const { error } = await supabase.from("transactions").insert(txData);
    if (error) {
      console.error("Insert error:", error);
      await answerCbq("Erro ao salvar.");
      return new Response("ok");
    }

    await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", pendingId);
    await editMsg(`✅ *Despesa salva!*\n\n💰 R$ ${Number(pending.amount).toFixed(2)} — ${pending.description}`);
    await answerCbq("Despesa salva com sucesso!");
    return new Response("ok");
  }

  // --- CANCEL ---
  if (action === "ocr_cancel") {
    await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", pendingId);
    // Clean up receipt if uploaded
    if (pending.receipt_path) {
      await supabase.storage.from("receipts").remove([pending.receipt_path]);
    }
    await editMsg("🗑️ Despesa cancelada.");
    await answerCbq("Cancelado.");
    return new Response("ok");
  }

  // --- EDIT ---
  if (action === "ocr_edit") {
    const field = parts[2];
    const fieldLabels: Record<string, string> = {
      amount: "valor (ex: 150.50)",
      description: "descrição (ex: Almoço restaurante)",
      date: "data (formato: YYYY-MM-DD)",
      category: "nome da categoria",
    };

    await supabase.from("pending_ocr_transactions")
      .update({ status: "editing", edit_field: field })
      .eq("id", pendingId);

    await answerCbq(`Editando ${field}`);
    await sendTg(`✏️ Digite o novo *${fieldLabels[field] || field}*:`);
    return new Response("ok");
  }

  await answerCbq("Ação desconhecida.");
  return new Response("ok");
}

// ---- Handle text response while in edit mode ----
async function handleEditResponse(pending: any, text: string, supabase: any, botToken: string, chatId: string) {
  const sendTg = async (msg: string, extra: any = {}) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown", ...extra }),
    });
  };

  // Handle /cancelar command
  if (text.trim().toLowerCase() === "/cancelar") {
    await supabase.from("pending_ocr_transactions").update({ status: "pending", edit_field: null }).eq("id", pending.id);
    await sendTg("↩️ Edição cancelada. Use os botões acima para continuar.");
    return new Response("ok");
  }

  const field = pending.edit_field;
  const updateData: any = { status: "pending", edit_field: null };

  if (field === "amount") {
    const val = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (!val || isNaN(val)) {
      await sendTg("❌ Valor inválido. Digite um número (ex: 150.50):");
      return new Response("ok");
    }
    updateData.amount = val;
  } else if (field === "description") {
    updateData.description = text.trim().slice(0, 50);
  } else if (field === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
      await sendTg("❌ Formato inválido. Use YYYY-MM-DD (ex: 2026-03-08):");
      return new Response("ok");
    }
    updateData.date = text.trim();
  } else if (field === "category") {
    // Find category by name (fuzzy)
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", pending.user_id)
      .eq("type", "expense");

    const match = (cats || []).find((c: any) =>
      c.name.toLowerCase().includes(text.trim().toLowerCase())
    );
    if (match) {
      updateData.category_id = match.id;
    } else {
      const catNames = (cats || []).map((c: any) => `• ${c.name}`).join("\n");
      await sendTg(`❌ Categoria não encontrada. Opções:\n${catNames || "Nenhuma"}\n\nDigite o nome ou /cancelar:`);
      return new Response("ok");
    }
  }

  await supabase.from("pending_ocr_transactions").update(updateData).eq("id", pending.id);

  // Fetch updated record and re-send preview with buttons
  const { data: updated } = await supabase
    .from("pending_ocr_transactions")
    .select("*")
    .eq("id", pending.id)
    .single();

  if (!updated) {
    await sendTg("❌ Erro ao atualizar.");
    return new Response("ok");
  }

  // Get category and account names
  let catName = "Sem categoria";
  let accName = "Sem conta";
  if (updated.category_id) {
    const { data: cat } = await supabase.from("categories").select("name").eq("id", updated.category_id).single();
    if (cat) catName = cat.name;
  }
  if (updated.account_id) {
    const { data: acc } = await supabase.from("accounts").select("name").eq("id", updated.account_id).single();
    if (acc) accName = acc.name;
  }

  const previewMsg = `✏️ *Dados atualizados — Confirme:*

💰 *Valor:* R$ ${Number(updated.amount).toFixed(2)}
📝 *Descrição:* ${updated.description}
📅 *Data:* ${updated.date}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `ocr_confirm:${updated.id}` },
        { text: "❌ Cancelar", callback_data: `ocr_cancel:${updated.id}` },
      ],
      [
        { text: "✏️ Valor", callback_data: `ocr_edit:${updated.id}:amount` },
        { text: "✏️ Descrição", callback_data: `ocr_edit:${updated.id}:description` },
      ],
      [
        { text: "✏️ Data", callback_data: `ocr_edit:${updated.id}:date` },
        { text: "✏️ Categoria", callback_data: `ocr_edit:${updated.id}:category` },
      ],
    ],
  };

  await sendTg(previewMsg, { reply_markup: inlineKeyboard });
  return new Response("ok");
}
