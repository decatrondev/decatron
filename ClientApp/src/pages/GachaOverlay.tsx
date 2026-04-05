import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';

interface GachaPullEvent {
    itemId: number;
    itemName: string;
    rarity: string;
    image?: string;
    participantName: string;
    pullsRemaining: number;
    timestamp: string;
}

const RARITY_COLORS: Record<string, { primary: string; secondary: string; glow: string }> = {
    legendary: { primary: '#ffd700', secondary: '#ff8c00', glow: '#ffff00' },
    epic:      { primary: '#a855f7', secondary: '#7c3aed', glow: '#c084fc' },
    rare:      { primary: '#3b82f6', secondary: '#2563eb', glow: '#93c5fd' },
    uncommon:  { primary: '#22c55e', secondary: '#16a34a', glow: '#86efac' },
    common:    { primary: '#94a3b8', secondary: '#64748b', glow: '#cbd5e1' },
};

const RARITY_STARS: Record<string, string> = {
    legendary: '★★★★★',
    epic: '★★★★',
    rare: '★★★',
    uncommon: '★★',
    common: '★',
};

const PARTICLE_COUNTS: Record<string, number> = {
    legendary: 60, epic: 45, rare: 35, uncommon: 25, common: 15,
};

export default function GachaOverlay() {
    const [searchParams] = useSearchParams();
    const channel = searchParams.get('channel') || '';
    const [queue, setQueue] = useState<GachaPullEvent[]>([]);
    const [currentEvent, setCurrentEvent] = useState<GachaPullEvent | null>(null);
    const [phase, setPhase] = useState<'idle' | 'flash' | 'particles' | 'reveal' | 'display' | 'fadeout'>('idle');
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; color: string; angle: number; speed: number }[]>([]);
    const connectionRef = useRef<signalR.HubConnection | null>(null);
    const processingRef = useRef(false);
    const processedRef = useRef(new Set<string>());

    // SignalR connection
    useEffect(() => {
        if (!channel) return;

        const connect = async () => {
            try {
                const connection = new signalR.HubConnectionBuilder()
                    .withUrl(`${window.location.origin}/hubs/overlay`, { withCredentials: false })
                    .withAutomaticReconnect()
                    .build();

                connection.on('GachaPull', (data: GachaPullEvent) => {
                    const key = `${data.itemId}_${data.timestamp}`;
                    if (processedRef.current.has(key)) return;
                    processedRef.current.add(key);
                    if (processedRef.current.size > 50) processedRef.current.clear();
                    setQueue(prev => [...prev, data]);
                });

                connection.onreconnected(async () => {
                    await connection.invoke('JoinChannel', channel);
                });

                connection.onclose(() => setTimeout(connect, 5000));

                await connection.start();
                await connection.invoke('JoinChannel', channel);
                connectionRef.current = connection;
            } catch {
                setTimeout(connect, 5000);
            }
        };

        connect();
        return () => { connectionRef.current?.stop(); };
    }, [channel]);

    // Queue processor
    useEffect(() => {
        if (queue.length > 0 && !processingRef.current) {
            processingRef.current = true;
            const next = queue[0];
            setQueue(prev => prev.slice(1));
            playAnimation(next);
        }
    }, [queue, phase]);

    const playAnimation = useCallback(async (event: GachaPullEvent) => {
        setCurrentEvent(event);
        const isHighRarity = event.rarity === 'legendary' || event.rarity === 'epic';
        const colors = RARITY_COLORS[event.rarity] || RARITY_COLORS.common;

        // Phase 1: Flash (only for legendary/epic)
        if (isHighRarity) {
            setPhase('flash');
            await delay(1500);
        }

        // Phase 2: Particles
        const count = PARTICLE_COUNTS[event.rarity] || 15;
        const newParticles = Array.from({ length: count }, (_, i) => ({
            id: i,
            x: 50 + (Math.random() - 0.5) * 10,
            y: 50 + (Math.random() - 0.5) * 10,
            size: 4 + Math.random() * 8,
            color: Math.random() > 0.5 ? colors.primary : colors.secondary,
            angle: (360 / count) * i + Math.random() * 30,
            speed: 150 + Math.random() * 200,
        }));
        setParticles(newParticles);
        setPhase('particles');
        await delay(2000);

        // Phase 3: Card reveal
        setPhase('reveal');
        await delay(500);

        // Phase 4: Display
        setPhase('display');
        await delay(4000);

        // Phase 5: Fade out
        setPhase('fadeout');
        await delay(600);

        // Reset
        setPhase('idle');
        setCurrentEvent(null);
        setParticles([]);
        processingRef.current = false;
    }, []);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    if (!channel) {
        return <div style={{ color: 'white', padding: 20, fontFamily: 'sans-serif' }}>Add ?channel=yourchannel to the URL</div>;
    }

    const colors = currentEvent ? (RARITY_COLORS[currentEvent.rarity] || RARITY_COLORS.common) : RARITY_COLORS.common;
    const stars = currentEvent ? (RARITY_STARS[currentEvent.rarity] || '★') : '★';

    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'transparent' }}>

            {/* Flash effect */}
            {phase === 'flash' && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(circle at center, ${colors.glow}40 0%, transparent 70%)`,
                    animation: 'flashPulse 0.5s ease-in-out infinite',
                }} />
            )}

            {/* Particles */}
            {(phase === 'particles' || phase === 'reveal') && particles.map(p => (
                <div
                    key={p.id}
                    style={{
                        position: 'absolute',
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        borderRadius: '50%',
                        backgroundColor: p.color,
                        boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                        animation: `particleBurst 2s ease-out forwards`,
                        transform: `translate(-50%, -50%)`,
                        '--angle': `${p.angle}deg`,
                        '--speed': `${p.speed}px`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Legendary extra stars */}
            {phase === 'particles' && currentEvent?.rarity === 'legendary' && (
                Array.from({ length: 12 }, (_, i) => (
                    <div key={`star-${i}`} style={{
                        position: 'absolute',
                        left: '50%', top: '50%',
                        width: 6, height: 6,
                        backgroundColor: '#ffd700',
                        clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                        animation: `starBurst 2.5s ease-out forwards`,
                        '--angle': `${(360 / 12) * i}deg`,
                        '--speed': `${200 + Math.random() * 150}px`,
                    } as React.CSSProperties} />
                ))
            )}

            {/* Card */}
            {currentEvent && (phase === 'reveal' || phase === 'display' || phase === 'fadeout') && (
                <div style={{
                    position: 'absolute',
                    left: '50%', top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: phase === 'reveal'
                        ? 'cardReveal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                        : phase === 'fadeout'
                            ? 'cardFadeout 0.5s ease-in forwards'
                            : 'none',
                    opacity: phase === 'display' ? 1 : undefined,
                }}>
                    <div style={{
                        width: 280, minHeight: 380,
                        borderRadius: 20,
                        background: `linear-gradient(145deg, #1a1a2e, #16213e)`,
                        border: `3px solid ${colors.primary}`,
                        boxShadow: `0 0 30px ${colors.primary}50, 0 0 60px ${colors.primary}25, inset 0 0 30px ${colors.primary}10`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '20px 16px',
                        gap: 12,
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}>
                        {/* Image */}
                        <div style={{
                            width: 200, height: 200, borderRadius: 14,
                            overflow: 'hidden',
                            border: `2px solid ${colors.primary}40`,
                            background: '#0f172a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {currentEvent.image ? (
                                <img src={currentEvent.image} alt={currentEvent.itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: 64, opacity: 0.3 }}>🎴</span>
                            )}
                        </div>

                        {/* Name */}
                        <h2 style={{
                            color: '#ffffff', fontSize: 20, fontWeight: 800,
                            textAlign: 'center', margin: 0,
                            textShadow: `0 0 10px ${colors.glow}50`,
                        }}>
                            {currentEvent.itemName}
                        </h2>

                        {/* Stars */}
                        <div style={{
                            color: colors.primary, fontSize: 22,
                            textShadow: `0 0 8px ${colors.primary}`,
                            letterSpacing: 2,
                        }}>
                            {stars}
                        </div>

                        {/* Rarity label */}
                        <div style={{
                            padding: '4px 16px', borderRadius: 20,
                            background: `${colors.primary}20`,
                            border: `1px solid ${colors.primary}60`,
                            color: colors.primary,
                            fontSize: 12, fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            {currentEvent.rarity}
                        </div>

                        {/* Participant */}
                        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                            {currentEvent.participantName}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes flashPulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.8; }
                }
                @keyframes particleBurst {
                    0% {
                        transform: translate(-50%, -50%) rotate(0deg) translateX(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--speed));
                        opacity: 0;
                    }
                }
                @keyframes starBurst {
                    0% {
                        transform: translate(-50%, -50%) rotate(0deg) translateX(0) scale(1);
                        opacity: 1;
                    }
                    50% { opacity: 1; }
                    100% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--speed)) scale(0);
                        opacity: 0;
                    }
                }
                @keyframes cardReveal {
                    0% { transform: translate(-50%, -50%) scale(0) rotate(-10deg); opacity: 0; }
                    100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
                }
                @keyframes cardFadeout {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
