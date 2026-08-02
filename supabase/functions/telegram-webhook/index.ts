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

  // Cliente Supabase usando SERVICE_ROLE para ignorar trava de RLS
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

    // -------------------------------------------------------------
    // 1. TRATAMENTO DE BOTAO "CONFIRMAR" / "CANCELAR" (CALLBACK)
    // -------------------------------------------------------------
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const data = String(cb.data); 
      await answerCallback(cb.id);

      const parts = data.split('|');
      const action = parts[0];

      if (action === 'c') { // Confirmar lançamento no Banco
        const transactionType = parts[1] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const description = parts[3] || 'Despesa Telegram';

        // Busca de usuário blindada (string + número)
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
            console.error("Erro no INSERT:", insErr);
            await sendTelegram(chatId, `⚠️ *Erro ao salvar no banco:* ${insErr.message}`);
          } else {
            await sendTelegram(chatId, `✅ *Lançamento confirmado e registrado com sucesso!*\n\n💰 *Valor:* R$ ${amount.toFixed(2)}\n📝 *Descrição:* ${description}`);
          }
        } else {
          await sendTelegram(chatId, "⚠️ *Erro:* Usuário não encontrado no sistema.");
        }
      } else if (action === 'x') {
        await sendTelegram(chatId, "❌ *Lançamento cancelado.*");
      } else if (action === 'e') {
        await sendTelegram(chatId, `✏️ Para alterar, envie uma nova mensagem com os dados corretos.`);
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // 2. RECEBIMENTO DE MENSAGENS DE TEXTO
    // -------------------------------------------------------------
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) {
      return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });
    }

    const cleanChatId = String(chatId).trim();

    // BUSCA BLINDADA DE USUARIO (Garante busca por String e por Número)
    let userProfile = null;
    const { data: p1 } = await supabase.from('profiles').select('user_id, name').eq('telegram_chat_id', cleanChatId).maybeSingle();
    userProfile = p1;
    if (!userProfile && !isNaN(Number(cleanChatId))) {
      const { data: p2 } = await supabase.from('profiles').select('user_id, name').eq('telegram_chat_id', Number(cleanChatId)).maybeSingle();
      userProfile = p2;
    }

    if (!userProfile) {
      console.error("Usuário não encontrado para o chat_id:", cleanChatId);
      await sendTelegram(cleanChatId, 
        `⚠️ *Atenção:* Seu Telegram não está vinculado.\n\n` +
        `Seu ID: \`${cleanChatId}\`\n` +
        `Vincule-o em Configurações no painel.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, `👋 *Olá ${userProfile.name || ''}!* Envie uma despesa como: \`despesa 15.50 almoço\`.`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Lógica de Parser
    let type = 'expense';
    let amount = 0;
    let description = '';

    const parts = text.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].toLowerCase();
      if (first === 'despesa' || first === 'receita') {
        type = first === 'receita' ? 'income' : 'expense';
        amount = parseFloat(parts[1].replace(',', '.')) || 0;
        description = parts.slice(2).join(' ') || 'Lançamento Telegram';
      } else {
        amount = parseFloat(parts[0].replace(',', '.')) || 0;
        description = parts.slice(1).join(' ') || 'Lançamento Telegram';
      }
    }

    if (amount > 0) {
      const shortDesc = description.substring(0, 30);
      const typeCode = type === 'income' ? 'INC' : 'EXP';
      
      const cardText = 
        `📉 *${type === 'income' ? 'Receita' : 'Despesa'} detectada — Confirme:*\\n\\n` +
        `💰 *Valor:* R$ ${amount.toFixed(2)}\\n` +
        `📝 *Descrição:* ${description}\\n` +
        `📅 *Data:* ${new Date().toISOString().split('T')[0]}`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Confirmar", callback_data: `c|${typeCode}|${amount}|${shortDesc}` },
            { text: "❌ Cancelar", callback_data: `x|draft` }
          ],
          [
            { text: "✏️ Editar", callback_data: `e|edit` }
          ]
        ]
      };

      await sendTelegram(cleanChatId, cardText, replyMarkup);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Erro interno no Webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
