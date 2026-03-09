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
    // Cleanup expired pending OCR transactions (>24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("pending_ocr_transactions")
      .delete()
      .lt("created_at", cutoff)
      .in("status", ["pending", "editing"])
      .then(({ data, error }) => {
        if (error) console.error("Cleanup error:", error.message);
      });

    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update).slice(0, 800));

    // --- HANDLE CALLBACK QUERY (button presses) ---
    if (update.callback_query) {
      return await handleCallbackQuery(update.callback_query, supabase);
    }

    const message = update.message;
    if (!message) return new Response("ok");

    const chatId = String(message.chat.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, telegram_bot_token")
      .eq("telegram_chat_id", chatId)
      .single();

    if (!profile) {
      console.log("No profile for chat_id:", chatId);
      return new Response("ok");
    }

    const userId = profile.user_id;
    const botToken = profile.telegram_bot_token;

    const sendTg = async (text: string, extra: any = {}) => {
      if (!botToken) return;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
      });
    };

    // --- Check if user is in edit mode for a pending transaction ---
    const { data: pendingEdit } = await supabase
      .from("pending_ocr_transactions")
      .select("*")
      .eq("chat_id", chatId)
      .eq("status", "editing")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingEdit && message.text && !message.text.startsWith("/")) {
      return await handleEditResponse(pendingEdit, message.text, supabase, botToken, chatId);
    }

    // --- HANDLE TEXT COMMANDS ---
    if (message.text) {
      const cmd = message.text.trim().toLowerCase().split(" ")[0];
      const args = message.text.trim().slice(cmd.length).trim();

      if (cmd === "/start" || cmd === "/help" || cmd === "/ajuda") {
        await sendTg(
`🤖 *T2-FinAI Bot — Comandos disponíveis:*

💰 /saldo — Saldo atual de todas as contas
📊 /extrato — Últimas 10 transações
📉 /despesas — Resumo de despesas do mês
📈 /receitas — Resumo de receitas do mês
➕ /despesa \`valor descrição\` — Lançar despesa rápida
➕ /receita \`valor descrição\` — Lançar receita rápida
🎯 /metas — Progresso das metas
💳 /contas — Lista de contas
🏷️ /categorias — Lista de categorias
📸 *Envie uma foto* — OCR de comprovante

_Exemplo: /despesa 45.90 Almoço restaurante_`
        );
        return new Response("ok");
      }

      if (cmd === "/cancelar") {
        if (pendingEdit) {
          await supabase.from("pending_ocr_transactions").update({ status: "pending", edit_field: null }).eq("id", pendingEdit.id);
          await sendTg("↩️ Edição cancelada.");
        } else {
          await sendTg("Nenhuma edição em andamento.");
        }
        return new Response("ok");
      }

      if (cmd === "/saldo") {
        return await handleSaldo(supabase, userId, sendTg);
      }
      if (cmd === "/extrato") {
        return await handleExtrato(supabase, userId, sendTg);
      }
      if (cmd === "/despesas") {
        return await handleResumoMes(supabase, userId, "expense", sendTg);
      }
      if (cmd === "/receitas") {
        return await handleResumoMes(supabase, userId, "income", sendTg);
      }
      if (cmd === "/despesa") {
        return await handleLancamentoRapido(supabase, userId, "expense", args, sendTg);
      }
      if (cmd === "/receita") {
        return await handleLancamentoRapido(supabase, userId, "income", args, sendTg);
      }
      if (cmd === "/metas") {
        return await handleMetas(supabase, userId, sendTg);
      }
      if (cmd === "/contas") {
        return await handleContas(supabase, userId, sendTg);
      }
      if (cmd === "/categorias") {
        return await handleCategorias(supabase, userId, sendTg);
      }

      // Unknown text — show help hint
      await sendTg("📸 Envie uma *foto de comprovante* ou digite /ajuda para ver os comandos.");
      return new Response("ok");
    }

    // --- HANDLE PHOTO ---
    const photo = message.photo;
    if (!photo || photo.length === 0) {
      return new Response("ok");
    }

    await sendTg("🔍 Analisando comprovante... Aguarde um momento.");

    // Download image
    const fileId = photo[photo.length - 1].file_id;
    const fileResp = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileResp.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      await sendTg("❌ Não consegui baixar a imagem. Tente novamente.");
      return new Response("ok");
    }

    const imageUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    const imageResp = await fetch(imageUrl);
    const imageBytes = new Uint8Array(await imageResp.arrayBuffer());
    // Convert to base64 in chunks to avoid stack overflow with large images
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      const chunk = imageBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64Image = btoa(binary);
    const mimeType = fileData.result.file_path.endsWith(".png") ? "image/png" : "image/jpeg";

    // Get categories & accounts
    const [catRes, accRes] = await Promise.all([
      supabase.from("categories").select("id, name, type").eq("user_id", userId),
      supabase.from("accounts").select("id, name, type").eq("user_id", userId),
    ]);

    const categories = catRes.data || [];
    const accounts = accRes.data || [];
    const expenseCategories = categories.filter((c: any) => c.type === "expense");

    const categoryList = expenseCategories.map((c: any) => `- "${c.name}" (id: ${c.id})`).join("\n");
    const accountList = accounts.map((a: any) => `- "${a.name}" tipo: ${a.type} (id: ${a.id})`).join("\n");

    // AI OCR
    const aiPrompt = `Você é um assistente financeiro que analisa comprovantes de pagamento.
Analise esta imagem e extraia:
- valor (número decimal, ex: 150.50)
- descrição curta (máximo 50 caracteres)
- data (YYYY-MM-DD, se não visível use: ${new Date().toISOString().split("T")[0]})

Categorias de despesa:
${categoryList || "Nenhuma"}

Contas:
${accountList || "Nenhuma"}

Responda APENAS JSON:
{"amount":150.50,"description":"Compra supermercado","date":"2026-03-08","category_id":"uuid-ou-null","account_id":"uuid-ou-null","confidence":"high|medium|low"}

Se não conseguir ler: {"error":"Não foi possível ler o comprovante"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: aiPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        }],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status, await aiResponse.text());
      await sendTg("❌ Erro ao analisar o comprovante. Tente novamente.");
      return new Response("ok");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    console.log("AI response:", rawContent);

    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      await sendTg("❌ Não consegui interpretar. Envie uma foto mais nítida.");
      return new Response("ok");
    }

    if (parsed.error) {
      await sendTg(`❌ ${parsed.error}`);
      return new Response("ok");
    }

    const amount = Number(parsed.amount);
    if (!amount || isNaN(amount)) {
      await sendTg("❌ Não identifiquei o valor. Tente novamente.");
      return new Response("ok");
    }

    // Upload receipt
    const receiptPath = `${userId}/${Date.now()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(receiptPath, imageBytes, { contentType: mimeType, upsert: false });

    let receiptUrl: string | null = null;
    if (!uploadErr) {
      const { data: publicData } = supabase.storage.from("receipts").getPublicUrl(receiptPath);
      receiptUrl = publicData?.publicUrl || null;
    }

    // Save as PENDING (not confirmed yet)
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_ocr_transactions")
      .insert({
        user_id: userId,
        chat_id: chatId,
        amount,
        description: parsed.description || "Despesa via Telegram",
        date: parsed.date || new Date().toISOString().split("T")[0],
        category_id: parsed.category_id || null,
        account_id: parsed.account_id || null,
        confidence: parsed.confidence || "medium",
        receipt_url: receiptUrl,
        receipt_path: receiptPath,
        status: "pending",
      })
      .select("id")
      .single();

    if (pendingErr || !pending) {
      console.error("Pending insert error:", pendingErr);
      await sendTg("❌ Erro interno. Tente novamente.");
      return new Response("ok");
    }

    const catName = categories.find((c: any) => c.id === parsed.category_id)?.name || "Sem categoria";
    const accName = accounts.find((a: any) => a.id === parsed.account_id)?.name || "Sem conta";

    const previewMsg = `📋 *Despesa detectada — Confirme os dados:*

💰 *Valor:* R$ ${amount.toFixed(2)}
📝 *Descrição:* ${parsed.description}
📅 *Data:* ${parsed.date}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}
🔒 *Confiança:* ${parsed.confidence || "medium"}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `ocr_confirm:${pending.id}` },
          { text: "❌ Cancelar", callback_data: `ocr_cancel:${pending.id}` },
        ],
        [
          { text: "✏️ Valor", callback_data: `ocr_edit:${pending.id}:amount` },
          { text: "✏️ Descrição", callback_data: `ocr_edit:${pending.id}:description` },
        ],
        [
          { text: "✏️ Data", callback_data: `ocr_edit:${pending.id}:date` },
          { text: "✏️ Categoria", callback_data: `ocr_edit:${pending.id}:category` },
        ],
      ],
    };

    await sendTg(previewMsg, { reply_markup: inlineKeyboard });

    return new Response("ok");
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("ok");
  }
});

// ---- Handle callback query (inline button presses) ----
async function handleCallbackQuery(cbq: any, supabase: any) {
  const data = cbq.data as string;
  const chatId = String(cbq.message.chat.id);
  const messageId = cbq.message.message_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, telegram_bot_token")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!profile) return new Response("ok");
  const botToken = profile.telegram_bot_token;

  const answerCbq = async (text: string) => {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cbq.id, text }),
    });
  };

  const sendTg = async (text: string, extra: any = {}) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra }),
    });
  };

  const editMsg = async (text: string) => {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown" }),
    });
  };

  // Parse action
  const parts = data.split(":");
  const action = parts[0];
  const pendingId = parts[1];

  const { data: pending } = await supabase
    .from("pending_ocr_transactions")
    .select("*")
    .eq("id", pendingId)
    .single();

  if (!pending || pending.status === "confirmed" || pending.status === "cancelled") {
    await answerCbq("Esta despesa já foi processada.");
    return new Response("ok");
  }

  // --- CONFIRM ---
  if (action === "ocr_confirm") {
    const txData: any = {
      user_id: pending.user_id,
      type: "expense",
      amount: pending.amount,
      description: pending.description,
      date: pending.date,
      status: "paid",
      notes: `Lançado via Telegram OCR (confiança: ${pending.confidence})`,
      receipt_url: pending.receipt_url,
    };
    if (pending.category_id) txData.category_id = pending.category_id;
    if (pending.account_id) txData.account_id = pending.account_id;

    const { error } = await supabase.from("transactions").insert(txData);
    if (error) {
      console.error("Insert error:", error);
      await answerCbq("Erro ao salvar.");
      return new Response("ok");
    }

    await supabase.from("pending_ocr_transactions").update({ status: "confirmed" }).eq("id", pendingId);
    await editMsg(`✅ *Despesa salva!*\n\n💰 R$ ${Number(pending.amount).toFixed(2)} — ${pending.description}`);
    await answerCbq("Despesa salva com sucesso!");

    // Trigger spending monitor
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      await fetch(`${SUPABASE_URL}/functions/v1/spending-monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ user_id: pending.user_id }),
      });
    } catch (e) { console.error("Monitor trigger error:", e); }

    return new Response("ok");
  }

  // --- CANCEL ---
  if (action === "ocr_cancel") {
    await supabase.from("pending_ocr_transactions").update({ status: "cancelled" }).eq("id", pendingId);
    // Clean up receipt if uploaded
    if (pending.receipt_path) {
      await supabase.storage.from("receipts").remove([pending.receipt_path]);
    }
    await editMsg("🗑️ Despesa cancelada.");
    await answerCbq("Cancelado.");
    return new Response("ok");
  }

  // --- EDIT ---
  if (action === "ocr_edit") {
    const field = parts[2];
    const fieldLabels: Record<string, string> = {
      amount: "valor (ex: 150.50)",
      description: "descrição (ex: Almoço restaurante)",
      date: "data (formato: YYYY-MM-DD)",
      category: "nome da categoria",
    };

    await supabase.from("pending_ocr_transactions")
      .update({ status: "editing", edit_field: field })
      .eq("id", pendingId);

    await answerCbq(`Editando ${field}`);
    await sendTg(`✏️ Digite o novo *${fieldLabels[field] || field}*:`);
    return new Response("ok");
  }

  await answerCbq("Ação desconhecida.");
  return new Response("ok");
}

