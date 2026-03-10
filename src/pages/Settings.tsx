import { useState, useEffect, useRef, useCallback } from "react";
import { Settings2, Bot, Brain, CheckCircle, Send, Loader2, Download, Upload, DatabaseBackup, AlertTriangle, Cloud, RotateCcw, Trash2, Clock, UserPlus, Users, Bell, BellOff, Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
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
  const { isAdmin } = useUserRole();
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

  // User management state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [newUserTelegramChatId, setNewUserTelegramChatId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

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

  const loadCloudBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", { body: { action: "list" } });
      if (error) throw error;
      setCloudBackups(data.backups || []);
    } catch (e: any) { console.error("Error loading backups:", e); }
    finally { setLoadingBackups(false); }
  }, []);

  useEffect(() => { if (user) loadCloudBackups(); }, [user, loadCloudBackups]);

  const handleCloudBackupNow = async () => {
    if (!user) return;
    setCreatingCloud(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", { body: { action: "create" } });
      if (error) throw error;
      toast.success(`Backup na nuvem criado! ${data.totalRows} registros salvos.`);
      loadCloudBackups();
    } catch (e: any) { toast.error(e.message || "Erro ao criar backup"); }
    finally { setCreatingCloud(false); }
  };

  const handleCloudRestore = async (filename: string) => {
    if (!user) return;
    setRestoringCloud(filename);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", { body: { action: "restore", filename } });
      if (error) throw error;
      qc.invalidateQueries();
      toast.success(`Backup restaurado! ${data.totalRows} registros importados.`);
    } catch (e: any) { toast.error(e.message || "Erro ao restaurar backup"); }
    finally { setRestoringCloud(null); }
  };

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

  const handleDetectChatId = async () => {
    if (!botToken) { toast.error("Preencha o token do bot primeiro."); return; }
    setTesting(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
      const data = await resp.json();
      if (data.ok && data.result && data.result.length > 0) {
        const lastUpdate = data.result[data.result.length - 1];
        const detectedChatId = String(lastUpdate.message?.chat?.id || lastUpdate.callback_query?.message?.chat?.id || "");
        if (detectedChatId) {
          setChatId(detectedChatId);
          toast.success(`Chat ID detectado: ${detectedChatId}\n\nAgora clique em "Salvar Configuração"`);
        } else {
          toast.error("Nenhuma mensagem encontrada. Envie /start para o bot primeiro.");
        }
      } else {
        toast.error("Envie /start para o bot no Telegram primeiro, depois clique aqui novamente.");
      }
    } catch { toast.error("Falha ao detectar Chat ID."); }
    finally { setTesting(false); }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) { toast.error("Preencha o token e o Chat ID primeiro."); return; }
    setTesting(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ *T2-SimplyFin* — Conexão testada com sucesso!", parse_mode: "Markdown" }),
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

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Email e senha são obrigatórios.");
      return;
    }

    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserName || newUserEmail.split("@")[0],
          role: newUserRole,
          telegramChatId: newUserTelegramChatId || null,
          telegramBotToken: botToken || null,
        },
      });

      if (error) throw error;

      toast.success(`Usuário ${newUserEmail} criado com sucesso!`);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserName("");
      setNewUserRole("user");
      setNewUserTelegramChatId("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar usuário");
    } finally {
      setCreatingUser(false);
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
          O T2-SimplyFin utiliza o <strong className="text-foreground">Google Gemini</strong> via Lovable AI como assistente financeiro. Nenhuma chave externa necessária.
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
          <p className="text-[11px] text-muted-foreground">4. Envie <code className="bg-background px-1 rounded text-foreground">/start</code> para o seu bot no Telegram</p>
          <p className="text-[11px] text-muted-foreground">5. Clique em <strong className="text-foreground">"Detectar Chat ID"</strong> abaixo</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-token" className="text-xs text-muted-foreground">Token do Bot</Label>
          <Input id="telegram-token" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456789:ABCDEF..." className="bg-secondary border-border font-mono text-xs" disabled={!loaded} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="telegram-chat" className="text-xs text-muted-foreground">Chat ID</Label>
            <Button variant="ghost" size="sm" onClick={handleDetectChatId} disabled={testing || !botToken} className="text-[10px] h-6 px-2 text-primary">
              {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔍 Detectar Chat ID"}
            </Button>
          </div>
          <Input id="telegram-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Envie /start no bot e clique em 'Detectar Chat ID'" className="bg-secondary border-border font-mono text-xs" disabled={!loaded} />
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

      {/* Backup Local */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Backup Local (JSON)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Exporte para arquivo JSON no seu computador ou restaure a partir de um arquivo.
        </p>

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
            {importing ? "Importando..." : "Restaurar de Arquivo"}
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>

        {importing && (
          <div className="space-y-1.5">
            <Progress value={importProgress} className="h-2 [&>div]:bg-primary" />
            <p className="text-[10px] text-muted-foreground text-center">{importProgress}% concluído</p>
          </div>
        )}
      </div>

      {/* Backup Automático na Nuvem */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Backup Automático na Nuvem</h2>
          </div>
          <Badge variant="outline" className="bg-success/15 text-success border-success/20 text-[10px]">
            <Clock className="h-3 w-3 mr-1" /> Diário às 23:30
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          O sistema cria backups automaticamente todos os dias às 23:30 (quando o app estiver aberto). São mantidos os últimos 7 backups.
        </p>

        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">Dados incluídos:</p>
          <div className="grid grid-cols-2 gap-1">
            {["Contas bancárias", "Categorias", "Transações", "Metas", "Orçamentos", "Recorrentes", "Insights da IA"].map((item) => (
              <p key={item} className="text-[11px] text-muted-foreground">✓ {item}</p>
            ))}
          </div>
        </div>

        <Button onClick={handleCloudBackupNow} disabled={creatingCloud} className="gradient-bg-primary text-primary-foreground text-xs gap-1.5 w-full">
          {creatingCloud ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
          {creatingCloud ? "Criando backup..." : "Criar Backup Agora"}
        </Button>

        {/* Cloud backups list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground">Backups disponíveis na nuvem:</p>
            <Button variant="ghost" size="sm" onClick={loadCloudBackups} disabled={loadingBackups} className="h-6 text-[10px] text-muted-foreground">
              {loadingBackups ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            </Button>
          </div>

          {cloudBackups.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              {loadingBackups ? "Carregando..." : "Nenhum backup na nuvem ainda."}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-auto scrollbar-thin">
              {cloudBackups.map((b) => (
                <div key={b.name} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50 border border-border/50">
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {b.created_at ? new Date(b.created_at).toLocaleString("pt-BR") : ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCloudRestore(b.name)}
                    disabled={restoringCloud === b.name}
                    className="h-7 text-[10px] border-border text-muted-foreground hover:text-primary gap-1"
                  >
                    {restoringCloud === b.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-[11px] text-warning">
            <strong>Atenção:</strong> Restaurar um backup substituirá todos os dados atuais. Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>

      {/* Gerenciamento de Usuários (Admin Only) */}
      {isAdmin && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Gerenciamento de Usuários</h2>
          </div>
          <p className="text-xs text-muted-foreground">Crie novos usuários e defina suas credenciais de acesso.</p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-user-email" className="text-xs text-muted-foreground">Email do Usuário</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="bg-secondary border-border text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-name" className="text-xs text-muted-foreground">Nome (opcional)</Label>
              <Input
                id="new-user-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nome do usuário"
                className="bg-secondary border-border text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-password" className="text-xs text-muted-foreground">Senha</Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Senha inicial (mínimo 6 caracteres)"
                className="bg-secondary border-border text-xs"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-role" className="text-xs text-muted-foreground">Permissão</Label>
              <select
                id="new-user-role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as "user" | "admin")}
                className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-telegram" className="text-xs text-muted-foreground">Telegram Chat ID (opcional)</Label>
              <Input
                id="new-user-telegram"
                value={newUserTelegramChatId}
                onChange={(e) => setNewUserTelegramChatId(e.target.value)}
                placeholder="Ex: 123456789 — para receber alertas"
                className="bg-secondary border-border font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                O usuário pode obter o Chat ID enviando /start ao bot do Telegram e usando "Detectar Chat ID" nas configurações dele.
              </p>
            </div>

            <Button
              onClick={handleCreateUser}
              disabled={creatingUser}
              className="gradient-bg-primary text-primary-foreground text-xs gap-1.5 w-full"
            >
              {creatingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {creatingUser ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-foreground">ℹ️ Informações Importantes</p>
            <p className="text-[11px] text-muted-foreground">• A senha será definida por você e deve ser repassada ao usuário</p>
            <p className="text-[11px] text-muted-foreground">• O email será confirmado automaticamente (não requer verificação)</p>
            <p className="text-[11px] text-muted-foreground">• Usuários comuns acessam apenas seus próprios dados</p>
            <p className="text-[11px] text-muted-foreground">• Administradores podem criar novos usuários</p>
          </div>
        </div>
      )}

      {/* Notificações Push */}
      <PushNotificationsSection />

      {/* Atalhos de Teclado */}
      <KeyboardShortcutsSection />

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
