"use client";

import { useState } from "react";
import { store } from "@/data/store";

export function Newsletter({ variant = "block" }: { variant?: "block" | "footer" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      // Recorded against the Subscriber table so signups show in admin.
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const isFooter = variant === "footer";

  return (
    <form onSubmit={submit} className={isFooter ? "" : "mx-auto max-w-md text-center"}>
      {!isFooter && (
        <>
          <h2 className="font-serif text-2xl text-ink">Stay in the loop</h2>
          <p className="mt-2 text-ink-soft">{store.newsletterPitch}</p>
        </>
      )}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`nl-${variant}`}>
          Email address
        </label>
        <input
          id={`nl-${variant}`}
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
          placeholder="you@example.com"
          className="flex-1 rounded-full border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-sage-deep"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-full bg-sage-deep px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
        >
          {status === "sending" ? "Signing up…" : "Subscribe"}
        </button>
      </div>
      {status === "done" && (
        <p className="mt-2 text-sm text-sage-deep" role="status">
          Thank you for joining our community!
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          Please enter a valid email address and try again.
        </p>
      )}
    </form>
  );
}
