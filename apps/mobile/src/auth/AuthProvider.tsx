import type { PropsWithChildren } from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { getSupabaseClient, type MobileAuthSession } from "./supabase";

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: MobileAuthSession | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<MobileAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      setSession(error === null ? data.session : null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    const appStateSubscription =
      Platform.OS === "web"
        ? null
        : AppState.addEventListener("change", (state) => {
            if (state === "active") {
              void supabase.auth.startAutoRefresh();
            } else {
              void supabase.auth.stopAutoRefresh();
            }
          });

    if (Platform.OS !== "web" && AppState.currentState === "active") {
      void supabase.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== "web") {
        void supabase.auth.stopAutoRefresh();
      }
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error !== null) {
        throw error;
      }
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
      });
      if (error !== null) {
        throw error;
      }
      return {
        requiresEmailConfirmation: data.session === null,
      };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const { error } = await getSupabaseClient().auth.signOut({
      scope: "local",
    });
    if (error !== null) {
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, session, signIn, signOut, signUp],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = (): AuthContextValue => {
  const value = use(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
};
