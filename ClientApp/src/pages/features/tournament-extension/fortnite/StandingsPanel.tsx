import { useEffect, useState } from 'react';
import { Trophy, Loader2, Crown, Flame, ArrowUpRight, Check, AlertTriangle } from 'lucide-react';
import api from '../../../../services/api';
import { EditionPicker } from '../shared';
import type { TournamentEdition } from '../shared';
import { cardClass, primaryButton } from './types';

// Pestaña "Clasificación" del panel (.dev/torneos/15-fortnite.md F5): la misma tabla
// que ve el público, más el botón para pasar a la final a los que clasifican.

interface Row {
    rank: number;
    teamId: number;
    teamName: string;
    points: number;
    gamesPlayed: number;
    wins: number;
    eliminations: number;
    avgPlacement: number | null;
    matchPoint: boolean;
    champion: boolean;
    qualifies: boolean;
}

interface Scope {
    key: string;
    name: string;
    groupId: number | null;
    isFinal: boolean;
    qualifyCount: number | null;
    gamesPlanned: number;
    gamesWithResults: number;
    rows: Row[];
}

export default function StandingsPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [scopes, setScopes] = useState<Scope[] | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async (editionId: number) => {
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/fortnite/standings`);
            const list: Scope[] = res.data.scopes || [];
            setScopes(list);
            setActive((prev) => (prev && list.some((s) => s.key === prev) ? prev : list[0]?.key ?? null));
        } catch {
            setScopes([]);
        }
    };

    useEffect(() => {
        setScopes(null);
        setActive(null);
        if (!edition) return;
        load(edition.id);
        const t = setInterval(() => load(edition.id), 20000);
        return () => clearInterval(t);
    }, [edition?.id]);

    if (!edition) return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    if (scopes == null) return <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />;

    const scope = scopes.find((s) => s.key === active) || scopes[0];
    const hasGroupsAndFinal = scopes.some((s) => s.groupId != null && !s.isFinal) && scopes.some((s) => s.isFinal);

    const fillFinal = async () => {
        if (!window.confirm('Se reemplazan los equipos de la final por los que clasifican de cada grupo ahora mismo. ¿Seguir?')) return;
        setBusy(true);
        setMessage(null);
        try {
            const res = await api.post(`/admin/tournament/editions/${edition.id}/fortnite/groups/final/fill`);
            setMessage({ ok: true, text: `${res.data.added} equipo(s) pasaron a la final.` });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudo armar la final' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#2563eb]" /> Clasificación — {edition.name}
                </h2>
                {hasGroupsAndFinal && (
                    <button type="button" onClick={fillFinal} disabled={busy} className={primaryButton}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                        Pasar clasificados a la final
                    </button>
                )}
            </div>
            {message && (
                <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </p>
            )}

            {scopes.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    {scopes.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setActive(s.key)}
                            className={`px-3 py-2 4xl:px-4 4xl:py-2.5 rounded-lg text-sm 4xl:text-base font-bold ${
                                s.key === scope?.key
                                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                            }`}
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
            )}

            {!scope || scope.rows.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Todavía no hay equipos en esta tabla.</p>
            ) : (
                <section className={cardClass + ' overflow-x-auto'}>
                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {scope.gamesWithResults}/{scope.gamesPlanned} partidas con resultados
                        {scope.qualifyCount ? ` · pasan a la final los ${scope.qualifyCount} primeros` : ''}
                    </p>
                    <table className="w-full text-sm 4xl:text-base min-w-[560px]">
                        <thead>
                            <tr className="text-xs 4xl:text-sm font-mono uppercase text-[#64748b] dark:text-[#94a3b8]">
                                <th className="text-left px-2 py-2">#</th>
                                <th className="text-left px-2 py-2">Equipo</th>
                                <th className="text-right px-2 py-2">Puntos</th>
                                <th className="text-right px-2 py-2">Victorias</th>
                                <th className="text-right px-2 py-2">Elim.</th>
                                <th className="text-right px-2 py-2">Puesto prom.</th>
                                <th className="text-right px-2 py-2">Partidas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scope.rows.map((r) => (
                                <tr key={r.teamId} className="border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <td className={`px-2 py-2 font-mono ${r.rank === 1 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-[#64748b] dark:text-[#94a3b8]'}`}>{r.rank}</td>
                                    <td className="px-2 py-2 text-[#1e293b] dark:text-[#f8fafc]">
                                        <span className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold">{r.teamName}</span>
                                            {r.champion && (
                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center gap-1">
                                                    <Crown className="w-3 h-3" /> Campeón
                                                </span>
                                            )}
                                            {!r.champion && r.matchPoint && (
                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 flex items-center gap-1">
                                                    <Flame className="w-3 h-3" /> Match point
                                                </span>
                                            )}
                                            {r.qualifies && (
                                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">Clasifica</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-[#1e293b] dark:text-[#f8fafc]">{r.points}</td>
                                    <td className="px-2 py-2 text-right font-mono">{r.wins}</td>
                                    <td className="px-2 py-2 text-right font-mono">{r.eliminations}</td>
                                    <td className="px-2 py-2 text-right font-mono text-[#64748b] dark:text-[#94a3b8]">{r.avgPlacement ?? '—'}</td>
                                    <td className="px-2 py-2 text-right font-mono text-[#64748b] dark:text-[#94a3b8]">{r.gamesPlayed}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </div>
    );
}
