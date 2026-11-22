"use client";

import { Database, Eye, Link2, Pencil, Search, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackendAction, useBackendQuery } from "@/hooks/use-backend";
import { linkHisChild, loadGuardianHis, lookupHisChild, unlinkHisChild, updateHisLink } from "@/lib/actions/admin/his";
import {
  RELATIONSHIPS,
  birthConditionLabels,
  childName,
  type Guardian,
  type HisLookup,
  type PortalChild,
} from "@/lib/api/types";
import { buttonClass, inputClass, secondaryButtonClass } from "@/lib/dashboard/cred";
import { ageDays, formatAge, todayISO } from "@/lib/sisnat/dates";
import { EmptyRow, StatusBadge, Table, Td, Tr, toneFor } from "@/components/dashboard/shared";
import { TextField, labelClass, submitWith } from "@/components/dashboard/forms";
import { LoadState, SelectField, optional, required } from "@/components/dashboard/admin/common";
import { FollowupModal, followup } from "@/components/dashboard/admin/tracking-view";
import { ControlDetailModal } from "@/components/dashboard/guardian/portal-views";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";

/**
 * Hijos del padre que están en HIS-MINSA (SQL Server). HIS no guarda padres ni nombres:
 * aquí el admin o el coordinador vincula al niño por su DNI/CNV + fecha de nacimiento (y el
 * nombre del carnet, opcional). El vínculo vive en Postgres y se puede editar o quitar; HIS-MINSA
 * es solo lectura: sus atenciones se leen en vivo y nunca se modifican.
 */
