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

    // Normalized update structure
    const message = body.message || body.edited_message;
    const callback = body.callback_query;

    if (!message && !callback) return new Response("ok");

    const chatId = String(message?.chat?.id || callback?.message?.chat?.id);
    if (!chatId) return new Response("ok");

    // 2. Identify User Profile with Strict Isolation
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, telegram_chat_id")
      .eq("telegram_chat_id", chatId)
      .limit(10);

    if (pErr) throw new Error(`Profile lookup failed: ${pErr.message}`);

    // Find best match: specific token match or global match
    let profile = profiles?.find(p => p.telegram_bot_token === CURRENT_BOT_TOKEN);
    if (!profile) {
      profile = profiles?.find(p => !p.telegram_bot_token || p.telegram_bot_token === "default" || p.telegram_bot_token === "");
    }
    if (!profile && profiles && profiles.length > 0) {
      profile = profiles[0];
    }

    if (!profile) {
      console.warn("[SECURITY] Unauthorized Chat ID:", chatId);
      return new Response(JSON.stringify({ error: "Unauthorized", id: chatId }), { status: 200 });
    }

    const userId = profile.user_id;
    const userBotToken = profile.telegram_bot_token || CURRENT_BOT_TOKEN;

    if (!userBotToken) throw new Error("Missing Bot Token");

    // Helper: Send Message
    const sendTg = async (text: string, extra: any = {}) => {
      await fetch(`https://api.telegram.org/bot${userBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });
    };

    // Router
    if (callback) {
      await fetch(`https://api.telegram.org/bot${userBotToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id }),
      });
      return await handleCallbackLogic(callback, supabase, userId, sendTg, userBotToken);
    }

    if (message.photo || (message.document && message.document.mime_type?.startsWith("image/"))) {
      await sendTg("🔍 *Analisando comprovante...*");
      return await handleVisionOCR(message, supabase, userId, userBotToken, chatId, sendTg, GROQ_API_KEY || DEEPSEEK_API_KEY);
    }

    if (message.text) {
      const text = message.text.trim();
      
      // Check for edit mode
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

async function handleCommands(text: string, supabase: any, userId: string, sendTg: Function) {
  const parts = text.split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  if (cmd === "/saldo") {
    const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
    const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
    const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toFixed(2)}*`).join("\n");
    await sendTg(`💰 *Saldo Total:* R$ ${total.toFixed(2)}\n\n${list || "Nenhuma conta ativa."}`);
  } else if (cmd === "/despesa" || cmd === "/receita") {
    await handleQuickEntry(cmd === "/despesa" ? "expense" : "income", args, supabase, userId, sendTg);
  } else {
    await sendTg("🚀 *FinanceAI Online!* Use /saldo, /despesa ou envie uma foto.");
  }
  return new Response("ok");
}

async function handleQuickEntry(type: "expense" | "income", args: string, supabase: any, userId: string, sendTg: Function) {
  const match = args?.match(/^([\d.,]+)\s+(.+)/);
  if (!match) return await sendTg(`❌ Use: /${type} 10.50 Descrição`);
  
  const amount = parseFloat(match[1].replace(",", "."));
  const { data: pending } = await supabase.from("pending_ocr_transactions").insert({
    user_id: userId, amount, description: match[2], status: "pending", date: new Date().toISOString().split("T")[0]
  }).select("id").single();

  await sendTg(`📋 *Confirmar ${type === 'income' ? 'Receita' : 'Despesa'}?*\n\n💰 R$ ${amount.toFixed(2)}\n📝 ${match[2]}`, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Sim", callback_data: `confirm:${pending.id}:${type}` }, { text: "❌ Não", callback_data: `cancel:${pending.id}` }]] }
  });
}

async function handleVisionOCR(message: any, supabase: any, userId: string, token: string, chatId: string, sendTg: Function, apiKey: string) {
  try {
    const fileId = message.photo ? message.photo[message.photo.length - 1].file_id : message.document.file_id;
    const file = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json());
    const bytes = await fetch(`https://api.telegram.org/file/bot${token}/${file.result.file_path}`).then(r => r.arrayBuffer());
    
    // Convert to base64
    const u8 = new Uint8Array(bytes);
    let binary = "";
    for (let i = 0; i < u8.length; i += 8192) binary += String.fromCharCode.apply(null, u8.subarray(i, i + 8192) as any);
    const base64 = btoa(binary);

    const aiResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [{ role: "user", content: [{ type: "text", text: "Extraia: amount (number), description, date (YYYY-MM-DD). JSON puro." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }] }],
        response_format: { type: "json_object" }
      })
    });

    const res = JSON.parse((await aiResp.json()).choices[0].message.content);
    const { data: pending } = await supabase.from("pending_ocr_transactions").insert({
      user_id: userId, chat_id: chatId, amount: res.amount, description: res.description, date: res.date || new Date().toISOString().split("T")[0], status: "pending"
    }).select("id").single();

    await sendTg(`📸 *Detectado:* R$ ${Number(res.amount).toFixed(2)}\n📝 ${res.description}`, {
      reply_markup: { inline_keyboard: [[{ text: "✅ Confirmar", callback_data: `confirm:${pending.id}:expense` }, { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }]] }
    });
  } catch { await sendTg("❌ Falha no OCR. Tente digitar o valor."); }
}

