import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * TELEGRAM ENGINE V6.0 - BANK-GRADE ISOLATION & RACE PROTECTION
 * Updates:
 * 1. Atomic updates for race condition protection.
 * 2. Strict multi-tenant isolation via service role verification.
 * 3. Support for income/expense dynamics.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "Telegram Webhook Active", engine: "v6.0" }), {
      status: 200,
      headers: corsHeaders
    });
  }

  let payload: any = null;
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const rawBody = await req.text();
    if (!rawBody) return new Response(null, { status: 200, headers: corsHeaders });

    payload = JSON.parse(rawBody);

    const chatIdStr = String(
      payload.message?.chat?.id || 
      payload.edited_message?.chat?.id || 
      payload.callback_query?.message?.chat?.id || 
      ""
    ).trim();

    if (!chatIdStr) return new Response(null, { status: 200, headers: corsHeaders });

    const messageText = payload.message?.text || payload.message?.caption || payload.edited_message?.text || payload.edited_message?.caption || null;
    const callbackData = payload.callback_query?.data || null;
    const callbackQueryId = payload.callback_query?.id || null;
    const messageId = payload.message?.message_id || payload.edited_message?.message_id || payload.callback_query?.message?.message_id || null;

    const sendTg = async (text: string, extra: any = {}) => {
      return await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatIdStr, text, parse_mode: "Markdown", ...extra }),
      });
    };

    // 1. LINKING HANDLER (/start TOKEN)
    if (messageText?.startsWith("/start ")) {
      const linkCode = messageText.split(" ")[1];
      const { data: profile } = await supabase.from("profiles").select("user_id, name").eq("telegram_link_code", linkCode).single();

      if (!profile) {
        await sendTg("❌ Código de vinculação inválido ou expirado.");
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      await supabase.from("profiles").update({ telegram_chat_id: chatIdStr, telegram_link_code: null }).eq("user_id", profile.user_id);
      await sendTg(`✅ *Conta Vinculada!* Olá ${profile.name || "usuário"}.`);
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // 2. AUTHENTICATION (ISOLATION)
    const { data: profile, error: profileErr } = await supabase.from("profiles").select("user_id, name").eq("telegram_chat_id", chatIdStr).single();
    
    if (profileErr || !profile) {
      await sendTg("⚠️ Seu Telegram não está vinculado a nenhuma conta no *T2-SimplyFin*.\n\nPara vincular:\n1. Vá em *Configurações* no painel web.\n2. Clique em *Conectar Telegram*.\n3. Envie o código gerado aqui.");
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    const userId = profile.user_id;

    // 3. CALLBACK HANDLER (Atomic Actions)
    if (callbackData && callbackQueryId) {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      });

      const [action, id] = callbackData.split(":");
      
      if (action === "confirm") {
        // RACE CONDITION PROTECTION: Atomic status update
        const { data: pending, error: updError } = await supabase
          .from("pending_ocr_transactions")
          .update({ status: "confirmed" })
          .eq("id", id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .select()
          .single();

        if (updError || !pending) {
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatIdStr, message_id: messageId, text: "⚠️ Esta transação já foi processada." })
          });
          return new Response(null, { status: 200, headers: corsHeaders });
        }

        // INTEGRITY CHECK: Cross-user data prevention
        if (pending.category_id) {
          const { data: cat } = await supabase.from("categories").select("id").eq("id", pending.category_id).eq("user_id", userId).single();
          if (!cat) pending.category_id = null;
        }
        if (pending.account_id) {
          const { data: acc } = await supabase.from("accounts").select("id").eq("id", pending.account_id).eq("user_id", userId).single();
          if (!acc) pending.account_id = null;
        }

        const { error: insErr } = await supabase.from("transactions").insert({
          user_id: userId,
          amount: pending.amount,
          description: pending.description,
          date: pending.date,
          type: pending.type || "expense",
          status: "paid",
          category_id: pending.category_id,
          account_id: pending.account_id
        });
        
        if (!insErr) {
          const emoji = pending.type === 'income' ? '📈' : '✅';
          const label = pending.type === 'income' ? 'Receita' : 'Despesa';
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatIdStr,
              message_id: messageId,
              text: `${emoji} *${label} Confirmada!*\n\n💰 R$ ${Number(pending.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 ${pending.description}`
            })
          });
        } else {
          await supabase.from("pending_ocr_transactions").update({ status: "pending" }).eq("id", id).eq("user_id", userId);
          await sendTg("❌ Erro ao salvar transação.");
        }
      } else if (action === "cancel") {
        await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", id).eq("user_id", userId);
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatIdStr, message_id: messageId, text: "❌ Lançamento descartado." })
        });
      }
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // 4. TEXT PROCESSING (AI)
    if (messageText) {
      const text = messageText.trim();
      if (text.startsWith("/saldo")) {
        const { data: accs } = await supabase.from("accounts").select("name, balance").eq("user_id", userId).eq("status", "active");
        const total = accs?.reduce((s: number, a: any) => s + Number(a.balance), 0) || 0;
        const list = accs?.map((a: any) => `• ${a.name}: *R$ ${Number(a.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*`).join("\n");
        await sendTg(`💰 *Saldo Geral: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n${list || "_Nenhuma conta ativa._"}`);
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { 
              role: "system", 
              content: "Extraia dados financeiros brasileiros. Retorne APENAS JSON: {is_transaction: boolean, type: 'expense'|'income', amount: number, description: string}. Se não for uma transação clara ou o valor for zero, is_transaction deve ser false." 
            }, 
            { role: "user", content: text }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!aiResp.ok) {
        await sendTg("⚠️ Falha ao processar com IA. Tente algo como: '50,00 gasolina'");
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (result.is_transaction && result.amount && result.amount > 0) {
        const { data: pending, error: pendingErr } = await supabase.from("pending_ocr_transactions").insert({
          user_id: userId,
          chat_id: chatIdStr,
          amount: result.amount,
          description: result.description || "Transação via Telegram",
          status: "pending",
          type: result.type || "expense",
          date: new Date().toISOString().split("T")[0]
        }).select("id").single();

        if (pendingErr || !pending) {
          await sendTg("❌ Erro ao preparar transação.");
          return new Response(null, { status: 200, headers: corsHeaders });
        }

        const emoji = result.type === 'income' ? '📈' : '📉';
        const label = result.type === 'income' ? 'Receita' : 'Despesa';
        
        await sendTg(`${emoji} ${label} detectada — Confirme:\n\n💰 Valor: R$ ${Number(result.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 Descrição: ${result.description || "Sem descrição"}\n📅 Data: ${new Date().toISOString().split("T")[0]}\n🏷️ Categoria: Sem categoria\n🏦 Conta: Sem conta`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Confirmar", callback_data: `confirm:${pending.id}` }, { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }],
              [{ text: "✏️ Categoria", callback_data: `edit_cat:${pending.id}` }, { text: "✏️ Conta", callback_data: `edit_acc:${pending.id}` }],
              [{ text: "✏️ Valor", callback_data: `edit_val:${pending.id}` }, { text: "✏️ Descrição", callback_data: `edit_desc:${pending.id}` }]
            ]
          }
        });
      } else {
        // Fallback instructions
        await sendTg("🤖 Não identifiquei uma despesa ou receita nessa mensagem.\n\n*Como usar:*\n• `50,00 gasolina`\n• `Recebi 2000 pix`\n• `Almoço 35,90`\n\nOu use `/saldo` para ver suas contas.");
      }
    } else {
      // No text and no callback (maybe a document or photo without caption)
      await sendTg("🧐 Recebi sua mensagem, mas não consegui processá-la. Envie um texto com o valor ou uma foto do comprovante.");
    }

    return new Response(null, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Telegram Webhook Error:", err);
    // Explicit error response to Telegram chat if possible
    try {
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const errorChatId = chatIdStr || payload?.message?.chat?.id || payload?.callback_query?.message?.chat?.id;
      
      if (botToken && errorChatId) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            chat_id: errorChatId, 
            text: "⚠️ Ocorreu um erro interno ao processar sua mensagem. Por favor, tente novamente em instantes." 
          }),
        });
      }
    } catch (sendErr) {
      console.error("Failed to send fallback error to Telegram:", sendErr);
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});