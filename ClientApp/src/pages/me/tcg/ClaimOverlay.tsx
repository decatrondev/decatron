import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CardBack, CardFace, RARITY_HALO, RARITY_STYLES, type PulledCard } from './cardVisuals';

// Claim gratis diario — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md seccion 4.2.
// Mismo lenguaje visual que abrir un sobre (sacudida, estallido, giro de la carta),
// pero sin sobre: el claim entrega una carta suelta, asi que lo que se sacude y
// estalla es el dorso de la carta misma.

const SPARKLE_COUNT = 14;

interface Props {
    onClaim: () => Promise<PulledCard>;
    onClose: () => void;
    onError: (message: string) => void;
    onViewCollection?: () => void;
}

type Phase = 'idle' | 'opening' | 'burst' | 'revealed';

export default function ClaimOverlay({ onClaim, onClose, onError, onViewCollection }: Props) {
    const [phase, setPhase] = useState<Phase>('idle');
    const [card, setCard] = useState<PulledCard | null>(null);
    const requestRef = useRef<Promise<PulledCard> | null>(null);

    const start = () => {
        if (phase !== 'idle') return;
        setPhase('opening');
        requestRef.current = onClaim();
    };

    useEffect(() => {
        if (phase !== 'opening' || !requestRef.current) return;

        let cancelled = false;
        const animationDone = new Promise((resolve) => setTimeout(resolve, 850));

        Promise.all([requestRef.current, animationDone])
            .then(([claimed]) => {
                if (cancelled) return;
                setCard(claimed as PulledCard);
                setPhase('burst');
            })
            .catch((err: any) => {
                if (cancelled) return;
                onError(err?.response?.data?.error || 'Error al reclamar la carta.');
                onClose();
            });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    useEffect(() => {
        if (phase !== 'burst') return;
        const t = setTimeout(() => setPhase('revealed'), 700);
        return () => clearTimeout(t);
    }, [phase]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    const halo = card ? RARITY_HALO[card.rarity || 'N'] : null;

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-[#0a0a0c] flex items-center justify-center p-4">
            {(phase === 'idle' || phase === 'revealed') && (
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 z-10 text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="w-6 h-6" />
                </button>
            )}

            <div className="flex flex-col items-center gap-7">
                <div className="relative w-56 sm:w-64 flex items-center justify-center tcg-flip-scene">
                    {/* Resplandor: respira en reposo, carga al reclamar, estalla al final */}
                    <div
                        className={`absolute inset-[-25%] rounded-full pointer-events-none ${
                            phase === 'idle' ? 'tcg-pack-breathe'
                                : phase === 'opening' ? 'tcg-pack-charge'
                                : phase === 'burst' ? 'tcg-pack-glow'
                                : 'tcg-card-halo'
                        }`}
                        style={{
                            background: phase === 'revealed' && halo
                                ? `radial-gradient(circle, ${halo.color} 0%, transparent 68%)`
                                : phase === 'burst'
                                    ? 'radial-gradient(circle, rgba(191,219,254,0.7) 0%, rgba(96,165,250,0.35) 35%, transparent 70%)'
                                    : 'radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(37,99,235,0.18) 45%, transparent 70%)',
                            ...(phase === 'revealed' && halo ? { '--halo': halo.intensity } : {}),
                        } as CSSProperties}
                    />

                    {phase === 'burst' && (
                        <>
                            <div
                                className="absolute inset-[-40%] rounded-full tcg-pack-rays pointer-events-none"
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

                    {phase === 'revealed' && card ? (
                        <div
                            className={`tcg-card-flip-in tcg-flip-inner relative w-full rounded-2xl border p-4 overflow-hidden ${RARITY_STYLES[card.rarity || 'N']}`}
                        >
                            <CardFace card={card} />
                            <span
                                className="tcg-card-shine absolute inset-y-0 w-1/3 pointer-events-none"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                            />
                        </div>
                    ) : (
                        <div
                            onClick={phase === 'idle' ? start : undefined}
                            className={`relative w-full ${
                                phase === 'idle' ? 'tcg-pack-float cursor-pointer'
                                    : phase === 'opening' ? 'tcg-pack-shake'
                                    : 'tcg-pack-vanish'
                            }`}
                        >
                            <CardBack />
                        </div>
                    )}
                </div>

                {phase === 'idle' && (
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-white/50 text-sm">Tu carta gratis del día</p>
                        <button
                            onClick={start}
                            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-10 py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/40"
                        >
                            Reclamar
                        </button>
                    </div>
                )}

                {phase === 'revealed' && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-xs text-white/40 text-center max-w-xs">
                            Las cartas gratis valen 1 de catálogo para siempre. Se pueden subir de nivel
                            para pelear, pero nunca suben de valor.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <button
                                onClick={onClose}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
                            >
                                Listo
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
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
