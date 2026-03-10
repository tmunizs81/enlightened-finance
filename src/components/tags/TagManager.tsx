import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagManagerProps {
  transactionId: string;
  tags: Tag[];
  allTags: Tag[];
  onTagsChange: () => void;
}

export function TagManager({ transactionId, tags, allTags, onTagsChange }: TagManagerProps) {
  const { user } = useAuth();
  const [newTag, setNewTag] = useState("");
  const [open, setOpen] = useState(false);

  const availableTags = allTags.filter((t) => !tags.some((tt) => tt.id === t.id));

  const addTag = async (tagId: string) => {
    const { error } = await supabase
      .from("transaction_tags" as any)
      .insert({ transaction_id: transactionId, tag_id: tagId } as any);
    if (error) { toast.error("Erro ao adicionar tag"); return; }
    onTagsChange();
  };

  const removeTag = async (tagId: string) => {
    const { error } = await supabase
      .from("transaction_tags" as any)
      .delete()
      .eq("transaction_id", transactionId)
      .eq("tag_id", tagId);
    if (error) { toast.error("Erro ao remover tag"); return; }
    onTagsChange();
  };

  const createAndAdd = async () => {
    if (!newTag.trim() || !user) return;
    const colors = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { data, error } = await supabase
      .from("tags" as any)
      .insert({ user_id: user.id, name: newTag.trim(), color } as any)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Tag already exists, find and add it
        const existing = allTags.find((t) => t.name.toLowerCase() === newTag.trim().toLowerCase());
        if (existing) await addTag(existing.id);
      } else {
        toast.error("Erro ao criar tag");
      }
      setNewTag("");
      return;
    }

    if (data) {
      await addTag((data as any).id);
      setNewTag("");
      onTagsChange();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-[10px] gap-1 pr-1"
          style={{ borderColor: tag.color, color: tag.color }}
        >
          {tag.name}
          <button onClick={() => removeTag(tag.id)} className="hover:opacity-70">
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors">
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 space-y-2" align="start">
          <div className="flex gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              className="h-7 text-xs bg-secondary"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createAndAdd(); } }}
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={createAndAdd} disabled={!newTag.trim()}>
              +
            </Button>
          </div>
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => addTag(tag.id)}
                  className="text-[10px] px-2 py-0.5 rounded-full border hover:opacity-80 transition-opacity"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
