import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

  const botToken = TELEGRAM_BOT_TOKEN;

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    if (!botToken) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
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

  const editMessage = async (chatId: number | string, messageId: number, text: string, replyMarkup?: any) => {
    if (!botToken) return;
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
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

  try {
    const body = await req.json();
    console.log("Recebido Webhook Payload:", JSON.stringify(body));

    const message = body.message || body.edited_message;
    const callbackQuery = body.callback_query;
    
    const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";
    const callbackData = callbackQuery?.data;
    const messageId = callbackQuery?.message?.message_id;

    if (!chatId) {
      return new Response(JSON.stringify({ error: "Missing chat_id" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Busca o usuário vinculado ao Telegram
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id, name')
      .or(`telegram_chat_id.eq.${chatId},telegram_chat_id.eq.${String(chatId)}`)
      .maybeSingle();

    if (profileErr || !profile) {
      await sendTelegram(
        chatId,
        `⚠️ *Atenção:* Seu Telegram não está vinculado a nenhuma conta no T2-SimplyFin.\n\n` +
        `Seu ID do Telegram é: \`${chatId}\`\n` +
        `Copie esse ID e vincule-o no painel em Configurações.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const userId = profile.user_id;

    // --- CALLBACK HANDLER (Botoes de Confirmar/Cancelar/Editar) ---
    if (callbackData && messageId) {
      const [action, pendingId] = callbackData.split(':');
      
      if (action === 'confirm') {
        // Busca a transação pendente
        const { data: pending, error: pendingErr } = await supabase
          .from('pending_ocr_transactions')
          .select('*')
          .eq('id', pendingId)
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (pendingErr || !pending) {
          await editMessage(chatId, messageId, "⚠️ Transação já processada ou não encontrada.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // Insere na tabela de transações reais
        const { error: insErr } = await supabase.from('transactions').insert({
          user_id: userId,
          amount: pending.amount,
          description: pending.description,
          date: pending.date || new Date().toISOString().split('T')[0],
          type: pending.type || 'expense',
          category_id: pending.category_id,
          account_id: pending.account_id,
          status: 'paid'
        });

        if (insErr) {
          await sendTelegram(chatId, "❌ Erro ao salvar transação final.");
        } else {
          await supabase.from('pending_ocr_transactions').update({ status: 'confirmed' }).eq('id', pendingId);
          const emoji = pending.type === 'income' ? '📈' : '✅';
          const label = pending.type === 'income' ? 'Receita' : 'Despesa';
          await editMessage(chatId, messageId, `${emoji} *${label} Confirmada!*\n\n💰 Valor: R$ ${Number(pending.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 Descrição: ${pending.description}`);
        }
      } else if (action === 'cancel') {
        await supabase.from('pending_ocr_transactions').update({ status: 'cancelled' }).eq('id', pendingId);
        await editMessage(chatId, messageId, "❌ Lançamento cancelado.");
      } else if (action.startsWith('edit_')) {
        await sendTelegram(chatId, "📝 Função de edição rápida em breve! Por enquanto, use o painel web para ajustes finos.");
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // --- TEXT PROCESSING (DeepSeek AI) ---
    if (text) {
      if (text.startsWith('/start') || text.startsWith('/help')) {
        await sendTelegram(
          chatId,
          `👋 *Olá ${profile.name || ''}! Sou seu assistente SimplyFin.*\\n\\n` +
          `Envie textos como:\\n` +
          `• \`50.00 almoco\`\\n` +
          `• \`receita 2500 salario\`\\n\\n` +
          `Vou detectar automaticamente e pedir sua confirmação!`
        );
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Se for teste do painel
      if (body.type === "test" || text === "/test") {
        await sendTelegram(chatId, "✅ *T2-SimplyFin — Conexão testada com sucesso!*");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Processamento com DeepSeek
      if (!DEEPSEEK_API_KEY) {
        // Fallback simples se não houver chave de IA
        await sendTelegram(chatId, "⚠️ IA não configurada no servidor. Contate o administrador.");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      const aiResp = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { 
              role: "system", 
              content: "Extraia dados financeiros. Retorne APENAS JSON: {is_transaction: boolean, type: 'expense'|'income', amount: number, description: string}. Se não for transação, is_transaction: false." 
            }, 
            { role: "user", content: text }
          ],
          response_format: { type: "json_object" }
        })
      });

      const aiData = await aiResp.json();
      const result = JSON.parse(aiData.choices[0].message.content);

      if (result.is_transaction && result.amount > 0) {
        const { data: pending, error: pErr } = await supabase.from('pending_ocr_transactions').insert({
          user_id: userId,
          amount: result.amount,
          description: result.description || "Telegram",
          type: result.type || 'expense',
          status: 'pending',
          date: new Date().toISOString().split('T')[0]
        }).select('id').single();

        if (pErr) throw pErr;

        const emoji = result.type === 'income' ? '📈' : '📉';
        const label = result.type === 'income' ? 'Receita' : 'Despesa';

        await sendTelegram(chatId, 
          `${emoji} *${label} detectada — Confirme:*\n\n` +
          `💰 *Valor:* R$ ${Number(result.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `📝 *Descrição:* ${result.description || "Sem descrição"}\n` +
          `📅 *Data:* ${new Date().toISOString().split('T')[0]}\n` +
          `🏷️ *Categoria:* Sem categoria\n` +
          `🏦 *Conta:* Sem conta`,
          {
            inline_keyboard: [
              [{ text: "✅ Confirmar", callback_data: `confirm:${pending.id}` }, { text: "❌ Cancelar", callback_data: `cancel:${pending.id}` }],
              [{ text: "✏️ Categoria", callback_data: `edit_cat:${pending.id}` }, { text: "✏️ Conta", callback_data: `edit_acc:${pending.id}` }],
              [{ text: "✏️ Valor", callback_data: `edit_val:${pending.id}` }, { text: "✏️ Descrição", callback_data: `edit_desc:${pending.id}` }]
            ]
          }
        );
      } else {
        await sendTelegram(chatId, "🤔 Não consegui entender esse lançamento. Tente algo como '50 cafe' ou 'receita 1000'");
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Erro interno no Webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});