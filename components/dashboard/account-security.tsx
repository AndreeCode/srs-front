"use client";

import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import {
  mfaDisableAction,
  mfaEnableAction,
  mfaSetupAction,
  mfaStatusAction,
  mySessionsAction,
  revokeMySessionAction,
  type MfaSetup,
} from "@/lib/actions/account";
import { buttonClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { formatDateTime } from "@/components/dashboard/admin/audit-labels";
import { TextField, submitWith } from "@/components/dashboard/forms";
import { LoadState } from "@/components/dashboard/admin/common";
import { Modal } from "@/components/ui/modal";

/** La clave en grupos de 4 se copia a mano sin errores. */
const grouped = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

/**
 * Verificación en dos pasos con TOTP (ASVS V6.3). Sirve cualquier app autenticadora
 * (Google Authenticator, Microsoft Authenticator, FreeOTP...). El back guarda el secreto cifrado.
 * `forced`: el rol la exige y aún no está activa, así que no se puede cerrar el modal.
 */
export function MfaModal({ onClose, forced = false }: { onClose: () => void; forced?: boolean }) {
  const status = useBackendQuery("mfa-status", mfaStatusAction);
  const run = useBackendAction();
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);

  async function wrap<T>(fn: () => Promise<T>) {
    setPending(true);
    try {
      return await fn();
    } finally {
      setPending(false);
    }
  }

  const start = () =>
    wrap(async () => {
      const data = await run(mfaSetupAction(), "Clave generada: agrégala en tu app");
      if (data) setSetup(data);
    });

  const confirm = submitWith((form) =>
    wrap(async () => {
      const data = await run(mfaEnableAction(String(form.get("code") ?? "")));
      if (data) {
        setCodes(data.recovery_codes);
        setSetup(null);
        status.reload();
      }
    }),
  );

  const disable = submitWith((form) =>
    wrap(async () => {
      if (await run(mfaDisableAction(String(form.get("password") ?? ""), String(form.get("code") ?? "")))) status.reload();
    }),
  );

  const close = forced ? () => window.location.reload() : onClose;

  return (
    <Modal
      title="Verificación en dos pasos"
      subtitle={forced ? "Tu rol tiene acceso a datos de niños y exige un segundo factor para ingresar." : "Protege tu cuenta con un código de tu celular."}
      onClose={forced && !status.data?.enabled ? () => undefined : close}
    >
      <LoadState loading={!status.data && !status.error} error={status.error} onRetry={status.reload}>
        {codes ? (
          <div className="grid gap-4 text-sm">
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <b>Guarda estos códigos de respaldo ahora: no se volverán a mostrar.</b> Cada uno sirve una sola vez si pierdes el celular.
            </p>
            <pre className="rounded-lg bg-muted p-3 text-base leading-8 tracking-wider">{codes.join("\n")}</pre>
            <button className={buttonClass} onClick={close}>
              <ShieldCheck className="size-4" />
              Ya los guardé
            </button>
          </div>
        ) : status.data?.enabled ? (
          <div className="grid gap-4 text-sm">
            <p className="rounded-lg border border-success/30 bg-success/10 p-3">
              Verificación en dos pasos <b>activa</b>. Te quedan {status.data.recovery_codes_left} códigos de respaldo.
            </p>
            {status.data.required ? (
              <p className="text-muted-foreground">Tu rol exige la verificación en dos pasos, así que no se puede desactivar.</p>
            ) : (
              <form onSubmit={disable} className="grid gap-3">
                <TextField label="Contraseña" name="password" type="password" required autoComplete="current-password" />
                <TextField label="Código actual" name="code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={20} />
                <button className={secondaryButtonClass} disabled={pending}>
                  Desactivar verificación en dos pasos
                </button>
              </form>
            )}
          </div>
        ) : setup ? (
          <form onSubmit={confirm} className="grid gap-4 text-sm">
            <ol className="grid list-decimal gap-2 pl-5">
              <li>Abre tu app autenticadora y elige «Ingresar una clave de configuración».</li>
              <li>
                Escribe esta clave (tipo «basada en tiempo»):{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-base font-bold tracking-wider">{grouped(setup.secret)}</code>
                <br />
                <span className="text-xs text-muted-foreground">
                  Desde el celular también puedes <a className="underline" href={setup.otpauth_uri}>abrirla directamente en la app</a>.
                </span>
              </li>
              <li>Escribe el código de 6 dígitos que muestra la app.</li>
            </ol>
            <TextField label="Código de la app" name="code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} autoFocus />
            <button className={buttonClass} disabled={pending}>
              <ShieldCheck className="size-4" />
              {pending ? "Verificando..." : "Activar"}
            </button>
          </form>
        ) : (
          <div className="grid gap-4 text-sm">
            <p className="text-muted-foreground">
              Además de la contraseña, al ingresar se pedirá un código de 6 dígitos de una app autenticadora en tu celular.
            </p>
            <button className={buttonClass} onClick={start} disabled={pending}>
              <KeyRound className="size-4" />
              Configurar verificación en dos pasos
            </button>
          </div>
        )}
      </LoadState>
    </Modal>
  );
}

/** Sesiones abiertas de la propia cuenta (ASVS V7.4): cerrar las que no reconozcas. */
export function SessionsModal({ onClose }: { onClose: () => void }) {
  const sessions = useBackendQuery("my-sessions", mySessionsAction);
  const run = useBackendAction();

  async function close(id: string) {
    if (await run(revokeMySessionAction(id))) sessions.reload();
  }

  return (
    <Modal title="Mis sesiones" subtitle="Se cierran solas tras 30 minutos sin actividad. Cierra las que no reconozcas." onClose={onClose}>
      <LoadState loading={!sessions.data && !sessions.error} error={sessions.error} onRetry={sessions.reload}>
        <ul className="grid gap-2">
          {sessions.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <MonitorSmartphone className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.current ? "Esta sesión" : (s.user_agent ?? "Navegador desconocido")}</p>
                <p className="text-xs text-muted-foreground">
                  IP {s.ip_address ?? "—"} · última actividad {formatDateTime(s.last_activity_at)}
                </p>
              </div>
              {!s.current && (
                <button className={secondaryButtonClass} onClick={() => close(s.id)}>
                  <LogOut className="size-4" />
                  Cerrar
                </button>
              )}
            </li>
          ))}
        </ul>
      </LoadState>
    </Modal>
  );
}
