import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonList } from "@/components/ui/skeleton-card";
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from "@/hooks/use-supabase-crud";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
}

const ICONS = ["🛒", "🍔", "🏠", "🚗", "💊", "📚", "🎮", "👕", "✈️", "💼", "📱", "🎵", "⚡", "💰", "🎯", "🏦", "💳", "🎁"];

const Categories = () => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [icon, setIcon] = useState<string>("");
  const [color, setColor] = useState("#6366f1");

  const { deleteTarget, isConfirmOpen, requestDelete, cancelDelete, confirmDelete } = useConfirmDelete();
  const { data: categories = [], isLoading } = useSupabaseQuery<Category>("categories", "name", true);
  const insertMutation = useSupabaseInsert("categories");
  const updateMutation = useSupabaseUpdate("categories");
  const deleteMutation = useSupabaseDelete("categories");

  // Deduplicate categories by name+type
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      const key = `${c.name.trim().toLowerCase()}|${c.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);

  const filtered = useMemo(() => {
    if (filter === "all") return uniqueCategories;
    return uniqueCategories.filter((c) => c.type === filter);
  }, [uniqueCategories, filter]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setType("expense");
    setIcon("");
    setColor("#6366f1");
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon || "");
    setColor(cat.color || "#6366f1");
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: name.trim(), type, icon: icon || null, color: color || null };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data } as any, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      insertMutation.mutate(data as any, {
        onSuccess: () => { setFormOpen(false); setName(""); },
      });
    }
  };

  const handleDeleteConfirm = () => {
    confirmDelete((id) => deleteMutation.mutate(id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas categorias de receita e despesa</p>
        </div>
        <Button onClick={openNew} className="gradient-bg-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "income", "expense"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${filter === f ? "gradient-bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "Todas" : f === "income" ? "Receitas" : "Despesas"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonList count={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">📂</div>
          <p className="text-muted-foreground text-sm font-medium">Nenhuma categoria encontrada</p>
          <p className="text-muted-foreground text-xs">Clique em "Nova Categoria" para criar</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03 }}
              className="glass-card-hover p-4 flex items-center gap-3"
            >
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: (cat.color || "#6366f1") + "20" }}
              >
                {cat.icon || <Tag className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                <Badge variant="outline" className={`text-[10px] mt-0.5 ${cat.type === "income" ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}`}>
                  {cat.type === "income" ? "Receita" : "Despesa"}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(cat)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => requestDelete(cat.id, cat.name)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => { if (!open) cancelDelete(); }}
        title="Excluir categoria"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name || "esta categoria"}"? Transações com esta categoria ficarão sem categoria.`}
        onConfirm={handleDeleteConfirm}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="glass-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editing ? "Editar" : "Nova"} Categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" required placeholder="Ex: Alimentação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="bg-secondary border-border h-9 p-1 cursor-pointer" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(icon === ic ? "" : ic)}
                    className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all ${icon === ic ? "ring-2 ring-primary bg-primary/10" : "bg-secondary hover:bg-secondary/80"}`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} className="text-muted-foreground">Cancelar</Button>
              <Button type="submit" disabled={insertMutation.isPending || updateMutation.isPending || !name.trim()} className="gradient-bg-primary text-primary-foreground">
                {(insertMutation.isPending || updateMutation.isPending) ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categories;
