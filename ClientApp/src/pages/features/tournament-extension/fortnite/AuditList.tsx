import { useEffect, useState } from 'react';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../../../services/api';
import AuthImage from '../../../../components/tournament/AuthImage';
import { AUDIT_ACTION_LABELS, RESULT_STATUS_LABELS, cardClass } from './types';

// Historial de lo que hizo el organizador con los resultados (F4). Es el mismo que
// ven los participantes en "Mi inscripción".

export interface AuditEntry {
    id: number;
    createdAt: string;
    action: string;
    actorName: string;
    sessionName: string;
    gameNumber: number;
    teamName: string;
    before: { placement: number | null; eliminations: number; status: string } | null;
    after: { placement: number | null; eliminations: number; status: string } | null;
    reason: string | null;
    evidenceFileIds: number[];
}

export function describeResult(r: AuditEntry['before']): string {
    if (!r) return '—';
    if (r.status !== 'approved') return RESULT_STATUS_LABELS[r.status] || r.status;
    return `puesto ${r.placement} · ${r.eliminations} elim.`;
}

export default function AuditList({ base }: { base: string }) {
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<AuditEntry[] | null>(null);

    useEffect(() => {
        if (!open) return;
        api.get(`${base}/audit`).then((res) => setEntries(res.data.entries || [])).catch(() => setEntries([]));
    }, [open, base]);

    return (
        <section className={cardClass}>
            <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2">
                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg flex items-center gap-2">
                    <History className="w-4 h-4 text-[#2563eb]" /> Historial de cambios
                </span>
                {open ? <ChevronDown className="w-4 h-4 text-[#64748b]" /> : <ChevronRight className="w-4 h-4 text-[#64748b]" />}
            </button>
            {open &&
                (entries == null ? null : entries.length === 0 ? (
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Todavía no hay cambios.</p>
                ) : (
                    <div className="space-y-2">
                        {entries.map((e) => (
                            <div key={e.id} className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626] space-y-1">
                                <p className="text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">
                                    <span className="font-bold">{e.actorName}</span> · {AUDIT_ACTION_LABELS[e.action] || e.action} · {e.teamName}
                                </p>
                                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    {e.sessionName}, partida {e.gameNumber} · {new Date(e.createdAt.endsWith('Z') ? e.createdAt : e.createdAt + 'Z').toLocaleString()}
                                </p>
                                {(e.before || e.after) && (
                                    <p className="text-xs 4xl:text-sm text-[#475569] dark:text-[#cbd5e1]">
                                        {describeResult(e.before)} → {describeResult(e.after)}
                                    </p>
                                )}
                                {e.reason && <p className="text-xs 4xl:text-sm italic text-[#475569] dark:text-[#cbd5e1]">“{e.reason}”</p>}
                                {e.evidenceFileIds.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap">
                                        {e.evidenceFileIds.map((id) => (
                                            <AuthImage key={id} url={`${base}/files/${id}`} alt="Justificante" className="w-16 h-10 4xl:w-24 4xl:h-14" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
        </section>
    );
}
