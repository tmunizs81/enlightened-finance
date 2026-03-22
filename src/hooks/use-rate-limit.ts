import { useRef, useCallback } from "react";
import { toast } from "sonner";

export function useRateLimit(maxCalls: number = 5, windowMs: number = 10000) {
  const callTimestamps = useRef<number[]>([]);

  const checkLimit = useCallback((): boolean => {
    const now = Date.now();
    callTimestamps.current = callTimestamps.current.filter(
      (ts) => now - ts < windowMs
    );

    if (callTimestamps.current.length >= maxCalls) {
      toast.error("Muitas requisições. Aguarde um momento.");
      return false;
    }

    callTimestamps.current.push(now);
    return true;
  }, [maxCalls, windowMs]);

  return { checkLimit };
}
