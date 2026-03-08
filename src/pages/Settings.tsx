import { Settings2, Bot, Brain, CheckCircle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SettingsPage = () => {
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
            <h2 className="text-sm font-semibold text-foreground">Inteligência Artificial — OpenAI</h2>
          </div>
          <Badge variant="outline" className="bg-success/15 text-success border-success/20 text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1" /> Gemini Ativo
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          O T2-FinAI utiliza a API do <strong className="text-foreground">ChatGPT (OpenAI)</strong> para o assistente financeiro.
          A chave está armazenada de forma segura no Lovable Cloud.
        </p>
        <div className="rounded-lg bg-secondary/50 border border-border/50 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Modelo:</strong> gpt-4o-mini
          </p>
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Chave:</strong> sk-••••••••••••••••
          </p>
          <p className="text-[11px] text-muted-foreground">
            Para alterar a chave, acesse as configurações de Secrets no Lovable Cloud.
          </p>
        </div>
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Gerenciar chaves na OpenAI <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Telegram */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Integração Telegram Bot</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Insira o token do seu Bot do Telegram para receber comprovantes e transações via webhook.
        </p>
        <div className="space-y-2">
          <Label htmlFor="telegram-token" className="text-xs text-muted-foreground">Token do Bot</Label>
          <Input
            id="telegram-token"
            placeholder="123456789:ABCDEF..."
            className="bg-secondary border-border font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telegram-chat" className="text-xs text-muted-foreground">Chat ID</Label>
          <Input
            id="telegram-chat"
            placeholder="Seu Chat ID"
            className="bg-secondary border-border font-mono text-xs"
          />
        </div>
        <Button className="gradient-bg-primary text-primary-foreground text-xs">
          Salvar Configuração
        </Button>
      </div>

      {/* Geral */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Geral</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Mais configurações serão adicionadas em breve, incluindo categorias personalizadas, limites de orçamento e notificações.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
