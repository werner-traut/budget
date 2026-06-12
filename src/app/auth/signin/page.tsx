"use client";

import { signIn } from "next-auth/react";

const devBypassEnabled =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

export default function SignIn() {
  const handleGoogleSignIn = async () => {
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleDevSignIn = async () => {
    try {
      await signIn("dev-bypass", { callbackUrl: "/" });
    } catch (error) {
      console.error("Dev sign in error:", error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Frontispiece */}
        <div className="mb-10 text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-foreground/30" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Est. every payday
            </span>
            <span className="h-px w-12 bg-foreground/30" />
          </div>
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            Budget{" "}
            <span className="italic text-primary">Tracker</span>
          </h1>
          <p className="mt-4 font-display text-lg italic text-muted-foreground">
            Every dollar, entered in ink.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-8 shadow-[0_1px_2px_rgba(35,28,15,0.06)]">
          <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Sign in to open your ledger
          </p>

          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-foreground/25 bg-background px-4 py-2.5 text-sm font-medium tracking-wide transition-colors hover:bg-accent hover:border-primary/40"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>

          {devBypassEnabled && (
            <button
              onClick={handleDevSignIn}
              className="mt-3 w-full rounded-md bg-destructive/90 px-4 py-2 text-sm font-medium tracking-wide text-destructive-foreground transition-colors hover:bg-destructive"
            >
              Dev sign in (bypass — local only)
            </button>
          )}
        </div>

        <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/60">
          Balanced books · Honest numbers
        </p>
      </div>
    </div>
  );
}
