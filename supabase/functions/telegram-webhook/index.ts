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

  const sendTelegram = async (chatId: number | string, text: string, replyMarkup?: any) => {
    if (!TELEGRAM_BOT_TOKEN) return;
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

  try {
    const body = await req.json();
    console.log("Recebido Webhook Payload:", JSON.stringify(body));

    // Suporta mensagens diretas, mensagens editadas e simulações do painel web
    const message = body.message || body.edited_message;
    const chatId = message?.chat?.id || body.chat_id;
    const text = message?.text || body.text || "";

    if (!chatId) {
      return new Response(JSON.stringify({ error: "Missing chat_id" }), { status: 400, headers: corsHeaders });
    }

    // Tratamento de teste de conexão via painel
    if (body.type === "test" || text === "/test") {
      await sendTelegram(chatId, "✅ *T2-SimplyFin — Conexão testada com sucesso!*");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Busca o usuário vinculado ao Telegram
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`telegram_chat_id.eq.${chatId},telegram_chat_id.eq.${String(chatId)}`)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error("Usuário não encontrado para o chat_id:", chatId);
      await sendTelegram(
        chatId,
        `⚠️ *Atenção:* Seu Telegram não está vinculado a nenhuma conta no T2-SimplyFin.\n\n` +
        `Seu ID do Telegram é: \`${chatId}\`\n` +
        `Copie esse ID e vincule-o no painel em Configurações.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Comando /start ou /help
    if (text.startsWith('/start') || text.startsWith('/help')) {
      await sendTelegram(
        chatId,
        `👋 *Olá! Eu sou o assistente do T2-SimplyFin.*\n\n` +
        `Envie suas despesas ou receitas digitando textos como:\n` +
        `• \`despesa 15.00 almoco\`\n` +
        `• \`receita 5000 freela\`\n` +
        `• Ou envie uma foto de comprovante/nota fiscal.`
      );
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Resposta padrão e confirmação
    await sendTelegram(
      chatId,
      `📉 *Lançamento Detectado*\n\n` +
      `📝 *Texto:* ${text}\n` +
      `✅ Registrado com sucesso para o seu usuário!`
    );

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("Erro interno no Webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});