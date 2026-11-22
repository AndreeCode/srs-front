"use server";

import { cookies } from "next/headers";
import { forwardedHeaders } from "@/lib/api/forwarded";
import { backend } from "@/lib/api/server";
import {
  BACKEND_URL,
  parseSetCookie,
  type BackendUser,
  type SessionRole,
} from "@/lib/backend";
import type { LinkedChild, RegisterInput } from "@/lib/api/types";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60,
};

/** El backend identifica el navegador con esta cookie; dura lo mismo que allá (~400 días). */
const DEVICE_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 400 * 24 * 60 * 60 };

type LoginResult = { ok: true; user: BackendUser; role: SessionRole } | { ok: false; error: string };

/**
 * Devuelve el error en lugar de lanzarlo: en producción Next oculta el mensaje de los
 * errores lanzados en Server Actions y el usuario vería un error genérico de React.
 */
export async function loginAction(username: string, password: string): Promise<LoginResult> {
  const cookieStore = await cookies();
  const deviceToken = cookieStore.get("device_token")?.value;

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await forwardedHeaders()),
      ...(deviceToken ? { Cookie: `device_token=${deviceToken}` } : {}),
    },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!loginRes) return { ok: false, error: "No se pudo conectar con el servidor" };
  const loginBody = await loginRes.json().catch(() => null);
  if (!loginRes.ok) {
    return { ok: false, error: loginBody?.msg ?? "Credenciales inválidas" };
  }

  const setCookies = loginRes.headers.getSetCookie();
  const token = parseSetCookie(setCookies, "access_token");
  if (!token) {
    return { ok: false, error: "No se recibió la sesión del servidor" };
  }
  const newDeviceToken = parseSetCookie(setCookies, "device_token");

  // El backend devuelve el nombre del rol junto al usuario: no todos los roles pueden leer /roles.
  const user = loginBody.data as BackendUser;
  const role = user.role;
  if (!role) return { ok: false, error: "Tu cuenta no tiene un rol válido" };

  cookieStore.set("access_token", token, COOKIE_OPTIONS);
  cookieStore.set("session_role", role, COOKIE_OPTIONS);
  if (newDeviceToken) cookieStore.set("device_token", newDeviceToken, DEVICE_COOKIE_OPTIONS);

  return { ok: true, user, role };
}

type RegisterResult =
  | { ok: true; child: LinkedChild | null; role: SessionRole | null; loginError: string | null }
  | { ok: false; error: string };

/**
 * Registro público de padres: el backend busca al niño en Postgres y, si no está, en SISNAT
 * (SQL Server); solo guarda al padre, su cuenta y el vínculo. Si se crea, inicia sesión de una vez.
 */
export async function registerAction(input: RegisterInput): Promise<RegisterResult> {
  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await forwardedHeaders()) },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res) return { ok: false, error: "No se pudo conectar con el servidor" };
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: body?.msg ?? `Error ${res.status} del servidor` };

  const child = (body?.data?.child ?? null) as LinkedChild | null;
  const login = await loginAction(input.dni, input.password);
  return login.ok
    ? { ok: true, child, role: login.role, loginError: null }
    : { ok: true, child, role: null, loginError: login.error };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const client = await forwardedHeaders();

  await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: "POST",
    headers: token ? { Cookie: `access_token=${token}`, ...client } : client,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  cookieStore.delete("access_token");
  cookieStore.delete("session_role");
}

/** Cambia la contraseña propia: el backend pide la actual y cierra las demás sesiones. */
export async function changePasswordAction(currentPassword: string, newPassword: string) {
  return backend<null>("/auth/password", {
    method: "PUT",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
