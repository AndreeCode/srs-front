import { redirect } from "next/navigation";

/**
 * Registro público de padres apagado por ahora: HIS-MINSA no guarda quién es el padre de
 * cada niño, así que al padre lo registra el admin o el coordinador (ficha del padre).
 * El formulario sigue en components/login/register-form.tsx y el backend lo acepta con
 * PUBLIC_REGISTRATION=true.
 */
export default function Page() {
  redirect("/login");
}
