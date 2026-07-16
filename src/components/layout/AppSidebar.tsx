import { memo, useMemo } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  Settings,
  Brain,
  LogOut,
  PiggyBank,
  FileText,
  Key,
  Download,
  Trophy,
  Zap,
  FolderOpen,
  Users,
  CreditCard,
  Activity,
  Sliders,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useSupabaseQuery } from "@/hooks/use-supabase-crud";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useFamily } from "@/hooks/use-family";
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

  { title: "Orçamentos", url: "/budgets", icon: PiggyBank },
  { title: "Metas", url: "/goals", icon: Target },
  { title: "Contas", url: "/accounts", icon: Wallet },
  { title: "Categorias", url: "/categories", icon: FolderOpen },
  { title: "Conquistas", url: "/achievements", icon: Trophy },
];

const toolItems = [
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Insights IA", url: "/insights", icon: Brain },
  { title: "Regras", url: "/rules", icon: Zap },
  { title: "Família", url: "/familia", icon: Users },
  { title: "Instalar App", url: "/install", icon: Download },
  { title: "Minha Licença", url: "/license", icon: Key },
  { title: "Planos", url: "/planos", icon: CreditCard },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export const AppSidebar = memo(function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { data: accounts = [] } = useSupabaseQuery<{ id: string; balance: number }>("accounts");
  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.balance), 0),
    [accounts],
  );
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="T2-SimplyFin"
            className="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground">T2-SimplyFin</h1>
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/payment-events")}>
                    <NavLink
                      to="/admin/payment-events"
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Eventos Asaas</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/settings")}>
                    <NavLink
                      to="/admin/settings"
                      className="transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <Sliders className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Configurações</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="space-y-2 p-4">
        {!collapsed && (
          <div className="glass-card p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Saldo Total</p>
            <p className="gradient-text-primary text-lg font-bold">
              R$ {totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
});
