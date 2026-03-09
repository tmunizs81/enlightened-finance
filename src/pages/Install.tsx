import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, CheckCircle, Share, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Instalar App</h1>
        <p className="text-sm text-muted-foreground">Instale o T2-SimplyFin no seu celular</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 max-w-lg mx-auto text-center space-y-6">
        {installed ? (
          <>
            <div className="inline-flex p-4 rounded-2xl bg-success/15">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">App Instalado! ✅</h2>
              <p className="text-sm text-muted-foreground">
                O T2-FinAI já está instalado no seu dispositivo. Abra pela tela inicial.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex p-4 rounded-2xl bg-primary/15">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Instale o T2-FinAI</h2>
              <p className="text-sm text-muted-foreground">
                Use o T2-FinAI como um app nativo no seu celular. Acesso rápido, offline e sem precisar de loja de apps.
              </p>
            </div>

            {deferredPrompt ? (
              <Button onClick={handleInstall} className="gradient-bg-primary text-primary-foreground gap-2 text-base px-8 py-3 h-auto">
                <Download className="h-5 w-5" /> Instalar Agora
              </Button>
            ) : isIOS ? (
              <div className="space-y-3 text-left bg-secondary/50 rounded-lg p-4 border border-border">
                <p className="text-xs font-semibold text-foreground">📱 Como instalar no iPhone:</p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                    Toque no ícone <Share className="h-3.5 w-3.5 text-primary inline" /> Compartilhar na barra do Safari
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                    Selecione "Adicionar à Tela de Início"
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                    Toque em "Adicionar" para confirmar
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-left bg-secondary/50 rounded-lg p-4 border border-border">
                <p className="text-xs font-semibold text-foreground">📱 Como instalar no Android:</p>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                    Toque no menu <MoreVertical className="h-3.5 w-3.5 text-primary inline" /> do navegador
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                    Selecione "Instalar app" ou "Adicionar à tela inicial"
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="bg-primary/15 text-primary rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                    Confirme a instalação
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: "Offline", desc: "Funciona sem internet" },
                { label: "Rápido", desc: "Carregamento instantâneo" },
                { label: "Seguro", desc: "Seus dados protegidos" },
              ].map((f) => (
                <div key={f.label} className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                  <p className="text-xs font-medium text-foreground">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
