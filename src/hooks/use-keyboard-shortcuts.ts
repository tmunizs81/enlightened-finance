import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const shortcuts: ShortcutConfig[] = [
      // Navigation
      { key: "1", alt: true, description: "Dashboard", action: () => navigate("/") },
      { key: "2", alt: true, description: "Transações", action: () => navigate("/transactions") },
      { key: "3", alt: true, description: "Contas", action: () => navigate("/accounts") },
      { key: "4", alt: true, description: "Metas", action: () => navigate("/goals") },
      { key: "5", alt: true, description: "Orçamentos", action: () => navigate("/budgets") },
      { key: "6", alt: true, description: "Relatórios", action: () => navigate("/reports") },
      // Quick actions
      { key: "n", ctrl: true, shift: true, description: "Nova Transação", action: () => navigate("/transactions?new=1") },
      // Help
      { key: "?", shift: true, description: "Atalhos", action: () => showShortcutsHelp() },
    ];

    function showShortcutsHelp() {
      toast.info(
        "⌨️ Atalhos de Teclado",
        {
          description: [
            "⌘K — Busca global",
            "Alt+1~6 — Navegar páginas",
            "Ctrl+Shift+N — Nova transação",
            "Shift+? — Esta ajuda",
          ].join("\n"),
          duration: 6000,
        }
      );
    }

    const handler = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      for (const s of shortcuts) {
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;

        if (e.key === s.key && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
}

export const SHORTCUTS_LIST = [
  { keys: "⌘K", label: "Busca global" },
  { keys: "Alt+1", label: "Dashboard" },
  { keys: "Alt+2", label: "Transações" },
  { keys: "Alt+3", label: "Contas" },
  { keys: "Alt+4", label: "Metas" },
  { keys: "Alt+5", label: "Orçamentos" },
  { keys: "Alt+6", label: "Relatórios" },
  { keys: "Ctrl+Shift+N", label: "Nova Transação" },
  { keys: "Shift+?", label: "Ver atalhos" },
];
