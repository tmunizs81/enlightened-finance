import { useState, useRef } from "react";
import { Upload, FileText, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

export function CSVImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [separator, setSeparator] = useState<"," | ";">(";");

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) { toast.error("CSV vazio ou sem dados."); return; }

    const parsed: ParsedRow[] = [];
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map((c) => c.replace(/^"|"$/g, "").trim());
      if (cols.length < 3) continue;

      let date = cols[0];
      const description = cols[1];
      let amountStr = cols[cols.length - 1] || cols[2];

      if (date.includes("/")) {
        const parts = date.split("/");
        if (parts.length === 3 && parts[0].length <= 2) {
          date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      amountStr = amountStr.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || !description) continue;

      parsed.push({
        date: date || new Date().toISOString().split("T")[0],
        description,
        amount: Math.abs(amount),
        type: amount < 0 ? "expense" : "income",
      });
    }

    if (parsed.length === 0) { toast.error("Nenhuma transação válida encontrada."); return; }
    setRows(parsed);
    setOpen(true);
  };

  const parseOFX = (text: string) => {
    const parsed: ParsedRow[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;

    while ((match = stmtTrnRegex.exec(text)) !== null) {
      const block = match[1];
      const getValue = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, "i"));
        return m ? m[1].trim() : "";
      };

      const trnType = getValue("TRNTYPE");
      const dtPosted = getValue("DTPOSTED");
      const trnAmt = getValue("TRNAMT");
      const memo = getValue("MEMO") || getValue("NAME") || "Transação OFX";

      const amount = parseFloat(trnAmt.replace(",", "."));
      if (isNaN(amount)) continue;

      let date = new Date().toISOString().split("T")[0];
      if (dtPosted.length >= 8) {
        date = `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}`;
      }

      parsed.push({
        date,
        description: memo.slice(0, 100),
        amount: Math.abs(amount),
        type: amount < 0 ? "expense" : "income",
      });
    }

    if (parsed.length === 0) { toast.error("Nenhuma transação válida encontrada no OFX."); return; }
    setRows(parsed);
    setOpen(true);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => parseCSV(reader.result as string);
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setImporting(true);
    try {
      const toInsert = rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        status: "paid",
        user_id: user.id,
      }));

      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const { error } = await supabase.from("transactions").insert(toInsert.slice(i, i + batchSize));
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(`${rows.length} transações importadas com sucesso!`);
      setOpen(false);
      setRows([]);
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,.txt,.ofx" className="hidden" onChange={handleFile} />
      <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 border-border text-muted-foreground hover:text-foreground">
        <Upload className="h-4 w-4" /> Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-background border-border">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Importar Transações ({rows.length} encontradas)
          </DialogTitle>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground">Separador:</span>
            <Select value={separator} onValueChange={(v) => setSeparator(v as "," | ";")}>
              <SelectTrigger className="w-24 h-8 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=";">Ponto-vírgula (;)</SelectItem>
                <SelectItem value=",">Vírgula (,)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-64 overflow-auto scrollbar-thin border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="text-left p-2 text-muted-foreground font-medium">Data</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Valor</th>
                  <th className="text-center p-2 text-muted-foreground font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 text-foreground">{new Date(r.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="p-2 text-foreground truncate max-w-[200px]">{r.description}</td>
                    <td className={`p-2 text-right font-medium ${r.type === "income" ? "text-success" : "text-foreground"}`}>
                      R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.type === "income" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                        {r.type === "income" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="text-[10px] text-muted-foreground text-center py-2">... e mais {rows.length - 50} transações</p>}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} className="gap-1 border-border text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing} className="gradient-bg-primary text-primary-foreground gap-1">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {importing ? "Importando..." : `Importar ${rows.length} transações`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
