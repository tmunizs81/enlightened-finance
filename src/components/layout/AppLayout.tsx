import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useAutoBackup } from "@/hooks/use-auto-backup";
import { useLicenseNotification } from "@/hooks/use-license-notification";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useDailyReminder } from "@/hooks/use-push-notifications";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { OfflineIndicator } from "@/components/ui/offline-indicator";

export function AppLayout({ children }: { children: React.ReactNode }) {
  useAutoBackup();
  useLicenseNotification();
  useInactivityLogout();
  useKeyboardShortcuts();
  useDailyReminder();

  return (
    <SidebarProvider>
      <OfflineIndicator />
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 glass-card rounded-none">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Buscar...</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd>
              </button>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto scrollbar-thin p-4 md:p-6 lg:p-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <CommandPalette />
      <OnboardingTour />
    </SidebarProvider>
  );
}
