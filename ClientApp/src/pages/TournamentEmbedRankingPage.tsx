import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';

// Milestone 3 — widget de ranking embebible (fase 12 #2). Pagina liviana pensada
// para <iframe src="..."> en la web de un tercero — sin nav, sin auth, CORS abierto
// del lado del backend (TournamentEmbedController).

interface RankingRow { rank: number; displayName: string; currentLp: number | null; }

export default function TournamentEmbedRankingPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [searchParams] = useSearchParams();
    const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark';
    const limit = searchParams.get('limit') || '20';

    const [editionName, setEditionName] = useState('');
    const [ranking, setRanking] = useState<RankingRow[]>([]);
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/embed/torneo/${channelName}/${editionSlug}/ranking?theme=${theme}&limit=${limit}`);
                if (res.data?.success) {
                    setEditionName(res.data.editionName);
                    setRanking(res.data.ranking || []);
                    setStatus('ok');
                } else setStatus('error');
            } catch { setStatus('error'); }
        })();
    }, [channelName, editionSlug, theme, limit]);

    const isDark = theme === 'dark';
    const bg = isDark ? '#0B1120' : '#ffffff';
    const fg = isDark ? '#EDF0F7' : '#1e293b';
    const mist = isDark ? '#7C8AA6' : '#64748b';
    const line = isDark ? '#232C42' : '#e2e8f0';
    const gold = '#E8B04B';

    if (status === 'loading') return null;
    if (status === 'error') {
        return <div style={{ fontFamily: 'sans-serif', color: mist, padding: 12, fontSize: 12 }}>Torneo no encontrado.</div>;
    }

    return (
        <div style={{ fontFamily: '"Inter", sans-serif', background: bg, color: fg, padding: 12, borderRadius: 8, maxWidth: 360 }}>
            <div style={{ fontFamily: '"Chakra Petch", sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{editionName}</div>
            {ranking.map(r => (
                <div key={r.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${line}`, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', color: r.rank === 1 ? gold : mist, fontWeight: 700, width: 16 }}>{r.rank}</span>
                        <span>{r.displayName}</span>
                    </div>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{r.currentLp != null ? `${r.currentLp} LP` : '—'}</span>
                </div>
            ))}
            <div style={{ fontSize: 9, color: mist, marginTop: 8, textAlign: 'right' }}>via Decatron</div>
        </div>
    );
}
