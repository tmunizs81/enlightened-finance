import { useState, useEffect, useRef, useCallback } from "react";
import {
  Settings2,
  Bot,
  Brain,
  CheckCircle,
  Send,
  Loader2,
  Download,
  Upload,
  DatabaseBackup,
  AlertTriangle,
  Cloud,
  RotateCcw,
  Trash2,
  Clock,
  UserPlus,
  Users,
  Bell,
  BellOff,
  Keyboard,
  KeyRound,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { AdminManagementSection } from "@/components/settings/AdminManagementSection";
import { useAutoBackup } from "@/hooks/use-auto-backup";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { SHORTCUTS_LIST } from "@/hooks/use-keyboard-shortcuts";

function ChangePasswordSection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(`Erro ao alterar senha: ${error.message}`);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha alterada com sucesso");
  };

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Alterar Senha</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Defina uma nova senha para sua conta. Mínimo 8 caracteres. Após salvar, use a nova senha no
        próximo login.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="new-password" className="text-xs text-muted-foreground">
            Nova senha
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
            Confirmar nova senha
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />
        </div>
        <Button type="submit" disabled={loading} size="sm">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Alterando...
            </>
          ) : (
            "Alterar senha"
          )}
        </Button>
      </form>
    </div>
  );
}

