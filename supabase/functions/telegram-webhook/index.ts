import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TELEGRAM BOT ENGINE V3 - ULTIMATE STABILITY REWRITE
 * Focused on strict VPS compatibility and absolute logging.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
  const CURRENT_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    console.log("[TELEGRAM-INBOUND] Raw Body:", rawBody);
    
    if (!rawBody) return new Response("Empty Body", { status: 200 });

    const body = JSON.parse(rawBody);

    // 1. Health/Ping check from Admin UI
    if (body.action === "ping") {
      return new Response(JSON.stringify({ status: "ok", engine: "v3-stable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Extract Message/Callback
    const message = body.message || body.edited_message;
    const callback = body.callback_query;
    
    if (!message && !callback) {
      console.log("[TELEGRAM-SKIP] No processable content.");
      return new Response("ok");
    }

    const chatId = String(message?.chat?.id || callback?.message?.chat?.id);
    console.log("[TELEGRAM-ID] ChatID Detected:", chatId);

    // 3. Strict User Identification (Multi-tenant safe)
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token, telegram_chat_id")
      .eq("telegram_chat_id", chatId);

    if (pErr) throw new Error(`DB Profile Error: ${pErr.message}`);
    
    // Logic: 
    // 1. Find profile with this bot's token.
    // 2. If not found, find profile with null/default token.
    // 3. Fail if no profile matches this chatId.
    let profile = profiles?.find(p => p.telegram_bot_token === CURRENT_BOT_TOKEN) || 
                  profiles?.find(p => !p.telegram_bot_token || p.telegram_bot_token === "default" || p.telegram_bot_token === "");

    if (!profile && profiles?.length > 0) profile = profiles[0];

    if (!profile) {
      console.warn("[TELEGRAM-UNAUTHORIZED] ChatID not registered in profiles:", chatId);
      return new Response("Unauthorized", { status: 200 });
    }

    const userId = profile.user_id;
    const botToken = CURRENT_BOT_TOKEN || profile.telegram_bot_token;

    // Helper: Send to Telegram
    const sendTg = async (text: string, extra: any = {}) => {
      console.log("[TELEGRAM-OUTBOUND] Sending to:", chatId);
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });
      if (!res.ok) console.error("[TELEGRAM-ERROR] Send failed:", await res.text());
    };

    // 4. Handle Callbacks (Button Confirmations)
    if (callback) {
      const data = callback.data as string;
      const [action, id, type] = data.split(":");
      
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callback.id }),
      });

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
                chat_id: chatId,
                message_id: callback.message.message_id,
                text: `✅ *Lançamento Confirmado!*\n\n💰 R$ ${Number(pending.amount).toFixed(2)}\n📝 ${pending.description}`
              })
            });
          }
        }
      } else if (action === "cancel") {
        await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id);
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: callback.message.message_id, text: "❌ Lançamento descartado." })
        });
      }
      return new Response("ok");
    }

    // 5. Handle Text Messages (AI Logic)
    if (message?.text) {
      const text = message.text.trim();
      
      if (text.startsWith("/saldo")) {
        const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
        const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
        const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toFixed(2)}*`).join("\n");
        await sendTg(`💰 *Saldo Geral: R$ ${total.toFixed(2)}*\n\n${list || "Sem contas."}`);
        return new Response("ok");
      }

      if (text.startsWith("/")) {
        await sendTg("🚀 *FinanceAI Engine V3 Ativa!*\nUse comandos como /saldo ou apenas digite: 'Gastei 50 no posto'");
        return new Response("ok");
      }

      // AI Recognition for simple text
      console.log("[AI-PROCESS] Processing text with DeepSeek:", text);
      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ 
            role: "system",
            content: "Você é um extrator de dados financeiros. Extraia valores monetários e descrições. Para despesas o tipo é 'expense', para ganhos é 'income'. Retorne APENAS JSON."
          }, { 
            role: "user", 
            content: `Analise: "${text}". 
            Retorne um JSON plano com estas chaves (amount deve ser numérico, use ponto para decimal): 
            {"is_transaction": boolean, "type": "expense" ou "income", "amount": number, "description": string}` 
          }],
          response_format: { type: "json_object" },
          temperature: 0
        })
      });

      if (!aiResp.ok) throw new Error("AI API Failure");

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (!result.is_transaction) {
        await sendTg("🤖 Não identifiquei uma despesa. Tente: 'Comprei café por 10 reais'.");
        return new Response("ok");
      }

      // Create Pending for user confirmation
      const { data: pending, error: pErr } = await supabase.from("pending_ocr_transactions").insert({
        user_id: userId,
        chat_id: chatId,
        amount: Number(result.amount),
        description: result.description || "Lançamento via Telegram",
        status: "pending",
        date: new Date().toISOString().split("T")[0]
      }).select("id").single();

      if (pErr) throw pErr;

      await sendTg(`🤖 *IA detectou um lançamento:*\n\n💰 R$ ${Number(result.amount).toFixed(2)}\n📝 ${result.description}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirmar", callback_data: `confirm:${pending.id}:${result.type}` },
            { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }
          ]]
        }
      });
    }

    return new Response("ok");
  } catch (err) {
    console.error("[CRITICAL ERROR V3]", err.message);
    return new Response("ok"); // Always return 200 to Telegram to stop loops
  }
});