// ---- Handle text response while in edit mode ----
async function handleEditResponse(pending: any, text: string, supabase: any, botToken: string, chatId: string) {
  const sendTg = async (msg: string, extra: any = {}) => {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown", ...extra }),
    });
  };

  // Handle /cancelar command
  if (text.trim().toLowerCase() === "/cancelar") {
    await supabase.from("pending_ocr_transactions").update({ status: "pending", edit_field: null }).eq("id", pending.id);
    await sendTg("↩️ Edição cancelada. Use os botões acima para continuar.");
    return new Response("ok");
  }

  const field = pending.edit_field;
  const updateData: any = { status: "pending", edit_field: null };

  if (field === "amount") {
    const val = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (!val || isNaN(val)) {
      await sendTg("❌ Valor inválido. Digite um número (ex: 150.50):");
      return new Response("ok");
    }
    updateData.amount = val;
  } else if (field === "description") {
    updateData.description = text.trim().slice(0, 50);
  } else if (field === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
      await sendTg("❌ Formato inválido. Use YYYY-MM-DD (ex: 2026-03-08):");
      return new Response("ok");
    }
    updateData.date = text.trim();
  } else if (field === "category") {
    // Find category by name (fuzzy)
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", pending.user_id)
      .eq("type", "expense");

    const match = (cats || []).find((c: any) =>
      c.name.toLowerCase().includes(text.trim().toLowerCase())
    );
    if (match) {
      updateData.category_id = match.id;
    } else {
      const catNames = (cats || []).map((c: any) => `• ${c.name}`).join("\n");
      await sendTg(`❌ Categoria não encontrada. Opções:\n${catNames || "Nenhuma"}\n\nDigite o nome ou /cancelar:`);
      return new Response("ok");
    }
  }

  await supabase.from("pending_ocr_transactions").update(updateData).eq("id", pending.id);

  // Fetch updated record and re-send preview with buttons
  const { data: updated } = await supabase
    .from("pending_ocr_transactions")
    .select("*")
    .eq("id", pending.id)
    .single();

  if (!updated) {
    await sendTg("❌ Erro ao atualizar.");
    return new Response("ok");
  }

  // Get category and account names
  let catName = "Sem categoria";
  let accName = "Sem conta";
  if (updated.category_id) {
    const { data: cat } = await supabase.from("categories").select("name").eq("id", updated.category_id).single();
    if (cat) catName = cat.name;
  }
  if (updated.account_id) {
    const { data: acc } = await supabase.from("accounts").select("name").eq("id", updated.account_id).single();
    if (acc) accName = acc.name;
  }

  const previewMsg = `✏️ *Dados atualizados — Confirme:*

💰 *Valor:* R$ ${Number(updated.amount).toFixed(2)}
📝 *Descrição:* ${updated.description}
📅 *Data:* ${updated.date}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `ocr_confirm:${updated.id}` },
        { text: "❌ Cancelar", callback_data: `ocr_cancel:${updated.id}` },
      ],
      [
        { text: "✏️ Valor", callback_data: `ocr_edit:${updated.id}:amount` },
        { text: "✏️ Descrição", callback_data: `ocr_edit:${updated.id}:description` },
      ],
      [
        { text: "✏️ Data", callback_data: `ocr_edit:${updated.id}:date` },
        { text: "✏️ Categoria", callback_data: `ocr_edit:${updated.id}:category` },
      ],
    ],
  };

  await sendTg(previewMsg, { reply_markup: inlineKeyboard });
  return new Response("ok");
}

// ===== COMMAND HANDLERS =====

async function handleSaldo(supabase: any, userId: string, sendTg: Function) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, type, balance")
    .eq("user_id", userId)
    .order("name");

  if (!accounts || accounts.length === 0) {
    await sendTg("💳 Nenhuma conta cadastrada.");
    return new Response("ok");
  }

  let total = 0;
  const lines = accounts.map((a: any) => {
    total += Number(a.balance);
    const emoji = Number(a.balance) >= 0 ? "🟢" : "🔴";
    return `${emoji} *${a.name}* (${a.type})\n    R$ ${Number(a.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  });

  const totalEmoji = total >= 0 ? "🟢" : "🔴";
  await sendTg(`💰 *Saldo das Contas:*\n\n${lines.join("\n\n")}\n\n━━━━━━━━━━━━━━━\n${totalEmoji} *Total:* R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  return new Response("ok");
}

async function handleExtrato(supabase: any, userId: string, sendTg: Function) {
  const { data: txs } = await supabase
    .from("transactions")
    .select("description, amount, type, date, status")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(10);

  if (!txs || txs.length === 0) {
    await sendTg("📊 Nenhuma transação encontrada.");
    return new Response("ok");
  }

  const lines = txs.map((t: any) => {
    const icon = t.type === "income" ? "📈" : "📉";
    const sign = t.type === "income" ? "+" : "-";
    const dateStr = new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR");
    return `${icon} ${dateStr} — ${sign}R$ ${Number(t.amount).toFixed(2)}\n    _${t.description}_`;
  });

  await sendTg(`📊 *Últimas 10 Transações:*\n\n${lines.join("\n\n")}`);
  return new Response("ok");
}

async function handleResumoMes(supabase: any, userId: string, type: string, sendTg: Function) {
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const { data: txs } = await supabase
    .from("transactions")
    .select("description, amount, date, category_id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date", { ascending: false });

  if (!txs || txs.length === 0) {
    const label = type === "expense" ? "despesas" : "receitas";
    await sendTg(`📊 Nenhuma ${label} este mês.`);
    return new Response("ok");
  }

  const total = txs.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const label = type === "expense" ? "Despesas" : "Receitas";
  const icon = type === "expense" ? "📉" : "📈";
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Group by category
  const catIds = [...new Set(txs.filter((t: any) => t.category_id).map((t: any) => t.category_id))];
  let catMap: Record<string, string> = {};
  if (catIds.length > 0) {
    const { data: cats } = await supabase.from("categories").select("id, name").in("id", catIds);
    if (cats) catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
  }

  const byCategory: Record<string, number> = {};
  for (const t of txs) {
    const catName = t.category_id ? (catMap[t.category_id] || "Outros") : "Sem categoria";
    byCategory[catName] = (byCategory[catName] || 0) + Number(t.amount);
  }

  const catLines = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => `  🏷️ ${name}: R$ ${val.toFixed(2)}`)
    .join("\n");

  await sendTg(`${icon} *${label} — ${monthName}*\n\n${catLines}\n\n━━━━━━━━━━━━━━━\n💰 *Total:* R$ ${total.toFixed(2)} (${txs.length} lançamentos)`);
  return new Response("ok");
}

async function handleLancamentoRapido(supabase: any, userId: string, type: string, args: string, sendTg: Function) {
  const label = type === "expense" ? "despesa" : "receita";
  if (!args) {
    await sendTg(`❌ Formato: /${type === "expense" ? "despesa" : "receita"} \`valor descrição\`\n\n_Ex: /${type === "expense" ? "despesa" : "receita"} 45.90 Almoço restaurante_`);
    return new Response("ok");
  }

  const match = args.match(/^([\d.,]+)\s+(.+)/);
  if (!match) {
    await sendTg(`❌ Formato: /${type === "expense" ? "despesa" : "receita"} \`valor descrição\`\n\n_Ex: /${type === "expense" ? "despesa" : "receita"} 45.90 Almoço_`);
    return new Response("ok");
  }

  const amount = Number(match[1].replace(",", "."));
  const description = match[2].trim().slice(0, 50);

  if (!amount || isNaN(amount)) {
    await sendTg("❌ Valor inválido.");
    return new Response("ok");
  }

  // Fetch categories and accounts for AI classification
  const [catRes, accRes] = await Promise.all([
    supabase.from("categories").select("id, name, type").eq("user_id", userId).eq("type", type),
    supabase.from("accounts").select("id, name, type").eq("user_id", userId),
  ]);

  const categories = catRes.data || [];
  const accounts = accRes.data || [];

  let categoryId: string | null = null;
  let accountId: string | null = null;
  let catName = "Sem categoria";
  let accName = "Sem conta";

  // Use AI to classify category and account
  if (categories.length > 0 || accounts.length > 0) {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const catList = categories.map((c: any) => `- "${c.name}" (id: ${c.id})`).join("\n");
        const accList = accounts.map((a: any) => `- "${a.name}" tipo: ${a.type} (id: ${a.id})`).join("\n");

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Classifique esta ${label}: "${description}" (R$ ${amount.toFixed(2)})

Categorias disponíveis (tipo: ${type}):
${catList || "Nenhuma"}

Contas disponíveis:
${accList || "Nenhuma"}

Responda APENAS JSON: {"category_id":"uuid-ou-null","account_id":"uuid-ou-null"}
Escolha a categoria e conta mais adequadas. Se nenhuma se encaixar, use null.`,
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.category_id) {
              categoryId = parsed.category_id;
              catName = categories.find((c: any) => c.id === categoryId)?.name || "Sem categoria";
            }
            if (parsed.account_id) {
              accountId = parsed.account_id;
              accName = accounts.find((a: any) => a.id === accountId)?.name || "Sem conta";
            }
          }
        }
      } catch (e) {
        console.error("AI classification error:", e);
      }
    }
  }

  // Save as PENDING transaction for confirmation
  const chatId = (await supabase.from("profiles").select("telegram_chat_id").eq("user_id", userId).single()).data?.telegram_chat_id;

  const { data: pending, error: pendingErr } = await supabase
    .from("pending_ocr_transactions")
    .insert({
      user_id: userId,
      chat_id: chatId || "",
      amount,
      description,
      date: new Date().toISOString().split("T")[0],
      category_id: categoryId,
      account_id: accountId,
      confidence: "high",
      status: "pending",
    })
    .select("id")
    .single();

  if (pendingErr || !pending) {
    console.error("Pending insert error:", pendingErr);
    await sendTg("❌ Erro interno. Tente novamente.");
    return new Response("ok");
  }

  const icon = type === "income" ? "📈" : "📉";
  const previewMsg = `${icon} *${label.charAt(0).toUpperCase() + label.slice(1)} detectada — Confirme:*

💰 *Valor:* R$ ${amount.toFixed(2)}
📝 *Descrição:* ${description}
📅 *Data:* ${new Date().toLocaleDateString("pt-BR")}
🏷️ *Categoria:* ${catName}
🏦 *Conta:* ${accName}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `cmd_confirm:${pending.id}:${type}` },
        { text: "❌ Cancelar", callback_data: `ocr_cancel:${pending.id}` },
      ],
      [
        { text: "✏️ Categoria", callback_data: `ocr_edit:${pending.id}:category` },
        { text: "✏️ Conta", callback_data: `ocr_edit:${pending.id}:account` },
      ],
      [
        { text: "✏️ Valor", callback_data: `ocr_edit:${pending.id}:amount` },
        { text: "✏️ Descrição", callback_data: `ocr_edit:${pending.id}:description` },
      ],
    ],
  };

  await sendTg(previewMsg, { reply_markup: inlineKeyboard });
  return new Response("ok");
}

