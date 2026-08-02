import { motion } from "framer-motion";
import logo from "@/assets/logo.png";

const Updating = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--gradient-dark)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-2xl p-8 border-red-500/30"
      >
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src={logo} alt="SimplyFin" className="h-20 w-20 rounded-2xl object-contain animate-pulse" />
          <div>
            <h1 className="text-xl font-bold text-foreground">SimplyFin</h1>
            <p className="text-xs text-muted-foreground">Sistema em Manutenção</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-black/50 p-6 font-mono text-sm text-green-400 border border-border/50 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs uppercase tracking-widest opacity-70">Console Output</span>
            </div>
            <p className="mb-2">ATUALIZANDO SISTEMA , AGUARDE...##</p>
            <p className="text-red-400">error: Pulling is not possible because you have unmerged files.</p>
            <p className="text-yellow-400">hint: Fix them up in the work tree, and then use 'git add/rm &lt;file&gt;'</p>
            <p className="text-yellow-400">hint: as appropriate to mark resolution and make a commit.</p>
            <div className="mt-4 flex animate-pulse">
              <span className="mr-2">_</span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Falha Crítica na Sincronização</h2>
            <p className="text-sm text-muted-foreground">
              Detectamos conflitos de arquivos durante a atualização automática. 
              Nossa equipe técnica já foi notificada para realizar o merge manual.
            </p>
          </div>
        </div>
      </motion.div>
      <p className="mt-6 max-w-sm px-4 text-center text-[10px] text-muted-foreground/60">
        SimplyFin Cluster v6.0 - T2 Soluções Tecnológicas
      </p>
    </div>
  );
};

export default Updating;
