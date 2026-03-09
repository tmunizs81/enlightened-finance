import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  Settings,
  Brain,
  LogOut,
  PiggyBank,
  Repeat,
  FileText,
  Key,
  Download,
  Trophy,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
  { title: "Recorrentes", url: "/recurring", icon: Repeat },
  { title: "Orçamentos", url: "/budgets", icon: PiggyBank },
  { title: "Metas", url: "/goals", icon: Target },
  { title: "Contas", url: "/accounts", icon: Wallet },
];

const toolItems = [
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Insights IA", url: "/insights", icon: Brain },
  { title: "Instalar App", url: "/install", icon: Download },
  { title: "Minha Licença", url: "/license", icon: Key },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: accounts = [] } = useSupabaseQuery<{ id: string; balance: number }>("accounts");
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="T2-FinAI" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground">T2-FinAI</h1>
              <p className="text-[10px] text-muted-foreground">Controle Inteligente</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Ferramentas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/licenses")}>
                    <NavLink
                      to="/admin/licenses"
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <Key className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Licenças</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="glass-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Saldo Total</p>
            <p className="text-lg font-bold gradient-text-primary">
              R$ {totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
        <button onClick={signOut} className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-secondary">
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
