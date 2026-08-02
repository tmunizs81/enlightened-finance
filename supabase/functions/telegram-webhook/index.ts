import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // FIXED TOKEN AS FALLBACK
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "https://difwlzancpnvwkiyhmll.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    try {
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
    } catch (e) {
      console.error("Error sending message to Telegram:", e);
    }
  };

  const editTelegram = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        }),
      });
    } catch (e) {
      console.error("Error editing message on Telegram:", e);
    }
  };

  const answerCallback = async (callbackQueryId: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  };

  try {
    const body = await req.json();
    console.log("Telegram Webhook received body:", JSON.stringify(body));

    // 1. CALLBACK QUERIES (Confirm/Cancel/Edit)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data);
      await answerCallback(cb.id);

      const parts = data.split('|');
      const action = parts[0];

      // Atomic security check: Verify user first
      let userProfile = null;
      const cleanIdNum = Number(chatId);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`telegram_chat_id.eq.${chatId}${!isNaN(cleanIdNum) ? `,telegram_chat_id.eq.${cleanIdNum}` : ''}`);
      
      userProfile = profiles?.[0];

      if (!userProfile) {
         await editTelegram(chatId, messageId, "⚠️ *Erro:* Vínculo não encontrado.");
         return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const userId = userProfile.user_id;

      if (action === 'c') { // Confirm
        const type = parts[1] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const desc = parts[3] || 'Transação Telegram';

        const { error } = await supabase.from('transactions').insert({
          user_id: userId,
          type: type,
          amount: amount,
          description: desc,
          date: new Date().toISOString(),
          status: 'confirmed'
        });

        if (error) {
          await editTelegram(chatId, messageId, `⚠️ *Falha ao registrar:* ${error.message}`);
        } else {
          await editTelegram(chatId, messageId, `✅ *Lançamento Realizado!* \n\n💰 *Valor:* R$ ${amount.toFixed(2)}\n📝 *Desc:* ${desc}`);
        }
      } else if (action === 'x') {
        await editTelegram(chatId, messageId, "❌ *Operação cancelada.*");
      } else {
        await editTelegram(chatId, messageId, "✏️ Para alterar, envie uma nova mensagem.");
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. TEXT MESSAGES
    const message = body.message || body.edited_message;
    if (!message || !message.chat) return new Response("OK", { headers: corsHeaders });

    const chatId = String(message.chat.id).trim();
    const text = message.text || "";
    
    // Find User
    const cleanIdNum = Number(chatId);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .or(`telegram_chat_id.eq.${chatId}${!isNaN(cleanIdNum) ? `,telegram_chat_id.eq.${cleanIdNum}` : ''}`);

    const profile = profiles?.[0];

    if (!profile) {
      await sendTelegram(chatId, 
        `⚠️ *Atenção:* Seu Telegram não está vinculado.\n\n` +
        `Chat ID: \`${chatId}\`\n\n` +
        `Vincule este ID no painel SimplyFin em Configurações.`
      );
      return new Response("OK", { headers: corsHeaders });
    }

    if (text.startsWith('/start')) {
      await sendTelegram(chatId, `🚀 *SimplyFin Online!* \nOlá ${profile.name || 'usuário'}.\nEnvie: \`despesa 50 pizza\` ou apenas \`100 freela\`.`);
      return new Response("OK", { headers: corsHeaders });
    }

    // Advanced Parser
    let type = 'expense';
    let amount = 0;
    let description = '';

    const lowerText = text.toLowerCase();
    const match = text.match(/([\d.,]+)/); // Find first number
    
    if (match) {
        amount = parseFloat(match[0].replace(',', '.'));
        
        if (lowerText.includes('receita') || lowerText.includes('ganho') || lowerText.includes('recebi')) {
            type = 'income';
        }
        
        description = text.replace(match[0], '').replace(/despesa|receita|ganho|recebi/gi, '').trim() || 'Telegram';
    }

    if (amount > 0) {
      const typeLabel = type === 'income' ? 'Receita' : 'Despesa';
      const typeCode = type === 'income' ? 'INC' : 'EXP';
      const safeDesc = description.substring(0, 30);

      const responseText = 
        `📉 *${typeLabel} detectada — Confirme:* \n\n` +
        `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
        `📝 *Descrição:* ${description}\n` +
        `📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ Confirmar", callback_data: `c|${typeCode}|${amount}|${safeDesc}` },
            { text: "❌ Cancelar", callback_data: `x|0` }
          ],
          [
            { text: "✏️ Categoria", callback_data: `e|cat` },
            { text: "✏️ Conta", callback_data: `e|acc` }
          ],
          [
            { text: "✏️ Valor", callback_data: `e|val` },
            { text: "✏️ Descrição", callback_data: `e|desc` }
          ]
        ]
      };

      await sendTelegram(chatId, responseText, keyboard);
    } else {
        await sendTelegram(chatId, "❓ Não entendi. Tente: `despesa 25.50 mercado` ou `receita 1000 bonus`.");
    }

    return new Response("OK", { headers: corsHeaders });

  } catch (err) {
    console.error("Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
