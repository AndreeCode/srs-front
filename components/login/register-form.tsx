"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Baby, CheckCircle2, HeartPulse, LogIn, UserPlus } from "lucide-react";
import { registerAction } from "@/lib/actions/auth";
import type { GuardianRelationship, LinkedChild } from "@/lib/api/types";
import { PasswordField } from "@/components/ui/field";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TextField, labelClass } from "@/components/dashboard/forms";
import { buttonClass, inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { todayISO } from "@/lib/sisnat/dates";

const relationships: GuardianRelationship[] = ["Madre", "Padre", "Apoderado"];

type Done = { child: LinkedChild | null; loggedIn: boolean; loginError: string | null };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export function RegisterForm() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  async function doRegister(form: FormData) {
    setNotice("");
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("password_confirm") ?? "")) {
      setNotice("Las contraseñas no coinciden");
      return;
    }
    setPending(true);
    const result = await registerAction({
      dni: text(form, "dni"),
      full_name: text(form, "full_name"),
      phone: text(form, "phone") || null,
      email: text(form, "email") || null,
      password,
      child_identifier: text(form, "child_identifier"),
      child_birth_date: text(form, "child_birth_date"),
      relationship: text(form, "relationship") as GuardianRelationship,
    }).catch(() => null);
    setPending(false);

    if (!result) {
      setNotice("No se pudo crear la cuenta, intenta de nuevo");
      return;
    }
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDone({ child: result.child, loggedIn: result.role !== null, loginError: result.loginError });
  }

  return (
    <section className="relative flex flex-col justify-center p-6 sm:p-10">
      <div className="mb-8 flex items-center justify-between lg:absolute lg:inset-x-10 lg:top-10 lg:mb-0 lg:justify-end">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <p className="font-bold">CRED Huamanga</p>
            <p className="text-xs text-muted-foreground">Red de Salud Huamanga</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md lg:mt-14">
        {done ? (
          <RegisterDone done={done} onEnter={() => {
            router.push("/dashboard");
            router.refresh();
          }} />
        ) : (
          <>
            <p className="text-sm font-semibold text-primary">Portal familiar</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Crear cuenta</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Para madres, padres y apoderados. Confirmamos que eres familiar con los datos de uno de tus hijos,
              registrado en SICNA o en HIS-MINSA.
            </p>

            <form action={doRegister} className="mt-6 grid gap-5">
              <fieldset className="grid gap-4">
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tus datos</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="DNI"
                    name="dni"
                    required
                    inputMode="numeric"
                    pattern="\d{8}"
                    maxLength={8}
                    placeholder="8 dígitos"
                    autoComplete="username"
                    hint="Será tu usuario para ingresar"
                  />
                  <label className={labelClass}>
                    <span>
                      Parentesco<span className="text-destructive"> *</span>
                    </span>
                    <select name="relationship" required defaultValue="Madre" className={inputClass}>
                      {relationships.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <TextField label="Nombres y apellidos" name="full_name" required minLength={3} placeholder="Ej. Rosa Quispe Huamán" autoComplete="name" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Celular" name="phone" inputMode="numeric" pattern="\d{9}" maxLength={9} placeholder="9 dígitos" autoComplete="tel" />
                  <TextField label="Correo" name="email" type="email" placeholder="Opcional" autoComplete="email" />
                </div>
              </fieldset>

              <fieldset className="grid gap-4">
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uno de tus hijos</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="DNI o código de padrón"
                    name="child_identifier"
                    required
                    minLength={3}
                    placeholder="Del niño o niña"
                  />
                  <TextField label="Fecha de nacimiento" name="child_birth_date" type="date" required max={todayISO()} />
                </div>
                <p className="text-xs text-muted-foreground">Podrás vincular a tus otros hijos desde el portal.</p>
              </fieldset>

              <fieldset className="grid gap-4">
                <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contraseña</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField label="Contraseña" name="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                  <PasswordField label="Repetir contraseña" name="password_confirm" placeholder="Igual a la anterior" autoComplete="new-password" />
                </div>
              </fieldset>

              <button className={`${buttonClass} h-11`} disabled={pending}>
                <UserPlus className="size-4" />
                {pending ? "Verificando y creando..." : "Crear mi cuenta"}
              </button>
            </form>

            {notice && (
              <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {notice}
              </p>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function RegisterDone({ done, onEnter }: { done: Done; onEnter: () => void }) {
  const { child } = done;
  return (
    <div className="grid gap-5">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CheckCircle2 className="size-7" />
      </div>
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cuenta creada</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tu usuario es tu DNI. Podrás ver los controles y vacunas de tu hijo cuando tu establecimiento de salud
          confirme que eres su padre o apoderado.
        </p>
      </div>

      {child && (
        <div className="grid gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <Baby className="size-4 text-primary" />
            Documento {child.identifier} · {child.relationship}
          </span>
          <span className="text-muted-foreground">{child.message}</span>
        </div>
      )}

      {done.loggedIn ? (
        <button className={`${buttonClass} h-11`} onClick={onEnter}>
          <LogIn className="size-4" />
          Ir a mi portal
        </button>
      ) : (
        <>
          {done.loginError && <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{done.loginError}</p>}
          <Link href="/login" className={`${secondaryButtonClass} h-11`}>
            <LogIn className="size-4" />
            Iniciar sesión
          </Link>
        </>
      )}
    </div>
  );
}
