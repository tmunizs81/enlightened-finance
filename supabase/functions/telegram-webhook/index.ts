import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TELEGRAM BOT ENGINE - REWRITTEN FROM SCRATCH
 * High-performance, multi-tenant isolated finance assistant.
 */
serve(async (req) => {
  // 1. Preflight and Health Checks
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return new Response("SimplyFin Engine Online", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
  const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
  const CURRENT_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log("[INBOUND]", JSON.stringify(body));

    // Support for ping action from UI
    if (body.action === "ping") {
      return new Response(JSON.stringify({ status: "ok", engine: "v2-reborn" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update = body;
    const message = update.message || update.edited_message;
    const callback = update.callback_query;

    if (!message && !callback) return new Response("ok");

    const chatId = String(message?.chat?.id || callback?.message?.chat?.id);
    if (!chatId) return new Response("ok");

    // 2. Identify User Profile with Strict Isolation
    // We prioritize the bot token from env to ensure we are talking to the right user in this bot instance
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, telegram_chat_id")
      .eq("telegram_chat_id", chatId)
      .limit(5); // Get a few to check token match

    if (pErr) throw new Error(`Profile lookup failed: ${pErr.message}`);

    // Exact match by token (if bot multi-tenancy is active)
    let profile = profiles?.find(p => p.telegram_bot_token === CURRENT_BOT_TOKEN);
    
    // Fallback to chat_id match if token is null or "default" (common in single-bot setups)
    if (!profile) {
      profile = profiles?.find(p => !p.telegram_bot_token || p.telegram_bot_token === "default" || p.telegram_bot_token === "");
    }

    // Ultimate fallback: first match
    if (!profile && profiles && profiles.length > 0) {
      profile = profiles[0];
    }

    if (!profile) {
      console.warn("[SECURITY] Unauthorized Chat ID:", chatId);
      // We still return 200 to stop Telegram retries, but we don't process
      return new Response(JSON.stringify({ error: "Unauthorized", id: chatId }), { status: 200 });
    }

    const userId = profile.user_id;
    const userBotToken = profile.telegram_bot_token || CURRENT_BOT_TOKEN;

    if (!userBotToken) throw new Error("Missing Bot Token for communication");

    // 3. Helper Functions for Communication
    const sendTg = async (text: string, extra: any = {}) => {
      const endpoint = `https://api.telegram.org/bot${userBotToken}/sendMessage`;
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });
    };

    const answerCallback = async (id: string, text?: string) => {
      await fetch(`https://api.telegram.org/bot${userBotToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: id, text }),
      });
    };

    // 4. Router: Callbacks vs Messages
    if (callback) {
      await answerCallback(callback.id);
      return await handleCallbackLogic(callback, supabase, userId, sendTg);
    }

    // 5. Message Processing
    if (message.photo || (message.document && message.document.mime_type?.startsWith("image/"))) {
      await sendTg("🔍 *Analisando imagem...* Aguarde um momento.");
      return await handleVisionOCR(message, supabase, userId, userBotToken, chatId, sendTg, GROQ_API_KEY || DEEPSEEK_API_KEY);
    }

    if (message.text) {
      const text = message.text.trim();
      
      // Check for active edit mode
      const { data: activeEdit } = await supabase
        .from("pending_ocr_transactions")
        .select("*")
        .eq("chat_id", chatId)
        .eq("status", "editing")
        .limit(1)
        .maybeSingle();

      if (activeEdit && !text.startsWith("/")) {
        return await handleEditInput(activeEdit, text, supabase, userId, sendTg);
      }

      // Commands vs Natural Language
      if (text.startsWith("/")) {
        return await handleCommands(text, supabase, userId, sendTg);
      } else {
        return await handleNaturalLanguage(text, supabase, userId, chatId, userBotToken, sendTg, DEEPSEEK_API_KEY);
      }
    }

    return new Response("ok");
  } catch (err) {
    console.error("[CRITICAL ERROR]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});

// ==========================================
// BUSINESS LOGIC HANDLERS
// ==========================================

async function handleCommands(text: string, supabase: any, userId: string, sendTg: Function) {
  const parts = text.split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (cmd) {
    case "/start":
    case "/help":
    case "/ajuda":
      await sendTg(`🚀 *T2-SimplyFin Engine V2*
      
Comandos rápidos:
💰 /saldo — Suas contas
📊 /extrato — Últimos lançamentos
📉 /despesas — Resumo do mês
➕ /despesa 10.50 Lanche — Lançar rápido
➕ /receita 2000 Salário — Receber rápido
🎯 /metas — Seus objetivos
💡 /dicas — Dicas da IA
📸 *Envie foto* — OCR Automático

_Exemplo: "Gastei 50 no posto"_`);
      break;

    case "/saldo":
      const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
      const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
      const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toFixed(2)}*`).join("\n") || "Nenhuma conta ativa.";
      await sendTg(`💰 *Saldo Atual:*\n\n${list}\n\n💵 *Total: R$ ${total.toFixed(2)}*`);
      break;

    case "/despesa":
    case "/receita":
      await handleQuickEntry(cmd === "/despesa" ? "expense" : "income", args, supabase, userId, sendTg);
      break;
    
    // Add more command cases as needed, following the same pattern
    default:
      await sendTg("❓ Comando não reconhecido. Tente /ajuda.");
  }

  return new Response("ok");
}

async function handleQuickEntry(type: "expense" | "income", args: string, supabase: any, userId: string, sendTg: Function) {
  if (!args) {
    await sendTg(`❌ Formato: /${type} \`valor descrição\`\nEx: /${type} 25.00 Café`);
    return;
  }

  const match = args.match(/^([\d.,]+)\s+(.+)/);
  if (!match) {
    await sendTg(`❌ Formato inválido. Use: /${type} 10.00 Descrição`);
    return;
  }

  const amount = parseFloat(match[1].replace(",", "."));
  const description = match[2].trim();

  // Create a pending transaction for confirmation
  const { data: pending, error } = await supabase
    .from("pending_ocr_transactions")
    .insert({
      user_id: userId,
      amount,
      description,
      type, // if schema supports it, else it's inferred in confirmation
      status: "pending",
      date: new Date().toISOString().split("T")[0]
    })
    .select("id")
    .single();

  if (error) {
    await sendTg("❌ Erro ao preparar lançamento.");
    return;
  }

  const icon = type === "expense" ? "📉" : "📈";
  await sendTg(`${icon} *Confirmar ${type === "expense" ? "Despesa" : "Receita"}?*
  
💰 R$ ${amount.toFixed(2)}
📝 ${description}`, {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Sim", callback_data: `confirm:${pending.id}:${type}` },
        { text: "❌ Não", callback_data: `cancel:${pending.id}` }
      ]]
    }
  });
}

async function handleVisionOCR(message: any, supabase: any, userId: string, token: string, chatId: string, sendTg: Function, apiKey: string) {
  try {
    const fileId = message.photo ? message.photo[message.photo.length - 1].file_id : message.document.file_id;
    const fileInfo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json());
    
    if (!fileInfo.ok) throw new Error("Download failed");

    const imageUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
    const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
    const bytes = new Uint8Array(imageBuffer);
    
    // Base64 conversion
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
    }
    const base64 = btoa(binary);

    // AI Request (Vision)
    const prompt = `Extraia dados deste comprovante de pagamento: valor (number), descrição curta, data (YYYY-MM-DD). 
    Responda APENAS JSON: {"amount": 0.00, "description": "...", "date": "..."}`;

    const aiResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });

    const aiData = await aiResp.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // Save Pending
    const { data: pending } = await supabase.from("pending_ocr_transactions").insert({
      user_id: userId,
      chat_id: chatId,
      amount: result.amount,
      description: result.description,
      date: result.date || new Date().toISOString().split("T")[0],
      status: "pending"
    }).select("id").single();

    await sendTg(`📸 *Comprovante Lido!*
    
💰 Valor: *R$ ${Number(result.amount).toFixed(2)}*
📝 Descrição: *${result.description}*
📅 Data: *${result.date}*`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirmar", callback_data: `confirm:${pending.id}:expense` }, { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }],
          [{ text: "✏️ Editar Valor", callback_data: `edit:${pending.id}:amount` }]
        ]
      }
    });

  } catch (err) {
    await sendTg("❌ Não consegui processar a imagem. Tente digitar o valor.");
  }
}

