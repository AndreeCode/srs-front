import { headers } from "next/headers";

/**
 * Datos del navegador que el backend usa para la sesión, el rate limit y la auditoría.
 * Sin esto el backend solo vería la IP del servidor de Next. Se toma la última entrada de
 * X-Forwarded-For: la agrega Next (IP del socket) o el proxy inverso más cercano, así que el
 * cliente no la controla. En producción el proxy debe reescribir el encabezado
 * (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`).
 */
export async function forwardedHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",").pop()?.trim();
  return { "User-Agent": h.get("user-agent") ?? "", ...(ip ? { "X-Forwarded-For": ip } : {}) };
}
