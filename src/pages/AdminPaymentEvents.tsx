import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, XCircle, MinusCircle, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type PaymentEvent = {
  id: string;
  provider: string;
  event_type: string | null;
  payment_id: string | null;
  subscription_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  payload: unknown;
  status: string;
  error_message: string | null;
  processing_ms: number | null;
  processed_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <Badge variant="outline" className="border-green-500/40 bg-green-500/10 text-green-500">
        <CheckCircle2 className="mr-1 h-3 w-3" /> sucesso
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-500">
        <XCircle className="mr-1 h-3 w-3" /> erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
      <MinusCircle className="mr-1 h-3 w-3" /> ignorado
    </Badge>
  );
}

export default function AdminPaymentEvents() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selected, setSelected] = useState<PaymentEvent | null>(null);
  const [page, setPage] = useState(0);

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase
      .from("payment_events")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (eventFilter !== "all") query = query.eq("event_type", eventFilter);

    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar eventos", { description: error.message });
      setEvents([]);
    } else {
      setEvents((data ?? []) as PaymentEvent[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter, eventFilter, page]);

  const eventTypes = useMemo(() => {
    const set = new Set(events.map((e) => e.event_type).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [
        e.event_type,
        e.payment_id,
        e.subscription_id,
        e.customer_id,
        e.user_id,
        e.error_message,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [events, search]);

  const stats = useMemo(() => {
    const total = events.length;
    const ok = events.filter((e) => e.status === "success").length;
    const err = events.filter((e) => e.status === "error").length;
    const skipped = events.filter((e) => e.status === "skipped").length;
    const avg =
      events.filter((e) => e.processing_ms !== null).reduce((s, e) => s + (e.processing_ms || 0), 0) /
        Math.max(1, events.filter((e) => e.processing_ms !== null).length) || 0;
    return { total, ok, err, skipped, avg: Math.round(avg) };
  }, [events]);

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Activity className="h-8 w-8 text-primary" />
            Eventos do Webhook Asaas
          </h1>
          <p className="mt-1 text-muted-foreground">
            Auditoria de todos os eventos recebidos, com payload completo, status e tempo de processamento.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Nesta página</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sucesso</p>
          <p className="text-2xl font-bold text-green-500">{stats.ok}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Erros</p>
          <p className="text-2xl font-bold text-red-500">{stats.err}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Ignorados</p>
          <p className="text-2xl font-bold text-amber-500">{stats.skipped}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Tempo médio</p>
          <p className="text-2xl font-bold">{stats.avg} ms</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID de pagamento, assinatura, cliente, usuário ou erro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setPage(0); setStatusFilter(v); }}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="skipped">Ignorado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={eventFilter} onValueChange={(v) => { setPage(0); setEventFilter(v); }}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos eventos</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido em</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum evento encontrado.</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.event_type ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-xs">{e.processing_ms != null ? `${e.processing_ms} ms` : "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs" title={e.payment_id ?? ""}>{e.payment_id ?? "—"}</TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs" title={e.subscription_id ?? ""}>{e.subscription_id ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-red-500" title={e.error_message ?? ""}>{e.error_message ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(e)}>Ver</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} · {events.length} registros
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={events.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{selected?.event_type}</span>
              {selected && <StatusBadge status={selected.status} />}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Recebido:</span> {new Date(selected.created_at).toLocaleString("pt-BR")}</div>
                <div><span className="text-muted-foreground">Tempo:</span> {selected.processing_ms ?? "—"} ms</div>
                <div className="col-span-2"><span className="text-muted-foreground">Payment ID:</span> <span className="font-mono">{selected.payment_id ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Subscription:</span> <span className="font-mono">{selected.subscription_id ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Customer:</span> <span className="font-mono">{selected.customer_id ?? "—"}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{selected.user_id ?? "—"}</span></div>
              </div>
              {selected.error_message && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
                  <strong>Erro:</strong> {selected.error_message}
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Payload completo</p>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