export function GuardianHisSection({ guardian }: { guardian: Guardian }) {
  const { data, loading, error, reload } = useBackendQuery(`his-${guardian.id}`, () => loadGuardianHis(guardian.id));
  const run = useBackendAction();
  const [linking, setLinking] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [rename, setRename] = useState<PortalChild | null>(null);
  const [unlink, setUnlink] = useState<PortalChild | null>(null);

  const summaries = useMemo(
    () =>
      new Map(
        data?.his.children.map((c) => [
          c.id,
          followup(c, { controls: data.his.controls, packages: data.packages, services: data.services }),
        ]) ?? [],
      ),
    [data],
  );
  const viewing = data?.his.children.find((c) => c.id === viewId);
  const kids = data?.his.children ?? [];

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Database className="size-5 text-primary" />
            Hijos en HIS-MINSA ({kids.length})
          </h2>
          <p className="text-sm text-muted-foreground">Sus atenciones se leen en vivo de HIS-MINSA (SQL Server); no se copian a SICNA.</p>
        </div>
        <button className={secondaryButtonClass} onClick={() => setLinking(true)}>
          <Link2 className="size-4" />
          Vincular niño de HIS-MINSA
        </button>
      </div>

      <LoadState loading={loading && !data} error={error} onRetry={reload}>
        <Table head={["Niño", "Edad", "Establecimiento (HIS)", "Cumplimiento", "Parentesco", ""]} minWidth={900}>
          {kids.length ? (
            kids.map((child) => {
              const s = summaries.get(child.id);
              return (
                <Tr key={child.id}>
                  <Td>
                    <span className="block font-medium">{childName(child).trim()}</span>
                    <span className="block text-xs text-muted-foreground">
                      {child.document_type} {child.dni} · {child.attentions ?? 0} atenciones · {birthConditionLabels[child.birth_condition]}
                    </span>
                  </Td>
                  <Td>{formatAge(ageDays(child.birth_date))}</Td>
                  <Td>
                    <span className="block">{child.facility_name ?? "—"}</span>
                    {child.micro_red && <span className="block text-xs text-muted-foreground">Micro red {child.micro_red}</span>}
                  </Td>
                  <Td>{s && <StatusBadge tone={toneFor(s.coverage)}>{s.coverage}%</StatusBadge>}</Td>
                  <Td>
                    <select
                      key={`${child.id}-${child.relationship}`}
                      aria-label={`Parentesco con ${childName(child)}`}
                      className={`${inputClass} h-9 w-36`}
                      defaultValue={child.relationship}
                      onChange={async (e) => {
                        const ok = await run(updateHisLink(guardian.id, child.dni!, { relationship: e.target.value }), "Parentesco actualizado");
                        if (ok) reload();
                      }}
                    >
                      {[...new Set([child.relationship, ...RELATIONSHIPS])].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <span className="flex items-center justify-end gap-2">
                      <IconButton label={`Ver controles de ${childName(child)}`} onClick={() => setViewId(child.id)}>
                        <Eye className="size-4" />
                      </IconButton>
                      <IconButton label={`Poner nombre a ${childName(child)}`} onClick={() => setRename(child)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label={`Desvincular a ${childName(child)}`} danger onClick={() => setUnlink(child)}>
                        <Unlink className="size-4" />
                      </IconButton>
                    </span>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <EmptyRow colSpan={6}>
              Ningún niño de HIS-MINSA vinculado. Usa <b>Vincular niño de HIS-MINSA</b> con el DNI o CNV del carnet.
            </EmptyRow>
          )}
        </Table>
      </LoadState>

      {viewing && data && summaries.get(viewing.id) && (
        <FollowupModal
          followup={summaries.get(viewing.id)!}
          parents={[{ guardian, relationship: viewing.relationship }]}
          onClose={() => setViewId(null)}
          renderPick={(row, close) => (
            <ControlDetailModal
              row={row}
              child={viewing}
              pkg={data.packages.find((p) => p.id === row.service.package_id)}
              facilities={[]}
              onClose={close}
            />
          )}
          footer={
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="size-4" />
              Solo lectura: las atenciones se registran en HIS-MINSA.
            </p>
          }
        />
      )}
      {linking && <LinkHisChildModal guardian={guardian} onClose={() => setLinking(false)} onSaved={reload} />}
      {rename && (
        <RenameModal
          child={rename}
          onClose={() => setRename(null)}
          onSave={async (name) => {
            const ok = await run(updateHisLink(guardian.id, rename.dni!, { child_name: name }), "Nombre guardado");
            if (ok) reload();
            return ok !== null;
          }}
        />
      )}
      {unlink && (
        <ConfirmModal
          title="Desvincular niño de HIS-MINSA"
          confirmText="Desvincular"
          message={
            <>
              <b>{childName(unlink).trim()}</b> dejará de aparecer en la ficha y en el portal de <b>{guardian.full_name}</b>. Solo se
              quita el vínculo en SICNA: en HIS-MINSA <b>no se borra nada</b>.
            </>
          }
          onConfirm={async () => {
            const ok = await run(unlinkHisChild(guardian.id, unlink.dni!), "Niño desvinculado");
            if (ok) reload();
            return ok !== null;
          }}
          onClose={() => setUnlink(null)}
        />
      )}
    </section>
  );
}

function IconButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`inline-flex size-9 items-center justify-center rounded-lg border border-border transition ${danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent"}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/** Paso 1: buscar por DNI/CNV. Paso 2: confirmar con la fecha de nacimiento del carnet (el backend la compara con HIS). */
function LinkHisChildModal({ guardian, onClose, onSaved }: { guardian: Guardian; onClose: () => void; onSaved: () => void }) {
  const run = useBackendAction();
  const [document, setDocument] = useState("");
  const [found, setFound] = useState<HisLookup | null>(null);
  const [pending, setPending] = useState(false);

  async function search() {
    if (!/^\d{8}$/.test(document)) return;
    setPending(true);
    setFound(await run(lookupHisChild(document)));
    setPending(false);
  }

  async function submit(form: FormData) {
    setPending(true);
    const ok = await run(
      linkHisChild({
        guardian_id: guardian.id,
        document_number: document,
        birth_date: required(form, "birth_date"),
        relationship: required(form, "relationship"),
        child_name: optional(form, "child_name"),
      }),
    );
    setPending(false);
    if (ok) {
      onSaved();
      onClose();
    }
  }

  const alreadyHere = found?.links.some((l) => l.guardian_id === guardian.id);

  return (
    <Modal title="Vincular niño de HIS-MINSA" subtitle={`Hijo de ${guardian.full_name}`} onClose={onClose}>
      <div className="grid gap-4">
        <form onSubmit={submitWith(search)} className="flex items-end gap-2">
          <label className={`${labelClass} min-w-0 flex-1`}>
            <span>
              DNI o CNV del niño<span className="text-destructive"> *</span>
            </span>
            <input
              name="document"
              required
              inputMode="numeric"
              maxLength={8}
              placeholder="8 dígitos"
              value={document}
              onChange={(e) => {
                setDocument(e.target.value.replace(/\D/g, ""));
                setFound(null);
              }}
              className={inputClass}
            />
          </label>
          <button className={`${secondaryButtonClass} h-10`} type="submit" disabled={pending || document.length !== 8}>
            <Search className="size-4" />
            Buscar
          </button>
        </form>

        {found && (
          <div className="grid gap-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <span className="font-semibold">
              {found.child.document_type} {found.child.dni} · {found.child.gender === "F" ? "Niña" : found.child.gender === "M" ? "Niño" : "Sexo no registrado"}
            </span>
            <span className="text-muted-foreground">
              {found.child.facility_name ?? "Sin establecimiento"}
              {found.child.micro_red ? ` · Micro red ${found.child.micro_red}` : ""}
            </span>
            <span className="text-muted-foreground">
              {found.attentions.length} atenciones en HIS · {found.controls.length} prestaciones cumplidas ·{" "}
              {birthConditionLabels[found.child.birth_condition]}
            </span>
            {found.links.length > 0 && (
              <span className="text-xs text-muted-foreground">Ya vinculado a {found.links.length} padre(s){alreadyHere ? ", incluido este" : ""}.</span>
            )}
          </div>
        )}

        {found && !alreadyHere && (
          <form onSubmit={submitWith(submit)} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Fecha de nacimiento"
                name="birth_date"
                type="date"
                required
                max={todayISO()}
                hint="La del carnet; se compara con HIS"
              />
              <SelectField
                label="Parentesco"
                name="relationship"
                required
                defaultValue="Madre"
                options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))}
              />
            </div>
            <TextField
              label="Nombre del niño"
              name="child_name"
              maxLength={150}
              placeholder="Opcional: HIS no guarda nombres"
              hint="Puedes cambiarlo después"
            />
            <button className={buttonClass} type="submit" disabled={pending}>
              <Link2 className="size-4" />
              {pending ? "Vinculando..." : "Vincular a este padre"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

function RenameModal({ child, onClose, onSave }: { child: PortalChild; onClose: () => void; onSave: (name: string | null) => Promise<boolean> }) {
  const [pending, setPending] = useState(false);
  return (
    <Modal title="Nombre del niño" subtitle={`${child.document_type} ${child.dni} · HIS-MINSA no guarda nombres`} onClose={onClose}>
      <form
        onSubmit={submitWith(async (form) => {
          setPending(true);
          const ok = await onSave(optional(form, "child_name"));
          setPending(false);
          if (ok) onClose();
        })}
        className="grid gap-4"
      >
        <TextField
          label="Nombre"
          name="child_name"
          maxLength={150}
          defaultValue={child.first_names.startsWith(`${child.document_type} `) ? "" : child.first_names}
          placeholder="Como figura en su carnet"
        />
        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </Modal>
  );
}
