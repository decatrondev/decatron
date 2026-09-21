import React, { useEffect, useState } from 'react';
import { LayoutDashboard, AlertTriangle, Trophy, Swords, Clock, Code2, Copy } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Milestone 1 — Dashboard. Ver .dev/torneos/09-panel-admin-backend.md #2.
// No incluye "jugadores en vivo" — ver nota en TournamentDashboardAdminController.cs
// (no hay deteccion de en-vivo para canales que no son usuarios de Decatron).

interface DashboardData {
    editionName: string;
    editionStatus: string;
    endsAt: string | null;
    daysUntilEnd: number | null;
    totalParticipants: number;
    totalMatchesTracked: number;
    currentLeaderName: string | null;
    currentLeaderLp: number | null;
    recentShellEvents: { id: number; type: string; createdAt: string; wasReverse: boolean }[];
    unfulfilledPunishments: number;
    alerts: string[];
    riotKeyConfigured: boolean;
    riotKeyActive: boolean;
    riotLastValidatedAt: string | null;
}

export default function DashboardPanel({
    edition,
    editions,
    onSelectEdition,
    channelName,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
    channelName: string;
}) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/dashboard`);
            setData(res.data.dashboard);
        } catch (err) {
            console.error('Error cargando dashboard', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
    }, [edition?.id]);

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    if (loading || !data) {
        return <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>;
    }

    return (
        <div className="space-y-4 4xl:space-y-6">
            <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-[#2563eb]" /> Dashboard — {data.editionName}
            </h2>

            {channelName && <PublicLinkCard channelName={channelName} editionSlug={edition.slug} />}

            {data.alerts.length > 0 && (
                <div className="space-y-1.5">
                    {data.alerts.map((a, i) => (
                        <p
                            key={i}
                            className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg flex items-center gap-2"
                        >
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {a}
                        </p>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 4xl:gap-5">
                <StatCard
                    icon={<Clock className="w-5 h-5 4xl:w-6 4xl:h-6" />}
                    label="Dias restantes"
                    value={data.daysUntilEnd != null ? Math.max(0, Math.floor(data.daysUntilEnd)) : '—'}
                />
                <StatCard icon={<Swords className="w-5 h-5 4xl:w-6 4xl:h-6" />} label="Participantes" value={data.totalParticipants} />
                <StatCard icon={<Swords className="w-5 h-5 4xl:w-6 4xl:h-6" />} label="Partidas trackeadas" value={data.totalMatchesTracked} />
                <StatCard
                    icon={<Trophy className="w-5 h-5 4xl:w-6 4xl:h-6" />}
                    label="Lider actual"
                    value={data.currentLeaderName ? `${data.currentLeaderName} (${data.currentLeaderLp} LP)` : 'Sin datos'}
                    small
                />
            </div>

            <div className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Estado de Riot API</h3>
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    {data.riotKeyConfigured
                        ? `Key configurada, ${data.riotKeyActive ? 'activa' : 'desactivada'}. Ultima validacion: ${data.riotLastValidatedAt ? new Date(data.riotLastValidatedAt).toLocaleString() : 'nunca'}.`
                        : 'No hay Riot API key configurada para este canal.'}
                </p>
            </div>

            <div>
                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                    Ultimos eventos ({data.unfulfilledPunishments} sin marcar cumplidos hace +24h)
                </h3>
                {data.recentShellEvents.length === 0 ? (
                    <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin eventos todavia.</p>
                ) : (
                    <div className="space-y-1">
                        {data.recentShellEvents.map((e) => (
                            <div key={e.id} className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
                                <span>{new Date(e.createdAt).toLocaleString()}</span>
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{e.type}</span>
                                {e.wasReverse && <span className="text-amber-600 dark:text-amber-400">reverse</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* El widget embebible muestra el ranking (LP) — no aplica a ARAM, que no tiene ranking individual. */}
            {channelName && edition.mode === 'solo_q_climb' && <EmbedSnippet channelName={channelName} editionSlug={edition.slug} />}
        </div>
    );
}

// Link publico del torneo — pedido del usuario 24-08-2026: quien crea el torneo no
// tenia forma de saber cual es su link para compartirlo (solo existia el snippet
// del widget embebible, que es otra cosa y ademas solo aplica a SoloQ Climb).
function PublicLinkCard({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [copied, setCopied] = useState(false);
    const url = `${window.location.origin}/torneos/${channelName}/${editionSlug}`;

    const copy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="p-4 4xl:p-6 rounded-xl border border-[#2563eb]/30 bg-[#2563eb]/5">
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Link público de tu torneo</h3>
            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">Compartí esto con tus participantes y tu audiencia.</p>
            <div className="flex items-center gap-1.5">
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs 4xl:text-sm px-2 py-1.5 rounded bg-white dark:bg-[#1B1C1D] text-[#2563eb] flex-1 truncate hover:underline"
                >
                    {url}
                </a>
                <button onClick={copy} className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] flex-shrink-0">
                    <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-[10px] text-[#2563eb] flex-shrink-0">copiado</span>}
            </div>
        </div>
    );
}

function EmbedSnippet({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [copied, setCopied] = useState(false);
    const url = `${window.location.origin}/embed/torneo/${channelName}/${editionSlug}/ranking`;
    const snippet = `<iframe src="${url}" width="360" height="500" frameborder="0"></iframe>`;

    const copy = () => {
        navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 flex items-center gap-1.5">
                <Code2 className="w-4 h-4" /> Widget embebible
            </h3>
            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">
                Cualquier participante puede pegar esto en su propia web para mostrar el ranking en vivo.
            </p>
            <div className="flex items-center gap-1.5">
                <code className="text-[10px] px-2 py-1.5 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] flex-1 truncate">
                    {snippet}
                </code>
                <button onClick={copy} className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] flex-shrink-0">
                    <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-[10px] text-[#2563eb] flex-shrink-0">copiado</span>}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean }) {
    return (
        <div className="p-3 4xl:p-5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]">
            <div className="text-[#2563eb] mb-1">{icon}</div>
            <div className={`font-black text-[#1e293b] dark:text-[#f8fafc] ${small ? 'text-sm 4xl:text-base' : 'text-xl 4xl:text-3xl'}`}>{value}</div>
            <div className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">{label}</div>
        </div>
    );
}
