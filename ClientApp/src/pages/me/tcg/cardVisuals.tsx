import { Sparkles } from 'lucide-react';

// Piezas visuales compartidas entre la apertura de sobres y el claim gratis —
// las dos revelan una carta con el mismo lenguaje, no tiene sentido tener dos
// versiones que se desincronicen.

export interface PulledCard {
    instanceId: number;
    cardId: string;
    level: number;
    origin: string;
    catalogValue: number;
    name: string | null;
    rarity: string | null;
    element: string | null;
    cardClass: string | null;
    gender: string | null;
    animated: boolean;
    imageUrl: string | null;
}

export const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR', 'LR', 'MR'];

export const RARITY_STYLES: Record<string, string> = {
    N: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    R: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    SR: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    SSR: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    UR: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    LR: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    MR: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

// Color e intensidad del halo detras de la carta — cuanto mas rara, mas presente.
export const RARITY_HALO: Record<string, { color: string; intensity: number }> = {
    N:   { color: 'rgba(148,163,184,0.5)',  intensity: 0.25 },
    R:   { color: 'rgba(96,165,250,0.6)',   intensity: 0.35 },
    SR:  { color: 'rgba(168,85,247,0.65)',  intensity: 0.5 },
    SSR: { color: 'rgba(236,72,153,0.7)',   intensity: 0.65 },
    UR:  { color: 'rgba(251,191,36,0.75)',  intensity: 0.8 },
    LR:  { color: 'rgba(251,146,60,0.8)',   intensity: 0.9 },
    MR:  { color: 'rgba(232,121,249,0.85)', intensity: 1 },
};

export function CardFace({ card, compact }: { card: PulledCard; compact?: boolean }) {
    return (
        <>
            {card.imageUrl ? (
                <img
                    src={card.imageUrl}
                    alt={card.name || 'carta'}
                    draggable={false}
                    className="w-full aspect-[3/4] object-cover rounded-xl mb-3 bg-black/30 select-none"
                />
            ) : (
                <div className="w-full aspect-[3/4] rounded-xl mb-3 bg-black/30 flex items-center justify-center text-xs text-[#64748b]">
                    sin arte
                </div>
            )}
            <div className="text-xs font-bold uppercase tracking-[0.15em]">{card.rarity}</div>
            <div className={`font-semibold text-white truncate ${compact ? 'text-base' : 'text-lg'}`}>
                {card.name || '???'}
            </div>
            {!compact && (
                <div className="text-xs text-white/60 mt-0.5">
                    {card.element} · {card.cardClass}
                </div>
            )}
            {card.animated && (
                <div className="mt-1 text-xs font-bold text-fuchsia-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Animada
                </div>
            )}
        </>
    );
}

// Dorso de carta — se usa donde no hay un sobre que mostrar (el claim gratis
// entrega una carta suelta, no un paquete).
export function CardBack({ className = '' }: { className?: string }) {
    return (
        <div
            className={`w-full aspect-[3/4] rounded-2xl border border-[#2563eb]/40 overflow-hidden relative ${className}`}
            style={{
                background: 'linear-gradient(150deg, #10203f 0%, #0b1220 55%, #131a2e 100%)',
                boxShadow: '0 20px 45px rgba(0,0,0,0.6), inset 0 0 40px rgba(37,99,235,0.15)',
            }}
        >
            <div
                className="absolute inset-0 opacity-25"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(96,165,250,0.25) 0 2px, transparent 2px 14px)',
                }}
            />
            <div className="absolute inset-4 rounded-xl border border-[#2563eb]/25" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className="w-16 h-16 rotate-45 border-2 border-[#60a5fa]/60"
                    style={{ boxShadow: '0 0 24px rgba(96,165,250,0.45)' }}
                />
            </div>
        </div>
    );
}
