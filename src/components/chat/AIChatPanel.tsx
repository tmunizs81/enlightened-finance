import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, User, Loader2, Sparkles, Trash2, Baby, Brain, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const QUICK_QUESTIONS = [
  "Quanto gastei esse mês?",
  "Como está meu orçamento?",
  "Quais minhas metas?",
  "Dicas para economizar",
  "Posso comprar algo de R$500?",
  "Analise minhas assinaturas",
  "Crie um plano financeiro para mim",
  "Explique meu score financeiro",
];

type ChatMode = "normal" | "simple" | "advisor";

const MODE_LABELS: Record<ChatMode, { label: string; icon: any; desc: string; prefix: string }> = {
  normal: { label: "Normal", icon: Brain, desc: "Respostas completas", prefix: "" },
  simple: { label: "Simples", icon: Baby, desc: "Como se eu tivesse 5 anos", prefix: "[MODO SIMPLES: Responda como se o usuário tivesse 5 anos de idade. Use linguagem ultra-simples, analogias do dia a dia, sem termos técnicos. Máximo 3 frases curtas.]\n\n" },
  advisor: { label: "Consultor", icon: TrendingUp, desc: "Consultoria financeira profissional", prefix: "[MODO CONSULTOR: Aja como um consultor financeiro sênior. Analise profundamente, cite números específicos, sugira estratégias detalhadas com prazos e valores. Seja formal e profissional.]\n\n" },
};

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: "Erro na conexão" }));
    if (resp.status === 429) { onError("Limite de requisições excedido. Tente em instantes."); return; }
    if (resp.status === 402) { onError("Créditos insuficientes. Adicione créditos ao workspace."); return; }
    onError(data.error || `Erro ${resp.status}`);
    return;
  }
  if (!resp.body) { onError("Sem resposta"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("normal");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const modePrefix = MODE_LABELS[mode].prefix;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const userMsgWithMode: Msg = { role: "user", content: modePrefix + text.trim() };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    // Build full history with mode prefix only on last message
    const historyMessages = [...messages.map(m => ({ ...m })), userMsgWithMode];

    try {
      await streamChat({
        messages: historyMessages,
        onDelta: upsert,
        onDone: () => setLoading(false),
        onError: (err) => {
          upsert(`❌ ${err}`);
          setLoading(false);
        },
      });
    } catch {
      setLoading(false);
    }
  };

  const send = () => sendMessage(input);

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full gradient-bg-primary flex items-center justify-center shadow-lg glow-primary"
          >
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] glass-card flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg gradient-bg-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">T2-FinAI Chat</p>
                  <p className="text-[10px] text-primary">● Conectado · {MODE_LABELS[mode].desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMessages([])}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Limpar conversa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex gap-1 p-2 border-b border-border/50">
              {(Object.entries(MODE_LABELS) as [ChatMode, typeof MODE_LABELS["normal"]][]).map(([key, val]) => {
                const Icon = val.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                      mode === key
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50 border border-transparent"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {val.label}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="h-12 w-12 rounded-2xl gradient-bg-primary flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Assistente Financeiro IA</p>
                    <p className="text-xs text-muted-foreground mt-1">Tenho acesso aos seus dados financeiros reais.<br />Pergunte qualquer coisa!</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-1">Perguntas rápidas</p>
                    {QUICK_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-foreground transition-colors border border-border/50 hover:border-primary/30"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-md gradient-bg-primary flex items-center justify-center shrink-0 mt-1">
                      <Sparkles className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "gradient-bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1.5 [&_p]:mt-0 [&_ul]:mb-1.5 [&_ul]:mt-0.5 [&_li]:mb-0.5 [&_strong]:text-foreground [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-primary [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-md gradient-bg-primary flex items-center justify-center shrink-0">
                    <Sparkles className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div className="bg-secondary rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground">Analisando seus dados...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={mode === "simple" ? "Pergunta algo simples..." : mode === "advisor" ? "Consulte o especialista..." : "Quanto gastei com alimentação?..."}
                  className="flex-1 bg-secondary border-border text-xs h-9"
                  disabled={loading}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={loading || !input.trim()}
                  className="h-9 w-9 gradient-bg-primary text-primary-foreground shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
