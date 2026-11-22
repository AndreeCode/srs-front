"use client";

import { ArrowRight, Baby, CheckCircle2, RefreshCw, ShieldAlert, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendQuery } from "@/hooks/use-backend";
import { loadDashboard } from "@/lib/actions/admin/dashboard";
import type { ChildControl } from "@/lib/api/types";
import { inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { childCoverage, pct, tally } from "@/lib/dashboard/coverage";
import { formatDate, todayISO } from "@/lib/sisnat/dates";
import { PageTitle, StatusBadge, toneFor } from "@/components/dashboard/shared";
import { LoadState } from "@/components/dashboard/admin/common";
import type { Nav } from "@/components/dashboard/views/packages-view";

type Data = NonNullable<ReturnType<typeof useDashboard>["data"]>;

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function useDashboard() {
  return useBackendQuery("dashboard", loadDashboard);
}

/**
 * Pulso general de la red. El detalle (micro red, establecimiento, paquete) vive en Estadísticas
 * y las listas de trabajo en sus propias pantallas; aquí no se repiten.
 */
function summarize(data: Data) {
  const today = todayISO();
  const coverage = childCoverage(data, today);
  const total = tally(coverage.flatMap((c) => c.items));
  return {
    done: total.done,
    due: total.due,
    coverage: pct(total.done, total.due),
    children: coverage.length,
    newborns: coverage.filter((c) => c.age <= 28).length,
    atRisk: coverage.filter((c) => c.child.birth_condition !== "none").length,
    withAccount: data.guardians.filter((g) => g.user_id).length,
  };
}

/** Atenciones cumplidas por año y mes, a partir de la fecha de atención de cada control. */
function attentionsByYear(controls: ChildControl[]) {
  const years = new Map<number, number[]>();
  for (const c of controls) {
    if (c.status !== "completed" || !c.completed_date) continue;
    const year = Number(c.completed_date.slice(0, 4));
    const month = Number(c.completed_date.slice(5, 7)) - 1;
    if (!years.has(year)) years.set(year, Array(12).fill(0));
    years.get(year)![month]++;
  }
  return years;
}

export function AdminDashboardView({ nav }: { nav: Nav }) {
  const { data, loading, error, reload } = useDashboard();
  const stats = useMemo(() => (data ? summarize(data) : null), [data]);
  const byYear = useMemo(() => attentionsByYear(data?.controls ?? []), [data]);

  return (
    <>
      <PageTitle
        kicker="Administración"
        title="Panel general"
        subtitle={`Situación de la Red de Salud Huamanga al ${formatDate(todayISO())}.`}
        action={
          <button className={secondaryButtonClass} onClick={reload} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        {data && stats && (
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-3">
              <Kpi
                icon={CheckCircle2}
                label="Cumplimiento CRED"
                value={`${stats.coverage}%`}
                badge={<CoverageBadge value={stats.coverage} />}
                detail={`${stats.done.toLocaleString("es-PE")} de ${stats.due.toLocaleString("es-PE")} prestaciones exigibles`}
                meter={stats.coverage}
                link="Ver estadísticas"
                onClick={() => nav.go({ name: "stats" })}
              />
              <Kpi
                icon={Baby}
                label="Niños en el padrón"
                value={stats.children.toLocaleString("es-PE")}
                detail={`${stats.newborns} recién nacidos · ${stats.atRisk} en riesgo al nacer · ${stats.withAccount} familias con cuenta`}
                link="Ver niños"
                onClick={() => nav.go({ name: "children" })}
              />
              <Kpi
                icon={ShieldAlert}
                label="Alertas de seguridad"
                value={String(data.alerts.length)}
                badge={data.alerts.length ? <StatusBadge tone="danger">Revisar</StatusBadge> : <StatusBadge tone="good">Sin alertas</StatusBadge>}
                detail={`${data.sessions.length} sesiones activas en este momento`}
                link="Ver alertas"
                onClick={() => nav.go({ name: "alerts" })}
              />
            </section>

            <AttentionsChart byYear={byYear} />
          </div>
        )}
      </LoadState>
    </>
  );
}

/* ───────────── Atenciones por mes ───────────── */

/** Eje con escalones redondos (1, 2, 2.5, 5 × 10ⁿ): 22 → 0·5·10·15·20·25; 86 → 0·20·40·60·80·100. */
function axis(value: number) {
  const raw = Math.max(value, 1) / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * power).find((n) => n >= raw) ?? 10 * power);
  const top = Math.max(step, Math.ceil(value / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) }, (_, i) => top - i * step);
  return { top, ticks };
}

