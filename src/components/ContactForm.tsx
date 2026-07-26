"use client";

import { useState } from "react";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      setError("Please fill in your name and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Stub: wire this to your email service or form backend.
    setError("");
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-sand p-8 text-center ring-1 ring-border">
        <p className="font-serif text-xl text-ink">Thank you for reaching out!</p>
        <p className="mt-2 text-ink-soft">
          We&apos;ll get back to you within 1–2 business days.
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-sage-deep";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="c-name" className="text-sm font-medium text-ink">
          Name
        </label>
        <input
          id="c-name"
          className={`mt-1 ${field}`}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="c-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="c-email"
          type="email"
          className={`mt-1 ${field}`}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="c-message" className="text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="c-message"
          rows={5}
          className={`mt-1 ${field}`}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-full bg-sage-deep px-6 py-2.5 text-sm font-semibold text-white hover:bg-sage"
      >
        Send message
      </button>
    </form>
  );
}