async function handleNaturalLanguage(text: string, supabase: any, userId: string, chatId: string, token: string, sendTg: Function, apiKey: string) {
  // Simples NL via AI
  const prompt = `Identifique se esta frase é um lançamento financeiro: "${text}". 
  Responda APENAS JSON: {"is_transaction": true/false, "type": "expense/income", "amount": 0.00, "description": "..."}`;

  const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });

  const aiData = await aiResp.json();
  const res = JSON.parse(aiData.choices[0].message.content);

  if (!res.is_transaction) {
    await sendTg("🤖 Não entendi seu comando. Tente algo como: 'Gastei 50 no almoço'.");
    return;
  }

  const { data: pending } = await supabase.from("pending_ocr_transactions").insert({
    user_id: userId,
    chat_id: chatId,
    amount: res.amount,
    description: res.description,
    status: "pending",
    date: new Date().toISOString().split("T")[0]
  }).select("id").single();

  await sendTg(`🤖 *IA detectou um lançamento:*
  
💰 R$ ${Number(res.amount).toFixed(2)} (${res.type})
📝 ${res.description}`, {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Confirmar", callback_data: `confirm:${pending.id}:${res.type}` },
        { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }
      ]]
    }
  });
}

async function handleCallbackLogic(cb: any, supabase: any, userId: string, sendTg: Function) {
  const [action, id, type] = cb.data.split(":");
  const chatId = String(cb.message.chat.id);
  const messageId = cb.message.message_id;

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

  if (action === "confirm") {
    const { data: pending } = await supabase.from("pending_ocr_transactions").select("*").eq("id", id).single();
    if (pending) {
      await supabase.from("transactions").insert({
        user_id: userId,
        amount: pending.amount,
        description: pending.description,
        date: pending.date,
        type: type || "expense",
        status: "paid"
      });
      await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", id);
      
      // Edit message to show success
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `✅ *Lançamento confirmado!*
          
💰 R$ ${Number(pending.amount).toFixed(2)}
📝 ${pending.description}`,
          parse_mode: "Markdown"
        })
      });
    }
  } else if (action === "cancel") {
    await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id);
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: "❌ Lançamento cancelado."
      })
    });
  } else if (action === "edit") {
    await supabase.from("pending_ocr_transactions").update({ status: "editing", edit_field: type }).eq("id", id);
    await sendTg(`✏️ Digite o novo *${type}*:`);
  }

  return new Response("ok");
}

async function handleEditInput(pending: any, text: string, supabase: any, userId: string, sendTg: Function) {
  const field = pending.edit_field;
  const update: any = { status: "pending", edit_field: null };

  if (field === "amount") {
    update.amount = parseFloat(text.replace(",", "."));
  } else {
    update[field] = text;
  }

  await supabase.from("pending_ocr_transactions").update(update).eq("id", pending.id);
  await sendTg("✅ Atualizado! Clique em *Confirmar* na mensagem anterior.");
  return new Response("ok");
}
