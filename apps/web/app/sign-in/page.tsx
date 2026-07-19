"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { getSupabase } from "../../src/supabase";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="authShell">
          <p className="eyebrow">OPENING TEMPO…</p>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    const supabase = getSupabase();
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error !== null) {
      setMessage(result.error.message);
      return;
    }
    if (result.data.session === null) {
      setMessage("Check your inbox to confirm your account, then sign in.");
      return;
    }
    const returnTo = search.get("returnTo");
    router.replace(returnTo?.startsWith("/") === true ? returnTo : "/");
  };

  return (
    <main className="authShell">
      <section className="authIntro">
        <a className="wordmark" href="/">
          tempo
        </a>
        <p className="eyebrow">THE RIGHT AMOUNT, AT THE RIGHT TIME</p>
        <h1>Your attention deserves an editor.</h1>
        <p>
          One finite daily briefing across everything you care about. Grounded
          in sources, fitted to your available time, and finished when you are.
        </p>
      </section>
      <section className="authCard">
        <p className="eyebrow">
          {mode === "sign-in" ? "WELCOME BACK" : "START YOUR TEMPO"}
        </p>
        <h2>
          {mode === "sign-in" ? "Open your briefing" : "Create your account"}
        </h2>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {message === null ? null : <p className="formMessage">{message}</p>}
        <button
          disabled={busy || email.length === 0 || password.length < 6}
          onClick={() => void submit()}
        >
          {busy
            ? "One moment…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
        <button
          className="textButton"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        >
          {mode === "sign-in"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
