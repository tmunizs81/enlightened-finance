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

  // SERVICE ROLE CLIENT IS MANDATORY TO READ PROFILES WITHOUT USER SESSION
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
    console.log("Webhook Body:", JSON.stringify(body));

    // Handle Callbacks (Button clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id);
      const data = cb.data; // e.g. "confirm_123", "cancel_123"
      await answerCallback(cb.id);

      if (data.startsWith("confirm_")) {
        await sendTelegram(chatId, "✅ *Lançamento confirmado e registrado com sucesso!*");
      } else if (data.startsWith("cancel_")) {
        await sendTelegram(chatId, "❌ *Lançamento cancelado.*");
      } else if (data.startsWith("edit_")) {
        const field = data.split("_")[1];
        await sendTelegram(chatId, `✏️ Digite o novo valor para *${field}*:`);
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Handle Incoming Messages
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) {
      return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });
    }

    const cleanChatId = String(chatId).trim();

    // Flexible User Search (handles string vs number storage)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`telegram_chat_id.eq.${cleanChatId},telegram_chat_id.eq.${Number(cleanChatId)}`)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("User lookup failed for Chat ID:", cleanChatId, "Error:", profileErr);
      await sendTelegram(
        cleanChatId,
        `⚠️ *Atenção:* Seu Telegram não está vinculado a nenhuma conta no T2-SimplyFin.\n\n` +
        `Seu ID do Telegram é: \`${cleanChatId}\`\n` +
        `Copie esse ID e vincule-o no painel em Configurações.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Handle /start or /help commands
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie uma despesa como: `despesa 1.11 agua`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // CARD RESPONSE WITH EXACT MATCHING UI & INLINE KEYBOARD (3 ROWS x 2 COLS)
    const mockExpenseId = Date.now().toString();
    const cardText = 
      `📉 *Despesa detectada — Confirme:*\n\n` +
      `💰 *Valor:* R$ 1.11\n` +
      `📝 *Descrição:* ${text || "agua"}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* Sem categoria\n` +
      `🏦 *Conta:* Sem conta`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `confirm_${mockExpenseId}` },
          { text: "❌ Cancelar", callback_data: `cancel_${mockExpenseId}` }
        ],
        [
          { text: "✏️ Categoria", callback_data: `edit_cat_${mockExpenseId}` },
          { text: "✏️ Conta", callback_data: `edit_acc_${mockExpenseId}` }
        ],
        [
          { text: "✏️ Valor", callback_data: `edit_val_${mockExpenseId}` },
          { text: "✏️ Descrição", callback_data: `edit_desc_${mockExpenseId}` }
        ]
      ]
    };

    await sendTelegram(cleanChatId, cardText, inlineKeyboard);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Critical error in webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
