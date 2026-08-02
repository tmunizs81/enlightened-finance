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
            <p className="mb-2">Act as a Principal Software Architect and Lead System Maintainer.</p>
            <p className="text-blue-300">We have successfully configured and deployed our financial application (SimplyFin) to production with strict multi-tenant isolation, specialized Edge Functions, custom Docker containerization, and a Nginx Reverse Proxy.</p>
            <p className="mt-2">Your goal is to synchronize your state with the current codebase and perform any future updates in a STRICTLY NON-DESTRUCTIVE (ZERO-REGRESSION) manner.</p>
            <div className="h-px bg-border/30 my-4" />
            <p className="font-bold text-yellow-400">🛡️ IMMUTABLE ARCHITECTURAL RULES (DO NOT MODIFY OR BREAK):</p>
            <div className="mt-2 space-y-1 text-xs">
              <p>1. MULTI-TENANT ISOLATION & SECURITY:</p>
              <p className="pl-4 opacity-80">- ALL database queries MUST retain explicit .eq("user_id", userId) filters.</p>
              <p className="pl-4 opacity-80">- DO NOT remove or loosen Row Level Security (RLS) policies.</p>
              <p className="pl-4 opacity-80">- The Telegram Bot remains SHARED multi-tenant using profiles.user_id.</p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <p>2. TELEGRAM UI/UX & INLINE KEYBOARD:</p>
              <p className="pl-4 opacity-80">- DO NOT change the message layout format for expense confirmation.</p>
              <p className="pl-4 opacity-80">- DO NOT alter the 3-row, 2-column Inline Keyboard layout.</p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <p>3. EDGE FUNCTION & PROXY COMPATIBILITY:</p>
              <p className="pl-4 opacity-80">- DO NOT alter the route structure /functions/v1/telegram-webhook.</p>
              <p className="pl-4 opacity-80">- Ensure all callback handler logic handles race conditions atomically.</p>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <p>4. DEPLOYMENT & CONTAINERIZATION:</p>
              <p className="pl-4 opacity-80">- Respect the Docker Compose architecture (application binding to port 3005).</p>
              <p className="pl-4 opacity-80">- Do not override .env variable names or database connections.</p>
            </div>
            <div className="h-px bg-border/30 my-4" />
            <p className="font-bold text-green-400">📋 INSTRUCTIONS FOR ALL FUTURE CODE UPDATES:</p>
            <p className="text-xs opacity-80 mt-1">- Apply changes INCREMENTALLY.</p>
            <p className="text-xs opacity-80">- If editing existing files, ONLY modify necessary lines without deleting pre-existing security guards.</p>
            <p className="text-xs opacity-80">- Before outputting code, verify that no user_id checks were accidentally dropped.</p>
            <p className="mt-4 text-white font-bold animate-pulse">Acknowledge this system context and state that you are ready for the next task.</p>
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