async function handleNaturalLanguage(text: string, supabase: any, userId: string, chatId: string, token: string, sendTg: Function, apiKey: string) {
  const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: `Analise: "${text}". Retorne JSON: {"is_transaction": bool, "type": "expense/income", "amount": number, "description": string}` }],
      response_format: { type: "json_object" }
    })
  });

  const res = JSON.parse((await aiResp.json()).choices[0].message.content);
  if (!res.is_transaction) return await sendTg("🤖 Não entendi. Tente: 'Gastei 50 no almoço'.");

  const { data: pending, error: pErr } = await supabase.from("pending_ocr_transactions").insert({
    user_id: userId, chat_id: String(chatId), amount: res.amount, description: res.description, status: "pending", date: new Date().toISOString().split("T")[0]
  }).select("id").single();

  if (pErr) throw pErr;

  await sendTg(`🤖 *IA detectou:* R$ ${Number(res.amount).toFixed(2)}\n📝 ${res.description}`, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Sim", callback_data: `confirm:${pending.id}:${res.type}` }, { text: "❌ Não", callback_data: `cancel:${pending.id}` }]] }
  });
}

async function handleCallbackLogic(cb: any, supabase: any, userId: string, sendTg: Function, token: string) {
  const [action, id, type] = cb.data.split(":");
  const chatId = String(cb.message.chat.id);
  
  if (action === "confirm") {
    const { data: pending } = await supabase.from("pending_ocr_transactions").select("*").eq("id", id).single();
    if (pending) {
      await supabase.from("transactions").insert({ user_id: userId, amount: pending.amount, description: pending.description, date: pending.date, type: type || "expense", status: "paid" });
      await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", id);
      await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: cb.message.message_id, text: `✅ *Salvo!* R$ ${Number(pending.amount).toFixed(2)} - ${pending.description}` })
      });
    }
  } else if (action === "cancel") {
    await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id);
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: cb.message.message_id, text: "❌ Cancelado." })
    });
  }
  return new Response("ok");
}

async function handleEditInput(pending: any, text: string, supabase: any, userId: string, sendTg: Function) {
  const update: any = { status: "pending", edit_field: null };
  if (pending.edit_field === "amount") update.amount = parseFloat(text.replace(",", "."));
  else update[pending.edit_field] = text;
  await supabase.from("pending_ocr_transactions").update(update).eq("id", pending.id);
  await sendTg("✅ Atualizado! Confirme na mensagem anterior.");
  return new Response("ok");
}
