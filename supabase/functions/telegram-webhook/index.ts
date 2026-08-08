import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8837475856:AAG_LBcIO1kr89gjCWsYdO0MOYGejR_u1r8";
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    
    // Simplificação Máxima: Processamento direto do Webhook
    if (body.message?.photo || body.message?.document) {
      const chatId = body.message.chat.id;
      const fileId = body.message.document?.file_id || body.message.photo?.[body.message.photo.length - 1]?.file_id;

      // 1. Obter URL do arquivo
      const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;

      // 2. Buscar DeepSeek Key do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, deepseek_api_key')
        .eq('telegram_chat_id', String(chatId))
        .maybeSingle();

      const apiKey = profile?.deepseek_api_key || Deno.env.get('DEEPSEEK_API_KEY');

      if (!apiKey) {
        throw new Error("DeepSeek API Key não configurada.");
      }

      // 3. Chamada Única DeepSeek (Multimodal)
      // Nota: DeepSeek R1/V3 suporta visão via chat completions se disponível no endpoint
      const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-chat", // Ou o modelo vision específico se disponível
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extraia valor, descricao, data (YYYY-MM-DD) e estabelecimento deste comprovante. Responda APENAS JSON." },
                { type: "image_url", image_url: { url: fileUrl } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        })
      });

      const dsData = await dsRes.json();
      const extracted = JSON.parse(dsData.choices[0].message.content);

      // 4. Retorno Limpo
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ *DeepSeek OCR:* R$ ${extracted.valor}\n📝 ${extracted.descricao}\n📅 ${extracted.data}`
        })
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});