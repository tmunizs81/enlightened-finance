import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update).slice(0, 500));

    const message = update.message;
    if (!message) return new Response("ok");

    const chatId = String(message.chat.id);

    // Find user by telegram_chat_id
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token")
      .eq("telegram_chat_id", chatId)
      .single();

    if (profileErr || !profile) {
      console.log("No profile found for chat_id:", chatId);
      return new Response("ok");
    }

    const userId = profile.user_id;
    const botToken = profile.telegram_bot_token;

    // Helper to send Telegram message
    const sendTg = async (text: string) => {
      if (!botToken) return;
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
          }),
        }
      );
    };

    // Check if message has a photo
    const photo = message.photo;
    if (!photo || photo.length === 0) {
      // If it's just text, ignore or reply
      if (message.text) {
        await sendTg(
          "📸 Para lançar uma despesa automaticamente, envie a *foto do comprovante*."
        );
      }
      return new Response("ok");
    }

    await sendTg("🔍 Analisando comprovante... Aguarde um momento.");

    // Get largest photo
    const fileId = photo[photo.length - 1].file_id;

    // Get file path from Telegram
    const fileResp = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    );
    const fileData = await fileResp.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      await sendTg("❌ Não consegui baixar a imagem. Tente novamente.");
      return new Response("ok");
    }

    // Download the image
    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const imageResp = await fetch(imageUrl);
    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    const base64Image = btoa(String.fromCharCode(...imageBytes));
    const mimeType = fileData.result.file_path.endsWith(".png")
      ? "image/png"
      : "image/jpeg";

    // Get user's categories and accounts for context
    const [catRes, accRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", userId),
      supabase
        .from("accounts")
        .select("id, name, type")
        .eq("user_id", userId),
    ]);

    const categories = catRes.data || [];
    const accounts = accRes.data || [];

    const expenseCategories = categories.filter(
      (c: any) => c.type === "expense"
    );
    const categoryList = expenseCategories
      .map((c: any) => `- "${c.name}" (id: ${c.id})`)
      .join("\n");
    const accountList = accounts
      .map((a: any) => `- "${a.name}" tipo: ${a.type} (id: ${a.id})`)
      .join("\n");

    // Send image to Gemini via Lovable AI Gateway for OCR
    const aiPrompt = `Você é um assistente financeiro que analisa comprovantes de pagamento.
Analise esta imagem de comprovante/recibo e extraia as seguintes informações:
- valor (número decimal, ex: 150.50)
- descrição curta da despesa (máximo 50 caracteres)
- data da transação (formato YYYY-MM-DD, se não visível use a data de hoje: ${new Date().toISOString().split("T")[0]})

Com base na descrição, escolha a categoria e conta mais adequadas dentre as opções do usuário.

Categorias de despesa disponíveis:
${categoryList || "Nenhuma categoria cadastrada"}

Contas disponíveis:
${accountList || "Nenhuma conta cadastrada"}

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem explicação. Formato:
{
  "amount": 150.50,
  "description": "Compra supermercado",
  "date": "2026-03-08",
  "category_id": "uuid-da-categoria-ou-null",
  "account_id": "uuid-da-conta-ou-null",
  "confidence": "high|medium|low"
}

Se não conseguir ler o comprovante, retorne:
{"error": "Não foi possível ler o comprovante"}`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: aiPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      await sendTg(
        "❌ Erro ao analisar o comprovante com IA. Tente novamente mais tarde."
      );
      return new Response("ok");
    }

    const aiData = await aiResponse.json();
    const rawContent =
      aiData.choices?.[0]?.message?.content || "";
    console.log("AI raw response:", rawContent);

    // Parse JSON from AI response (handle potential markdown wrapping)
    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      await sendTg(
        "❌ Não consegui interpretar o comprovante. Tente enviar uma foto mais nítida."
      );
      return new Response("ok");
    }

    if (parsed.error) {
      await sendTg(`❌ ${parsed.error}`);
      return new Response("ok");
    }

    const amount = Number(parsed.amount);
    if (!amount || isNaN(amount)) {
      await sendTg(
        "❌ Não consegui identificar o valor no comprovante. Tente novamente."
      );
      return new Response("ok");
    }

    // Upload receipt image to storage
    const receiptPath = `${userId}/${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(receiptPath, imageBytes, {
        contentType: mimeType,
        upsert: false,
      });

    let receiptUrl: string | null = null;
    if (!uploadErr) {
      const { data: publicData } = supabase.storage
        .from("receipts")
        .getPublicUrl(receiptPath);
      receiptUrl = publicData?.publicUrl || null;
    }

    // Insert transaction
    const txData: any = {
      user_id: userId,
      type: "expense",
      amount,
      description: parsed.description || "Despesa via Telegram",
      date: parsed.date || new Date().toISOString().split("T")[0],
      status: "completed",
      notes: `Lançado automaticamente via Telegram (confiança: ${parsed.confidence || "medium"})`,
      receipt_url: receiptUrl,
    };

    if (parsed.category_id) txData.category_id = parsed.category_id;
    if (parsed.account_id) txData.account_id = parsed.account_id;

    const { error: insertErr } = await supabase
      .from("transactions")
      .insert(txData);

    if (insertErr) {
      console.error("Insert error:", insertErr);
      await sendTg("❌ Erro ao salvar a despesa. Tente novamente.");
      return new Response("ok");
    }

    // Find names for the response
    const catName =
      categories.find((c: any) => c.id === parsed.category_id)?.name ||
      "Sem categoria";
    const accName =
      accounts.find((a: any) => a.id === parsed.account_id)?.name ||
      "Sem conta";

    const confirmMsg = `✅ *Despesa lançada com sucesso!*

💰 *Valor:* R$ ${amount.toFixed(2)}
📝 *Descrição:* ${parsed.description}
📅 *Data:* ${parsed.date}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}
🔒 *Confiança:* ${parsed.confidence || "medium"}
${receiptUrl ? "📎 Comprovante salvo" : ""}`;

    await sendTg(confirmMsg);

    return new Response("ok");
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("ok");
  }
});