/** "septiembre", "septiembre y diciembre", "marzo, junio y agosto". */
function joinMonths(indexes: number[]) {
  const names = indexes.map((i) => MONTH_NAMES[i]);
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : (names[0] ?? "—");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function AttentionsChart({ byYear }: { byYear: Map<number, number[]> }) {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const years = useMemo(() => [...new Set([currentYear, ...byYear.keys()])].sort((a, b) => b - a), [byYear, currentYear]);
  const [year, setYear] = useState(currentYear);

  const months = byYear.get(year) ?? Array(12).fill(0);
  const previous = byYear.get(year - 1);
  // En el año en curso los meses que aún no llegan no cuentan para el promedio ni se dibujan como cero.
  const elapsed = year === currentYear ? currentMonth + 1 : year > currentYear ? 0 : 12;
  const total = months.reduce((n, v) => n + v, 0);
  const average = elapsed ? Math.round(total / elapsed) : 0;
  const highest = Math.max(...months);
  const peaks = highest ? months.flatMap((v, i) => (v === highest ? [i] : [])) : [];
  // Comparación justa: el mismo periodo (ene → mes actual) del año anterior.
  const previousTotal = previous ? previous.slice(0, elapsed).reduce((n, v) => n + v, 0) : 0;
  const change = previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 100) : null;
  const { top: max, ticks } = axis(highest);

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Atenciones registradas por mes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Controles cumplidos según su fecha de atención</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Año
          <select className={`${inputClass} h-9 w-28`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label={`Total ${year}`} value={total.toLocaleString("es-PE")} />
        <Figure label="Promedio mensual" value={average.toLocaleString("es-PE")} hint={elapsed < 12 && elapsed > 0 ? `en ${elapsed} meses transcurridos` : undefined} />
        <Figure
          label={peaks.length > 1 ? "Meses con más atenciones" : "Mes con más atenciones"}
          value={joinMonths(peaks)}
          hint={total ? `${highest} atenciones${peaks.length > 1 ? " cada uno" : ""}` : undefined}
        />
        <Figure
          label={`Frente a ${year - 1}`}
          value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
          hint={change === null ? "Sin datos del año anterior" : elapsed < 12 ? `ene–${MONTHS[elapsed - 1]} de ${year - 1}: ${previousTotal}` : `${previousTotal} en ${year - 1}`}
          trend={change === null || change === 0 ? undefined : change > 0 ? "up" : "down"}
        />
      </div>

      {total ? (
        <div className="grid grid-cols-[2.25rem_1fr] gap-2">
          {/* Eje vertical */}
          <div className="relative h-56 text-right text-[10px] tabular-nums text-muted-foreground">
            {ticks.map((t, i) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / ticks.length) * 100}%` }}>
                {t}
              </span>
            ))}
            <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
          </div>
          <div>
            <div className="relative h-56 border-b border-border" role="img" aria-label={`Atenciones por mes en ${year}: ${total} en total`}>
              {ticks.map((t, i) => (
                <span key={t} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${(i / ticks.length) * 100}%` }} />
              ))}
              <div className="relative flex h-full items-end gap-1.5 sm:gap-3">
                {months.map((value, i) => {
                  const future = i >= elapsed;
                  return (
                    <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                      {!future && value > 0 && (
                        <span className={`mb-1 text-[11px] font-semibold tabular-nums ${peaks.includes(i) ? "text-primary" : "text-muted-foreground"}`}>{value}</span>
                      )}
                      {future ? (
                        <span className="h-full w-full max-w-12 rounded-t border border-dashed border-border/80" title="Mes aún no transcurrido" />
                      ) : (
                        <span
                          className={`w-full max-w-12 rounded-t transition-opacity group-hover:opacity-80 ${peaks.includes(i) ? "bg-primary" : "bg-primary/70"}`}
                          style={{ height: `${(value / max) * 100}%`, minHeight: value ? 4 : 0 }}
                        />
                      )}
                      {!future && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg group-hover:block"
                        >
                          <b className="capitalize">{MONTH_NAMES[i]}</b> {year}: {value} atenciones
                          {previous && ` · ${previous[i]} en ${year - 1}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 flex gap-1.5 sm:gap-3">
              {MONTHS.map((m, i) => (
                <span key={m} className={`flex-1 text-center text-[11px] ${i >= elapsed ? "text-muted-foreground/50" : "text-muted-foreground"} ${i % 2 ? "max-sm:invisible" : ""}`}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay atenciones registradas en {year}.</p>
      )}
    </section>
  );
}

function Figure({ label, value, hint, trend }: { label: string; value: string; hint?: string; trend?: "up" | "down" }) {
  const Trend = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-xl font-bold tabular-nums ${trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : ""}`}>
        {trend && <Trend className="size-4" />}
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ───────────── Piezas del panel ───────────── */

function CoverageBadge({ value }: { value: number }) {
  const tone = toneFor(value);
  return <StatusBadge tone={tone}>{tone === "good" ? "Adecuado" : tone === "warn" ? "En proceso" : "Bajo"}</StatusBadge>;
}

/** Cifra principal con un único destino, escrito en la tarjeta para que se sepa a dónde lleva. */
function Kpi({
  icon: Icon,
  label,
  value,
  badge,
  detail,
  meter,
  link,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  badge?: React.ReactNode;
  detail: string;
  meter?: number;
  link: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:border-primary/40 hover:bg-accent/40"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums tracking-tight">{value}</span>
        {badge}
      </span>
      {meter !== undefined && (
        <span className="block h-2 rounded-full bg-primary/15" role="meter" aria-valuenow={meter} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, meter)}%` }} />
        </span>
      )}
      <span className="text-xs text-muted-foreground">{detail}</span>
      <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
        {link}
        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