function PushNotificationsSection() {
  const { isSupported, isEnabled, requestPermission } = usePushNotifications();
  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Notificações Push</h2>
        </div>
        {isEnabled && (
          <Badge
            variant="outline"
            className="border-success/20 bg-success/15 text-[10px] text-success"
          >
            <CheckCircle className="mr-1 h-3 w-3" /> Ativadas
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Receba lembretes diários às 21h para registrar seus gastos e alertas importantes.
      </p>
      {!isSupported ? (
        <p className="text-xs text-muted-foreground">
          Seu navegador não suporta notificações push.
        </p>
      ) : isEnabled ? (
        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
          <p className="text-[11px] text-success">
            ✅ Notificações ativadas. Você receberá lembretes diários às 21h.
          </p>
        </div>
      ) : (
        <Button
          onClick={requestPermission}
          className="gradient-bg-primary gap-1.5 text-xs text-primary-foreground"
        >
          <Bell className="h-3.5 w-3.5" /> Ativar Notificações
        </Button>
      )}
    </div>
  );
}

function KeyboardShortcutsSection() {
  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Keyboard className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Atalhos de Teclado</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Use atalhos para navegar e executar ações rapidamente.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SHORTCUTS_LIST.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/50 p-2"
          >
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
            <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

const BACKUP_TABLES = [
  "accounts",
  "categories",
  "transactions",
  "goals",
  "budgets",
  "recurring_transactions",
  "ai_insights",
] as const;

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
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [isOCRActive, setIsOCRActive] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<{ ok: boolean; description?: string } | null>(null);
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
  const [testMessage, setTestMessage] = useState("despesa 1.11 agua");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("telegram_bot_token, telegram_chat_id, telegram_link_code, gemini_api_key")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBotToken(data.telegram_bot_token || "");
          setChatId(data.telegram_chat_id || "");
          setLinkCode(data.telegram_link_code || "");
          setGeminiKey(data.gemini_api_key || "");
        }
        setLoaded(true);
      });
  }, [user]);

  useEffect(() => {
    if (botToken) {
      fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.result.url) {
            setWebhookStatus({ ok: true });
          } else if (data.ok && !data.result.url) {
            setWebhookStatus(null);
          }
        })
        .catch(() => {});
    }
  }, [botToken]);

  const loadCloudBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", {
        body: { action: "list" },
      });
      if (error) throw error;
      setCloudBackups(data.backups || []);
    } catch (e: any) {
      console.error("Error loading backups:", e);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadCloudBackups();
  }, [user, loadCloudBackups]);

  const handleCloudBackupNow = async () => {
    if (!user) return;
    setCreatingCloud(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", {
        body: { action: "create" },
      });
      if (error) throw error;
      toast.success(`Backup na nuvem criado! ${data.totalRows} registros salvos.`);
      loadCloudBackups();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar backup");
    } finally {
      setCreatingCloud(false);
    }
  };

  const handleCloudRestore = async (filename: string) => {
    if (!user) return;
    setRestoringCloud(filename);
    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", {
        body: { action: "restore", filename },
      });
      if (error) throw error;
      qc.invalidateQueries();
      toast.success(`Backup restaurado! ${data.totalRows} registros importados.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao restaurar backup");
    } finally {
      setRestoringCloud(null);
    }
  };

  const handleSave = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return toast.error("Usuário não autenticado.");

    if (chatId && !/^-?\d+$/.test(chatId)) {
      toast.error("O Chat ID deve ser um número válido.");
      return;
    }

    setSaving(true);
    
    const cleanChatId = String(chatId).trim();
    const cleanToken = String(botToken).trim();

    const { error } = await supabase
      .from('profiles')
      .update({ 
        telegram_chat_id: cleanChatId,
        telegram_bot_token: cleanToken,
        gemini_api_key: geminiKey.trim()
      })
      .eq('user_id', authUser.id);

    if (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error(`Erro ao gravar no banco: ${error.message}`);
      setSaving(false);
    } else {
      toast.success("✅ Configuração salva e persistida com sucesso!");
      
      // Refresh local state
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("telegram_chat_id, telegram_bot_token")
        .eq("user_id", user.id)
        .single();
        
      if (updatedProfile) {
        setChatId(updatedProfile.telegram_chat_id || "");
        setBotToken(updatedProfile.telegram_bot_token || "");
      }
    }

    // 2. Automatic setWebhook if token is provided
    if (cleanToken) {
      try {
        const webhookUrl = `${window.location.origin}/functions/v1/telegram-webhook`;
        console.log("Setting webhook to:", webhookUrl);
        const resp = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            url: webhookUrl,
            allowed_updates: ["message", "callback_query", "edited_message"]
          }),
        });
        const data = await resp.json();
        if (data.ok) {
          toast.success("Configuração do Telegram salva com sucesso!");
          setWebhookStatus({ ok: true });
        } else {
          toast.warning(`Perfil salvo, mas falha no Webhook: ${data.description}`);
          setWebhookStatus({ ok: false, description: data.description });
        }
      } catch (err) {
        toast.warning("Perfil salvo, mas não foi possível registrar o Webhook.");
      }
    } else {
      toast.success("Configuração salva!");
    }
    
    setSaving(false);
  };

  const handleDetectChatId = async () => {
    if (!botToken) {
      toast.error("Preencha o token do bot primeiro.");
      return;
    }
    setTesting(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`);
      const data = await resp.json();
      if (data.ok && data.result && data.result.length > 0) {
        const lastUpdate = data.result[data.result.length - 1];
        const detectedChatId = String(
          lastUpdate.message?.chat?.id || lastUpdate.callback_query?.message?.chat?.id || "",
        );
        if (detectedChatId) {
          setChatId(detectedChatId);
          toast.success(
            `Chat ID detectado: ${detectedChatId}\n\nAgora clique em "Salvar Configuração"`,
          );
        } else {
          toast.error("Nenhuma mensagem encontrada. Envie /start para o bot primeiro.");
        }
      } else {
        toast.error("Envie /start para o bot no Telegram primeiro, depois clique aqui novamente.");
      }
    } catch {
      toast.error("Falha ao detectar Chat ID.");
    } finally {
      setTesting(false);
    }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) {
      toast.error("Preencha o token e o Chat ID primeiro.");
      return;
    }
    setTesting(true);
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ *T2-SimplyFin* — Conexão testada com sucesso!",
          parse_mode: "Markdown",
        }),
      });
      const data = await resp.json();
      if (data.ok) toast.success("Mensagem de teste enviada!");
      else toast.error(`Erro: ${data.description || "Verifique token e Chat ID"}`);
    } catch {
      toast.error("Falha ao conectar com a API do Telegram.");
    } finally {
      setTesting(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!botToken) {
      toast.error("Preencha o token do bot primeiro.");
      return;
    }
    setSettingWebhook(true);
    try {
      // Use /functions/v1 direct endpoint which is usually allowed on VPS Nginx configs
      const webhookUrl = `${window.location.origin}/functions/v1/telegram-webhook`;
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"]
        }),
      });
      const data = await resp.json();
      if (data.ok)
        toast.success("Webhook configurado! Agora envie fotos de comprovantes para o bot.");
      else toast.error(`Erro: ${data.description || "Falha ao configurar webhook"}`);
    } catch {
      toast.error("Falha ao configurar webhook.");
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-webhook", {
        body: { action: "ping" },
      });
      
      if (error) throw error;
      
      if (data && data.status === "ok") {
        toast.success("Conexão com a Edge Function confirmada!");
      } else {
        toast.error("Resposta inesperada da Edge Function.");
      }
    } catch (e: any) {
      console.error("Webhook test error:", e);
      toast.error(`Falha na Edge Function: ${e.message || "Erro desconhecido"}. Verifique os logs no painel admin.`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleTestBotMessage = async (customMessage?: string) => {
    if (!botToken || !chatId) {
      toast.error("Configure o Token e o Chat ID primeiro.");
      return;
    }

    setTestingWebhook(true);
    try {
      // Simular um comando ou mensagem enviada pelo usuário
      const { data, error } = await supabase.functions.invoke("telegram-webhook", {
        body: { 
          message: { 
            chat: { id: parseInt(chatId) || 0 },
            text: customMessage || "/help",
            from: { id: parseInt(chatId) || 0, first_name: "Test User" },
            date: Math.floor(Date.now() / 1000)
          } 
        },
      });

      if (error) throw error;
      
      // Check if data is a Response object or if it has a .text() method
      let responseText = "";
      if (data && typeof data.text === 'function') {
        responseText = await data.text();
      } else if (typeof data === 'string') {
        responseText = data;
      } else if (data) {
        responseText = JSON.stringify(data);
      }

      toast.success(`Simulação de "${customMessage || "/help"}" enviada! Verifique seu Telegram.`);
    } catch (e: any) {
      console.error("Test bot message error:", e);
      toast.error(`Falha na Edge Function: ${e.message || "Sem resposta"}.

1. O serviço Docker está rodando? (docker compose ps)
2. O rebuild foi feito? (git pull && docker compose up -d --build)
3. O Chat ID no Telegram é exatamente: ${chatId}?
4. Logs: docker compose logs -f financeai-app`);
    } finally {
      setTestingWebhook(false);
    }
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
        [
          JSON.stringify(
            { version: 1, exported_at: new Date().toISOString(), tables: backup },
            null,
            2,
          ),
        ],
        { type: "application/json" },
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
      const insertOrder: (typeof BACKUP_TABLES)[number][] = [
        "accounts",
        "categories",
        "goals",
        "budgets",
        "transactions",
        "recurring_transactions",
        "ai_insights",
      ];
      let done = 0;

      for (const table of insertOrder) {
        const rows = tables[table];
        if (!rows || rows.length === 0) {
          done++;
          continue;
        }

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
      const totalRows = Object.values(tables).reduce(
        (s: number, arr: any[]) => s + (arr?.length || 0),
        0,
      );
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
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "create",
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserName || newUserEmail.split("@")[0],
          role: newUserRole,
          telegramChatId: newUserTelegramChatId || null,
          telegramBotToken: botToken || null,
        },
      });

      if (error) {
        let detail = "";
        const ctx = (error as any)?.context;
        try {
          if (ctx && typeof ctx.text === "function") {
            const raw = await ctx.clone().text();
            try {
              const parsed = JSON.parse(raw);
              detail = parsed?.error || parsed?.message || raw;
            } catch {
              detail = raw;
            }
          }
        } catch {
          /* ignora */
        }
        throw new Error(detail || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

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
      <div className="glass-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Inteligência Artificial & OCR
            </h2>
          </div>
          {geminiKey ? (
            <Badge
              variant="outline"
              className="border-success/20 bg-success/15 text-[10px] text-success"
            >
              <CheckCircle className="mr-1 h-3 w-3" /> IA & OCR Ativos
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-warning/20 bg-warning/15 text-[10px] text-warning"
            >
              OCR Desativado
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground">
          Configure a API do Google Gemini para habilitar a leitura automática de comprovantes (OCR) via Telegram.
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="gemini-key" className="text-xs text-muted-foreground">
              Google Gemini API Key
            </Label>
            <Input
              id="gemini-key"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Digite sua chave do Gemini..."
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              A chave é necessária para a função de leitura de comprovantes (OCR) no Telegram.
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-secondary/50 p-3">
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-foreground">Assistente:</strong> DeepSeek Chat (V3)
            </p>
            <p className="text-[11px] text-muted-foreground">
              <strong className="text-foreground">OCR / Visão:</strong> Google Gemini 1.5 Flash
            </p>
            <p className="text-[11px] text-muted-foreground">
              Integrado via API Keys individuais para máxima precisão e economia.
            </p>
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="glass-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Integração Telegram</h2>
          </div>
          <div className="flex items-center gap-2">
            {chatId ? (
              <Badge
                variant="outline"
                className="border-success/20 bg-success/15 text-[10px] text-success"
              >
                <CheckCircle className="mr-1 h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-warning/20 bg-warning/15 text-[10px] text-warning"
              >
                Não Conectado
              </Badge>
            )}
            {webhookStatus && (
              <Badge
                variant="outline"
                className={webhookStatus.ok 
                  ? "border-primary/20 bg-primary/15 text-[10px] text-primary"
                  : "border-destructive/20 bg-destructive/15 text-[10px] text-destructive"}
              >
                Webhook {webhookStatus.ok ? "Ativo" : "Falhou"}
              </Badge>
            )}
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Conecte sua conta ao bot do Telegram para registrar despesas e receitas instantaneamente por voz ou texto.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="telegram-token" className="text-xs text-muted-foreground">
                Token do Bot
              </Label>
              <Input
                id="telegram-token"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCDEF..."
                disabled={!isAdmin}
                className="h-9 border-border bg-secondary/50 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="telegram-chat-id" className="text-xs text-muted-foreground">
                Chat ID do Telegram
              </Label>
              <div className="flex gap-2">
                <Input
                  id="telegram-chat-id"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Seu ID numérico"
                  className="h-9 border-border bg-secondary/50 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDetectChatId}
                  disabled={testing}
                  className="h-9 shrink-0 text-xs"
                >
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Detectar"}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gradient-bg-primary gap-2 text-xs text-primary-foreground"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Salvar Configuração
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="gap-2 text-xs"
            >
              <Bot className="h-3.5 w-3.5" /> Testar Conexão
            </Button>
            <Button
              variant="outline"
              onClick={handleSetWebhook}
              disabled={settingWebhook}
              className="gap-2 text-xs"
            >
              {settingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Testar Webhook
            </Button>
            <Button
              variant={isOCRActive ? "default" : "outline"}
              onClick={() => {
                setIsOCRActive(!isOCRActive);
                toast.success(isOCRActive ? "OCR Desativado" : "OCR Habilitado");
              }}
              className="gap-2 text-xs"
            >
              <Brain className="h-3.5 w-3.5" /> {isOCRActive ? "OCR Ativo" : "Habilitar OCR"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleTestBotMessage(testMessage)}
              disabled={testingWebhook}
              className="gap-2 text-xs"
            >
              {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Testar Bot (Enviar Mensagem)
            </Button>
            {chatId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!user) return;
                  setIsLinking(true);
                  const { error } = await supabase
                    .from("profiles")
                    .update({ telegram_chat_id: null, telegram_link_code: null })
                    .eq("user_id", user.id);
                  
                  if (error) toast.error("Erro ao desconectar");
                  else {
                    setChatId("");
                    toast.success("Telegram desconectado com sucesso");
                  }
                  setIsLinking(false);
                }}
                disabled={isLinking}
                className="gap-2 text-xs"
              >
                {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Desconectar
              </Button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold text-foreground flex items-center gap-2">
              <Settings2 className="h-3 w-3" /> Configurações de Desenvolvedor (Admin)
            </h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="telegram-token" className="text-[10px] text-muted-foreground">
                  Token do Bot (Global)
                </Label>
                <Input
                  id="telegram-token"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCDEF..."
                  className="h-8 border-border bg-secondary font-mono text-[10px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  className="h-8 text-[10px]"
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Salvar Token
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSetWebhook}
                  className="h-8 text-[10px]"
                  disabled={settingWebhook}
                >
                  {settingWebhook && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Registrar Webhook
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup Local */}
      <div className="glass-card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Backup Local (JSON)</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Exporte para arquivo JSON no seu computador ou restaure a partir de um arquivo.
        </p>

        <div className="flex gap-3">
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gradient-bg-primary flex-1 gap-1.5 text-xs text-primary-foreground"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exportando..." : "Exportar Backup"}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex-1 gap-1.5 border-border text-xs text-muted-foreground hover:text-primary"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {importing ? "Importando..." : "Restaurar de Arquivo"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        {importing && (
          <div className="space-y-1.5">
            <Progress value={importProgress} className="h-2 [&>div]:bg-primary" />
            <p className="text-center text-[10px] text-muted-foreground">
              {importProgress}% concluído
            </p>
          </div>
        )}
      </div>

      {/* Backup Automático na Nuvem */}
      <div className="glass-card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Backup Automático na Nuvem</h2>
          </div>
          <Badge
            variant="outline"
            className="border-success/20 bg-success/15 text-[10px] text-success"
          >
            <Clock className="mr-1 h-3 w-3" /> Diário às 23:30
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          O sistema cria backups automaticamente todos os dias às 23:30 (quando o app estiver
          aberto). São mantidos os últimos 7 backups.
        </p>

        <div className="space-y-1.5 rounded-lg border border-border/50 bg-secondary/50 p-3">
          <p className="text-[11px] font-semibold text-foreground">Dados incluídos:</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              "Contas bancárias",
              "Categorias",
              "Transações",
              "Metas",
              "Orçamentos",
              "Recorrentes",
              "Insights da IA",
            ].map((item) => (
              <p key={item} className="text-[11px] text-muted-foreground">
                ✓ {item}
              </p>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCloudBackupNow}
          disabled={creatingCloud}
          className="gradient-bg-primary w-full gap-1.5 text-xs text-primary-foreground"
        >
          {creatingCloud ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cloud className="h-3.5 w-3.5" />
          )}
          {creatingCloud ? "Criando backup..." : "Criar Backup Agora"}
        </Button>

        {/* Cloud backups list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground">
              Backups disponíveis na nuvem:
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadCloudBackups}
              disabled={loadingBackups}
              className="h-6 text-[10px] text-muted-foreground"
            >
              {loadingBackups ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {cloudBackups.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              {loadingBackups ? "Carregando..." : "Nenhum backup na nuvem ainda."}
            </p>
          ) : (
            <div className="scrollbar-thin max-h-48 space-y-1.5 overflow-auto">
              {cloudBackups.map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/50 p-2.5"
                >
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
                    className="h-7 gap-1 border-border text-[10px] text-muted-foreground hover:text-primary"
                  >
                    {restoringCloud === b.name ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-[11px] text-warning">
            <strong>Atenção:</strong> Restaurar um backup substituirá todos os dados atuais. Esta
            ação não pode ser desfeita.
          </p>
        </div>
      </div>

      {/* Gerenciamento de Usuários (Admin Only) */}
      {isAdmin && (
        <div className="glass-card space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Gerenciamento de Usuários</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Crie novos usuários e defina suas credenciais de acesso.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-user-email" className="text-xs text-muted-foreground">
                Email do Usuário
              </Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                className="border-border bg-secondary text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-name" className="text-xs text-muted-foreground">
                Nome (opcional)
              </Label>
              <Input
                id="new-user-name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nome do usuário"
                className="border-border bg-secondary text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-password" className="text-xs text-muted-foreground">
                Senha
              </Label>
              <Input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Senha inicial (mínimo 6 caracteres)"
                className="border-border bg-secondary text-xs"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-role" className="text-xs text-muted-foreground">
                Permissão
              </Label>
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
              <Label htmlFor="new-user-telegram" className="text-xs text-muted-foreground">
                Telegram Chat ID (opcional)
              </Label>
              <Input
                id="new-user-telegram"
                value={newUserTelegramChatId}
                onChange={(e) => setNewUserTelegramChatId(e.target.value)}
                placeholder="Ex: 123456789 — para receber alertas"
                className="border-border bg-secondary font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                O usuário pode obter o Chat ID enviando /start ao bot do Telegram e usando "Detectar
                Chat ID" nas configurações dele.
              </p>
            </div>

            <Button
              onClick={handleCreateUser}
              disabled={creatingUser}
              className="gradient-bg-primary w-full gap-1.5 text-xs text-primary-foreground"
            >
              {creatingUser ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {creatingUser ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>

          <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-[11px] font-semibold text-foreground">ℹ️ Informações Importantes</p>
            <p className="text-[11px] text-muted-foreground">
              • A senha será definida por você e deve ser repassada ao usuário
            </p>
            <p className="text-[11px] text-muted-foreground">
              • O email será confirmado automaticamente (não requer verificação)
            </p>
            <p className="text-[11px] text-muted-foreground">
              • Usuários comuns acessam apenas seus próprios dados
            </p>
            <p className="text-[11px] text-muted-foreground">
              • Administradores podem criar novos usuários
            </p>
          </div>
        </div>
      )}

      {/* Alterar Senha */}
      <ChangePasswordSection />

      {/* Gestão Comercial (admin) */}
      {isAdmin && <AdminManagementSection />}


      {/* Notificações Push */}
      <PushNotificationsSection />

      {/* Atalhos de Teclado */}
      <KeyboardShortcutsSection />

      {/* Geral */}
      <div className="glass-card space-y-4 p-5">
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
