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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card mx-auto max-w-lg space-y-6 p-8 text-center"
      >
        {installed ? (
          <>
            <div className="inline-flex rounded-2xl bg-success/15 p-4">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">App Instalado! ✅</h2>
              <p className="text-sm text-muted-foreground">
                O T2-SimplyFin já está instalado no seu dispositivo. Abra pela tela inicial.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex rounded-2xl bg-primary/15 p-4">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Instale o T2-SimplyFin</h2>
              <p className="text-sm text-muted-foreground">
                Use o T2-SimplyFin como um app nativo no seu celular. Acesso rápido, offline e sem
                precisar de loja de apps.
              </p>
            </div>

            {deferredPrompt ? (
              <Button
                onClick={handleInstall}
                className="gradient-bg-primary h-auto gap-2 px-8 py-3 text-base text-primary-foreground"
              >
                <Download className="h-5 w-5" /> Instalar Agora
              </Button>
            ) : isIOS ? (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4 text-left">
                <p className="text-xs font-semibold text-foreground">📱 Como instalar no iPhone:</p>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      1
                    </span>
                    Toque no ícone <Share className="inline h-3.5 w-3.5 text-primary" />{" "}
                    Compartilhar na barra do Safari
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      2
                    </span>
                    Selecione "Adicionar à Tela de Início"
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      3
                    </span>
                    Toque em "Adicionar" para confirmar
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4 text-left">
                <p className="text-xs font-semibold text-foreground">
                  📱 Como instalar no Android:
                </p>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      1
                    </span>
                    Toque no menu <MoreVertical className="inline h-3.5 w-3.5 text-primary" /> do
                    navegador
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      2
                    </span>
                    Selecione "Instalar app" ou "Adicionar à tela inicial"
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      3
                    </span>
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
                <div
                  key={f.label}
                  className="rounded-lg border border-border/50 bg-secondary/50 p-3"
                >
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
