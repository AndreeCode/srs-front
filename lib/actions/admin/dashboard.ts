"use server";

import { backend, combine } from "@/lib/api/server";
import type {
  CarePackage,
  CareService,
  Child,
  ChildControl,
  Guardian,
  HealthFacility,
  Region,
  SecurityAlert,
  UserSession,
} from "@/lib/api/types";

/** Lo que resume el panel del administrador (indicadores y atenciones por mes), en una sola ida al servidor. */
export async function loadDashboard() {
  const [children, controls, packages, services, facilities, guardians, sessions, alerts] = await Promise.all([
    backend<Child[]>("/children"),
    backend<ChildControl[]>("/child-controls"),
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
    backend<HealthFacility[]>("/health-facilities"),
    backend<Guardian[]>("/guardians"),
    backend<UserSession[]>("/sessions?active=true"),
    backend<SecurityAlert[]>("/security-alerts?status=open"),
  ]);
  return combine({ children, controls, packages, services, facilities, guardians, sessions, alerts });
}

/** Lo que necesita la pantalla de Estadísticas: padrón, controles, catálogo y territorio. */
export async function loadStats() {
  const [children, controls, packages, services, facilities, regions] = await Promise.all([
    backend<Child[]>("/children"),
    backend<ChildControl[]>("/child-controls"),
    backend<CarePackage[]>("/care-packages"),
    backend<CareService[]>("/care-services"),
    backend<HealthFacility[]>("/health-facilities"),
    backend<Region[]>("/regions"),
  ]);
  return combine({ children, controls, packages, services, facilities, regions });
}
