import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import {
  registerPushEndpoint,
  type PushRegistrationResult,
} from "./push-registration";

export type PushRegistrationState =
  PushRegistrationResult | "idle" | "registering" | "error";

export const usePushRegistration = (
  enabled: boolean,
): PushRegistrationState => {
  const [state, setState] = useState<PushRegistrationState>("idle");
  const lastAttempt = useRef(0);
  const register = useCallback(async (): Promise<void> => {
    if (!enabled || Date.now() - lastAttempt.current < 6 * 60 * 60_000) {
      return;
    }
    lastAttempt.current = Date.now();
    setState("registering");
    try {
      setState(await registerPushEndpoint());
    } catch {
      setState("error");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      return;
    }
    void register();
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") void register();
    });
    return () => subscription.remove();
  }, [enabled, register]);

  return state;
};
