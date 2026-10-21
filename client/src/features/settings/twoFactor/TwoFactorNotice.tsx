import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn } from "@/lib/queryClient";

const SETTINGS_PATH = "/platform/settings";
const SEEN_KEY = "leadawaker_2fa_notice_seen";

type Me = { user: { twoFactor?: { required: boolean; enrollRequired: boolean; graceEndsAt: string | null } } | null } | null;

/**
 * Renders nothing. When the require-2FA policy applies to this user and they have no
 * method: during the grace period it shows one reminder per browser session, after it
 * it keeps them on Settings > Profile where they can enroll.
 */
export function TwoFactorNotice() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { data } = useQuery<Me>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 30_000,
  });
  const tf = data?.user?.twoFactor;

  useEffect(() => {
    if (!tf?.required) return;
    if (tf.enrollRequired) {
      if (!location.startsWith(SETTINGS_PATH)) setLocation(`${SETTINGS_PATH}?tab=profile`);
      return;
    }
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch { /* storage unavailable: remind every time */ }
    const days = tf.graceEndsAt ? Math.max(0, Math.ceil((new Date(tf.graceEndsAt).getTime() - Date.now()) / 86_400_000)) : 0;
    toast({ title: t("twoFactor.noticeTitle"), description: t("twoFactor.requiredSoon", { count: days }) });
  }, [tf?.required, tf?.enrollRequired, tf?.graceEndsAt, location, setLocation, toast, t]);

  return null;
}
