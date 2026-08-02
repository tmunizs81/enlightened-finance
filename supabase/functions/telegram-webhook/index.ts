import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "https://difwlzancpnvwkiyhmll.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
      });
    } catch (e) {
      console.error("Failed to send telegram message:", e);
    }
  };

  const editTelegramMessage = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
      });
    } catch (e) {
      console.error("Failed to edit telegram message:", e);
    }
  };

  const answerCallback = async (callbackQueryId: string, text?: string) => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
      });
    } catch (e) {
      console.error("Failed to answer callback:", e);
    }
  };

  let targetChatId: string | null = null;

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (body.message?.chat?.id) targetChatId = String(body.message.chat.id);
    if (body.callback_query?.message?.chat?.id) targetChatId = String(body.callback_query.message.chat.id);

    // 1. HANDLE BUTTON CLICKS (CALLBACK QUERIES)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data || '');

      await answerCallback(cb.id, "Processando...");

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`telegram_chat_id.eq.${chatId},telegram_chat_id.eq.${Number(chatId)}`)
        .maybeSingle();

      if (!profile?.user_id) {
        await editTelegramMessage(chatId, messageId, "⚠️ Usuário não vinculado ao Telegram.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const userId = profile.user_id;
      const parts = data.split('|');
      const action = parts[0];

      if (action === 'c') {
        const type = parts[1] === 'I' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const description = parts.slice(3).join('|') || 'Lançamento Telegram';

        const { error: insErr } = await supabase.from('transactions').insert({
          user_id: userId,
          type: type,
          amount: amount,
          description: description,
          date: new Date().toISOString()
        });

        if (insErr) {
          await editTelegramMessage(chatId, messageId, `❌ *Erro ao salvar no banco:* ${insErr.message}`);
        } else {
          await editTelegramMessage(
            chatId,
            messageId,
            `✅ *Lançamento confirmado e salvo com sucesso!*\n\n💰 *Valor:* R$ ${amount.toFixed(2)}\n📝 *Descrição:* ${description}`
          );
        }
      } else if (action === 'x') {
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      } else {
        await editTelegramMessage(chatId, messageId, "ℹ️ Envie uma nova mensagem com o lançamento corrigido.");
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. HANDLE TEXT MESSAGES
    const message = body.message || body.edited_message;
    if (!message) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    const chatId = String(message.chat.id).trim();
    const text = message.text || "";

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`telegram_chat_id.eq.${chatId},telegram_chat_id.eq.${Number(chatId)}`)
      .maybeSingle();

    if (!profile?.user_id) {
      await sendTelegram(chatId, `⚠️ *Telegram não vinculado.*\nSeu Chat ID é: \`${chatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie um valor e descrição, ex: `despesa 1.00 agua`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const isIncome = /^receita/i.test(text);
    const amountMatch = text.match(/(\d+[\.,]?\d*)/);
    let amount = 0;
    if (amountMatch) amount = parseFloat(amountMatch[1].replace(',', '.'));

    let description = text
      .replace(/^despesa/i, '')
      .replace(/^receita/i, '')
      .replace(amountMatch ? amountMatch[0] : '', '')
      .trim();

    if (!description) description = "Lançamento Telegram";

    const typeCode = isIncome ? 'I' : 'E';
    const payload = `c|${typeCode}|${amount}|${description}`;

    const cardText =
      `${isIncome ? '📈 *Receita*' : '📉 *Despesa*'} detectada — Confirme:\n\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
      `📝 *Descrição:* ${description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: payload },
          { text: "❌ Cancelar", callback_data: "x|cancel" }
        ]
      ]
    };

    await sendTelegram(chatId, cardText, inlineKeyboard);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Fatal Webhook Error:", err);
    if (targetChatId) {
      await sendTelegram(targetChatId, `🚨 *Erro na Edge Function:* \`${err.message}\``);
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});