async function handleMetas(supabase: any, userId: string, sendTg: Function) {
  const { data: goals } = await supabase
    .from("goals")
    .select("name, target_amount, current_amount, deadline")
    .eq("user_id", userId)
    .order("name");

  if (!goals || goals.length === 0) {
    await sendTg("🎯 Nenhuma meta cadastrada.");
    return new Response("ok");
  }

  const lines = goals.map((g: any) => {
    const pct = g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
    const bar = "█".repeat(Math.floor(pct / 10)) + "░".repeat(10 - Math.floor(pct / 10));
    const deadlineStr = g.deadline ? ` (até ${new Date(g.deadline + "T00:00:00").toLocaleDateString("pt-BR")})` : "";
    return `🎯 *${g.name}*${deadlineStr}\n  ${bar} ${pct}%\n  R$ ${Number(g.current_amount).toFixed(2)} / R$ ${Number(g.target_amount).toFixed(2)}`;
  });

  await sendTg(`🎯 *Progresso das Metas:*\n\n${lines.join("\n\n")}`);
  return new Response("ok");
}

async function handleContas(supabase: any, userId: string, sendTg: Function) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("name, type, balance, institution")
    .eq("user_id", userId)
    .order("name");

  if (!accounts || accounts.length === 0) {
    await sendTg("💳 Nenhuma conta cadastrada.");
    return new Response("ok");
  }

  const lines = accounts.map((a: any) => {
    const inst = a.institution ? ` — ${a.institution}` : "";
    return `💳 *${a.name}* (${a.type}${inst})\n  R$ ${Number(a.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  });

  await sendTg(`💳 *Suas Contas:*\n\n${lines.join("\n\n")}`);
  return new Response("ok");
}

async function handleCategorias(supabase: any, userId: string, sendTg: Function) {
  const { data: cats } = await supabase
    .from("categories")
    .select("name, type, icon")
    .eq("user_id", userId)
    .order("type")
    .order("name");

  if (!cats || cats.length === 0) {
    await sendTg("🏷️ Nenhuma categoria cadastrada.");
    return new Response("ok");
  }

  const expenses = cats.filter((c: any) => c.type === "expense");
  const incomes = cats.filter((c: any) => c.type === "income");

  const fmtList = (list: any[]) => list.map((c: any) => `  ${c.icon || "•"} ${c.name}`).join("\n");

  let msg = "🏷️ *Suas Categorias:*\n\n";
  if (expenses.length > 0) msg += `📉 *Despesas:*\n${fmtList(expenses)}\n\n`;
  if (incomes.length > 0) msg += `📈 *Receitas:*\n${fmtList(incomes)}`;

  await sendTg(msg);
  return new Response("ok");
}
