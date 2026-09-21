import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { CardFace, RARITY_HALO, RARITY_ORDER, RARITY_STYLES, type PulledCard } from './cardVisuals';

export type { PulledCard };

// Overlay de apertura de sobre — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
// seccion 4.
//
// El sobre NO se abre solo: flota esperando el click. La expectativa es el momento
// del gacha, abrirlo automaticamente se la saca al jugador.
//
// Despues del estallido las cartas se revelan de a una girando desde el dorso, de
// peor a mejor rareza. Recien cuando termina el revelado el mismo mazo se vuelve un
// carrusel navegable con el mouse — antes no, porque poder arrastrar libremente
// mientras todavia quedan cartas por revelar te spoilea lo que falta.

const SPARKLE_COUNT = 14;

interface Props {
    tierKey: string;
    tierName: string;
    onOpen: () => Promise<PulledCard[]>;
    onClose: () => void;
    onError: (message: string) => void;
    onViewCollection?: () => void;
}

type Phase = 'idle' | 'opening' | 'burst' | 'revealing' | 'gallery';

export default function PackOpeningOverlay({ tierKey, tierName, onOpen, onClose, onError, onViewCollection }: Props) {
    const [phase, setPhase] = useState<Phase>('idle');
    const [cards, setCards] = useState<PulledCard[] | null>(null);
    const [revealIndex, setRevealIndex] = useState(0);
    const [autoPlay, setAutoPlay] = useState(false);
    const [autoSpeed, setAutoSpeed] = useState(1200);
    const requestRef = useRef<Promise<PulledCard[]> | null>(null);

    // El click dispara la animacion y el pedido al backend a la vez: mientras corre
    // la sacudida (~0.85s) la respuesta ya viene viajando, asi no se suma la espera
    // de red arriba de la animacion.
    const startOpening = () => {
        if (phase !== 'idle') return;
        setPhase('opening');
        requestRef.current = onOpen();
    };

    useEffect(() => {
        if (phase !== 'opening' || !requestRef.current) return;

        let cancelled = false;
        const animationDone = new Promise((resolve) => setTimeout(resolve, 850));

        Promise.all([requestRef.current, animationDone])
            .then(([pulled]) => {
                if (cancelled) return;
                const sorted = [...(pulled as PulledCard[])].sort(
                    (a, b) => RARITY_ORDER.indexOf(a.rarity || 'N') - RARITY_ORDER.indexOf(b.rarity || 'N')
                );
                setCards(sorted);
                setPhase('burst');
            })
            .catch((err: any) => {
                if (cancelled) return;
                onError(err?.response?.data?.error || 'Error al abrir el sobre.');
                onClose();
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    useEffect(() => {
        if (phase !== 'burst') return;
        const t = setTimeout(() => setPhase('revealing'), 750);
        return () => clearTimeout(t);
    }, [phase]);

    // El overlay ocupa toda la ventana: que la pagina de atras no siga scrolleando.
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    const advance = useCallback(() => {
        if (!cards) return;
        setRevealIndex((n) => {
            if (n + 1 >= cards.length) {
                setPhase('gallery');
                return n;
            }
            return n + 1;
        });
    }, [cards]);

    const skipToGallery = () => {
        if (!cards) return;
        setRevealIndex(cards.length - 1);
        setPhase('gallery');
    };

    // Modo automático: avanza solo. Imprescindible con el sobre Legendario, que son 40
    // cartas — hacer 40 clics es un plomo, y "revelar todas" te las saltea de golpe sin
    // que llegues a ver ninguna.
    useEffect(() => {
        if (phase !== 'revealing' || !autoPlay || !cards) return;
        const t = setTimeout(advance, autoSpeed);
        return () => clearTimeout(t);
    }, [phase, autoPlay, autoSpeed, revealIndex, cards, advance]);

    // Portal a <body>: montado dentro de <main> el overlay queda encerrado en el
    // layout (navbar y sidebar se le asoman por arriba). En body cubre la ventana
    // entera pase lo que pase con el layout de la pagina.
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-[#0a0a0c] flex items-center justify-center p-4">
            {(phase === 'idle' || phase === 'gallery') && (
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="w-6 h-6" />
                </button>
            )}

            {(phase === 'idle' || phase === 'opening' || phase === 'burst') && (
                <PackStage phase={phase} tierKey={tierKey} tierName={tierName} onOpen={startOpening} />
            )}

            {phase === 'revealing' && cards && (
                <RevealStage
                    card={cards[revealIndex]}
                    index={revealIndex}
                    total={cards.length}
                    onAdvance={advance}
                    onSkip={skipToGallery}
                    autoPlay={autoPlay}
                    autoSpeed={autoSpeed}
                    onToggleAuto={() => setAutoPlay((a) => !a)}
                    onChangeSpeed={setAutoSpeed}
                />
            )}

            {phase === 'gallery' && cards && (
                <GalleryStage
                    cards={cards}
                    tierName={tierName}
                    onClose={onClose}
                    onViewCollection={onViewCollection}
                />
            )}
        </div>,
        document.body
    );
}

// ─── Etapa 1: el sobre ───────────────────────────────────────────────────────

function PackStage({ phase, tierKey, tierName, onOpen }: {
    phase: Phase;
    tierKey: string;
    tierName: string;
    onOpen: () => void;
}) {
    const isIdle = phase === 'idle';
    const isBurst = phase === 'burst';

    return (
        <div className="flex flex-col items-center gap-8">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                {/* Resplandor de fondo — respira en reposo, carga al abrir, estalla al final */}
                <div
                    className={`absolute inset-[-15%] rounded-full pointer-events-none ${
                        isIdle ? 'tcg-pack-breathe' : phase === 'opening' ? 'tcg-pack-charge' : 'tcg-pack-glow'
                    }`}
                    style={{
                        background: isBurst
                            ? 'radial-gradient(circle, rgba(191,219,254,0.7) 0%, rgba(96,165,250,0.35) 35%, rgba(37,99,235,0.12) 55%, transparent 72%)'
                            : 'radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(37,99,235,0.18) 45%, transparent 70%)',
                    }}
                />

                {isBurst && (
                    <>
                        <div
                            className="absolute inset-[-30%] rounded-full tcg-pack-rays pointer-events-none"
                            style={{
                                background:
                                    'conic-gradient(from 0deg, transparent 0deg, rgba(250,204,21,0.4) 5deg, transparent 14deg, transparent 85deg, rgba(147,197,253,0.4) 92deg, transparent 101deg, transparent 175deg, rgba(250,204,21,0.35) 182deg, transparent 191deg, transparent 265deg, rgba(147,197,253,0.35) 272deg, transparent 281deg)',
                            }}
                        />
                        {Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
                            const angle = (360 / SPARKLE_COUNT) * i + (i % 2 ? 12 : 0);
                            const distance = 130 + (i % 3) * 35;
                            return (
                                <span
                                    key={i}
                                    className="absolute left-1/2 top-1/2 rounded-full tcg-pack-sparkle pointer-events-none"
                                    style={{
                                        width: i % 3 === 0 ? '6px' : '4px',
                                        height: i % 3 === 0 ? '6px' : '4px',
                                        background: i % 2 ? '#fde68a' : '#bfdbfe',
                                        boxShadow: `0 0 8px ${i % 2 ? '#fbbf24' : '#60a5fa'}`,
                                        animationDelay: `${(i % 4) * 0.06}s`,
                                        '--tx': `${Math.cos((angle * Math.PI) / 180) * distance}px`,
                                        '--ty': `${Math.sin((angle * Math.PI) / 180) * distance}px`,
                                    } as CSSProperties}
                                />
                            );
                        })}
                    </>
                )}

                <img
                    src={`/tcg-packs/${tierKey}_${isBurst ? 'open' : 'closed'}.webp`}
                    alt={tierName}
                    draggable={false}
                    onClick={isIdle ? onOpen : undefined}
                    className={`relative w-full h-full object-contain select-none ${
                        isIdle ? 'tcg-pack-float cursor-pointer' : phase === 'opening' ? 'tcg-pack-shake' : 'tcg-pack-vanish'
                    }`}
                    style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}
                />
            </div>

            {isIdle && (
                <div className="flex flex-col items-center gap-3">
                    <p className="text-white/50 text-sm tracking-wide">{tierName}</p>
                    <button
                        onClick={onOpen}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-10 py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/40"
                    >
                        Abrir sobre
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Etapa 2: revelado de a una ──────────────────────────────────────────────

function RevealStage({ card, index, total, onAdvance, onSkip, autoPlay, autoSpeed, onToggleAuto, onChangeSpeed }: {
    card: PulledCard;
    index: number;
    total: number;
    onAdvance: () => void;
    onSkip: () => void;
    autoPlay: boolean;
    autoSpeed: number;
    onToggleAuto: () => void;
    onChangeSpeed: (ms: number) => void;
}) {
    const halo = RARITY_HALO[card.rarity || 'N'];

    return (
        <div className="flex flex-col items-center gap-5">
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase">
                {index + 1} / {total}
            </p>

            <div className="relative tcg-flip-scene" onClick={onAdvance}>
                <div
                    className="absolute inset-[-18%] rounded-full tcg-card-halo pointer-events-none"
                    style={{
                        background: `radial-gradient(circle, ${halo.color} 0%, transparent 68%)`,
                        '--halo': halo.intensity,
                    } as CSSProperties}
                />
                <div
                    key={card.instanceId}
                    className={`tcg-card-flip-in tcg-flip-inner relative w-56 sm:w-64 rounded-2xl border p-4 cursor-pointer overflow-hidden ${RARITY_STYLES[card.rarity || 'N']}`}
                >
                    <CardFace card={card} />
                    <span
                        className="tcg-card-shine absolute inset-y-0 w-1/3 pointer-events-none"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                    />
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 max-w-[16rem]">
                {Array.from({ length: total }).map((_, i) => (
                    <span
                        key={i}
                        className={`h-1 rounded-full transition-all ${i <= index ? 'w-4 bg-white/80' : 'w-1 bg-white/20'}`}
                    />
                ))}
            </div>

            <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleAuto}
                        title={autoPlay ? 'Pausar' : 'Reproducir solo'}
                        className={`flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl transition-colors ${
                            autoPlay ? 'bg-[#2563eb] text-white' : 'bg-white/5 hover:bg-white/10 text-white'
                        }`}
                    >
                        {autoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        Auto
                    </button>
                    <button
                        onClick={onAdvance}
                        className="flex items-center gap-1 text-white font-bold px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {autoPlay && (
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-white/40">Velocidad</span>
                        {[
                            { ms: 2000, label: 'Lenta' },
                            { ms: 1200, label: 'Normal' },
                            { ms: 600, label: 'Rápida' },
                        ].map((s) => (
                            <button
                                key={s.ms}
                                onClick={() => onChangeSpeed(s.ms)}
                                className={`px-2 py-1 rounded-lg transition-colors ${
                                    autoSpeed === s.ms ? 'bg-white/15 text-white font-bold' : 'text-white/40 hover:text-white/70'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                )}

                <button onClick={onSkip} className="text-xs text-white/40 hover:text-white/70 underline">
                    Ver todas de una
                </button>
            </div>
        </div>
    );
}

// ─── Etapa 3: carrusel coverflow ─────────────────────────────────────────────

function GalleryStage({ cards, tierName, onClose, onViewCollection }: {
    cards: PulledCard[];
    tierName: string;
    onClose: () => void;
    onViewCollection?: () => void;
}) {
    const [active, setActive] = useState(cards.length - 1);
    const [drag, setDrag] = useState(0); // desplazamiento en "unidades de carta"
    const [dragging, setDragging] = useState(false);
    const startXRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Cuanto se mueve el dedo para pasar una carta. Se mide del contenedor real para
    // que arrastrar se sienta igual en celular que en desktop.
    const stepPx = () => Math.max(120, (containerRef.current?.offsetWidth ?? 600) * 0.22);

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        setDragging(true);
        startXRef.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!dragging) return;
        setDrag((e.clientX - startXRef.current) / stepPx());
    };

    const handlePointerUp = () => {
        if (!dragging) return;
        setDragging(false);
        // Arrastrar a la derecha (drag > 0) trae las cartas anteriores.
        const next = Math.round(active - drag);
        setActive(Math.min(cards.length - 1, Math.max(0, next)));
        setDrag(0);
    };

    const go = (delta: number) => {
        setActive((a) => Math.min(cards.length - 1, Math.max(0, a + delta)));
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'ArrowRight') go(1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [cards.length]);

    const position = active - drag;
    const current = cards[Math.min(cards.length - 1, Math.max(0, Math.round(position)))];

    return (
        <div className="flex flex-col items-center gap-6 w-full">
            <p className="text-white/50 text-sm">
                {tierName} — {cards.length} carta{cards.length === 1 ? '' : 's'}
            </p>

            <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`tcg-coverflow relative w-full h-[26rem] touch-none select-none ${dragging ? 'tcg-coverflow-dragging cursor-grabbing' : 'cursor-grab'}`}
            >
                {cards.map((card, i) => {
                    const offset = i - position;
                    const distance = Math.abs(offset);
                    // Mas alla de 3 posiciones no se dibuja: no se ve y ahorra trabajo
                    // de composicion con sobres de 40 cartas.
                    if (distance > 3.5) return null;

                    const clamped = Math.min(distance, 3);
                    return (
                        <div
                            key={card.instanceId}
                            onClick={() => !dragging && setActive(i)}
                            className="tcg-coverflow-item"
                            style={{
                                transform: `translateX(calc(-50% + ${offset * 58}%)) scale(${1 - clamped * 0.16}) rotateY(${offset * -22}deg)`,
                                filter: `blur(${clamped * 2.4}px) brightness(${1 - clamped * 0.28})`,
                                opacity: distance > 3 ? 0 : 1,
                                zIndex: 100 - Math.round(distance * 10),
                                width: '14rem',
                            }}
                        >
                            <div className={`rounded-2xl border p-4 ${RARITY_STYLES[card.rarity || 'N']}`}>
                                <CardFace card={card} compact />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={() => go(-1)}
                    disabled={active <= 0}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-25 text-white transition-colors"
                    aria-label="Anterior"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-white/40 tabular-nums">
                    {Math.round(position) + 1} / {cards.length}
                </span>
                <button
                    onClick={() => go(1)}
                    disabled={active >= cards.length - 1}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-25 text-white transition-colors"
                    aria-label="Siguiente"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            <p className="text-xs text-white/30">Arrastrá para ver el resto</p>

            <div className="flex flex-wrap justify-center gap-3">
                <button
                    onClick={onClose}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
                >
                    Abrir otro
                </button>
                {onViewCollection && (
                    <button
                        onClick={onViewCollection}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
                    >
                        Ver colección
                    </button>
                )}
            </div>

            {/* Nombre de la carta enfocada, fuera del carrusel para que no se difumine */}
            <span className="sr-only">{current.name}</span>
        </div>
    );
}
