import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TELEGRAM ENGINE V4 - MULTI-TENANT & DEFENSIVE PAYLOAD
 * Architecture:
 * 1. Defensive Payload Parsing (Message, Edited, Callback)
 * 2. Robust ChatID Normalization (String cleaning & DB casting)
 * 3. Strict Multi-tenant Bot Token Isolation
 * 4. Resilient Transaction Processing (AI & BRL normalization)
 * 5. Diagnostic logging & Handshake stability
 */
serve(async (req) => {
  // CORS Handshake
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
  
  // Create Supabase client with Service Role for RLS bypass (needed for multi-tenant profile lookup)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    console.log("[TELEGRAM-V4] Inbound:", rawBody);
    
    if (!rawBody) return new Response("Empty Body", { status: 200 });
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("[TELEGRAM-V4] JSON Parse Error:", e.message);
      return new Response("Invalid JSON", { status: 200 });
    }

    // --- 1. HEALTH CHECK ---
    if (payload.action === "ping") {
      console.log("[TELEGRAM-V4] Health check ping received.");
      return new Response(JSON.stringify({ status: "ok", engine: "v4-multi-tenant" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- 2. DEFENSIVE PAYLOAD PARSING ---
    let telegramChatIdRaw: any = null;
    let telegramUserIdRaw: any = null;
    let messageText: string | null = null;
    let callbackData: string | null = null;
    let callbackQueryId: string | null = null;
    let messageId: number | null = null;

    if (payload.message) {
      telegramChatIdRaw = payload.message.chat?.id;
      telegramUserIdRaw = payload.message.from?.id;
      messageText = payload.message.text || payload.message.caption || null;
      messageId = payload.message.message_id;
    } else if (payload.edited_message) {
      telegramChatIdRaw = payload.edited_message.chat?.id;
      telegramUserIdRaw = payload.edited_message.from?.id;
      messageText = payload.edited_message.text || payload.edited_message.caption || null;
      messageId = payload.edited_message.message_id;
    } else if (payload.callback_query) {
      telegramChatIdRaw = payload.callback_query.message?.chat?.id;
      telegramUserIdRaw = payload.callback_query.from?.id;
      callbackData = payload.callback_query.data;
      callbackQueryId = payload.callback_query.id;
      messageId = payload.callback_query.message?.message_id;
    }

    // --- 3. ROBUST NORMALIZATION ---
    if (!telegramChatIdRaw) {
      console.warn("[TELEGRAM-V4] No Chat ID found in payload.");
      return new Response("No Chat ID", { status: 200 });
    }

    const normalizedChatId = String(telegramChatIdRaw).trim();
    console.log(`[TELEGRAM-V4] Normalized Chat ID: ${normalizedChatId}`);

    // --- 4. MULTI-TENANT PROFILE SEARCH ---
    // Note: We use .eq() but Postgres casting might be needed if types mismatch.
    // In Supabase client, we just pass the string.
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, full_name")
      .eq("telegram_chat_id", normalizedChatId);

    if (pErr) {
      console.error(`[TELEGRAM-V4] DB Error searching profile: ${pErr.message}`);
      return new Response("DB Error", { status: 200 });
    }

    if (!profiles || profiles.length === 0) {
      console.warn(`[TELEGRAM-V4] Chat ID ${normalizedChatId} not linked to any account.`);
      // Try to respond if possible (requires a bot token, but we don't have one linked yet)
      // If we have a global default bot token, we could use it here.
      return new Response("Unauthorized", { status: 200 });
    }

    // If multiple profiles share a chat_id (edge case), we take the first or filter by bot token if available in context
    const profile = profiles[0];
    const userId = profile.user_id;
    const botToken = profile.telegram_bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!botToken) {
      console.error(`[TELEGRAM-V4] No Bot Token linked for user ${userId}`);
      return new Response("No Token", { status: 200 });
    }

    const sendTg = async (text: string, extra: any = {}) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: normalizedChatId, text, parse_mode: "Markdown", ...extra }),
      });
      if (!res.ok) console.error(`[TELEGRAM-V4] TG API Error: ${await res.text()}`);
      return res;
    };

    // --- 5. CALLBACK HANDLER (CONFIRM/CANCEL) ---
    if (callbackData && callbackQueryId) {
      console.log(`[TELEGRAM-V4] Processing callback: ${callbackData}`);
      
      // Answer callback query to stop loading spinner in TG
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      });

      const [action, id, type] = callbackData.split(":");
      
      if (action === "confirm") {
        const { data: pending } = await supabase.from("pending_ocr_transactions").select("*").eq("id", id).single();
        if (pending) {
          const { error: insErr } = await supabase.from("transactions").insert({
            user_id: userId,
            amount: pending.amount,
            description: pending.description,
            date: pending.date,
            type: type || "expense",
            status: "paid"
          });
          
          if (!insErr) {
            await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", id);
            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: normalizedChatId,
                message_id: messageId,
                text: `✅ *Lançamento Confirmado!*\n\n💰 R$ ${Number(pending.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 ${pending.description}`
              })
            });
          } else {
            console.error("[TELEGRAM-V4] Transaction insert error:", insErr);
          }
        }
      } else if (action === "cancel") {
        await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id);
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: normalizedChatId, 
            message_id: messageId, 
            text: "❌ Lançamento descartado com sucesso." 
          })
        });
      }
      return new Response("ok", { status: 200 });
    }

    // --- 6. TEXT PROCESSING (AI ENGINE) ---
    if (messageText) {
      const text = messageText.trim();
      console.log(`[TELEGRAM-V4] Processing text: "${text}"`);

      // Commands
      if (text.startsWith("/saldo")) {
        const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
        const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
        const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*`).join("\n");
        await sendTg(`💰 *Saldo Geral: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n${list || "_Nenhuma conta ativa._"}`);
        return new Response("ok", { status: 200 });
      }

      if (text.startsWith("/start") || text.startsWith("/help")) {
        await sendTg(`👋 Olá ${profile.full_name || ""}!\n\n🤖 *SimplyFin Bot V4 Multi-tenant*\nEstou pronto para registrar suas finanças.\n\n💡 *Exemplos:*\n• "Gastei 50 no mercado"\n• "Recebi 2500 de salário"\n• "35.50 almoço hoje"\n\nCommands: /saldo`);
        return new Response("ok", { status: 200 });
      }

      // AI Recognition
      console.log(`[TELEGRAM-V4] Invoking DeepSeek AI for: "${text}"`);
      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ 
            role: "system",
            content: "Você é um especialista em extração de dados financeiros brasileiros. Identifique valores (convertendo vírgulas para pontos se necessário) e descrições. 'expense' para gastos, 'income' para ganhos. Retorne estritamente JSON."
          }, { 
            role: "user", 
            content: `Analise a mensagem: "${text}". Data atual: ${new Date().toISOString().split('T')[0]}. 
            Extraia o JSON: {"is_transaction": boolean, "type": "expense"|"income", "amount": number, "description": string}` 
          }],
          response_format: { type: "json_object" },
          temperature: 0
        })
      });

      if (!aiResp.ok) {
        console.error(`[TELEGRAM-V4] AI API Error: ${aiResp.status}`);
        await sendTg("⚠️ Minha inteligência está temporariamente indisponível. Tente novamente em instantes.");
        return new Response("ok", { status: 200 });
      }

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (!result.is_transaction || !result.amount) {
        await sendTg("🤔 Não consegui identificar um valor ou despesa nesta mensagem. Poderia ser mais específico? (Ex: 'Gastei 15 no café')");
        return new Response("ok", { status: 200 });
      }

      // Create Pending entry
      const { data: pending, error: pErr } = await supabase.from("pending_ocr_transactions").insert({
        user_id: userId,
        chat_id: normalizedChatId,
        amount: Number(result.amount),
        description: result.description || "Lançamento via Telegram",
        status: "pending",
        date: new Date().toISOString().split("T")[0]
      }).select("id").single();

      if (pErr) {
        console.error(`[TELEGRAM-V4] Pending DB Error: ${pErr.message}`);
        await sendTg("❌ Erro ao processar transação no banco de dados.");
        return new Response("ok", { status: 200 });
      }

      await sendTg(`🤖 *IA SimplyFin detectou:* \n\n💰 *R$ ${Number(result.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n📝 ${result.description}\n🏷️ Tipo: ${result.type === 'income' ? 'Ganho 🟢' : 'Despesa 🔴'}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirmar", callback_data: `confirm:${pending.id}:${result.type}` },
            { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }
          ]]
        }
      });
    } else {
      // Message without text (stickers, locations, etc)
      await sendTg("📸 No momento eu processo apenas texto e recibos (em breve). Envie algo como 'Gastei 20 no almoço'.");
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[TELEGRAM-V4] CRITICAL CRASH:", err.message);
    return new Response("ok", { status: 200 }); // Critical: Handshake 200
  }
});