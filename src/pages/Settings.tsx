import { Settings2, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize o sistema</p>
      </div>

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
