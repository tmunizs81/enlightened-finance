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

  const getUserIdByChatId = async (chatId: string) => {
    const { data: p1 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', chatId).maybeSingle();
    if (p1?.user_id) return p1.user_id;
    if (!isNaN(Number(chatId))) {
      const { data: p2 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', Number(chatId)).maybeSingle();
      if (p2?.user_id) return p2.user_id;
    }
    return null;
  };

  const matchCategory = (description: string, categories: any[]) => {
    const descLower = description.toLowerCase();
    for (const cat of categories) {
      const catName = (cat.name || '').toLowerCase();
      if (descLower.includes(catName) || catName.includes(descLower)) return cat;
    }
    if (/agua|comida|lanche|restaurante|mercado|ifood|padaria/i.test(descLower)) {
      return categories.find(c => /alimenta|refeic|mercado|comida/i.test(c.name)) || null;
    }
    if (/uber|99|gasolina|combustivel|estacionamento|bus/i.test(descLower)) {
      return categories.find(c => /transporte|veiculo|carro/i.test(c.name)) || null;
    }
    if (/luz|energia|internet|aluguel|condominio/i.test(descLower)) {
      return categories.find(c => /moradia|casa|habita/i.test(c.name)) || null;
    }
    return null;
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

    const cardText =
      `📉 *Despesa detectada — Confirme:*\\n\\n` +
      `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\\n` +
      `📝 *Descrição:* ${draft.description}\\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\\n` +
      `🏷️ *Categoria:* ${catName}\\n` +
      `🏦 *Conta:* ${accName}`;

    await editTelegramMessage(chatId, messageId, cardText, buildStandardKeyboard(draft.id));
  }

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    // 1. CALLBACK QUERIES (BUTTON CLICKS)
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

      // CONFIRM TRANSACTION
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
          await editTelegramMessage(chatId, messageId, `❌ *Erro ao salvar no banco:* ${insErr.message}`);
        } else {
          await supabase.from('telegram_drafts').delete().eq('id', draftId);
          await editTelegramMessage(
            chatId,
            messageId,
            `✅ *Lançamento confirmado e registrado no banco!*\\n\\n` +
            `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\\n` +
            `📝 *Descrição:* ${draft.description}`
          );
        }
      } 
      // CANCEL
      else if (action === 'x') {
        await supabase.from('telegram_drafts').delete().eq('id', draftId);
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      // EDIT VALUE PROMPT
      else if (action === 'val') {
        await supabase.from('telegram_drafts').update({ status: 'waiting_amount' }).eq('id', draftId);
        await editTelegramMessage(chatId, messageId, "💰 *Envie o novo valor no chat (ex: 45.90):*");
      }
      // EDIT DESCRIPTION PROMPT
      else if (action === 'desc') {
        await supabase.from('telegram_drafts').update({ status: 'waiting_description' }).eq('id', draftId);
        await editTelegramMessage(chatId, messageId, "📝 *Envie a nova descrição no chat:*");
      }
      // SHOW CATEGORY LIST
      else if (action === 'cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', draft.user_id);
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria cadastrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const row = [{ text: `🏷️ ${categories[i].name}`, callback_data: `setcat|${draftId}|${categories[i].id}` }];
          if (categories[i + 1]) {
            row.push({ text: `🏷️ ${categories[i + 1].name}`, callback_data: `setcat|${draftId}|${categories[i + 1].id}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${draftId}` }]);

        await editTelegramMessage(chatId, messageId, "🏷️ *Selecione a Categoria:*", { inline_keyboard: keyboardRows });
      }
      // SHOW ACCOUNT LIST
      else if (action === 'acc') {
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', draft.user_id);
        if (!accounts || accounts.length === 0) {
          const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', draft.user_id);
          accounts = bAccs;
        }

        if (!accounts || accounts.length === 0) {
          await answerCallback(cb.id, "Nenhuma conta cadastrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < accounts.length; i += 2) {
          const row = [{ text: `🏦 ${accounts[i].name}`, callback_data: `setacc|${draftId}|${accounts[i].id}` }];
          if (accounts[i + 1]) {
            row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `setacc|${draftId}|${accounts[i + 1].id}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${draftId}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      // SET CATEGORY
      else if (action === 'setcat') {
        const catId = parts[2];
        await supabase.from('telegram_drafts').update({ category_id: catId, status: 'active' }).eq('id', draftId);
        const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updated);
      }
      // SET ACCOUNT
      else if (action === 'setacc') {
        const accId = parts[2];
        await supabase.from('telegram_drafts').update({ account_id: accId, status: 'active' }).eq('id', draftId);
        const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updated);
      }
      // BACK
      else if (action === 'back') {
        await supabase.from('telegram_drafts').update({ status: 'active' }).eq('id', draftId);
        const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updated);
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. TEXT MESSAGES
    const message = body.message || body.edited_message;
    if (!message) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    const chatId = String(message.chat.id).trim();
    const text = message.text || "";

    const userId = await getUserIdByChatId(chatId);
    if (!userId) {
      await sendTelegram(chatId, `⚠️ *Telegram não vinculado.*\\nSeu Chat ID é: \\`${chatId}\\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId, "👋 *Bem-vindo ao T2-SimplyFin!*\\nEnvie: `despesa 1.00 agua`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Check if user is replying to a waiting prompt (Value or Description)
    const { data: activeDraft } = await supabase
      .from('telegram_drafts')
      .select('*')
      .eq('chat_id', chatId)
      .eq('status', 'waiting_amount')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeDraft) {
      const amountMatch = text.match(/(\d+[\.,]?\d*)/);
      const newAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : parseFloat(text.replace(',', '.')) || 0;
      
      await supabase.from('telegram_drafts').update({ amount: newAmount, status: 'active' }).eq('id', activeDraft.id);
      const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', activeDraft.id).single();
      
      await sendTelegram(chatId, "✅ *Valor atualizado com sucesso!*");
      await renderDraftCard(chatId, message.message_id - 1, updated); // Try to update previous card if possible, but actually we just send a confirmation.
      // Better: we just updated it, the user will see the next step.
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const { data: descDraft } = await supabase
      .from('telegram_drafts')
      .select('*')
      .eq('chat_id', chatId)
      .eq('status', 'waiting_description')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (descDraft) {
      await supabase.from('telegram_drafts').update({ description: text.trim(), status: 'active' }).eq('id', descDraft.id);
      const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', descDraft.id).single();

      await sendTelegram(chatId, "✅ *Descrição atualizada com sucesso!*");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Normal New Transaction Flow
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

    // Auto-match category
    let categoryId = null;
    const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
    if (categories && categories.length > 0) {
      const matched = matchCategory(description, categories);
      if (matched) categoryId = matched.id;
    }

    // Auto-match account
    let accountId = null;
    let { data: accounts } = await supabase.from('accounts').select('id').eq('user_id', userId).limit(1);
    if (!accounts || accounts.length === 0) {
      const { data: bAccs } = await supabase.from('bank_accounts').select('id').eq('user_id', userId).limit(1);
      accounts = bAccs;
    }
    if (accounts && accounts.length > 0) {
      accountId = accounts[0].id;
    }

    // Create Draft Record
    const { data: newDraft, error: draftErr } = await supabase.from('telegram_drafts').insert({
      user_id: userId,
      chat_id: chatId,
      type: isIncome ? 'income' : 'expense',
      amount: amount,
      description: description,
      category_id: categoryId,
      account_id: accountId,
      status: 'active'
    }).select().single();

    if (draftErr || !newDraft) {
      await sendTelegram(chatId, `⚠️ *Erro ao criar rascunho:* ${draftErr?.message}`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    let catName = "Sem categoria";
    if (categoryId) {
      const c = categories?.find(x => x.id === categoryId);
      if (c) catName = c.name;
    }

    let accName = "Sem conta";
    if (accountId) {
      accName = "Conta principal";
    }

    const cardText =
      `📉 *Despesa detectada — Confirme:*\\n\\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\\n` +
      `📝 *Descrição:* ${description}\\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\\n` +
      `🏷️ *Categoria:* ${catName}\\n` +
      `🏦 *Conta:* ${accName}`;

    await sendTelegram(chatId, cardText, buildStandardKeyboard(newDraft.id));
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});
