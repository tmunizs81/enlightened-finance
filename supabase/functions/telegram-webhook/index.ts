import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      }),
    });
  };

  const answerCallback = async (callbackQueryId: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  };

  const editTelegramMessage = async (chatId: string | number, messageId: number, text: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown'
      }),
    });
  };

  try {
    const body = await req.json();
    const callbackQuery = body.callback_query;
    const message = body.message || body.edited_message;
    const chatIdRaw = message?.chat?.id || callbackQuery?.message?.chat?.id || body.chat_id;
    
    if (!chatIdRaw) return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });
    
    const cleanChatId = String(chatIdRaw).trim();

    // Flexible User Search
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, name')
      .or(`telegram_chat_id.eq.${cleanChatId},telegram_chat_id.eq.${Number(cleanChatId)}`)
      .maybeSingle();

    if (!profile) {
      await sendTelegram(cleanChatId, `⚠️ *Atenção:* Seu Telegram não está vinculado.\nID: \`${cleanChatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 1. DATABASE INSERTION ON "CONFIRMAR" CLICK
    if (callbackQuery) {
      const data = callbackQuery.data; // Format: confirm|TYPE|AMOUNT|DESC
      await answerCallback(callbackQuery.id);
      const msgId = callbackQuery.message.message_id;

      if (data.startsWith("confirm|")) {
        const [_, type, amountStr, ...descParts] = data.split("|");
        const description = descParts.join("|");
        const amount = parseFloat(amountStr);

        const { error: insErr } = await supabase
          .from('transactions')
          .insert({
            user_id: profile.user_id,
            type: type.toLowerCase() === 'income' ? 'income' : 'expense',
            amount: amount,
            description: description || "Lançamento via Telegram",
            date: new Date().toISOString(),
            status: 'confirmed'
          });

        if (insErr) {
          console.error("Insert error:", insErr);
          await editTelegramMessage(cleanChatId, msgId, `❌ *Erro ao salvar:* ${insErr.message}`);
        } else {
          await editTelegramMessage(cleanChatId, msgId, "✅ *Lançamento confirmado e registrado com sucesso!*");
        }
      } else if (data.startsWith("cancel|")) {
        await editTelegramMessage(cleanChatId, msgId, "❌ *Lançamento cancelado.*");
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. REAL TEXT PARSER
    const text = message?.text || body.text || "";
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, "👋 *Bem-vindo!*\nEnvie: `despesa 1,13 agua` ou `receita 2500 freela`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Logic to parse "despesa 1,13 agua" or "receita 50 pizza"
    let type = 'expense';
    let amount = 0;
    let description = text;

    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase();
      if (first === 'despesa' || first === 'receita') {
        type = first === 'receita' ? 'income' : 'expense';
        const amountStr = parts[1].replace(',', '.');
        amount = parseFloat(amountStr) || 0;
        description = parts.slice(2).join(' ') || text;
      } else {
        // Handle direct "10.50 lunch"
        const amountStr = parts[0].replace(',', '.');
        const parsedAmount = parseFloat(amountStr);
        if (!isNaN(parsedAmount)) {
          amount = parsedAmount;
          description = parts.slice(1).join(' ') || text;
        }
      }
    }

    const cardText = 
      `📉 *${type === 'income' ? 'Receita' : 'Despesa'} detectada — Confirme:*\\n\\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\\n` +
      `📝 *Descrição:* ${description}\\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}`;

    // 3. DRAFT STATE ENCODING in callback_data
    const callbackData = `confirm|${type.toUpperCase()}|${amount}|${description.substring(0, 30)}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: callbackData },
          { text: "❌ Cancelar", callback_data: `cancel|draft` }
        ],
        [
          { text: "✏️ Categoria", callback_data: `edit_cat` },
          { text: "✏️ Conta", callback_data: `edit_acc` }
        ]
      ]
    };

    await sendTelegram(cleanChatId, cardText, inlineKeyboard);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
