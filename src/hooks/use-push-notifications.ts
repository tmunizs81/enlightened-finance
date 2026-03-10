import { useEffect, useCallback } from "react";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY_STORAGE = "t2-push-enabled";

export function usePushNotifications() {
  const isSupported = "Notification" in window && "serviceWorker" in navigator;

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Seu navegador não suporta notificações push.");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE, "true");
      toast.success("Notificações ativadas! 🔔");
      return true;
    } else {
      toast.error("Permissão de notificações negada.");
      return false;
    }
  }, [isSupported]);

  const sendLocalNotification = useCallback((title: string, body: string, tag?: string) => {
    if (!isSupported || Notification.permission !== "granted") return;

    const registration = navigator.serviceWorker?.ready;
    if (registration) {
      registration.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: "/pwa-icon-192.png",
          badge: "/pwa-icon-192.png",
          tag: tag || "t2-notification",
          vibrate: [200, 100, 200],
        });
      });
    }
  }, [isSupported]);

  const isEnabled = isSupported && Notification.permission === "granted";

  return { isSupported, isEnabled, requestPermission, sendLocalNotification };
}

// Hook to schedule daily reminder notifications
export function useDailyReminder() {
  const { isEnabled, sendLocalNotification } = usePushNotifications();

  useEffect(() => {
    if (!isEnabled) return;

    const checkReminder = () => {
      const now = new Date();
      const hour = now.getHours();
      const lastReminder = localStorage.getItem("t2-last-reminder");
      const today = now.toISOString().split("T")[0];

      // Send reminder at 9 PM if not sent today
      if (hour >= 21 && lastReminder !== today) {
        sendLocalNotification(
          "📝 Revisão diária",
          "Você registrou todos os gastos de hoje? Toque para conferir.",
          "daily-reminder"
        );
        localStorage.setItem("t2-last-reminder", today);
      }
    };

    // Check every 30 minutes
    const interval = setInterval(checkReminder, 30 * 60 * 1000);
    checkReminder();

    return () => clearInterval(interval);
  }, [isEnabled, sendLocalNotification]);
}
