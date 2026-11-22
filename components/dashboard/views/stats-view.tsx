"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock, Percent, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendQuery } from "@/hooks/use-backend";
import { loadStats } from "@/lib/actions/admin/dashboard";
import { inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { childCoverage, levelOf, pct, tally, type ChildCoverage, type Tally } from "@/lib/dashboard/coverage";
import { formatAge, todayISO } from "@/lib/sisnat/dates";
import { Stat } from "@/components/dashboard/stat";
import { LoadState } from "@/components/dashboard/admin/common";
import {
  EmptyRow,
  FilterBar,
  GroupRow,
  PageTitle,
  Progress,
  ResetButton,
  Table,
  Td,
  Tr,
  toneFor,
} from "@/components/dashboard/shared";

type Data = NonNullable<ReturnType<typeof useStats>["data"]>;
type Filters = { regionId: string; facilityId: string; packageId: string };
type Row = Tally & { id: string; label: string; children: number; ok: number; value: number };

const EMPTY: Filters = { regionId: "", facilityId: "", packageId: "" };

function useStats() {
  return useBackendQuery("stats", loadStats);
}

/** Suma niños y prestaciones de un grupo: "al día" es el niño con 80% o más de lo que le tocaba. */
function summarizeGroup(id: string, label: string, rows: ChildCoverage[]): Row {
  const total: Tally = { due: 0, done: 0, overdue: 0 };
  let children = 0;
  let ok = 0;
  for (const r of rows) {
    if (!r.items.length) continue;
    const t = tally(r.items);
    total.due += t.due;
    total.done += t.done;
    total.overdue += t.overdue;
    children++;
    if (levelOf(pct(t.done, t.due)) === "ok") ok++;
  }
  return { id, label, children, ok, ...total, value: pct(total.done, total.due) };
}

function analyze(data: Data, base: ChildCoverage[], f: Filters) {
  // 1. Territorio y paquete: el filtro de paquete deja solo sus prestaciones en cada niño.
  const rows = base
    .filter((r) => (!f.regionId || r.regionId === f.regionId) && (!f.facilityId || r.facilityId === f.facilityId))
    .map((r) => (f.packageId ? { ...r, items: r.items.filter((i) => i.service.package_id === f.packageId) } : r));

  const overall = summarizeGroup("all", "Total", rows);
  const levels = { ok: 0, late: 0, critical: 0 };
  for (const r of rows) {
    if (!r.items.length) continue;
    const t = tally(r.items);
    levels[levelOf(pct(t.done, t.due))]++;
  }

  // 2. Paquetes (o, si hay uno elegido, sus prestaciones agrupadas como en el catálogo).
  const packages = data.packages
    .filter((p) => p.active && (!f.packageId || p.id === f.packageId))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      pkg: p,
      ...summarizeGroup(p.id, p.name, rows.map((r) => ({ ...r, items: r.items.filter((i) => i.service.package_id === p.id) }))),
    }))
    .filter((p) => p.due > 0);

  const services = f.packageId
    ? data.services
        .filter((s) => s.active && s.package_id === f.packageId)
        .sort((a, b) => a.group_order - b.group_order || a.sort_order - b.sort_order)
        .map((s) => ({
          service: s,
          ...summarizeGroup(s.id, s.name, rows.map((r) => ({ ...r, items: r.items.filter((i) => i.service.id === s.id) }))),
        }))
        .filter((s) => s.due > 0)
    : [];

  // 3. Comparativos territoriales, de menor a mayor cumplimiento (los que necesitan apoyo, arriba).
  const group = (key: (r: ChildCoverage) => string, name: (id: string) => string) => {
    const map = new Map<string, ChildCoverage[]>();
    for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
    return [...map.entries()]
      .map(([id, list]) => summarizeGroup(id, name(id), list))
      .filter((g) => g.due > 0)
      .sort((a, b) => a.value - b.value || b.children - a.children);
  };
  const regionName = new Map(data.regions.map((r) => [r.id, r.name]));
  const facilityName = new Map(data.facilities.map((x) => [x.id, x.name]));

  return {
    overall,
    levels,
    pending: rows.filter((r) => !r.items.length).length,
    packages,
    services,
    regions: group((r) => r.regionId, (id) => regionName.get(id) ?? "Sin micro red"),
    facilities: group((r) => r.facilityId, (id) => facilityName.get(id) ?? "Sin establecimiento"),
  };
}

