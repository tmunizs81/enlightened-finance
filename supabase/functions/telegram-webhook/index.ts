import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "https://difwlzancpnvwkiyhmll.supabase.co";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || "";
  let GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  let GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

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

  const analyzeReceipt = async (fileUrl: string, promptOverride?: string) => {
    const defaultPrompt = "Você é um assistente financeiro sênior especializado em OCR. Analise este documento (imagem ou página de PDF) e extraia: {\"amount\": number, \"description\": string, \"type\": \"expense\" | \"income\", \"date\": string}. Regras: 1. Extraia o valor total final. 2. Descrição curta e clara. 3. Se houver múltiplos itens, some-os se for um cupom fiscal único. 4. Retorne APENAS o JSON. 5. Tente identificar a data no formato YYYY-MM-DD.";
    const prompt = promptOverride || defaultPrompt;

    // Try Gemini First (Better for Vision/PDF context)
    if (GEMINI_API_KEY) {
      try {
        console.log("Attempting OCR with Gemini...");
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const imageResponse = await fetch(fileUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Data = btoa(new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        const mimeType = fileUrl.toLowerCase().includes('.pdf') ? "application/pdf" : "image/jpeg";

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]);

        const text = result.response.text();
        const cleanedText = text.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedText);
      } catch (e) {
        console.error("Gemini OCR failed:", e);
      }
    }

    // Fallback to Groq
    if (GROQ_API_KEY && !fileUrl.toLowerCase().includes('.pdf')) {
      try {
        console.log("Attempting OCR with Groq Llama-3-Vision...");
        const imageResponse = await fetch(fileUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = btoa(new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                  }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        const data = await response.json();
        const content = data.choices[0].message.content;
        const cleanedContent = content.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedContent);
      } catch (e) {
        console.error("Groq OCR failed:", e);
      }
    }

    console.error("No API Keys configured or both OCR methods failed.");
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
      `${draft.type === 'income' ? '📈 *Receita*' : '📉 *Despesa*'} detectada — Confirme:\n\n` +
      `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\n` +
      `📝 *Descrição:* ${draft.description}\n` +
      `📅 *Data:* ${draft.date || new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* ${catName}\n` +
      `🏦 *Conta:* ${accName}`;

    await editTelegramMessage(chatId, messageId, cardText, buildStandardKeyboard(draft.id));
  }

  async function sendNewDraftCard(chatId: string, draft: any) {
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
      `${draft.type === 'income' ? '📈 *Receita*' : '📉 *Despesa*'} detectada — Confirme:\n\n` +
      `💰 *Valor:* R$ ${Number(draft.amount).toFixed(2)}\n` +
      `📝 *Descrição:* ${draft.description}\n` +
      `📅 *Data:* ${draft.date || new Date().toISOString().split('T')[0]}\n` +
      `🏷️ *Categoria:* ${catName}\n` +
      `🏦 *Conta:* ${accName}`;

    await sendTelegram(chatId, cardText, buildStandardKeyboard(draft.id));
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
      const payloadId = parts[1];

      // Logic to resolve the draft:
      // 1. If the action is a standard menu button (c, x, val, desc, cat, acc, back), payloadId IS the draftId.
      // 2. If the action is a selection (sct, sac), payloadId IS the item ID (category/account), 
      //    so we MUST find the active draft by chat_id.
      let draft = null;
      const directDraftActions = ['c', 'x', 'val', 'desc', 'cat', 'acc', 'back'];
      
      if (directDraftActions.includes(action) && payloadId) {
        const { data: d } = await supabase.from('telegram_drafts').select('*').eq('id', payloadId).maybeSingle();
        draft = d;
      } else {
        // Fallback for sct/sac or if draftId was missing/invalid
        const { data: d } = await supabase.from('telegram_drafts')
          .select('*')
          .eq('chat_id', chatId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        draft = d;
      }

      if (!draft && action !== 'x' && action !== 'c') {
        await editTelegramMessage(chatId, messageId, "⚠️ *Rascunho expirado ou não encontrado.* Envie uma nova mensagem.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // CONFIRM TRANSACTION
      if (action === 'c') {
        const targetDraftId = parts[1];
        const { data: targetDraft } = await supabase.from('telegram_drafts').select('*').eq('id', targetDraftId).maybeSingle();
        if (!targetDraft) {
          await editTelegramMessage(chatId, messageId, "⚠️ *Rascunho não encontrado.*");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const { error: insErr } = await supabase.from('transactions').insert({
          user_id: targetDraft.user_id,
          type: targetDraft.type,
          amount: targetDraft.amount,
          description: targetDraft.description,
          category_id: targetDraft.category_id,
          account_id: targetDraft.account_id,
          date: new Date().toISOString()
        });

        if (insErr) {
          await editTelegramMessage(chatId, messageId, `❌ *Erro ao salvar no banco:* ${insErr.message}`);
        } else {
          await supabase.from('telegram_drafts').delete().eq('id', targetDraftId);
          await editTelegramMessage(
            chatId,
            messageId,
            `✅ *Lançamento confirmado e registrado no banco!*\n\n` +
            `💰 *Valor:* R$ ${Number(targetDraft.amount).toFixed(2)}\n` +
            `📝 *Descrição:* ${targetDraft.description}`
          );
        }
      } 
      // CANCEL
      else if (action === 'x') {
        const targetDraftId = parts[1];
        await supabase.from('telegram_drafts').delete().eq('id', targetDraftId);
        await editTelegramMessage(chatId, messageId, "❌ *Lançamento cancelado.*");
      }
      // EDIT VALUE PROMPT
      else if (action === 'val') {
        const targetDraftId = parts[1];
        await supabase.from('telegram_drafts').update({ status: 'waiting_amount' }).eq('id', targetDraftId);
        await sendTelegram(chatId, "💰 *Envie o novo valor no chat (ex: 45.90):*");
      }
      // EDIT DESCRIPTION PROMPT
      else if (action === 'desc') {
        const targetDraftId = parts[1];
        await supabase.from('telegram_drafts').update({ status: 'waiting_description' }).eq('id', targetDraftId);
        await sendTelegram(chatId, "📝 *Envie a nova descrição no chat:*");
      }
      // SHOW CATEGORY LIST (Uses short prefix for callback data to avoid 64-byte limit)
      else if (action === 'cat') {
        const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', draft.user_id);
        if (!categories || categories.length === 0) {
          await answerCallback(cb.id, "Nenhuma categoria cadastrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const keyboardRows: any[] = [];
        for (let i = 0; i < categories.length; i += 2) {
          const catId1 = categories[i].id;
          const row = [{ text: `🏷️ ${categories[i].name}`, callback_data: `sct|${catId1}` }];
          if (categories[i + 1]) {
            const catId2 = categories[i + 1].id;
            row.push({ text: `🏷️ ${categories[i + 1].name}`, callback_data: `sct|${catId2}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${draft.id}` }]);

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
          const accId1 = accounts[i].id;
          const row = [{ text: `🏦 ${accounts[i].name}`, callback_data: `sac|${accId1}` }];
          if (accounts[i + 1]) {
            const accId2 = accounts[i + 1].id;
            row.push({ text: `🏦 ${accounts[i + 1].name}`, callback_data: `sac|${accId2}` });
          }
          keyboardRows.push(row);
        }
        keyboardRows.push([{ text: "⬅️ Voltar", callback_data: `back|${draft.id}` }]);

        await editTelegramMessage(chatId, messageId, "🏦 *Selecione a Conta:*", { inline_keyboard: keyboardRows });
      }
      // SET CATEGORY
      else if (action === 'sct') {
        const catId = parts[1];
        if (draft) {
          await supabase.from('telegram_drafts').update({ category_id: catId, status: 'active' }).eq('id', draft.id);
          const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draft.id).single();
          if (updated) await renderDraftCard(chatId, messageId, updated);
        }
      }
      // SET ACCOUNT
      else if (action === 'sac') {
        const accId = parts[1];
        if (draft) {
          await supabase.from('telegram_drafts').update({ account_id: accId, status: 'active' }).eq('id', draft.id);
          const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draft.id).single();
          if (updated) await renderDraftCard(chatId, messageId, updated);
        }
      }
      // BACK
      else if (action === 'back') {
        if (draft) {
          await supabase.from('telegram_drafts').update({ status: 'active' }).eq('id', draft.id);
          const { data: updated } = await supabase.from('telegram_drafts').select('*').eq('id', draft.id).single();
          if (updated) await renderDraftCard(chatId, messageId, updated);
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 2. DOCUMENT / PHOTO PROCESSING
    const doc = body.message?.document;
    const photo = body.message?.photo;
    
    if (doc || (photo && photo.length > 0)) {
      const chatId = String(body.message.chat.id).trim();
      const userId = await getUserIdByChatId(chatId);
      
      if (!userId) {
        await sendTelegram(chatId, `⚠️ *Telegram não vinculado.*\nSeu Chat ID é: \`${chatId}\``);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Try to load Gemini & Groq Keys
      if (!GEMINI_API_KEY || !GROQ_API_KEY) {
        const { data: profile } = await supabase.from('profiles').select('gemini_api_key, groq_api_key').eq('user_id', userId).maybeSingle();
        if (profile?.gemini_api_key) GEMINI_API_KEY = profile.gemini_api_key;
        if (profile?.groq_api_key) GROQ_API_KEY = profile.groq_api_key;
      }

      await sendTelegram(chatId, "🔍 *Analisando documento com IA...*");

      try {
        let fileId = "";
        if (doc) {
          fileId = doc.file_id;
        } else {
          fileId = photo[photo.length - 1].file_id;
        }

        const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();
        
        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
          
          let aiResult = await analyzeReceipt(fileUrl);
          
          if (!aiResult) {
            console.log("Retrying OCR with fallback strategy...");
            await sendTelegram(chatId, "🔄 *Primeira tentativa falhou. Tentando com estratégia de contraste...*");
            // Here we could add image processing if we had a library, but since we're in Edge Functions
            // we'll try a more descriptive prompt as a "recovery" logic.
            aiResult = await analyzeReceipt(fileUrl, "Analise este documento com ATENÇÃO REDOBRADA. Extraia o valor total mesmo que a imagem esteja difícil. Retorne JSON: {\"amount\": number, \"description\": string, \"type\": \"expense\", \"date\": string}");
          }

          if (aiResult) {
            let categoryId = null;
            const { data: categories } = await supabase.from('categories').select('id, name').eq('user_id', userId);
            if (categories && categories.length > 0) {
              const matched = matchCategory(aiResult.description, categories);
              if (matched) categoryId = matched.id;
            }

            let accountId = null;
            let { data: accounts } = await supabase.from('accounts').select('id').eq('user_id', userId).limit(1);
            if (!accounts || accounts.length === 0) {
              const { data: bAccs } = await supabase.from('bank_accounts').select('id').eq('user_id', userId).limit(1);
              accounts = bAccs;
            }
            if (accounts && accounts.length > 0) accountId = accounts[0].id;

            const { data: newDraft } = await supabase.from('telegram_drafts').insert({
              user_id: userId,
              chat_id: chatId,
              type: aiResult.type || 'expense',
              amount: aiResult.amount || 0,
              description: aiResult.description || "IA OCR",
              category_id: categoryId,
              account_id: accountId,
              date: aiResult.date || new Date().toISOString().split('T')[0],
              status: 'active'
            }).select().single();

            if (newDraft) {
              await sendNewDraftCard(chatId, newDraft);
              return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
            }
          }
        }
        await sendTelegram(chatId, "❌ *Falha crítica na leitura.* O comprovante parece ilegível para a IA no momento. Tente uma foto com melhor iluminação ou envie o valor manualmente. porem o ocmprovante esta nitido e normal, perfeitamente facil de ler");
      } catch (e) {
        console.error("OCR Processing error:", e);
        await sendTelegram(chatId, "❌ *Erro ao processar arquivo.*");
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 3. TEXT MESSAGES
    const message = body.message || body.edited_message;
    if (!message) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    const chatId = String(message.chat.id).trim();
    const text = message.text || "";

    const userId = await getUserIdByChatId(chatId);
    if (!userId) {
      await sendTelegram(chatId, `⚠️ *Telegram não vinculado.*\nSeu Chat ID é: \`${chatId}\``);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(chatId, "👋 *Bem-vindo ao T2-SimplyFin!*\nEnvie: `despesa 1.00 agua`.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Check waiting_amount
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
      
      if (updated) await sendNewDraftCard(chatId, updated);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Check waiting_description
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

      if (updated) await sendNewDraftCard(chatId, updated);
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

    await sendNewDraftCard(chatId, newDraft);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});
