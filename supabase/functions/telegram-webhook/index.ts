import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * TELEGRAM ENGINE V4.3 - MULTI-METHOD & ROBUST CORS
 * Updates:
 * 1. Support for POST, GET, and OPTIONS.
 * 2. Mandatory 200/204 status for OPTIONS (CORS preflight).
 * 3. Fallback message for GET (health check).
 * 4. Refactored response handling to ensure 200 OK to Telegram.
 */
serve(async (req) => {
  // 1. CORS PREFLIGHT HANDSHAKE
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  // 2. GET METHOD (Health Check/Browser View)
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "Telegram Webhook Endpoint Active", engine: "v4.3" }), {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // 3. ONLY PROCESS POST REQUESTS
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rawBody = await req.text();
    console.log("[TELEGRAM-V4.3-INBOUND] Webhook received:", rawBody);
    
    if (!rawBody) {
      return new Response(JSON.stringify({ success: false, message: "Empty body ignored" }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("[TELEGRAM-V4.3] JSON Parse Error:", e.message);
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // --- 4. INTERNAL ACTION HANDLER ---
    if (payload.action === "ping") {
      console.log("[TELEGRAM-V4.3] Action: ping received.");
      return new Response(JSON.stringify({ success: true, status: "ok", engine: "v4.3" }), {
        headers: corsHeaders
      });
    }

    // --- 3. DEFENSIVE PAYLOAD PARSING & STRING CONVERSION ---
    // Explicitly convert Chat ID to String to handle 1000772149 and others safely
    const chatIdStr = String(
      payload.message?.chat?.id || 
      payload.edited_message?.chat?.id || 
      payload.callback_query?.message?.chat?.id || 
      ""
    ).trim();

    if (!chatIdStr) {
      console.warn("[TELEGRAM-V4.1] No Chat ID found in payload.");
      return new Response(JSON.stringify({ success: false, error: "No Chat ID" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log(`[TELEGRAM-V4.3] Normalizing Chat ID to String: "${chatIdStr}"`);

    const telegramUserIdRaw = payload.message?.from?.id || payload.edited_message?.from?.id || payload.callback_query?.from?.id;
    const messageText = payload.message?.text || payload.message?.caption || payload.edited_message?.text || payload.edited_message?.caption || null;
    const callbackData = payload.callback_query?.data || null;
    const callbackQueryId = payload.callback_query?.id || null;
    const messageId = payload.message?.message_id || payload.edited_message?.message_id || payload.callback_query?.message?.message_id || null;

    // --- 4. MULTI-TENANT PROFILE SEARCH (Bypass RLS via Service Role) ---
    // If it's a /start command with a token, we handle authentication/linking
    if (messageText?.startsWith("/start ")) {
      const linkCode = messageText.split(" ")[1];
      console.log(`[TELEGRAM-V4.4] Linking attempt with code: ${linkCode}`);
      
      const { data: linkProfile, error: linkErr } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("telegram_link_code", linkCode)
        .single();

      if (linkErr || !linkProfile) {
        console.warn(`[TELEGRAM-V4.4] Invalid link code: ${linkCode}`);
        const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: chatIdStr, 
            text: "❌ Código de vinculação inválido ou expirado. Por favor, gere um novo código no painel web.",
            parse_mode: "Markdown"
          }),
        });
        return new Response(JSON.stringify({ success: false, error: "Invalid link code" }), { status: 200, headers: corsHeaders });
      }

      // Update profile with chat_id and clear link_code
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: chatIdStr, telegram_link_code: null })
        .eq("user_id", linkProfile.user_id);

      if (updErr) {
        console.error(`[TELEGRAM-V4.4] Error updating profile: ${updErr.message}`);
        return new Response(JSON.stringify({ success: false, error: "Update profile error" }), { status: 200, headers: corsHeaders });
      }

      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: chatIdStr, 
          text: `✅ *Conta Vinculada com Sucesso!*\n\nOlá ${linkProfile.display_name || "usuário"}! Seu Telegram agora está conectado ao *SimplyFin*.\n\nAgora você pode registrar despesas enviando mensagens como: "Gastei 50 no mercado".`,
          parse_mode: "Markdown"
        }),
      });

      return new Response(JSON.stringify({ success: true, message: "Profile linked" }), { status: 200, headers: corsHeaders });
    }

    // Normal profile search for registered users - MULTI-TENANT ISOLATION
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("telegram_chat_id", chatIdStr)
      .single();

    if (pErr || !profile) {
      if (pErr && pErr.code !== "PGRST116") {
        console.error(`[TELEGRAM-V5.0] DB Error: ${pErr.message}`);
      }
      console.warn(`[TELEGRAM-V5.0] Chat ID "${chatIdStr}" not linked. Sending guest message.`);
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_id: chatIdStr, 
          text: "👋 Olá! Identificamos que seu Telegram ainda não está vinculado ao *SimplyFin*.\n\nPara começar a usar o bot, acesse o painel web em https://fin.t2systems.com.br, vá em Configurações e clique em *Conectar Telegram*.",
          parse_mode: "Markdown"
        }),
      });
      return new Response(JSON.stringify({ success: false, error: "Unauthorized Chat ID" }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    const userId = profile.user_id;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!botToken) {
      console.error(`[TELEGRAM-V5.0] Global TELEGRAM_BOT_TOKEN missing in env`);
      return new Response(JSON.stringify({ success: false, error: "Global Bot Token Missing" }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    const sendTg = async (text: string, extra: any = {}) => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatIdStr, text, parse_mode: "Markdown", ...extra }),
      });
      if (!res.ok) console.error(`[TELEGRAM-V5.0] TG API Error: ${await res.text()}`);
      return res;
    };

    // --- 5. CALLBACK HANDLER ---
    if (callbackData && callbackQueryId) {
      console.log(`[TELEGRAM-V5.0] Processing callback: ${callbackData} for user ${userId}`);
      
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      });

      const [action, id] = callbackData.split(":");
      
      if (action === "confirm") {
        const { data: pending } = await supabase
          .from("pending_ocr_transactions")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId) // STRICT ISOLATION
          .single();

        if (pending) {
          const { error: insErr } = await supabase.from("transactions").insert({
            user_id: userId,
            amount: pending.amount,
            description: pending.description,
            date: pending.date,
            type: pending.type || "expense",
            status: "paid"
          });
          
          if (!insErr) {
            await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", id).eq("user_id", userId);
            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatIdStr,
                message_id: messageId,
                text: `✅ *Lançamento Confirmado!*\n\n💰 R$ ${Number(pending.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 ${pending.description}`
              })
            });
          }
        }
      } else if (action === "cancel") {
        await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id).eq("user_id", userId);
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: chatIdStr, 
            message_id: messageId, 
            text: "❌ Lançamento descartado com sucesso." 
          })
        });
      }
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // --- 6. TEXT PROCESSING (AI ENGINE) ---
    if (messageText) {
      const text = messageText.trim();
      
      if (text.startsWith("/saldo")) {
        const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
        const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
        const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*`).join("\n");
        await sendTg(`💰 *Saldo Geral: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n${list || "_Nenhuma conta ativa._"}`);
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      if (text.startsWith("/start") || text.startsWith("/help")) {
        await sendTg(`👋 Olá ${profile.display_name || ""}!\n\n🤖 *SimplyFin Bot V5.0*\nEstou pronto para registrar suas finanças.\n\n💡 *Exemplos:*\n• "Gastei 50 no mercado"\n• "Recebi 2500 de salário"\n\nCommands: /saldo`);
        return new Response(JSON.stringify({ success: true }), { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      console.log(`[TELEGRAM-V5.0] AI Analysis for user ${userId}: "${text}"`);
      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ 
            role: "system",
            content: "Extraia dados financeiros brasileiros. 'expense' ou 'income'. Retorne JSON puro."
          }, { 
            role: "user", 
            content: `Analise: "${text}". Data: ${new Date().toISOString().split('T')[0]}. JSON: {"is_transaction": boolean, "type": "expense"|"income", "amount": number, "description": string}` 
          }],
          response_format: { type: "json_object" },
          temperature: 0
        })
      });

      if (!aiResp.ok) {
        await sendTg("⚠️ Minha inteligência está instável. Tente novamente.");
        return new Response(JSON.stringify({ success: false, error: "AI API Failure" }), { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (result.is_transaction && result.amount) {
        const { data: pending, error: insErr } = await supabase.from("pending_ocr_transactions").insert({
          user_id: userId,
          chat_id: chatIdStr,
          amount: Number(result.amount),
          description: result.description || "Lançamento via Telegram",
          status: "pending",
          type: result.type || "expense",
          date: new Date().toISOString().split("T")[0]
        }).select("id").single();

        if (insErr) {
          console.error(`[TELEGRAM-V5.0] Insert Pending Error: ${insErr.message}`);
          await sendTg("⚠️ Erro ao preparar o lançamento. Tente novamente.");
          return new Response(JSON.stringify({ success: false }), { status: 200, headers: corsHeaders });
        }

        const valorFormatado = Number(result.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const emoji = result.type === 'income' ? '📈' : '📉';
        const label = result.type === 'income' ? 'Receita' : 'Despesa';

        const message = `${emoji} ${label} detectada — Confirme:\n\n💰 Valor: R$ ${valorFormatado}\n📝 Descrição: ${result.description}\n📅 Data: ${new Date().toISOString().split('T')[0]}\n🏷️ Categoria: Sem categoria\n🏦 Conta: Sem conta`;

        await sendTg(message, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Confirmar", callback_data: `confirm:${pending.id}` },
                { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }
              ],
              [
                { text: "✏️ Categoria", callback_data: `edit_cat:${pending.id}` },
                { text: "✏️ Conta", callback_data: `edit_acc:${pending.id}` }
              ],
              [
                { text: "✏️ Valor", callback_data: `edit_val:${pending.id}` },
                { text: "✏️ Descrição", callback_data: `edit_desc:${pending.id}` }
              ]
            ]
          }
        });
      } else {
        await sendTg("🤔 Não entendi o valor ou despesa. Tente: 'Gastei 15 no café'");
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (err) {
    console.error("[TELEGRAM-V5.0] GLOBAL CRITICAL ERROR:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
      status: 200, 
      headers: corsHeaders 
    });
  }
});