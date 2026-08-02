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

  try {
    const body = await req.json();

    // 1. HANDLE BUTTON CLICKS (CALLBACK QUERIES)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data);

      // ALWAYS Answer callback query FIRST to prevent frozen buttons
      await answerCallback(cb.id);

      const userId = await getUserIdByChatId(chatId);
      if (!userId) {
        await editTelegramMessage(chatId, messageId, "⚠️ Usuário não encontrado.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const parts = data.split('|');
      const action = parts[0];

      // ACTION: CONFIRM TRANSACTION
      if (action === 'c') {
        const type = parts[1] === 'I' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const catShort = parts[3] !== '0' ? parts[3] : null;
        const accShort = parts[4] !== '0' ? parts[4] : null;

        // Extract description from existing message card text
        const cardText = cb.message.text || '';
        const descMatch = cardText.match(/Descrição:\s*(.+)/i);
        const description = descMatch ? descMatch[1].trim() : "Lançamento Telegram";

        // Resolve Full UUIDs if short codes were passed
        let fullCatId = null;
        if (catShort) {
          const { data: c } = await supabase.from('categories').select('id').eq('user_id', userId).ilike('id', `${catShort}%`).maybeSingle();
          if (c?.id) fullCatId = c.id;
        }

        let fullAccId = null;
        if (accShort) {
          let { data: a } = await supabase.from('accounts').select('id').eq('user_id', userId).ilike('id', `${accShort}%`).maybeSingle();
          if (!a) {
            const { data: ba } = await supabase.from('bank_accounts').select('id').eq('user_id', userId).ilike('id', `${accShort}%`).maybeSingle();
            a = ba;
          }
          if (a?.id) fullAccId = a.id;
        }

        const insertPayload: any = {
          user_id: userId,
          type: type,
          amount: amount,
          description: description,
          date: new Date().toISOString(),
          category_id: fullCatId,
          account_id: fullAccId
        };

        const { error: insErr } = await supabase.from('transactions').insert(insertPayload);

        if (insErr) {
          console.error("Insert Error:", insErr);
          await editTelegramMessage(chatId, messageId, `⚠️ *Erro ao registrar:* ${insErr.message}`);
        } else {
          await editTelegramMessage(
            chatId, 
            messageId, 
            `✅ *Lançamento confirmado e registrado no banco!*\n\n` +
            `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
            `📝 *Descrição:* ${description}`
          );
        }
      } 
      // ACTION: CANCEL
      else if (action === 'x') {
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      // ACTION: PROMPT FOR MANUAL EDITING
      else if (action === 'eval' || action === 'edesc') {
        await answerCallback(cb.id, "Envie uma nova mensagem com o valor/descrição corrigidos.");
      }
      // ACTION: SHOW CATEGORIES
      else if (action === 'ecat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria cadastrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const cat1 = categories[i];
          const shortId1 = cat1.id.substring(0, 8);
          const row = [
            { text: `🏷️ ${cat1.name}`, callback_data: `scat|${shortId1}|${parts.slice(1).join('|')}` }
          ];
          if (categories[i + 1]) {
            const cat2 = categories[i + 1];
            const shortId2 = cat2.id.substring(0, 8);
            row.push({ text: `🏷️ ${cat2.name}`, callback_data: `scat|${shortId2}|${parts.slice(1).join('|')}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `b|${parts.slice(1).join('|')}` }]);

        await editTelegramMessage(chatId, messageId, "🏷️ *Selecione a Categoria:*", { inline_keyboard: keyboardRows });
      }
      // ACTION: SHOW ACCOUNTS
      else if (action === 'eacc') {
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', userId);
        if (!accounts || accounts.length === 0) {
          const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', userId);
          accounts = bAccs;
        }

        if (!accounts || accounts.length === 0) {
          await answerCallback(cb.id, "Nenhuma conta cadastrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < accounts.length; i += 2) {
          const acc1 = accounts[i];
          const shortId1 = acc1.id.substring(0, 8);
          const row = [
            { text: `🏦 ${acc1.name}`, callback_data: `sacc|${shortId1}|${parts.slice(1).join('|')}` }
          ];
          if (accounts[i + 1]) {
            const acc2 = accounts[i + 1];
            const shortId2 = acc2.id.substring(0, 8);
            row.push({ text: `🏦 ${acc2.name}`, callback_data: `sacc|${shortId2}|${parts.slice(1).join('|')}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `b|${parts.slice(1).join('|')}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      // ACTION: SELECT CATEGORY/ACCOUNT & REDRAW CARD
      else if (action === 'scat' || action === 'sacc' || action === 'b') {
        let catShort = parts[3] || '0';
        let accShort = parts[4] || '0';

        if (action === 'scat') catShort = parts[1];
        if (action === 'sacc') accShort = parts[1];

        const idx = (action === 'scat' || action === 'sacc') ? 2 : 1;
        const typeCode = parts[idx];
        const amount = parseFloat(parts[idx + 1] || '0');

        // Extract description from card text
        const cardTextOld = cb.message.text || '';
        const descMatch = cardTextOld.match(/Descrição:\s*(.+)/i);
        const description = descMatch ? descMatch[1].trim() : "Lançamento Telegram";

        let catName = "Sem categoria";
        if (catShort !== '0') {
          const { data: c } = await supabase.from('categories').select('name').eq('user_id', userId).ilike('id', `${catShort}%`).maybeSingle();
          if (c?.name) catName = c.name;
        }

        let accName = "Sem conta";
        if (accShort !== '0') {
          let { data: a } = await supabase.from('accounts').select('name').eq('user_id', userId).ilike('id', `${accShort}%`).maybeSingle();
          if (!a) {
            const { data: ba } = await supabase.from('bank_accounts').select('name').eq('user_id', userId).ilike('id', `${accShort}%`).maybeSingle();
            a = ba;
          }
          if (a?.name) accName = a.name;
        }

        const navPayload = `${typeCode}|${amount}|${catShort}|${accShort}`;

        const cardText =
          `📉 *Despesa detectada — Confirme:*` +
          `\n\n💰 *Valor:* R$ ${amount.toFixed(2)}` +
          `\n📝 *Descrição:* ${description}` +
          `\n📅 *Data:* ${new Date().toISOString().split('T')[0]}` +
          `\n🏷️ *Categoria:* ${catName}` +
          `\n🏦 *Conta:* ${accName}`;

        const inlineKeyboard = {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: `c|${navPayload}` },
              { text: "❌ Cancelar", callback_data: "x|cancel" }
            ],
            [
              { text: "✏️ Categoria", callback_data: `ecat|${navPayload}` },
              { text: "✏️ Conta", callback_data: `eacc|${navPayload}` }
            ],
            [
              { text: "✏️ Valor", callback_data: `eval|${navPayload}` },
              { text: "✏️ Descrição", callback_data: `edesc|${navPayload}` }
            ]
          ]
        };

        await editTelegramMessage(chatId, messageId, cardText, inlineKeyboard);
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. TEXT MESSAGES PARSER
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) return new Response(JSON.stringify({ error: "No chat_id" }), { status: 400, headers: corsHeaders });

    const cleanChatId = String(chatId).trim();
    const userId = await getUserIdByChatId(cleanChatId);

    if (!userId) {
      await sendTelegram(cleanChatId, `⚠️ *Atenção:* Seu Telegram não está vinculado.\nID: \`${cleanChatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(cleanChatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie: `despesa 1.00 agua`.");
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

    // Auto Match Category
    const { data: userCategories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
    let autoCatShort = '0';
    let autoCatName = 'Sem categoria';

    if (userCategories && userCategories.length > 0) {
      const matchedCat = matchCategory(description, userCategories);
      if (matchedCat) {
        autoCatShort = matchedCat.id.substring(0, 8);
        autoCatName = matchedCat.name;
      }
    }

    // Auto Match Account
    let autoAccShort = '0';
    let autoAccName = 'Sem conta';
    let { data: userAccounts } = await supabase.from('accounts').select('id, name').eq('user_id', userId).limit(1);
    if (!userAccounts || userAccounts.length === 0) {
      const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', userId).limit(1);
      userAccounts = bAccs;
    }
    if (userAccounts && userAccounts.length > 0) {
      autoAccShort = userAccounts[0].id.substring(0, 8);
      autoAccName = userAccounts[0].name;
    }

    const typeCode = isIncome ? 'I' : 'E';
    const navPayload = `${typeCode}|${amount}|${autoCatShort}|${autoAccShort}`;

    const cardText =
      `📉 *Despesa detectada — Confirme:*` +
      `\n\n💰 *Valor:* R$ ${amount.toFixed(2)}` +
      `\n📝 *Descrição:* ${description}` +
      `\n📅 *Data:* ${new Date().toISOString().split('T')[0]}` +
      `\n🏷️ *Categoria:* ${autoCatName}` +
      `\n🏦 *Conta:* ${autoAccName}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `c|${navPayload}` },
          { text: "❌ Cancelar", callback_data: "x|cancel" }
        ],
        [
          { text: "✏️ Categoria", callback_data: `ecat|${navPayload}` },
          { text: "✏️ Conta", callback_data: `eacc|${navPayload}` }
        ],
        [
          { text: "✏️ Valor", callback_data: `eval|${navPayload}` },
          { text: "✏️ Descrição", callback_data: `edesc|${navPayload}` }
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