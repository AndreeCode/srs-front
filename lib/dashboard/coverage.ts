import { packageApplies } from "@/lib/api/cred";
import type { CarePackage, CareService, Child, ChildControl, HealthFacility } from "@/lib/api/types";
import { ageDays } from "@/lib/sisnat/dates";

/**
 * Cumplimiento CRED: de las prestaciones que ya le tocaban a cada niño, cuántas están cumplidas.
 * Una prestación "le toca" cuando el niño alcanzó su edad mínima; si ya pasó la edad máxima sin
 * registrarse, está vencida. Las cumplidas cuentan siempre y las marcadas "no aplica" no cuentan.
 * El Panel general y Estadísticas usan este mismo cálculo.
 */

export type CoverageSource = {
  children: Child[];
  controls: ChildControl[];
  packages: CarePackage[];
  services: CareService[];
  facilities: HealthFacility[];
};

export type ItemState = "done" | "due" | "overdue";

export type ChildCoverage = {
  child: Child;
  facilityId: string;
  regionId: string;
  age: number;
  items: { service: CareService; state: ItemState }[];
};

export type Tally = { due: number; done: number; overdue: number };

export const pct = (done: number, due: number) => (due ? Math.round((done / due) * 100) : 0);

/** Estado de cada prestación exigible de cada niño activo (paquetes y prestaciones activos). */
export function childCoverage(data: CoverageSource, today: string): ChildCoverage[] {
  const status = new Map<string, ChildControl["status"]>();
  for (const c of data.controls) {
    const key = `${c.child_id}|${c.service_id}`;
    if (status.get(key) !== "completed") status.set(key, c.status);
  }

  const facilityById = new Map(data.facilities.map((f) => [f.id, f]));
  const activePackages = data.packages.filter((p) => p.active);
  const activeServices = data.services.filter((s) => s.active);

  return data.children
    .filter((child) => child.active)
    .map((child) => {
      const age = ageDays(child.birth_date, today);
      const applies = new Set(activePackages.filter((p) => packageApplies(p, child)).map((p) => p.id));
      const items: ChildCoverage["items"] = [];
      for (const service of activeServices) {
        if (!applies.has(service.package_id)) continue;
        const s = status.get(`${child.id}|${service.id}`);
        if (s === "not_applicable") continue;
        if (s === "completed") items.push({ service, state: "done" });
        else if (age >= service.min_age_days) items.push({ service, state: age > service.max_age_days ? "overdue" : "due" });
      }
      return {
        child,
        facilityId: child.health_facility_id,
        regionId: facilityById.get(child.health_facility_id)?.region_id ?? "",
        age,
        items,
      };
    });
}

export function tally(items: { state: ItemState }[]): Tally {
  const t = { due: items.length, done: 0, overdue: 0 };
  for (const i of items) {
    if (i.state === "done") t.done++;
    else if (i.state === "overdue") t.overdue++;
  }
  return t;
}

/** Nivel de cumplimiento de un niño, con los mismos cortes que el resto del sistema (80% y 50%). */
export type Level = "ok" | "late" | "critical";
export const levelOf = (value: number): Level => (value >= 80 ? "ok" : value >= 50 ? "late" : "critical");
