"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-ink">Admin sign in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Enter the store admin password to manage products and orders.
      </p>
      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-ink outline-none focus:ring-2 focus:ring-sage-deep"
          />
        </div>
        {state?.error && (
          <p className="text-sm text-red-700" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-sage-deep px-6 py-3 text-sm font-semibold text-white transition hover:bg-sage disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
