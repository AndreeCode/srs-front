"use server";

import { backend, id } from "@/lib/api/server";

export type MfaStatus = { enabled: boolean; required: boolean; setup_pending: boolean; recovery_codes_left: number };
export type MfaSetup = { secret: string; otpauth_uri: string };
export type MySession = {
  id: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  current: boolean;
};

/** Verificación en dos pasos (TOTP) de la propia cuenta. ASVS V6.3. */
export async function mfaStatusAction() {
  return backend<MfaStatus>("/auth/mfa");
}

/** Configurar el MFA y cerrar sesiones piden otra vez la contraseña (ASVS V7.5.1 / V7.5.2). */
export async function mfaSetupAction(password: string) {
  return backend<MfaSetup>("/auth/mfa/setup", { method: "POST", body: { password } });
}

export async function mfaEnableAction(code: string) {
  return backend<{ recovery_codes: string[] }>("/auth/mfa/enable", { method: "POST", body: { code } });
}

export async function mfaDisableAction(password: string, code: string) {
  return backend<null>("/auth/mfa/disable", { method: "POST", body: { password, code } });
}

/** Sesiones abiertas de la propia cuenta. ASVS V7.4. */
export async function mySessionsAction() {
  return backend<MySession[]>("/auth/sessions");
}

export async function revokeMySessionAction(sessionId: string, password: string) {
  return backend<null>(`/auth/sessions/${id(sessionId)}/revoke`, { method: "POST", body: { password } });
}

export async function revokeMyOtherSessionsAction(password: string) {
  return backend<null>("/auth/sessions/revoke-others", { method: "POST", body: { password } });
}

/** Admin: el usuario perdió el celular y debe volver a configurar la verificación. */
export async function resetUserMfaAction(userId: string) {
  return backend<null>(`/users/${id(userId)}/mfa`, { method: "DELETE" });
}
