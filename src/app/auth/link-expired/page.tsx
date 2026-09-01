"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Suspense } from "react";
import { supabaseBrowser } from "@/utils/supabase/client";
import { maskEmail } from "@/utils/mask-email";

type ResendState = "sending" | "sent" | "rate_limited" | "error";

function LinkExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams?.get("email");
  const type = searchParams?.get("type") === "invite" ? "invite" : "magiclink";

  const [state, setState] = useState<ResendState>("sending");
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (!email) {
      router.replace("/auth/login?error=link_expired");
      return;
    }

    if (hasSentRef.current) return;
    hasSentRef.current = true;

    async function resend() {
      try {
        if (type === "invite") {
          const res = await fetch("/api/auth/resend-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          if (!res.ok) {
            setState(res.status === 429 ? "rate_limited" : "error");
            return;
          }
        } else {
          const redirectTo = `${window.location.origin}/api/auth/callback?email=${encodeURIComponent(email as string)}`;
          const { error } = await supabaseBrowser.auth.signInWithOtp({
            email: email as string,
            options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
          });
          if (error) {
            const isRateLimited =
              (error as { status?: number; code?: string }).status === 429 ||
              (error as { status?: number; code?: string }).code === "over_request_rate_limit";
            setState(isRateLimited ? "rate_limited" : "error");
            return;
          }
        }
        setState("sent");
      } catch {
        setState("error");
      }
    }

    resend();
  }, [email, type, router]);

  const maskedEmail = email ? maskEmail(email) : "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
        <div className="text-center">
          {state === "sending" && (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">One moment…</h1>
              <p className="text-white/80">Checking your link.</p>
            </>
          )}

          {(state === "sent" || state === "rate_limited") && (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">
                Looks like that ticket has expired.
              </h1>
              <p className="text-white/80 mb-6">
                Let&apos;s get you a new one. We sent it to{" "}
                <span className="font-semibold text-white">{maskedEmail}</span>.
              </p>
              <p className="text-white/60 text-sm">
                Check your inbox in the next minute or two, then click the new link.
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <h1 className="text-2xl font-bold text-white mb-4">Unable to Send a New Link</h1>
              <p className="text-white/80 mb-6">
                Something went wrong sending a new link. Please request one manually.
              </p>
              <a
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-sm font-bold text-white transition hover:scale-105"
              >
                Go to Login
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LinkExpiredPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-pink-900 px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-7 shadow-2xl sm:p-9">
            <p className="text-center text-white/80">Loading...</p>
          </div>
        </main>
      }
    >
      <LinkExpiredContent />
    </Suspense>
  );
}
