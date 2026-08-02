import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const sendTelegram = async (chatId: string | number, text: string, replyMarkup?: any) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      }),
    });
  };

  const editTelegramMessage = async (chatId: string | number, messageId: number, text: string, replyMarkup?: any) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      }),
    });
  };

  const answerCallbackQuery = async (callbackQueryId: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  };

  try {
    const body = await req.json();
    console.log("Recebido Webhook Payload:", JSON.stringify(body));

    const message = body.message || body.edited_message;
    const callbackQuery = body.callback_query;
    
    const chatIdRaw = message?.chat?.id || callbackQuery?.message?.chat?.id || body.chat_id;
    if (!chatIdRaw) {
      return new Response(JSON.stringify({ error: "Missing chat_id" }), { status: 400, headers: corsHeaders });
    }
    const chatId = String(chatIdRaw).trim();
    const text = message?.text || body.text || "";

    // 1. Busca do Usuário (Vinculação Fix)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id, name')
      .or(`telegram_chat_id.eq.${chatId},telegram_chat_id.eq.${Number(chatId) || 0}`)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("Usuário não encontrado para o chat_id:", chatId);
      await sendTelegram(chatId, 
        `⚠️ *Atenção:* Seu Telegram não está vinculado a nenhuma conta no T2-SimplyFin.\n\n` +
        `Seu ID do Telegram é: \`${chatId}\`\n` +
        `Copie esse ID e vincule-o no painel em Configurações.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const userId = profile.user_id;

    // 2. Tratamento de Cliques nos Botões (callback_query)
    if (callbackQuery) {
      await answerCallbackQuery(callbackQuery.id);
      const callbackData = callbackQuery.data;
      const msgId = callbackQuery.message.message_id;

      if (callbackData.startsWith('confirm_')) {
        const expenseId = callbackData.replace('confirm_', '');
        const { data: pending } = await supabase.from('pending_ocr_transactions').select('*').eq('id', expenseId).eq('user_id', userId).single();
        
        if (pending) {
          const { error: insErr } = await supabase.from('transactions').insert({
            user_id: userId,
            amount: pending.amount,
            description: pending.description,
            date: pending.date || new Date().toISOString().split('T')[0],
            type: pending.type || 'expense',
            status: 'paid'
          });

          if (!insErr) {
            await supabase.from('pending_ocr_transactions').update({ status: 'confirmed' }).eq('id', expenseId);
            await editTelegramMessage(chatId, msgId, "✅ *Despesa confirmada com sucesso!*");
          }
        }
      } else if (callbackData.startsWith('cancel_')) {
        const expenseId = callbackData.replace('cancel_', '');
        await supabase.from('pending_ocr_transactions').update({ status: 'cancelled' }).eq('id', expenseId);
        await editTelegramMessage(chatId, msgId, "❌ *Lançamento cancelado.*");
      } else if (callbackData.startsWith('edit_')) {
        const field = callbackData.split('_')[1];
        await sendTelegram(chatId, `✏️ Digite o novo valor para *${field}*:`);
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 3. Comandos /start ou /test
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId, `👋 *Olá ${profile.name || ''}!* Envie uma despesa (ex: 50 pizza) para começar.`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (body.type === "test" || text === "/test") {
      await sendTelegram(chatId, "✅ *T2-SimplyFin — Conexão testada com sucesso!*");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 4. Processamento de Lançamento (IA)
    if (text && DEEPSEEK_API_KEY) {
      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Extraia: {is_transaction: bool, type: 'expense'|'income', amount: float, description: string}. JSON apenas." },
            { role: "user", content: text }
          ],
          response_format: { type: "json_object" }
        })
      });

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (result.is_transaction && result.amount > 0) {
        const { data: pending } = await supabase.from('pending_ocr_transactions').insert({
          user_id: userId,
          amount: result.amount,
          description: result.description || "Lançamento via Telegram",
          type: result.type || 'expense',
          status: 'pending',
          date: new Date().toISOString().split('T')[0]
        }).select('id').single();

        // 5. Card de Despesa (Layout Idêntico à Imagem)
        const markdown = `📉 *Despesa detectada — Confirme:*\n\n💰 *Valor:* R$ ${Number(result.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 *Descrição:* ${result.description || "Sem descrição"}\n📅 *Data:* ${new Date().toISOString().split('T')[0]}\n🏷️ *Categoria:* Sem categoria\n🏦 *Conta:* Sem conta`;

        // 6. Botões Interativos (3x2)
        const replyMarkup = {
          inline_keyboard: [
            [ { text: "✅ Confirmar", callback_data: `confirm_${pending.id}` }, { text: "❌ Cancelar", callback_data: `cancel_${pending.id}` } ],
            [ { text: "✏️ Categoria", callback_data: `edit_cat_${pending.id}` }, { text: "✏️ Conta", callback_data: `edit_acc_${pending.id}` } ],
            [ { text: "✏️ Valor", callback_data: `edit_val_${pending.id}` }, { text: "✏️ Descrição", callback_data: `edit_desc_${pending.id}` } ]
          ]
        };

        await sendTelegram(chatId, markdown, replyMarkup);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Erro interno no Webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});