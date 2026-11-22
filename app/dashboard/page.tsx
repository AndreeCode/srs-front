import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BACKEND_URL, type BackendUser, type SessionRole } from "@/lib/backend";
import { forwardedHeaders } from "@/lib/api/forwarded";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { ROLE_COOKIE, SESSION_COOKIE } from "@/lib/cookie-names";

async function loadSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: `access_token=${token}`, ...(await forwardedHeaders()) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!meRes?.ok) return null;
  const meBody = await meRes.json();
  const user = meBody.data as BackendUser;

  const role = user.role ?? (cookieStore.get(ROLE_COOKIE)?.value as SessionRole | undefined);
  if (!role) return null;

  return {
    id: user.id,
    name: user.full_name,
    role,
    establishment: "Red de Salud Huamanga",
    mustChangePassword: Boolean((user as { must_change_password?: boolean }).must_change_password),
    mfaSetupRequired: Boolean((user as { mfa_setup_required?: boolean }).mfa_setup_required),
  };
}

export default async function DashboardPage() {
  const session = await loadSession();
  if (!session) redirect("/session-expired");

  return <DashboardClient session={session} />;
}
