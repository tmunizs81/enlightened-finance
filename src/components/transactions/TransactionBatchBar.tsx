import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  loading?: boolean;
}

export function TransactionBatchBar({ count, onDelete, onClear, loading }: Props) {
  if (count === 0) return null;

  return (
    <div className="glass-card fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 border border-border px-5 py-3 shadow-2xl duration-300 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium text-foreground">
        {count} {count === 1 ? "selecionado" : "selecionados"}
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={loading}
        className="gap-2"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="gap-1 text-muted-foreground">
        <X className="h-3.5 w-3.5" /> Cancelar
      </Button>
    </div>
  );
}
