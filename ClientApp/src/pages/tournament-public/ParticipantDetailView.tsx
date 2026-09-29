import type { ParticipantDetail } from './shared';

// Detalle de un jugador de LoL (SoloQ Climb) dentro de su fila de la clasificación:
// fichas de castigo y sus últimas partidas. Rediseño de transmisión.

export default function ParticipantDetailView({ detail, shellName }: { detail: ParticipantDetail; shellName: string }) {
    return (
        <div className="pt-4 space-y-3">
            {detail.inventory && (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(
                        [
                            [`${shellName}s ahora`, detail.inventory.count],
                            ['Ganadas', detail.inventory.totalObtained],
                            ['Lanzadas', detail.inventory.totalThrown],
                            ['Recibidas', detail.inventory.totalReceived],
                        ] as [string, number][]
                    ).map(([k, v]) => (
                        <div key={k} className="px-3 py-2" style={{ background: 'var(--t-surface-raised)' }}>
                            <dt className="text-sm" style={{ color: 'var(--t-muted)' }}>{k}</dt>
                            <dd className="font-scoreboard font-black text-2xl leading-tight">{v}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {detail.history.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Todavía no hay partidas registradas.</p>
            ) : (
                <ul className="space-y-1">
                    {detail.history.map((m) => (
                        <li key={m.riotMatchId} className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: 'var(--t-surface-raised)' }}>
                            <span className="flex items-center gap-2.5 min-w-0">
                                <span className="w-1 h-5 flex-shrink-0" style={{ background: m.result === 'win' ? 'var(--t-accent)' : 'var(--t-live)' }} aria-label={m.result === 'win' ? 'Victoria' : 'Derrota'} />
                                <span className="font-semibold truncate">{m.champion || '—'}</span>
                                <span className="text-sm" style={{ color: 'var(--t-muted)' }}>
                                    {m.kills}/{m.deaths}/{m.assists}
                                </span>
                                {m.pentaKills > 0 && (
                                    <span className="text-xs font-bold px-1.5 py-0.5" style={{ background: 'var(--t-gold)', color: '#1A1300' }}>
                                        Pentakill
                                    </span>
                                )}
                            </span>
                            <span className="font-scoreboard font-black text-lg flex-shrink-0">{m.lpAfter != null ? `${m.lpAfter} LP` : '—'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
