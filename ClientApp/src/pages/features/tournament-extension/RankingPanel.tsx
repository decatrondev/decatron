import React, { useEffect, useState } from 'react';
import { RefreshCw, Loader2, Check, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Pestaña "Ranking". Separado de TournamentConfig.tsx el 15-08-2026.

interface RankingSnapshot {
    riotMatchId: string;
    occurredAt: string;
    result: string;
    champion: string | null;
    kills: number;
    deaths: number;
    assists: number;
    lpBefore: number | null;
    lpAfter: number | null;
}

interface RankingRow {
    participantId: number;
    displayName: string;
    riotId: string | null;
    riotTagLine: string | null;
    hasPuuid: boolean;
    currentLp: number | null;
    wins: number;
    losses: number;
    lastMatchAt: string | null;
    recentMatches: RankingSnapshot[];
}

export default function RankingPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [ranking, setRanking] = useState<RankingRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/ranking`);
            setRanking(res.data.ranking || []);
        } catch (err) {
            console.error('Error cargando ranking', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
    }, [edition?.id]);

    const handleResync = async () => {
        if (!edition) return;
        setSyncing(true);
        setSyncMessage(null);
        try {
            const res = await api.post(`/admin/tournament/editions/${edition.id}/riot-resync`);
            setSyncMessage({ ok: res.data.success, text: res.data.message });
            await load(edition.id);
        } catch (err: any) {
            setSyncMessage({ ok: false, text: err?.response?.data?.message || 'Error resincronizando' });
        } finally {
            setSyncing(false);
        }
    };

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">Ranking — {edition.name}</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => load(edition.id)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] text-sm font-bold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
                    </button>
                    <button
                        onClick={handleResync}
                        disabled={syncing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Resincronizar ahora
                    </button>
                </div>
            </div>

            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                El poller de Riot API corre cada 3 minutos por edicion en curso — "Resincronizar ahora" corre lo mismo al toque, sin esperar el ciclo, util
                mientras estas probando.
            </p>

            {syncMessage && (
                <p className={`text-sm flex items-center gap-1 ${syncMessage.ok ? 'text-[#2563eb]' : 'text-red-600 dark:text-red-400'}`}>
                    {syncMessage.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {syncMessage.text}
                </p>
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : ranking.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin participantes en esta edicion todavia.</p>
            ) : (
                <div className="space-y-2">
                    {ranking.map((row, idx) => (
                        <div key={row.participantId} className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                            <button
                                onClick={() => setExpandedId(expandedId === row.participantId ? null : row.participantId)}
                                className="w-full text-left p-4 flex items-center justify-between hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] w-6">{idx + 1}</span>
                                    <div>
                                        <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{row.displayName}</div>
                                        {row.riotId && (
                                            <div className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                {row.riotId}#{row.riotTagLine}
                                                {!row.hasPuuid && ' · aun sin resolver cuenta de Riot'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        {row.wins}V — {row.losses}D
                                    </span>
                                    <span className="font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {row.currentLp != null ? `${row.currentLp} LP` : 'Sin datos'}
                                    </span>
                                </div>
                            </button>

                            {expandedId === row.participantId && (
                                <div className="border-t border-[#e2e8f0] dark:border-[#374151] p-4 bg-[#f8fafc] dark:bg-[#262626] space-y-2">
                                    {row.recentMatches.length === 0 ? (
                                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">Todavia no se trackeo ninguna partida.</p>
                                    ) : (
                                        row.recentMatches.map((m) => (
                                            <div key={m.riotMatchId} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    {m.result === 'win' ? (
                                                        <ArrowUp className="w-4 h-4 text-[#2563eb]" />
                                                    ) : (
                                                        <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                    )}
                                                    <span className="text-[#1e293b] dark:text-[#f8fafc]">{m.champion || '—'}</span>
                                                    <span className="text-[#64748b] dark:text-[#94a3b8] text-xs">
                                                        {m.kills}/{m.deaths}/{m.assists}
                                                    </span>
                                                </div>
                                                <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                    {m.lpAfter != null ? `${m.lpAfter} LP` : '—'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
