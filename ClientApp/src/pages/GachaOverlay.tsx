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

interface SoundEventConfig {
    enabled: boolean;
    volume: number;
    url: string | null;
    useDefault: boolean;
}

interface SoundConfig {
    masterVolume: number;
    enableSounds: boolean;
    sounds: Record<string, SoundEventConfig>;
}

const DEFAULT_SOUND_URLS: Record<string, string> = {
    drum_roll: '/assets/gacha/sounds/drum_roll.mp3',
    flash: '/assets/gacha/sounds/flash.mp3',
    reveal_common: '/assets/gacha/sounds/reveal_common.mp3',
    reveal_uncommon: '/assets/gacha/sounds/reveal_uncommon.mp3',
    reveal_rare: '/assets/gacha/sounds/reveal_rare.mp3',
    reveal_epic: '/assets/gacha/sounds/reveal_epic.mp3',
    reveal_legendary: '/assets/gacha/sounds/reveal_legendary.mp3',
    win: '/assets/gacha/sounds/win.mp3',
    ambient: '/assets/gacha/sounds/ambient.mp3',
};

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
    const soundConfigRef = useRef<SoundConfig | null>(null);
    const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);

    // Load sound config + preload audio buffers
    useEffect(() => {
        if (!channel) return;

        const loadSounds = async () => {
            try {
                let config: SoundConfig = {
                    masterVolume: 80,
                    enableSounds: false,
                    sounds: {},
                };

                try {
                    const res = await fetch(`/api/gacha/public/sound-config/${channel}`);
                    const data = await res.json();
                    if (data.success && data.config) {
                        const parsed = JSON.parse(data.config.soundsJson || '{}');
                        config = {
                            masterVolume: data.config.masterVolume ?? 80,
                            enableSounds: data.config.enableSounds ?? true,
                            sounds: parsed,
                        };
                    }
                } catch { /* no config saved, use defaults */ }

                soundConfigRef.current = config;

                if (!config.enableSounds) return;

                const ctx = new AudioContext();
                audioContextRef.current = ctx;
                const buffers = new Map<string, AudioBuffer>();

                await Promise.allSettled(
                    Object.keys(DEFAULT_SOUND_URLS).map(async (key) => {
                        const eventCfg = config.sounds[key];
                        if (eventCfg && !eventCfg.enabled) return;

                        const url = (eventCfg && !eventCfg.useDefault && eventCfg.url)
                            ? eventCfg.url
                            : DEFAULT_SOUND_URLS[key];
                        if (!url) return;

                        try {
                            const response = await fetch(url);
                            if (!response.ok) return;
                            const arrayBuffer = await response.arrayBuffer();
                            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                            buffers.set(key, audioBuffer);
                        } catch { /* skip failed sounds */ }
                    })
                );

                audioBuffersRef.current = buffers;
            } catch { /* config not available, sounds disabled */ }
        };

        loadSounds();

        // Unlock AudioContext for OBS browser source
        const unlockAudio = () => {
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };
        document.addEventListener('click', unlockAudio, { once: true });

        return () => {
            document.removeEventListener('click', unlockAudio);
            audioContextRef.current?.close();
        };
    }, [channel]);

    const playSound = useCallback((key: string) => {
        const config = soundConfigRef.current;
        if (!config?.enableSounds) return;
        const ctx = audioContextRef.current;
        if (!ctx) return;

        const buffer = audioBuffersRef.current.get(key);
        if (!buffer) return;

        const eventCfg = config.sounds[key];
        if (eventCfg && !eventCfg.enabled) return;

        const eventVolume = (eventCfg?.volume ?? 80) / 100;
        const masterVolume = config.masterVolume / 100;

        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        gainNode.gain.value = masterVolume * eventVolume;
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
    }, []);

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

        // Resume AudioContext (OBS browser source policy)
        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        // Sound: drum roll build-up
        playSound('drum_roll');

        // Phase 1: Flash (only for legendary/epic)
        if (isHighRarity) {
            setPhase('flash');
            playSound('flash');
            await delay(1500);
        }

        // Phase 2: Particles
        const count = PARTICLE_COUNTS[event.rarity] || 15;
        const vw = window.innerWidth;
        const scale = Math.min(vw / 480, 1.5); // scale factor relative to 480px base
        const newParticles = Array.from({ length: count }, (_, i) => ({
            id: i,
            x: 50 + (Math.random() - 0.5) * 10,
            y: 50 + (Math.random() - 0.5) * 10,
            size: (4 + Math.random() * 8) * scale,
            color: Math.random() > 0.5 ? colors.primary : colors.secondary,
            angle: (360 / count) * i + Math.random() * 30,
            speed: (150 + Math.random() * 200) * scale,
        }));
        setParticles(newParticles);
        setPhase('particles');
        await delay(2000);

        // Phase 3: Card reveal + rarity-specific sound
        setPhase('reveal');
        playSound(`reveal_${event.rarity}`);
        await delay(500);

        // Phase 4: Display + celebration (high rarity) + ambient
        setPhase('display');
        if (isHighRarity) playSound('win');
        playSound('ambient');
        await delay(4000);

        // Phase 5: Fade out
        setPhase('fadeout');
        await delay(600);

        // Reset
        setPhase('idle');
        setCurrentEvent(null);
        setParticles([]);
        processingRef.current = false;
    }, [playSound]);

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
                Array.from({ length: 12 }, (_, i) => {
                    const starScale = Math.min(window.innerWidth / 480, 1.5);
                    return (
                        <div key={`star-${i}`} style={{
                            position: 'absolute',
                            left: '50%', top: '50%',
                            width: 6 * starScale, height: 6 * starScale,
                            backgroundColor: '#ffd700',
                            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                            animation: `starBurst 2.5s ease-out forwards`,
                            '--angle': `${(360 / 12) * i}deg`,
                            '--speed': `${(200 + Math.random() * 150) * starScale}px`,
                        } as React.CSSProperties} />
                    );
                })
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
                        width: 'min(58vw, 280px)', minHeight: 'min(80vw, 380px)',
                        borderRadius: 'min(4vw, 20px)',
                        background: `linear-gradient(145deg, #1a1a2e, #16213e)`,
                        border: `clamp(2px, 0.6vw, 3px) solid ${colors.primary}`,
                        boxShadow: `0 0 30px ${colors.primary}50, 0 0 60px ${colors.primary}25, inset 0 0 30px ${colors.primary}10`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: 'min(4vw, 20px) min(3.5vw, 16px)',
                        gap: 'min(2.5vw, 12px)',
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                    }}>
                        {/* Image */}
                        <div style={{
                            width: 'min(42vw, 200px)', height: 'min(42vw, 200px)',
                            borderRadius: 'min(3vw, 14px)',
                            overflow: 'hidden',
                            border: `2px solid ${colors.primary}40`,
                            background: '#0f172a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {currentEvent.image ? (
                                <img src={currentEvent.image} alt={currentEvent.itemName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: 'min(13vw, 64px)', opacity: 0.3 }}>🎴</span>
                            )}
                        </div>

                        {/* Name */}
                        <h2 style={{
                            color: '#ffffff', fontSize: 'clamp(12px, 4.2vw, 20px)', fontWeight: 800,
                            textAlign: 'center', margin: 0,
                            textShadow: `0 0 10px ${colors.glow}50`,
                        }}>
                            {currentEvent.itemName}
                        </h2>

                        {/* Stars */}
                        <div style={{
                            color: colors.primary, fontSize: 'clamp(14px, 4.6vw, 22px)',
                            textShadow: `0 0 8px ${colors.primary}`,
                            letterSpacing: 2,
                        }}>
                            {stars}
                        </div>

                        {/* Rarity label */}
                        <div style={{
                            padding: 'min(0.8vw, 4px) min(3.3vw, 16px)',
                            borderRadius: 'min(4vw, 20px)',
                            background: `${colors.primary}20`,
                            border: `1px solid ${colors.primary}60`,
                            color: colors.primary,
                            fontSize: 'clamp(8px, 2.5vw, 12px)', fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            {currentEvent.rarity}
                        </div>

                        {/* Participant */}
                        <div style={{ color: '#94a3b8', fontSize: 'clamp(8px, 2.5vw, 12px)', marginTop: 'min(0.8vw, 4px)' }}>
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
