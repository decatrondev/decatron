import type { ParticipantDetail } from './shared';

// Separado de TournamentPublicPage.tsx el 15-08-2026.

export default function ParticipantDetailView({ detail, shellName }: { detail: ParticipantDetail; shellName: string }) {
    return (
        <div className="space-y-3">
            {detail.inventory && (
                <p className="font-mono text-[11px] text-[#7C8AA6]">
                    {shellName}s: <span className="text-[#EDF0F7] font-bold">{detail.inventory.count}</span> en inventario ·
                    {' '}{detail.inventory.totalObtained} obtenidas · {detail.inventory.totalThrown} lanzadas · {detail.inventory.totalReceived} recibidas
                </p>
            )}
            <div className="space-y-1.5">
                {detail.history.length === 0 ? (
                    <p className="font-mono text-[11px] text-[#7C8AA6]">Sin partidas trackeadas todavía.</p>
                ) : detail.history.map(m => (
                    <div key={m.riotMatchId} className="flex items-center justify-between font-mono text-[11px]">
                        <div className="flex items-center gap-2">
                            <span className={`w-1 h-3.5 rounded-full ${m.result === 'win' ? 'bg-[#3ED6C4]' : 'bg-[#E8677A]'}`} />
                            <span className="text-[#EDF0F7]">{m.champion || '—'}</span>
                            <span className="text-[#7C8AA6]">{m.kills}/{m.deaths}/{m.assists}</span>
                            {m.pentaKills > 0 && <span className="text-[#E8B04B] font-bold">PENTAKILL</span>}
                        </div>
                        <span className="text-[#7C8AA6]">{m.lpAfter != null ? `${m.lpAfter} LP` : '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
