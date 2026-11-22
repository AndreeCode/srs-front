"use server";

import { backend, combine, id } from "@/lib/api/server";
import type { CarePackage, CareService, GuardianHisChild, GuardianHisFollowup, HisLookup } from "@/lib/api/types";

/**
 * Niños de HIS-MINSA (SQL Server, solo lectura). HIS no guarda quién es el padre: el admin o
 * el coordinador vincula cada niño a su padre por DNI/CNV + fecha de nacimiento, y ese vínculo
 * se guarda en Postgres (guardian_his_children): ese vínculo sí se edita y se borra; HIS nunca.
 */

/** Hijos HIS de un padre con sus controles ya traducidos, más el catálogo para el seguimiento. */
export async function loadGuardianHis(guardianId: string) {
  const [his, packages, services] = await Promise.all([
    backend<GuardianHisFollowup>(`/his/guardians/${id(guardianId)}`),
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
  ]);
  return combine({ his, packages, services });
}

/** Busca un niño en HIS-MINSA por su DNI o CNV (8 dígitos). */
export async function lookupHisChild(documentNumber: string) {
  // POST: el DNI del niño va en el cuerpo, no en la URL (no queda en logs de acceso). ASVS V14.
  return backend<HisLookup>("/his/children/lookup", { method: "POST", body: { document_number: documentNumber } });
}

export async function linkHisChild(input: {
  guardian_id: string;
  document_number: string;
  birth_date: string;
  relationship: string;
  child_name: string | null;
}) {
  return backend<GuardianHisChild>("/guardian-his-children", { method: "POST", body: input });
}

export async function updateHisLink(
  guardianId: string,
  documentNumber: string,
  input: { relationship?: string; child_name?: string | null },
) {
  return backend<GuardianHisChild>(`/guardian-his-children/${id(guardianId)}/${id(documentNumber)}`, {
    method: "PUT",
    body: input,
  });
}

export async function unlinkHisChild(guardianId: string, documentNumber: string) {
  return backend<null>(`/guardian-his-children/${id(guardianId)}/${id(documentNumber)}`, { method: "DELETE" });
}
