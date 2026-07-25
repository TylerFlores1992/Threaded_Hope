"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  isAdminConfigured,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!isAdminConfigured()) {
    return { error: "Admin is not configured (ADMIN_PASSWORD is not set)." };
  }
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }
  const token = await createSessionToken();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
