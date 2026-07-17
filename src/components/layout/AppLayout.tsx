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
import { LicenseBanner } from "@/components/LicenseBanner";
import { BuildFooter } from "./BuildFooter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  useAutoBackup();
  useLicenseNotification();
  useInactivityLogout();
  useKeyboardShortcuts();
  useDailyReminder();

  return (
    <SidebarProvider>
      <OfflineIndicator />
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-card flex h-14 items-center justify-between rounded-none border-b border-border px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
                }
                className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
              >
                <span>Buscar...</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
              </button>
              <NotificationCenter />
              <ThemeToggle />
            </div>
          </header>
          <main className="scrollbar-thin flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <ErrorBoundary>
              <LicenseBanner />
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
