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

  const buildStandardKeyboard = (typeCode: string, amount: number, catId: string, accId: string, desc: string) => {
    // Garantir que os IDs sejam strings limpas ou 'none'
    const safeCatId = catId || 'none';
    const safeAccId = accId || 'none';
    // Telegram callback_data tem limite de 64 bytes. Vamos encurtar o payload.
    // Formato: act|type|amt|cat|acc|desc
    const navPayload = `${typeCode}|${amount}|${safeCatId}|${safeAccId}|${desc.substring(0, 5)}`;
    
    return {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `c|${navPayload}` },
          { text: "❌ Cancelar", callback_data: "x|cancel" }
        ],
        [
          { text: "✏️ Categoria", callback_data: `e_cat|${navPayload}` },
          { text: "✏️ Conta", callback_data: `e_acc|${navPayload}` }
        ],
        [
          { text: "✏️ Valor", callback_data: `e_val|${navPayload}` },
          { text: "✏️ Descrição", callback_data: `e_desc|${navPayload}` }
        ]
      ]
    };
  };

  try {
    const body = await req.json();
    console.log("LOG: Incoming request body:", JSON.stringify(body));

    // 1. CALLBACK QUERIES
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = String(cb.message.chat.id).trim();
      const messageId = cb.message.message_id;
      const data = String(cb.data);
      await answerCallback(cb.id);

      const userId = await getUserIdByChatId(chatId);
      if (!userId) {
        await editTelegramMessage(chatId, messageId, "⚠️ Usuário não encontrado.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const parts = data.split('|');
      const action = parts[0];

      if (action === 'c') {
        const type = parts[1] === 'INC' ? 'income' : 'expense';
        const amount = parseFloat(parts[2] || '0');
        const catId = (parts[3] && parts[3] !== 'none') ? parts[3] : null;
        const accId = (parts[4] && parts[4] !== 'none') ? parts[4] : null;
        const description = parts[5] || 'Lançamento Telegram';

        const insertPayload: any = {
          user_id: userId,
          type: type,
          amount: amount,
          description: description,
          date: new Date().toISOString(),
          category_id: catId,
          account_id: accId
        };

        const { error: insErr } = await supabase.from('transactions').insert(insertPayload);

        if (insErr) {
          console.error("Insert Error:", insErr);
          await editTelegramMessage(chatId, messageId, `⚠️ *Erro ao registrar no banco:* ${insErr.message}`);
        } else {
          await editTelegramMessage(
            chatId, 
            messageId, 
            `✅ *Lançamento confirmado e registrado no banco com sucesso!*\n\n` +
            `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
            `📝 *Descrição:* ${description}`
          );
        }
      } 
      else if (action === 'x') {
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      else if (action === 'e_val' || action === 'e_desc') {
        await answerCallback(cb.id, "Para alterar, basta enviar uma nova mensagem corrigida no chat.");
      }
      else if (action === 'e_cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId).order('name');
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria encontrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        // Pegamos os dados atuais do payload (ignorando o 'e_cat') e compactamos
        const currentData = parts.slice(1).map(p => p.substring(0, 5)).join('|');

        for (let i = 0; i < categories.length; i += 2) {
          const row = [
            { text: `🏷️ ${categories[i].name}`, callback_data: `s_cat|${categories[i].id}|${currentData}` }
          ];
          if (categories[i + 1]) {
            row.push({ text: `🏷️ ${categories[i + 1].name}`, callback_data: `s_cat|${categories[i + 1].id}|${currentData}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${currentData}` }]);

        await editTelegramMessage(chatId, messageId, "🏷️ *Selecione a Categoria:*", { inline_keyboard: keyboardRows });
      }
      else if (action === 'e_acc') {
        let { data: accounts } = await supabase.from('accounts').select('id, name').eq('user_id', userId).order('name');
        if (!accounts || accounts.length === 0) {
          const { data: bAccs } = await supabase.from('bank_accounts').select('id, name').eq('user_id', userId).order('name');
          accounts = bAccs;
        }

        if (!accounts || accounts.length === 0) {
          await answerCallback(cb.id, "Nenhuma conta encontrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        const currentData = parts.slice(1).join('|');

        for (let i = 0; i < accounts.length; i += 2) {
          const row = [
            { text: `🏦 ${accounts[i].name}`, callback_data: `s_acc|${accounts[i].id}|${currentData}` }
          ];
          if (accounts[i + 1]) {
            row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `s_acc|${accounts[i + 1].id}|${currentData}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${currentData}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      else if (action === 's_cat' || action === 's_acc' || action === 'back') {
        let newCatId = parts[3] || 'none';
        let newAccId = parts[4] || 'none';

        if (action === 's_cat') newCatId = parts[1];
        if (action === 's_acc') newAccId = parts[1];

        // Se action é s_cat ou s_acc, os parâmetros originais foram deslocados para frente
        const idx = (action === 's_cat' || action === 's_acc') ? 2 : 1;
        const typeCode = parts[idx];
        const amount = parseFloat(parts[idx + 1] || '0');
        
        // Categoria e Conta foram movidas para cima (novos valores ou mantidos)
        const description = parts[idx + 4] || 'Lançamento Telegram';

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

        const typeLabel = typeCode === 'INC' ? '📈 *Receita detectada*' : '📉 *Despesa detectada*';
        const cardText =
          `${typeLabel} — Confirme:\n\n` +
          `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
          `📝 *Descrição:* ${description}\n` +
          `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
          `🏷️ *Categoria:* ${catName}\n` +
          `🏦 *Conta:* ${accName}`;

        const inlineKeyboard = buildStandardKeyboard(typeCode, amount, newCatId, newAccId, description);
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
      await sendTelegram(cleanChatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie: `despesa 1.11 agua mineral`.");
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
    let autoCatId = 'none';
    let autoCatName = 'Sem categoria';

    if (userCategories && userCategories.length > 0) {
      const matchedCat = matchCategory(description, userCategories);
      if (matchedCat) {
        autoCatId = matchedCat.id;
        autoCatName = matchedCat.name;
      }
    }

    // Auto Match Account
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
    const typeLabel = isIncome ? '📈 *Receita detectada*' : '📉 *Despesa detectada*';
    const cardText =
      `${typeLabel} — Confirme:\n\n` +
      `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
      `📝 *Descrição:* ${description}\n` +
      `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* ${autoCatName}\n` +
      `🏦 *Conta:* ${autoAccName}`;

    const inlineKeyboard = buildStandardKeyboard(typeCode, amount, autoCatId, autoAccId, description);

    await sendTelegram(cleanChatId, cardText, inlineKeyboard);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});