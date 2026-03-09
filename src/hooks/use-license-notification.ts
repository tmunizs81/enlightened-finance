import { useEffect, useRef } from "react";
import { useLicense } from "./use-license";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

export function useLicenseNotification() {
  const { license, isValid } = useLicense();
  const notified = useRef(false);

  useEffect(() => {
    if (!license || notified.current) return;

    const expiresAt = new Date(license.expires_at);
    const now = new Date();
    const daysRemaining = differenceInDays(expiresAt, now);

    if (isValid && daysRemaining <= 7 && daysRemaining > 0) {
      notified.current = true;
      toast.warning(`Sua licença expira em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}. Contate o administrador para renovação.`, {
        duration: 10000,
      });
    } else if (!isValid && license.status === "active") {
      notified.current = true;
      toast.error("Sua licença expirou. Contate o administrador para renovação.", {
        duration: 10000,
      });
    }
  }, [license, isValid]);
}
