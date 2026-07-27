import { Check } from 'lucide-react';

export interface SpriteData {
    id: number;
    spriteKey: string;
    name: string;
    character: string;
    theme: string;
    rarity: string;
    imageUrl?: string;
    isUnreleased: boolean;
    season?: string;
}

export interface SpriteCollectionItem {
    sprite: SpriteData;
    isObtained: boolean;
    obtainedAt?: string;
    platform?: string;
}

const RARITY_GLOW: Record<string, string> = {
    Rare:      '0 0 12px 2px rgba(96,165,250,0.5)',
    Special:   '0 0 12px 2px rgba(52,211,153,0.5)',
    Epic:      '0 0 12px 2px rgba(192,132,252,0.5)',
    Legendary: '0 0 12px 2px rgba(245,158,11,0.5)',
    Mythic:    '0 0 12px 2px rgba(244,63,94,0.5)',
};

const RARITY_BORDER: Record<string, string> = {
    Rare:      '#60A5FA',
    Special:   '#34D399',
    Epic:      '#C084FC',
    Legendary: '#F59E0B',
    Mythic:    '#F43F5E',
};

const RARITY_BADGE: Record<string, string> = {
    Rare:      'bg-blue-500/20 text-blue-300',
    Special:   'bg-emerald-500/20 text-emerald-300',
    Epic:      'bg-purple-500/20 text-purple-300',
    Legendary: 'bg-amber-500/20 text-amber-300',
    Mythic:    'bg-rose-500/20 text-rose-300',
};

interface SpiritCardProps {
    item: SpriteCollectionItem;
    onClick?: () => void;
    interactive?: boolean;
}

export default function SpiritCard({ item, onClick, interactive = false }: SpiritCardProps) {
    const { sprite, isObtained } = item;
    const borderColor = isObtained ? RARITY_BORDER[sprite.rarity] : 'transparent';
    const glowStyle = isObtained ? RARITY_GLOW[sprite.rarity] : undefined;

    return (
        <div
            onClick={interactive ? onClick : undefined}
            className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                interactive ? 'cursor-pointer hover:scale-105' : ''
            } ${isObtained ? 'bg-[#111827]' : 'bg-[#0D1117]'}`}
            style={{
                border: `1.5px solid ${borderColor}`,
                boxShadow: glowStyle,
            }}
        >
            {/* Unreleased overlay */}
            {sprite.isUnreleased && (
                <div className="absolute top-2 right-2 z-10">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 uppercase tracking-wider">
                        Soon
                    </span>
                </div>
            )}

            {/* Obtained badge */}
            {isObtained && (
                <div className="absolute top-2 left-2 z-10">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                </div>
            )}

            {/* Image area */}
            <div className="relative aspect-square flex items-center justify-center p-3 pt-5">
                {sprite.imageUrl ? (
                    <img
                        src={sprite.imageUrl}
                        alt={sprite.name}
                        className={`w-full h-full object-contain transition-all duration-300 ${
                            !isObtained ? 'grayscale opacity-30' : 'drop-shadow-lg'
                        }`}
                        style={isObtained && glowStyle ? { filter: `drop-shadow(0 0 6px ${RARITY_BORDER[sprite.rarity]}80)` } : undefined}
                    />
                ) : (
                    <div className="w-full h-full rounded-xl bg-[#1A2235] flex items-center justify-center">
                        <span className="text-[#374151] text-xs">?</span>
                    </div>
                )}

                {/* Shimmer overlay on missing */}
                {!isObtained && (
                    <div className="absolute inset-0 spirit-shimmer rounded-2xl" />
                )}
            </div>

            {/* Info */}
            <div className="px-2.5 pb-3 space-y-1">
                <p className={`text-xs font-bold truncate leading-tight ${
                    isObtained ? 'text-[#f1f5f9]' : 'text-[#374151]'
                }`}>
                    {sprite.name}
                </p>
                <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    isObtained
                        ? (RARITY_BADGE[sprite.rarity] ?? 'bg-gray-500/20 text-gray-400')
                        : 'bg-[#1A2235] text-[#374151]'
                }`}>
                    {sprite.rarity}
                </span>
            </div>
        </div>
    );
}
