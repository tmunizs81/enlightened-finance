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
      return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
      return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
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

  const buildStandardKeyboard = (draftId: string) => {
    return {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `c|${draftId}` },
          { text: "❌ Cancelar", callback_data: `x|${draftId}` }
        ],
        [
          { text: "✏️ Categoria", callback_data: `cat|${draftId}` },
          { text: "✏️ Conta", callback_data: `acc|${draftId}` }
        ],
        [
          { text: "✏️ Valor", callback_data: `val|${draftId}` },
          { text: "✏️ Descrição", callback_data: `desc|${draftId}` }
        ]
      ]
    };
  };

  async function renderDraftCard(chatId: string, messageId: number, draft: any) {
    let catName = "Sem categoria";
    if (draft.category_id) {
      const { data: c } = await supabase.from('categories').select('name').eq('id', draft.category_id).maybeSingle();
      if (c?.name) catName = c.name;
    }

    let accName = "Sem conta";
    if (draft.account_id) {
      let { data: a } = await supabase.from('accounts').select('name').eq('id', draft.account_id).maybeSingle();
      if (!a) {
        const { data: ba } = await supabase.from('bank_accounts').select('name').eq('id', draft.account_id).maybeSingle();
        a = ba;
      }
      if (a?.name) accName = a.name;
    }

    const typeLabel = draft.type === 'income' ? '📈 *Receita detectada*' : '📉 *Despesa detectada*';
    const cardText =
      `${typeLabel} — Confirme:\n\n` +
      `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\n` +
      `📝 *Descrição:* ${draft.description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* ${catName}\n` +
      `🏦 *Conta:* ${accName}`;

    await editTelegramMessage(chatId, messageId, cardText, buildStandardKeyboard(draft.id));
  }

  let targetChatId: string | null = null;

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (body.message?.chat?.id) targetChatId = String(body.message.chat.id);
    if (body.callback_query?.message?.chat?.id) targetChatId = String(body.callback_query.message.chat.id);

    // 1. CALLBACK QUERIES
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data || '');

      await answerCallback(cb.id);

      const parts = data.split('|');
      const action = parts[0];
      const draftId = parts[1];

      const { data: draft, error: draftErr } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).maybeSingle();

      if (draftErr || !draft) {
        await editTelegramMessage(chatId, messageId, "⚠️ *Rascunho expirado ou não encontrado.* Envie uma nova mensagem.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (action === 'c') {
        const { error: insErr } = await supabase.from('transactions').insert({
          user_id: draft.user_id,
          type: draft.type,
          amount: draft.amount,
          description: draft.description,
          category_id: draft.category_id,
          account_id: draft.account_id,
          date: new Date().toISOString()
        });

        if (insErr) {
          await editTelegramMessage(chatId, messageId, `❌ *Erro ao salvar:* ${insErr.message}`);
        } else {
          await supabase.from('telegram_drafts').delete().eq('id', draftId);
          await editTelegramMessage(chatId, messageId, `✅ *Salvo com sucesso!* \n💰 R$ ${Number(draft.amount).toFixed(2)}\n📝 ${draft.description}`);
        }
      } 
      else if (action === 'x') {
        await supabase.from('telegram_drafts').delete().eq('id', draftId);
        await editTelegramMessage(chatId, messageId, "❌ *Cancelado.*");
      }
      else if (action === 'cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', draft.user_id).order('name');
        const keyboard = {
          inline_keyboard: (categories || []).map(c => [{ text: `🏷️ ${c.name}`, callback_data: `setcat|${draftId}|${c.id}` }])
        };
        keyboard.inline_keyboard.push([{ text: "⬅️ Voltar", callback_data: `back|${draftId}` }]);
        await editTelegramMessage(chatId, messageId, "🏷️ *Selecione a Categoria:*", keyboard);
      }
      else if (action === 'acc') {
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', draft.user_id).order('name');
        if (!accounts || accounts.length === 0) {
          const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', draft.user_id).order('name');
          accounts = bAccs;
        }
        const keyboard = {
          inline_keyboard: (accounts || []).map(a => [{ text: `🏦 ${a.name}`, callback_data: `setacc|${draftId}|${a.id}` }])
        };
        keyboard.inline_keyboard.push([{ text: "⬅️ Voltar", callback_data: `back|${draftId}` }]);
        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", keyboard);
      }
      else if (action === 'setcat') {
        await supabase.from('telegram_drafts').update({ category_id: parts[2] }).eq('id', draftId);
        const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updated);
      }
      else if (action === 'setacc') {
        await supabase.from('telegram_drafts').update({ account_id: parts[2] }).eq('id', draftId);
        const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updated);
      }
      else if (action === 'back') {
        await renderDraftCard(chatId, messageId, draft);
      }
      else if (action === 'val' || action === 'desc') {
        await answerCallback(cb.id, "Para alterar, envie uma nova mensagem corrigida.");
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. TEXT MESSAGES
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
      await sendTelegram(chatId, `⚠️ *Telegram não vinculado.* Chat ID: \`${chatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId, "👋 *SimplyFin Bot!*\nEnvie: `despesa 10.00 mercado`.");
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

    const { data: newDraft } = await supabase.from('telegram_drafts').insert({
      user_id: profile.user_id,
      chat_id: chatId,
      type: isIncome ? 'income' : 'expense',
      amount: amount,
      description: description
    }).select().single();

    if (!newDraft) {
      await sendTelegram(chatId, "❌ Erro ao criar rascunho.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const typeLabel = isIncome ? '📈 *Receita detectada*' : '📉 *Despesa detectada*';
    const cardText =
      `${typeLabel} — Confirme:\n\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
      `📝 *Descrição:* ${description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* Sem categoria\n` +
      `🏦 *Conta:* Sem conta`;

    await sendTelegram(chatId, cardText, buildStandardKeyboard(newDraft.id));
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Fatal Webhook Error:", err);
    if (targetChatId) {
      await sendTelegram(targetChatId, `🚨 *Erro:* \`${err.message}\``);
    }
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});
