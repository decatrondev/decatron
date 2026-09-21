import { useEffect, useState } from 'react';
import api from '../../services/api';
import { SectionLabel, EmptyState, NameAvatar } from './shared';

// Separado de BracketSection.tsx el 24-08-2026 — equipos y bracket eran una sola
// tab, ahora son tabs distintas (ver reestructuracion en TournamentPublicPage.tsx).
// Sigue reusando el mismo endpoint /bracket (ya trae teams + matches juntos), solo
// se reparte el render.

interface Team {
    id: number;
    name: string;
    seed: number | null;
    roster: { displayName: string; isCaptain: boolean; isSubstitute: boolean }[];
}

export default function TeamsSection({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/bracket`);
                if (res.data?.success) setTeams(res.data.teams || []);
            } catch (err) {
                console.error('Error cargando equipos', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [channelName, editionSlug]);

    if (loading) return null;

    return (
        <section>
            <SectionLabel title="Equipos" />
            {teams.length === 0 ? (
                <EmptyState text="Todavía no hay equipos cargados." />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-4 5xl:grid-cols-5 gap-2.5 4xl:gap-4">
                    {teams.map((t) => (
                        <div key={t.id} className="p-3 4xl:p-4 rounded-lg border border-[#232C42] bg-[#0F1729] hover:border-[#3ED6C4]/50 hover:-translate-y-0.5 transition-all">
                            <div className="flex items-center gap-2 mb-1.5">
                                <NameAvatar name={t.name} size={24} />
                                <p className="font-display font-bold text-sm 4xl:text-base text-[#EDF0F7] truncate">{t.name}</p>
                            </div>
                            <div className="space-y-0.5">
                                {t.roster.map((m, i) => (
                                    <p key={i} className="font-mono text-[11px] 4xl:text-xs text-[#7C8AA6]">
                                        {m.displayName}
                                        {m.isCaptain ? ' (C)' : ''}
                                        {m.isSubstitute ? ' · suplente' : ''}
                                    </p>
                                ))}
                                {t.roster.length === 0 && <p className="font-mono text-[11px] text-[#7C8AA6]">Sin roster todavía</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
