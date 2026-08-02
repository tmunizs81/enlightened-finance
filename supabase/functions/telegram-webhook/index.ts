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

  try {
    const body = await req.json();

    // 1. HANDLE BUTTON CLICKS (CALLBACK QUERIES)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const data = String(cb.data);
      await answerCallback(cb.id);

      const parts = data.split('|');
      const action = parts[0];

      if (action === 'c') { // Confirm and Insert into DB
        const transactionType = parts[1] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const description = parts[3] || 'Despesa Telegram';

        // Robust User Profile Search
        let userProfile = null;
        const { data: p1 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', chatId).maybeSingle();
        userProfile = p1;
        if (!userProfile && !isNaN(Number(chatId))) {
          const { data: p2 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', Number(chatId)).maybeSingle();
          userProfile = p2;
        }

        if (userProfile?.user_id) {
          const { error: insErr } = await supabase.from('transactions').insert({
            user_id: userProfile.user_id,
            type: transactionType,
            amount: amount,
            description: description,
            date: new Date().toISOString()
          });

          if (insErr) {
            console.error("INSERT Error:", insErr);
            await sendTelegram(chatId, `⚠️ *Erro ao registrar transação:* ${insErr.message}`);
          } else {
            await sendTelegram(
              chatId, 
              `✅ *Lançamento confirmado e registrado com sucesso!*\n\n` +
              `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
              `📝 *Descrição:* ${description}`
            );
          }
        } else {
          await sendTelegram(chatId, "⚠️ *Erro:* Usuário não encontrado no sistema.");
        }
      } else if (action === 'x') {
        await sendTelegram(chatId, "❌ *Lançamento cancelado.*");
      } else if (action === 'e') {
        await sendTelegram(chatId, "✏️ *Para alterar, envie uma nova mensagem com os dados corrigidos.*");
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. HANDLE INCOMING MESSAGES
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });

    const cleanChatId = String(chatId).trim();

    // User Lookup
    let userProfile = null;
    const { data: p1 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', cleanChatId).maybeSingle();
    userProfile = p1;
    if (!userProfile && !isNaN(Number(cleanChatId))) {
      const { data: p2 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', Number(cleanChatId)).maybeSingle();
      userProfile = p2;
    }

    if (!userProfile) {
      await sendTelegram(
        cleanChatId,
        `⚠️ *Atenção:* Seu Telegram não está vinculado a nenhuma conta no T2-SimplyFin.\n\n` +
        `Seu ID do Telegram é: \`${cleanChatId}\`\n` +
        `Copie esse ID e vincule-o no painel em Configurações.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie mensagens como: `despesa 1.12 agua` ou `receita 250 pix`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Text Parsing
    const isIncome = /^receita/i.test(text);
    const amountMatch = text.match(/(\d+[\.,]?\d*)/);
    let amount = 0;
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(',', '.'));
    }

    let description = text
      .replace(/^despesa/i, '')
      .replace(/^receita/i, '')
      .replace(amountMatch ? amountMatch[0] : '', '')
      .trim();

    if (!description) description = "Lançamento Telegram";

    const typeCode = isIncome ? 'INC' : 'EXP';
    const confirmPayload = `c|${typeCode}|${amount}|${description.substring(0, 30)}`;

    const cardText =
      `📉 *Despesa detectada — Confirme:* \n\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
      `📝 *Descrição:* ${description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* Sem categoria\n` +
      `🏦 *Conta:* Sem conta`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: confirmPayload },
          { text: "❌ Cancelar", callback_data: "x|cancel" }
        ],
        [
          { text: "✏️ Categoria", callback_data: "e|categoria" },
          { text: "✏️ Conta", callback_data: "e|conta" }
        ],
        [
          { text: "✏️ Valor", callback_data: "e|valor" },
          { text: "✏️ Descrição", callback_data: "e|descricao" }
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
