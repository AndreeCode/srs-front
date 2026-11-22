import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CLEAR_SITE_DATA, ROLE_COOKIE, SESSION_COOKIE } from "@/lib/cookie-names";

/**
 * La sesión dejó de valer en el backend (cerrada, vencida o dispositivo bloqueado) pero la
 * cookie sigue en el navegador. Un Server Component no puede borrarla, así que el dashboard
 * redirige aquí: sin esto, proxy.ts mandaría de /login a /dashboard en bucle.
 */
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ROLE_COOKIE);
  // Redirección relativa: el navegador se queda en el mismo host por el que entró. Con
  // `new URL("/login", request.url)` el servidor de desarrollo arma la URL con "localhost"
  // aunque se haya entrado por 127.0.0.1, y en otro host la sesión no se comparte.
  const response = new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  for (const [key, value] of Object.entries(CLEAR_SITE_DATA)) response.headers.set(key, value);
  return response;
}
