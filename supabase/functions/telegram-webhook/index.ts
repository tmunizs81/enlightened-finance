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

  // Telegram API Helpers
  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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

  const editTelegramMessage = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    return await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
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
  };

  const answerCallback = async (callbackQueryId: string, text?: string) => {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
    });
  };

  // User Lookup Helper
  const getUserIdByChatId = async (chatId: string) => {
    const { data: p1 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', chatId).maybeSingle();
    if (p1?.user_id) return p1.user_id;
    if (!isNaN(Number(chatId))) {
      const { data: p2 } = await supabase.from('profiles').select('user_id').eq('telegram_chat_id', Number(chatId)).maybeSingle();
      if (p2?.user_id) return p2.user_id;
    }
    return null;
  };

  // Smart Category Matcher
  const matchCategory = (description: string, categories: any[]) => {
    const descLower = description.toLowerCase();
    for (const cat of categories) {
      const catName = (cat.name || '').toLowerCase();
      if (descLower.includes(catName) || catName.includes(descLower)) {
        return cat;
      }
    }
    // Heuristic Fallbacks
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

    // -------------------------------------------------------------
    // 1. CALLBACK QUERIES (BUTTON CLICKS)
    // -------------------------------------------------------------
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data);
      await answerCallback(cb.id);

      const userId = await getUserIdByChatId(chatId);
      if (!userId) {
        await sendTelegram(chatId, "⚠️ Usuário não encontrado.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const parts = data.split('|');
      const action = parts[0];

      // CONFIRM TRANSACTION
      if (action === 'c') {
        const type = parts[1] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const catId = parts[3] !== 'none' ? parts[3] : null;
        const accId = parts[4] !== 'none' ? parts[4] : null;
        const description = parts[5] || 'Lançamento Telegram';

        const insertPayload: any = {
          user_id: userId,
          type: type,
          amount: amount,
          description: description,
          date: new Date().toISOString()
        };
        if (catId) insertPayload.category_id = catId;
        if (accId) insertPayload.account_id = accId;

        const { error: insErr } = await supabase.from('transactions').insert(insertPayload);

        if (insErr) {
          await editTelegramMessage(chatId, messageId, `⚠️ *Erro ao registrar:* ${insErr.message}`);
        } else {
          await editTelegramMessage(
            chatId, 
            messageId, 
            `✅ *Lançamento confirmado e registrado!*\n\n` +
            `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
            `📝 *Descrição:* ${description}`
          );
        }
      } 
      // CANCEL TRANSACTION
      else if (action === 'x') {
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      // SHOW CATEGORY SELECTION MENU
      else if (action === 'e_cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
        
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria cadastrada na sua conta.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // Build Keyboard grid (2 items per row)
        const keyboardRows: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const row = [
            { text: `🏷️ ${categories[i].name}`, callback_data: `s_cat|${categories[i].id}|${parts.slice(1).join('|')}` }
          ];
          if (categories[i + 1]) {
            row.push({ text: `🏷️ ${categories[i + 1].name}`, callback_data: `s_cat|${categories[i + 1].id}|${parts.slice(1).join('|')}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${parts.slice(1).join('|')}` }]);

        await editTelegramMessage(chatId, messageId, "🏷️ *Selecione a Categoria:*", { inline_keyboard: keyboardRows });
      }
      // SHOW ACCOUNT SELECTION MENU
      else if (action === 'e_acc') {
        // Query accounts or bank_accounts table
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', userId);
        if (!accounts || accounts.length === 0) {
          const { data: bAccounts } = await supabase.from('bank_accounts').select('id, name').eq('user_id', userId);
          accounts = bAccounts;
        }

        if (!accounts || accounts.length === 0) {
          await answerCallback(cb.id, "Nenhuma conta cadastrada na sua conta.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < accounts.length; i += 2) {
          const row = [
            { text: `🏦 ${accounts[i].name}`, callback_data: `s_acc|${accounts[i].id}|${parts.slice(1).join('|')}` }
          ];
          if (accounts[i + 1]) {
            row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `s_acc|${accounts[i + 1].id}|${parts.slice(1).join('|')}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${parts.slice(1).join('|')}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      // APPLY SELECTED CATEGORY / ACCOUNT & REDRAW CARD
      else if (action === 's_cat' || action === 's_acc' || action === 'back') {
        let newCatId = parts[2] || 'none';
        let newAccId = parts[3] || 'none';

        if (action === 's_cat') newCatId = parts[1];
        if (action === 's_acc') newAccId = parts[1];

        const payloadStartIndex = (action === 's_cat' || action === 's_acc') ? 2 : 1;
        const type = parts[payloadStartIndex] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[payloadStartIndex + 1] || '0');
        const description = parts[payloadStartIndex + 4] || 'Lançamento Telegram';

        // Fetch Names for Display
        let catName = "Sem categoria";
        if (newCatId !== 'none') {
          const { data: c } = await supabase.from('categories').select('name').eq('id', newCatId).maybeSingle();
          if (c?.name) catName = c.name;
        }

        let accName = "Sem conta";
        if (newAccId !== 'none') {
          let { data: a } = await supabase.from('accounts').select('name').eq('id', newAccId).maybeSingle();
          if (!a) {
            const { data: ba } = await supabase.from('bank_accounts').select('name').eq('id', newAccId).maybeSingle();
            a = ba;
          }
          if (a?.name) accName = a.name;
        }

        const confirmPayload = `c|${parts[payloadStartIndex]}|${amount}|${newCatId}|${newAccId}|${description.substring(0, 20)}`;
        const navPayload = `${parts[payloadStartIndex]}|${amount}|${newCatId}|${newAccId}|${description.substring(0, 20)}`;

        const cardText =
          `📉 *Despesa detectada — Confirme:* \n\n` +
          `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
          `📝 *Descrição:* ${description}\n` +
          `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
          `🏷️ *Categoria:* ${catName}\n` +
          `🏦 *Conta:* ${accName}`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: confirmPayload },
              { text: "❌ Cancelar", callback_data: "x|cancel" }
            ],
            [
              { text: "✏️ Categoria", callback_data: `e_cat|${navPayload}` },
              { text: "✏️ Conta", callback_data: `e_acc|${navPayload}` }
            ]
          ]
        };

        await editTelegramMessage(chatId, messageId, cardText, inlineKeyboard);
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // -------------------------------------------------------------
    // 2. INCOMING TEXT MESSAGES (PARSER & AUTO MATCHING)
    // -------------------------------------------------------------
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });

    const cleanChatId = String(chatId).trim();
    const userId = await getUserIdByChatId(cleanChatId);

    if (!userId) {
      await sendTelegram(
        cleanChatId,
        `⚠️ *Atenção:* Seu Telegram não está vinculado.\n` +
        `ID: \`${cleanChatId}\`\n` +
        `Vincule-o em Configurações no painel.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, "👋 *Bem-vindo ao T2-SimplyFin!* \nEnvie: `despesa 1.11 agua mineral` ou `receita 250 pix`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Parse Text
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

    // AUTO CATEGORY & ACCOUNT MATCHING
    const { data: userCategories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
    let autoCatId = 'none';
    let autoCatName = 'Sem categoria';

    if (userCategories && userCategories.length > 0) {
      const matchedCat = matchCategory(description, userCategories);
      if (matchedCat) {
        autoCatId = matchedCat.id;
        autoCatName = matchedCat.name;
      }
    }

    // Auto Account Lookup (Pick default or first account)
    let autoAccId = 'none';
    let autoAccName = 'Sem conta';
    let { data: userAccounts } = await supabase.from('accounts').select('id, name').eq('user_id', userId).limit(1);
    if (!userAccounts || userAccounts.length === 0) {
      const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', userId).limit(1);
      userAccounts = bAccs;
    }
    if (userAccounts && userAccounts.length > 0) {
      autoAccId = userAccounts[0].id;
      autoAccName = userAccounts[0].name;
    }

    const typeCode = isIncome ? 'INC' : 'EXP';
    const payloadNav = `${typeCode}|${amount}|${autoCatId}|${autoAccId}|${description.substring(0, 20)}`;
    const confirmPayload = `c|${payloadNav}`;

    const cardText =
      `📉 *Despesa detectada — Confirme:* \n\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
      `📝 *Descrição:* ${description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* ${autoCatName}\n` +
      `🏦 *Conta:* ${autoAccName}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: confirmPayload },
          { text: "❌ Cancelar", callback_data: "x|cancel" }
        ],
        [
          { text: "✏️ Categoria", callback_data: `e_cat|${payloadNav}` },
          { text: "✏️ Conta", callback_data: `e_acc|${payloadNav}` }
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