export function StatsView() {
  const { data, loading, error, reload } = useStats();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const today = todayISO();
  const base = useMemo(() => (data ? childCoverage(data, today) : []), [data, today]);
  const stats = useMemo(() => (data ? analyze(data, base, filters) : null), [data, base, filters]);

  const regions = useMemo(() => (data?.regions ?? []).filter((r) => r.active).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const facilities = useMemo(
    () =>
      (data?.facilities ?? [])
        .filter((f) => f.active && (!filters.regionId || f.region_id === filters.regionId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data, filters.regionId],
  );
  const packages = useMemo(() => (data?.packages ?? []).filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order), [data]);
  const selectedPackage = packages.find((p) => p.id === filters.packageId);
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <>
      <PageTitle
        kicker="Indicadores"
        title="Estadísticas"
        subtitle="Cumplimiento de las prestaciones CRED que ya le tocaban a cada niño, según el filtro elegido."
        action={
          <button className={secondaryButtonClass} onClick={reload} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && stats && (
          <>
            <FilterBar>
              <Select label="Micro red" value={filters.regionId} all="Todas" onChange={(v) => set({ regionId: v, facilityId: "" })}>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Select label="Establecimiento" value={filters.facilityId} all="Todos" onChange={(v) => set({ facilityId: v })}>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <Select label="Paquete" value={filters.packageId} all="Todos" onChange={(v) => set({ packageId: v })}>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <ResetButton onClick={() => setFilters(EMPTY)} />
              <p className="ml-auto self-center text-sm text-muted-foreground">
                {stats.overall.children} niños evaluados
                {stats.pending > 0 && ` · ${stats.pending} aún sin prestaciones exigibles`}
              </p>
            </FilterBar>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Stat
                label="Cumplimiento"
                value={`${stats.overall.value}%`}
                detail={`${stats.overall.done.toLocaleString("es-PE")} de ${stats.overall.due.toLocaleString("es-PE")} prestaciones exigibles`}
                icon={Percent}
              />
              <Stat label="Niños al día" value={String(stats.levels.ok)} detail="Cumplimiento de 80% o más" icon={CheckCircle2} />
              <Stat label="Con retraso" value={String(stats.levels.late)} detail="Entre 50% y 79%" icon={Clock} />
              <Stat
                label="Críticos"
                value={String(stats.levels.critical)}
                detail={`Menos de 50% · ${stats.overall.overdue} prestaciones vencidas`}
                icon={AlertTriangle}
              />
            </div>

            <div className={`mb-8 grid gap-6 ${filters.regionId ? "" : "lg:grid-cols-2"}`}>
              {!filters.regionId && (
                <Comparison title="Por micro red" label="Micro red" rows={stats.regions} onPick={(id) => set({ regionId: id, facilityId: "" })} />
              )}
              <Comparison
                title="Por establecimiento"
                label="Establecimiento"
                rows={stats.facilities}
                onPick={filters.facilityId ? undefined : (id) => set({ facilityId: id })}
              />
            </div>

            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{selectedPackage ? `Prestaciones de ${selectedPackage.name}` : "Cumplimiento por paquete"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedPackage
                      ? `${formatAge(selectedPackage.min_age_days)} – ${formatAge(selectedPackage.max_age_days)} · cada prestación con los niños a los que ya les tocaba`
                      : "Elige un paquete para ver el detalle de sus prestaciones"}
                  </p>
                </div>
                {selectedPackage && (
                  <button className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline" onClick={() => set({ packageId: "" })}>
                    <ArrowLeft className="size-4" />
                    Todos los paquetes
                  </button>
                )}
              </div>
              {selectedPackage ? (
                <Table head={["Prestación", "Niños", "Cumplidas", "Vencidas", "Cumplimiento"]} minWidth={640}>
                  {stats.services.length ? (
                    groupByName(stats.services).map(([groupName, items]) => [
                      <GroupRow key={`g-${groupName}`} colSpan={5}>
                        {groupName}
                      </GroupRow>,
                      ...items.map((s) => (
                        <Tr key={s.id}>
                          <Td className="font-medium">
                            {s.label}
                            <span className="block text-xs font-normal text-muted-foreground">{s.service.code}</span>
                          </Td>
                          <Td>{s.children}</Td>
                          <Td>
                            {s.done} de {s.due}
                          </Td>
                          <Td>{s.overdue ? <span className="font-semibold text-destructive">{s.overdue}</span> : "0"}</Td>
                          <MeterCell value={s.value} />
                        </Tr>
                      )),
                    ])
                  ) : (
                    <EmptyRow colSpan={5}>Ningún niño del filtro tiene todavía prestaciones exigibles de este paquete.</EmptyRow>
                  )}
                </Table>
              ) : (
                <Table head={["Paquete", "Edad", "Niños", "Cumplidas", "Vencidas", "Cumplimiento"]} minWidth={720}>
                  {stats.packages.length ? (
                    stats.packages.map((p) => (
                      <Tr key={p.id}>
                        <Td>
                          <button className="group flex items-center gap-1 text-left font-medium hover:text-primary" onClick={() => set({ packageId: p.id })}>
                            <span>
                              {p.label}
                              <span className="block text-xs font-normal text-muted-foreground">{p.pkg.code}</span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                          </button>
                        </Td>
                        <Td className="whitespace-nowrap text-muted-foreground">
                          {formatAge(p.pkg.min_age_days)} – {formatAge(p.pkg.max_age_days)}
                        </Td>
                        <Td>{p.children}</Td>
                        <Td>
                          {p.done} de {p.due}
                        </Td>
                        <Td>{p.overdue ? <span className="font-semibold text-destructive">{p.overdue}</span> : "0"}</Td>
                        <MeterCell value={p.value} />
                      </Tr>
                    ))
                  ) : (
                    <EmptyRow colSpan={6}>No hay niños con prestaciones exigibles en este filtro.</EmptyRow>
                  )}
                </Table>
              )}
            </section>

          </>
        )}
      </LoadState>
    </>
  );
}

