import { useState, useEffect, useRef, useCallback } from "react";
import { Settings2, Bot, Brain, CheckCircle, Send, Loader2, Download, Upload, DatabaseBackup, AlertTriangle, Cloud, RotateCcw, Trash2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAutoBackup } from "@/hooks/use-auto-backup";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const BACKUP_TABLES = ["accounts", "categories", "transactions", "goals", "budgets", "recurring_transactions", "ai_insights"] as const;

interface CloudBackup {
  name: string;
  created_at: string;
  size: number;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringCloud, setRestoringCloud] = useState<string | null>(null);
  const [creatingCloud, setCreatingCloud] = useState(false);
  const { runBackupNow } = useAutoBackup();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBotToken(data.telegram_bot_token || "");
          setChatId(data.telegram_chat_id || "");
        }
        setLoaded(true);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_bot_token: botToken || null, telegram_chat_id: chatId || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração do Telegram salva!");
  };

  const handleTest = async () => {
    if (!botToken || !chatId) { toast.error("Preencha o token e o Chat ID primeiro."); return; }
    setTesting(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ *T2-FinAI* — Conexão testada com sucesso!", parse_mode: "Markdown" }),
      });
      const data = await resp.json();
      if (data.ok) toast.success("Mensagem de teste enviada!");
      else toast.error(`Erro: ${data.description || "Verifique token e Chat ID"}`);
    } catch { toast.error("Falha ao conectar com a API do Telegram."); }
    finally { setTesting(false); }
  };

  const handleSetWebhook = async () => {
    if (!botToken) { toast.error("Preencha o token do bot primeiro."); return; }
    setSettingWebhook(true);
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`;
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await resp.json();
      if (data.ok) toast.success("Webhook configurado! Agora envie fotos de comprovantes para o bot.");
      else toast.error(`Erro: ${data.description || "Falha ao configurar webhook"}`);
    } catch { toast.error("Falha ao configurar webhook."); }
    finally { setSettingWebhook(false); }
  };

  // === BACKUP: Export ===
  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const backup: Record<string, any[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw new Error(`Erro ao exportar ${table}: ${error.message}`);
        backup[table] = (data || []).map(({ user_id, ...rest }: any) => rest);
      }

      const blob = new Blob(
        [JSON.stringify({ version: 1, exported_at: new Date().toISOString(), tables: backup }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `t2finai-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalRows = Object.values(backup).reduce((s, arr) => s + arr.length, 0);
      toast.success(`Backup exportado! ${totalRows} registros em ${BACKUP_TABLES.length} tabelas.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar backup");
    } finally {
      setExporting(false);
    }
  };

  // === BACKUP: Import ===
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    setImporting(true);
    setImportProgress(0);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.tables) throw new Error("Arquivo de backup inválido.");

      const tables = data.tables as Record<string, any[]>;
      const tableNames = BACKUP_TABLES.filter((t) => tables[t] && tables[t].length > 0);

      if (tableNames.length === 0) throw new Error("Backup vazio — nenhuma tabela com dados.");

      // Delete existing data in reverse dependency order
      const deleteOrder = [...BACKUP_TABLES].reverse();
      for (const table of deleteOrder) {
        await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      setImportProgress(20);

      // Insert in dependency order (categories before transactions, etc.)
      const insertOrder: typeof BACKUP_TABLES[number][] = ["accounts", "categories", "goals", "budgets", "transactions", "recurring_transactions", "ai_insights"];
      let done = 0;

      for (const table of insertOrder) {
        const rows = tables[table];
        if (!rows || rows.length === 0) { done++; continue; }

        // Re-add user_id and insert in batches
        const withUser = rows.map((row: any) => ({ ...row, user_id: user.id }));
        const batchSize = 100;
        for (let i = 0; i < withUser.length; i += batchSize) {
          const batch = withUser.slice(i, i + batchSize);
          const { error } = await supabase.from(table).insert(batch);
          if (error) console.error(`Import error on ${table}:`, error.message);
        }
        done++;
        setImportProgress(20 + Math.round((done / insertOrder.length) * 80));
      }

      // Invalidate all queries
      qc.invalidateQueries();
      const totalRows = Object.values(tables).reduce((s: number, arr: any[]) => s + (arr?.length || 0), 0);
      toast.success(`Backup restaurado! ${totalRows} registros importados.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar backup");
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o sistema</p>
      </div>

      {/* AI */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Inteligência Artificial — Google Gemini</h2>
          </div>
          <Badge variant="outline" className="bg-success/15 text-success border-success/20 text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1" /> Gemini Ativo
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          O T2-FinAI utiliza o <strong className="text-foreground">Google Gemini</strong> via Lovable AI como assistente financeiro. Nenhuma chave externa necessária.
        </p>
        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">Modelo:</strong> Gemini 3 Flash Preview</p>
          <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">Provedor:</strong> Lovable AI Gateway</p>
          <p className="text-[11px] text-muted-foreground">Integrado automaticamente — uso incluso no plano Lovable.</p>
        </div>
      </div>

      {/* Telegram */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Notificações via Telegram</h2>
          </div>
          {botToken && chatId && (
            <Badge variant="outline" className="bg-success/15 text-success border-success/20 text-[10px]">
              <CheckCircle className="h-3 w-3 mr-1" /> Configurado
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Receba alertas e envie fotos de comprovantes para lançar despesas automaticamente via OCR com IA.</p>
        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">Como configurar:</p>
          <p className="text-[11px] text-muted-foreground">1. Abra o Telegram e procure por <strong className="text-foreground">@BotFather</strong></p>
          <p className="text-[11px] text-muted-foreground">2. Envie <code className="bg-background px-1 rounded text-foreground">/newbot</code> e siga as instruções</p>
          <p className="text-[11px] text-muted-foreground">3. Copie o <strong className="text-foreground">Token</strong> gerado e cole abaixo</p>
          <p className="text-[11px] text-muted-foreground">4. Para o Chat ID: <code className="bg-background px-1 rounded text-foreground text-[10px]">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-token" className="text-xs text-muted-foreground">Token do Bot</Label>
          <Input id="telegram-token" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456789:ABCDEF..." className="bg-secondary border-border font-mono text-xs" disabled={!loaded} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-chat" className="text-xs text-muted-foreground">Chat ID</Label>
          <Input id="telegram-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Seu Chat ID" className="bg-secondary border-border font-mono text-xs" disabled={!loaded} />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !loaded} className="gradient-bg-primary text-primary-foreground text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !botToken || !chatId} className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5">
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Testar Envio
          </Button>
          <Button variant="outline" onClick={handleSetWebhook} disabled={settingWebhook || !botToken} className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5">
            {settingWebhook ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
            Ativar OCR via Telegram
          </Button>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">📸 OCR de Comprovantes via Telegram</p>
          <p className="text-[11px] text-muted-foreground">Após ativar, envie uma foto de comprovante para o bot. A IA irá:</p>
          <p className="text-[11px] text-muted-foreground">• Ler o valor, descrição e data automaticamente</p>
          <p className="text-[11px] text-muted-foreground">• Classificar na categoria e conta corretas</p>
          <p className="text-[11px] text-muted-foreground">• Salvar o comprovante como anexo da transação</p>
        </div>
      </div>

      {/* Backup */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Backup Completo</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Exporte todos os seus dados financeiros em um arquivo JSON ou restaure a partir de um backup anterior.
        </p>

        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">Dados incluídos no backup:</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              "Contas bancárias", "Categorias", "Transações", "Metas",
              "Orçamentos", "Recorrentes", "Insights da IA",
            ].map((item) => (
              <p key={item} className="text-[11px] text-muted-foreground">✓ {item}</p>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleExport} disabled={exporting} className="gradient-bg-primary text-primary-foreground text-xs gap-1.5 flex-1">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exportando..." : "Exportar Backup"}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5 flex-1"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importing ? "Importando..." : "Restaurar Backup"}
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {importing && (
          <div className="space-y-1.5">
            <Progress value={importProgress} className="h-2 [&>div]:bg-primary" />
            <p className="text-[10px] text-muted-foreground text-center">{importProgress}% concluído</p>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-warning">
            <strong>Atenção:</strong> Restaurar um backup substituirá todos os dados atuais. Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>

      {/* Geral */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Geral</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Mais configurações serão adicionadas em breve, incluindo temas e preferências de exibição.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
