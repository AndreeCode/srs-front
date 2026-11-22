import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { CLEAR_SITE_DATA, ROLE_COOKIE, SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * La sesión dejó de valer en el backend (cerrada, vencida o dispositivo bloqueado) pero la
 * cookie sigue en el navegador. Un Server Component no puede borrarla, así que el dashboard
 * redirige aquí: sin esto, proxy.ts mandaría de /login a /dashboard en bucle.
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ROLE_COOKIE);
  const response = NextResponse.redirect(new URL("/login", request.url));
  for (const [key, value] of Object.entries(CLEAR_SITE_DATA)) response.headers.set(key, value);
  return response;
}