function groupByName<T extends { service: { group_name: string } }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(i.service.group_name, [...(map.get(i.service.group_name) ?? []), i]);
  return [...map.entries()];
}

function Select({
  label,
  value,
  all,
  onChange,
  children,
}: {
  label: string;
  value: string;
  all: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <select className={`${inputClass} min-w-44`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {children}
      </select>
    </label>
  );
}

function MeterCell({ value }: { value: number }) {
  return (
    <Td className="md:w-44">
      <div className="w-full min-w-28">
        <div className="mb-1 text-xs font-semibold tabular-nums">{value}%</div>
        <Progress value={value} tone={toneFor(value)} />
      </div>
    </Td>
  );
}

/** Tabla comparativa; con `onPick`, el nombre filtra la pantalla por esa micro red o establecimiento. */
function Comparison({ title, label, rows, onPick }: { title: string; label: string; rows: Row[]; onPick?: (id: string) => void }) {
  return (
    <section className="min-w-0">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">De menor a mayor cumplimiento</p>
      <Table head={[label, "Niños", "Al día", "Cumplimiento"]} minWidth={420}>
        {rows.length ? (
          rows.map((r) => (
            <Tr key={r.id || r.label}>
              <Td className="font-medium">
                {onPick && r.id ? (
                  <button className="text-left hover:text-primary hover:underline" onClick={() => onPick(r.id)}>
                    {r.label}
                  </button>
                ) : (
                  r.label
                )}
              </Td>
              <Td>{r.children}</Td>
              <Td>{r.ok}</Td>
              <MeterCell value={r.value} />
            </Tr>
          ))
        ) : (
          <EmptyRow colSpan={4}>Sin datos para mostrar.</EmptyRow>
        )}
      </Table>
    </section>
  );
}
