import { useState, useEffect } from "react";
import { Settings2, Bot, Brain, CheckCircle, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const SettingsPage = () => {
  const { user } = useAuth();
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configuração do Telegram salva!");
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
          text: "✅ *T2-FinAI* — Conexão testada com sucesso!\n\nVocê receberá alertas graves aqui.",
          parse_mode: "Markdown",
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        toast.success("Mensagem de teste enviada! Verifique seu Telegram.");
      } else {
        toast.error(`Erro do Telegram: ${data.description || "Verifique token e Chat ID"}`);
      }
    } catch {
      toast.error("Falha ao conectar com a API do Telegram.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o sistema</p>
      </div>

      {/* OpenAI API */}
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
          O T2-FinAI utiliza o <strong className="text-foreground">Google Gemini</strong> via Lovable AI como assistente financeiro.
          Nenhuma chave externa necessária.
        </p>
        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Modelo:</strong> Gemini 3 Flash Preview
          </p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Provedor:</strong> Lovable AI Gateway
          </p>
          <p className="text-[11px] text-muted-foreground">
            Integrado automaticamente — uso incluso no plano Lovable.
          </p>
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
        <p className="text-xs text-muted-foreground">
          Receba alertas graves diretamente no Telegram quando a IA detectar problemas financeiros críticos.
        </p>

        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">Como configurar:</p>
          <p className="text-[11px] text-muted-foreground">1. Abra o Telegram e procure por <strong className="text-foreground">@BotFather</strong></p>
          <p className="text-[11px] text-muted-foreground">2. Envie <code className="bg-background px-1 rounded text-foreground">/newbot</code> e siga as instruções para criar um bot</p>
          <p className="text-[11px] text-muted-foreground">3. Copie o <strong className="text-foreground">Token</strong> gerado e cole abaixo</p>
          <p className="text-[11px] text-muted-foreground">4. Para o Chat ID, envie uma mensagem ao seu bot e acesse: <code className="bg-background px-1 rounded text-foreground text-[10px]">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="telegram-token" className="text-xs text-muted-foreground">Token do Bot</Label>
          <Input
            id="telegram-token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456789:ABCDEF..."
            className="bg-secondary border-border font-mono text-xs"
            disabled={!loaded}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-chat" className="text-xs text-muted-foreground">Chat ID</Label>
          <Input
            id="telegram-chat"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Seu Chat ID"
            className="bg-secondary border-border font-mono text-xs"
            disabled={!loaded}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !loaded} className="gradient-bg-primary text-primary-foreground text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !botToken || !chatId}
            className="text-xs border-border text-muted-foreground hover:text-primary gap-1.5"
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Testar Envio
          </Button>
        </div>
      </div>

      {/* Geral */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Geral</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Mais configurações serão adicionadas em breve, incluindo categorias personalizadas, limites de orçamento e temas.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
