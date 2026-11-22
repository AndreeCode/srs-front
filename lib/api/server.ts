import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/backend";
import { forwardedHeaders } from "@/lib/api/forwarded";
import type { ApiResult } from "@/lib/api/types";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * Tiempo máximo de espera al backend (OWASP A10): si se cuelga, la acción responde con un error
 * claro en vez de dejar la pantalla cargando para siempre. Subir archivos tiene más margen.
 */
const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;


/**
 * Llamada al backend desde una Server Action: reenvía la cookie de sesión, el navegador
 * y la IP del usuario (el backend los usa para la sesión y la auditoría). Solo importar desde
 * archivos "use server": el token nunca llega al navegador.
 * `body` va como JSON; `form` como multipart (subida de archivos).
 */
export async function backend<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, error: "Tu sesión terminó, vuelve a ingresar" };

  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      Cookie: `access_token=${token}`,
      ...(await forwardedHeaders()),
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    cache: "no-store",
    signal: AbortSignal.timeout(init.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
  }).catch((err: unknown) => (err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : null));

  if (res === "timeout") return { ok: false, status: 504, error: "El servidor tardó demasiado en responder, inténtalo de nuevo" };
  if (!res) return { ok: false, status: 503, error: "No se pudo conectar con el servidor" };

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) {
      cookieStore.delete(SESSION_COOKIE);
      cookieStore.delete(ROLE_COOKIE);
    }
    return { ok: false, status: res.status, error: payload?.msg ?? `Error ${res.status} del servidor` };
  }
  return { ok: true, data: payload?.data as T, msg: payload?.msg ?? "", meta: payload?.meta };
}

/** Une varias lecturas hechas en paralelo: si alguna falla, devuelve ese error. */
export function combine<T extends Record<string, ApiResult<unknown>>>(
  results: T,
): ApiResult<{ [K in keyof T]: T[K] extends ApiResult<infer U> ? U : never }> {
  const data: Record<string, unknown> = {};
  for (const [key, result] of Object.entries(results)) {
    if (!result.ok) return result;
    data[key] = result.data;
  }
  return { ok: true, data: data as { [K in keyof T]: T[K] extends ApiResult<infer U> ? U : never }, msg: "" };
}

export const id = (value: string) => encodeURIComponent(value);

/**
 * Para listas de apoyo que no todos los roles pueden leer (p. ej. el coordinador no ve
 * usuarios): un 403 se trata como lista vacía en vez de romper toda la pantalla.
 */
export function orEmpty<T>(result: ApiResult<T[]>): ApiResult<T[]> {
  return !result.ok && result.status === 403 ? { ok: true, data: [], msg: "" } : result;
}
