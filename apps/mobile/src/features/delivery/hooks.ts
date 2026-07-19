import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!enabled || state !== "idle") {
      return;
    }
    let active = true;
    setState("registering");
    void registerPushEndpoint()
      .then((result) => {
        if (active) {
          setState(result);
        }
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, state]);

  return state;
};
