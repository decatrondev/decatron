import { useEffect, useState } from 'react';
import api from '../../services/api';
import { SectionLabel, EmptyState, NameAvatar, RoleBadge } from './shared';

// Tab "Jugadores" — separada de "Equipos" el 24-08-2026: vista plana de
// participantes de la edicion (con o sin equipo asignado), a diferencia de
// TeamsSection.tsx que los agrupa por equipo. Usa el endpoint nuevo /participants.

interface Player {
    id: number;
    displayName: string;
    riotId: string | null;
    riotTagLine: string | null;
    primaryRole: string | null;
    nationality: string | null;
    twitchChannel: string | null;
    kickChannel: string | null;
    teamId: number | null;
    teamName: string | null;
    isCaptain: boolean;
    isSubstitute: boolean;
}

export default function PlayersSection({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/participants`);
                if (res.data?.success) setPlayers(res.data.participants || []);
            } catch (err) {
                console.error('Error cargando jugadores', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [channelName, editionSlug]);

    if (loading) return null;

    return (
        <section>
            <SectionLabel title="Jugadores" accent="#7dd3fc" />
            {players.length === 0 ? (
                <EmptyState text="Todavía no hay jugadores cargados." />
            ) : (
                <div className="border border-[#232C42] rounded-lg overflow-hidden divide-y divide-[#232C42]">
                    {players.map((p) => (
                        <div key={p.id} className="bg-[#0F1729] px-4 4xl:px-6 py-3 4xl:py-4 flex items-center gap-4 4xl:gap-6">
                            <NameAvatar name={p.displayName} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-display font-bold text-[#EDF0F7] truncate 4xl:text-lg">{p.displayName}</span>
                                    {p.primaryRole && <RoleBadge role={p.primaryRole} />}
                                    {p.isCaptain && <span className="font-mono text-[10px] text-[#E8B04B]">(C)</span>}
                                    {p.isSubstitute && <span className="font-mono text-[10px] text-[#7C8AA6]">suplente</span>}
                                </div>
                                <p className="font-mono text-[11px] text-[#7C8AA6] truncate">{p.riotId ? `${p.riotId}#${p.riotTagLine}` : 'sin cuenta vinculada'}</p>
                            </div>
                            <p className="font-mono text-[11px] text-[#7C8AA6] text-right flex-shrink-0">{p.teamName || 'sin equipo'}</p>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
