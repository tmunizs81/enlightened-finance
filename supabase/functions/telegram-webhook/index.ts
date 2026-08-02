import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing environment variables" }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
    });
  };

  const editTelegramMessage = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: 'Markdown', reply_markup: replyMarkup }),
    });
  };

  const answerCallback = async (callbackQueryId: string, text?: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
    });
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

  try {
    const body = await req.json();

    // 1. CALLBACK QUERIES (BUTTON CLICKS)
    if (body.callback_query) {
      console.log("Processing callback_query:", JSON.stringify(body.callback_query));
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data);

      // Always answer callback query first to stop loading state in Telegram
      try {
        await answerCallback(cb.id);
      } catch (err) {
        console.error("Failed to answer callback:", err);
      }

      const parts = data.split('|');
      const action = parts[0];
      const draftId = parts[1];

      // Fetch draft from DB
      const { data: draft, error: draftErr } = await supabase
        .from('telegram_drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();

      if (draftErr || !draft) {
        console.error("Draft not found:", draftId, draftErr);
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
          await editTelegramMessage(chatId, messageId, `⚠️ *Erro ao gravar no banco:* ${insErr.message}`);
        } else {
          await supabase.from('telegram_drafts').delete().eq('id', draftId);
          await editTelegramMessage(
            chatId,
            messageId,
            `✅ *Lançamento confirmado e registrado no banco com sucesso!*\n\n` +
            `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\n` +
            `📝 *Descrição:* ${draft.description}`
          );
        }
      } 
      // CANCEL
      else if (action === 'x') {
        await supabase.from('telegram_drafts').delete().eq('id', draftId);
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      // SHOW CATEGORY LIST
      else if (action === 'cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', draft.user_id).order('name');
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria cadastrada no sistema.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const row = [
            { text: `🏷️ ${categories[i].name}`, callback_data: `setcat|${draftId}|${categories[i].id}` }
          ];
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
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', draft.user_id).order('name');
        if (!accounts || accounts.length === 0) {
          const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', draft.user_id).order('name');
          accounts = bAccs;
        }

        if (!accounts || accounts.length === 0) {
          await answerCallback(cb.id, "Nenhuma conta cadastrada no sistema.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < accounts.length; i += 2) {
          const row = [
            { text: `🏦 ${accounts[i].name}`, callback_data: `setacc|${draftId}|${accounts[i].id}` }
          ];
          if (accounts[i + 1]) {
            row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `setacc|${draftId}|${accounts[i + 1].id}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${draftId}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      // SET CATEGORY & REDRAW CARD
      else if (action === 'setcat') {
        const selectedCatId = parts[2];
        await supabase.from('telegram_drafts').update({ category_id: selectedCatId }).eq('id', draftId);
        
        // Reload draft
        const { data: updatedDraft } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updatedDraft);
      }
      // SET ACCOUNT & REDRAW CARD
      else if (action === 'setacc') {
        const selectedAccId = parts[2];
        await supabase.from('telegram_drafts').update({ account_id: selectedAccId }).eq('id', draftId);

        const { data: updatedDraft } = await supabase.from('telegram_drafts').select('*').eq('id', draftId).single();
        await renderDraftCard(chatId, messageId, updatedDraft);
      }
      // BACK TO MAIN CARD
      else if (action === 'back') {
        await renderDraftCard(chatId, messageId, draft);
      }
      else if (action === 'val' || action === 'desc') {
        await answerCallback(cb.id, "Para alterar, basta enviar uma nova mensagem corrigida.");
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // HELPER: RENDER CARD
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

    // 2. TEXT MESSAGES PARSER
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });

    const cleanChatId = String(chatId).trim();
    const userId = await getUserIdByChatId(cleanChatId);

    if (!userId) {
      await sendTelegram(cleanChatId, `⚠️ *Atenção:* Telegram não vinculado.\nID: \`${cleanChatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      const helpText = "👋 *Bem-vindo ao T2-SimplyFin!*\n\n" +
        "Envie uma despesa ou receita assim:\n" +
        "`despesa 50 padaria` ou `receita 1000 bonus`\n\n" +
        "O sistema irá detectar o valor e a descrição, e você poderá confirmar ou ajustar via botões.";
      await sendTelegram(cleanChatId, helpText);
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

    // Create Draft Record in Supabase
    const { data: newDraft, error: draftCreateErr } = await supabase.from('telegram_drafts').insert({
      user_id: userId,
      chat_id: cleanChatId,
      type: isIncome ? 'income' : 'expense',
      amount: amount,
      description: description
    }).select().single();

    if (draftCreateErr || !newDraft) {
      await sendTelegram(cleanChatId, `⚠️ *Erro ao criar rascunho:* ${draftCreateErr?.message}`);
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

    await sendTelegram(cleanChatId, cardText, buildStandardKeyboard(newDraft.id));
    
    // Add logging to verify the sent message
    console.log(`Draft ${newDraft.id} sent to ${cleanChatId}`);
    
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});