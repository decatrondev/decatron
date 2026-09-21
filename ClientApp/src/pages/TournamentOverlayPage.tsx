import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

// Milestone 3 — overlay de streamer (fase 12 #1). Pensado para OBS Browser Source:
// fondo transparente, sin chrome, polling corto. El token en la URL es la unica
// autenticacion — no hay [Authorize] del lado del backend, ver
// TournamentEmbedController.GetOverlayState.

interface OverlayState {
    theme: string;
    enabledWidgets: string[];
    displayName: string;
    shellItemName: string;
    currentLp: number | null;
    rank: number | null;
    shellCount: number;
    activePunishment: boolean;
    recentForm: string[];
}

export default function TournamentOverlayPage() {
    const { token } = useParams<{ token: string }>();
    const [state, setState] = useState<OverlayState | null>(null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const res = await api.get(`/overlay/torneo/${token}`);
                if (active && res.data?.success) setState(res.data);
                else if (active) setNotFound(true);
            } catch {
                if (active) setNotFound(true);
            }
        };
        load();
        const id = setInterval(load, 10000);
        return () => { active = false; clearInterval(id); };
    }, [token]);

    if (notFound) return null; // OBS source vacia, nada que mostrar
    if (!state) return null;

    return (
        <div style={{
            fontFamily: '"Inter", sans-serif',
            background: 'transparent',
            color: '#EDF0F7',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: 'fit-content',
        }}>
            <div style={{
                background: 'rgba(11,17,32,0.85)',
                borderRadius: 10,
                padding: '10px 16px',
                border: '1px solid rgba(62,214,196,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
            }}>
                <span style={{ fontWeight: 800, fontFamily: '"Chakra Petch", sans-serif' }}>{state.displayName}</span>

                {state.enabledWidgets.includes('lp-actual') && state.currentLp != null && (
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#3ED6C4' }}>
                        {state.currentLp} LP
                    </span>
                )}

                {state.rank != null && (
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#7C8AA6' }}>#{state.rank}</span>
                )}

                {state.enabledWidgets.includes('shell-inventory') && (
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#E8B04B' }}>
                        {state.shellCount} {state.shellItemName.toLowerCase()}{state.shellCount === 1 ? '' : 's'}
                    </span>
                )}

                {state.enabledWidgets.includes('castigo-activo') && state.activePunishment && (
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#E8677A', fontWeight: 700 }}>
                        CASTIGO ACTIVO
                    </span>
                )}

                {state.enabledWidgets.includes('racha') && state.recentForm.length > 0 && (
                    <span style={{ display: 'flex', gap: 3 }}>
                        {state.recentForm.map((r, i) => (
                            <span key={i} style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: r === 'win' ? '#3ED6C4' : '#E8677A',
                            }} />
                        ))}
                    </span>
                )}
            </div>
        </div>
    );
}
