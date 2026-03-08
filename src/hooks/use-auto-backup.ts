import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const BACKUP_HOUR = 23;
const BACKUP_MINUTE = 30;
const CHECK_INTERVAL_MS = 60_000; // check every minute
const STORAGE_KEY = "t2finai_last_auto_backup";

export function useAutoBackup() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runBackup = useCallback(async () => {
    if (!user) return;

    // Check if already backed up today
    const today = new Date().toISOString().split("T")[0];
    const lastBackup = localStorage.getItem(STORAGE_KEY);
    if (lastBackup === today) return;

    try {
      const { data, error } = await supabase.functions.invoke("auto-backup", {
        body: { action: "create" },
      });

      if (error) {
        console.error("Auto-backup failed:", error);
        return;
      }

      localStorage.setItem(STORAGE_KEY, today);
      console.log(`Auto-backup completed: ${data.totalRows} records in ${data.tables} tables → ${data.filename}`);
    } catch (e) {
      console.error("Auto-backup error:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkTime = () => {
      const now = new Date();
      if (now.getHours() === BACKUP_HOUR && now.getMinutes() === BACKUP_MINUTE) {
        runBackup();
      }
    };

    // Check immediately in case app was just opened at 23:30
    checkTime();

    intervalRef.current = setInterval(checkTime, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, runBackup]);

  return { runBackupNow: runBackup };
}
