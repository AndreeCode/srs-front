"use client";

import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useBackendAction } from "@/hooks/use-backend";
import { changePasswordAction } from "@/lib/actions/auth";
import { buttonClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { TextField } from "@/components/dashboard/forms";
import { Modal } from "@/components/ui/modal";

/** Cambio de contraseña propio. La política (longitud, comunes, DNI) la valida el backend. */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const run = useBackendAction();
  const [pending, setPending] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = String(form.get("current_password") ?? "");
    const next = String(form.get("new_password") ?? "");
    if (next !== String(form.get("confirm_password") ?? "")) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    setPending(true);
    const ok = await run(changePasswordAction(current, next));
    setPending(false);
    if (ok) onClose();
  }

  return (
    <Modal title="Cambiar contraseña" subtitle="Se cerrarán tus sesiones en otros dispositivos." onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <TextField label="Contraseña actual" name="current_password" type="password" required autoComplete="current-password" />
        <TextField
          label="Nueva contraseña"
          name="new_password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          hint="Mínimo 8 caracteres con letras y números. No uses tu DNI ni contraseñas comunes."
        />
        <TextField label="Repite la nueva contraseña" name="confirm_password" type="password" required autoComplete="new-password" />
        {mismatch && <p className="text-sm text-destructive">Las contraseñas nuevas no coinciden.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            Cancelar
          </button>
          <button className={buttonClass} disabled={pending}>
            <KeyRound className="size-4" />
            {pending ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
