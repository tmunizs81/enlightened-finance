export type TransactionStatus = "paid" | "pending" | "overdue";
export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  status: TransactionStatus;
  date: string;
  account: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  icon: string;
  color: string;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit";
  balance: number;
  institution: string;
}

export const accounts: Account[] = [
  { id: "1", name: "Conta Principal", type: "checking", balance: 12450.80, institution: "Nubank" },
  { id: "2", name: "Poupança", type: "savings", balance: 35200.00, institution: "Inter" },
  { id: "3", name: "Cartão Crédito", type: "credit", balance: -2340.50, institution: "Nubank" },
  { id: "4", name: "Investimentos", type: "savings", balance: 78500.00, institution: "XP" },
];

export const transactions: Transaction[] = [
  { id: "1", description: "Salário", amount: 8500, type: "income", category: "Salário", status: "paid", date: "2026-03-05", account: "Conta Principal" },
  { id: "2", description: "Aluguel", amount: 2200, type: "expense", category: "Moradia", status: "paid", date: "2026-03-01", account: "Conta Principal" },
  { id: "3", description: "iFood", amount: 187.50, type: "expense", category: "Alimentação", status: "paid", date: "2026-03-04", account: "Cartão Crédito" },
  { id: "4", description: "Netflix", amount: 55.90, type: "expense", category: "Lazer", status: "paid", date: "2026-03-03", account: "Cartão Crédito" },
  { id: "5", description: "Freelance Design", amount: 3200, type: "income", category: "Freelance", status: "pending", date: "2026-03-10", account: "Conta Principal" },
  { id: "6", description: "Conta de Luz", amount: 320, type: "expense", category: "Moradia", status: "pending", date: "2026-03-15", account: "Conta Principal" },
  { id: "7", description: "Supermercado", amount: 650, type: "expense", category: "Alimentação", status: "paid", date: "2026-03-02", account: "Cartão Crédito" },
  { id: "8", description: "Academia", amount: 129.90, type: "expense", category: "Saúde", status: "paid", date: "2026-03-01", account: "Conta Principal" },
  { id: "9", description: "Uber", amount: 45.80, type: "expense", category: "Transporte", status: "paid", date: "2026-03-06", account: "Cartão Crédito" },
  { id: "10", description: "Consultoria", amount: 5000, type: "income", category: "Freelance", status: "overdue", date: "2026-02-28", account: "Conta Principal" },
  { id: "11", description: "Farmácia", amount: 89.90, type: "expense", category: "Saúde", status: "paid", date: "2026-03-07", account: "Cartão Crédito" },
  { id: "12", description: "Internet", amount: 119.90, type: "expense", category: "Moradia", status: "pending", date: "2026-03-20", account: "Conta Principal" },
];

export const goals: Goal[] = [
  { id: "1", name: "Reserva de Emergência", target: 50000, current: 35200, icon: "🛡️", color: "primary" },
  { id: "2", name: "Viagem Europa", target: 25000, current: 12800, icon: "✈️", color: "accent" },
  { id: "3", name: "MacBook Pro", target: 15000, current: 9500, icon: "💻", color: "success" },
  { id: "4", name: "Entrada Apartamento", target: 100000, current: 42000, icon: "🏠", color: "warning" },
];

export const categorySpending = [
  { name: "Moradia", value: 2640, fill: "hsl(175, 80%, 50%)" },
  { name: "Alimentação", value: 837.50, fill: "hsl(265, 70%, 60%)" },
  { name: "Transporte", value: 45.80, fill: "hsl(152, 60%, 48%)" },
  { name: "Lazer", value: 55.90, fill: "hsl(38, 92%, 55%)" },
  { name: "Saúde", value: 219.80, fill: "hsl(340, 70%, 58%)" },
];

export const cashFlowData = [
  { month: "Out", receitas: 11200, despesas: 7800 },
  { month: "Nov", receitas: 9800, despesas: 8200 },
  { month: "Dez", receitas: 14500, despesas: 11000 },
  { month: "Jan", receitas: 8500, despesas: 7200 },
  { month: "Fev", receitas: 11700, despesas: 8900 },
  { month: "Mar", receitas: 16700, despesas: 6400 },
];

export const goalsVsReal = [
  { category: "Moradia", meta: 2500, real: 2640 },
  { category: "Alimentação", meta: 800, real: 837 },
  { category: "Transporte", meta: 300, real: 46 },
  { category: "Lazer", meta: 200, real: 56 },
  { category: "Saúde", meta: 250, real: 220 },
];

export const balanceForecast = [
  { month: "Mar", real: 123810, previsto: null },
  { month: "Abr", real: null, previsto: 128500 },
  { month: "Mai", real: null, previsto: 134200 },
  { month: "Jun", real: null, previsto: 139800 },
  { month: "Jul", real: null, previsto: 146500 },
  { month: "Ago", real: null, previsto: 152000 },
];

export const insights = [
  {
    id: "1",
    type: "warning" as const,
    title: "Gastos com alimentação acima da média",
    description: "Seus gastos com alimentação estão 15% acima do orçamento definido. Considere revisar pedidos de delivery.",
  },
  {
    id: "2",
    type: "success" as const,
    title: "Meta de economia no caminho certo",
    description: "Você está 70% mais perto da sua reserva de emergência. Continue assim!",
  },
  {
    id: "3",
    type: "destructive" as const,
    title: "Pagamento atrasado detectado",
    description: "A consultoria de R$ 5.000 está com pagamento atrasado desde 28/02.",
  },
];
