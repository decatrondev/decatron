import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

// Insignias legibles en tema claro y oscuro (variante del dashboard)
const RARITY_BADGE_PANEL: Record<string, string> = {
    Rare:      'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    Special:   'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    Epic:      'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    Legendary: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    Mythic:    'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

interface SpiritCardProps {
    item: SpriteCollectionItem;
    onClick?: () => void;
    interactive?: boolean;
    // 'panel' = colores del dashboard (claro/oscuro); por defecto, las vistas públicas oscuras
    variant?: 'public' | 'panel';
}

export default function SpiritCard({ item, onClick, interactive = false, variant = 'public' }: SpiritCardProps) {
    const { t } = useTranslation('spirits');
    const panel = variant === 'panel';
    const { sprite, isObtained } = item;
    const borderColor = isObtained ? RARITY_BORDER[sprite.rarity] : 'transparent';
    const surface = panel
        ? (isObtained ? 'bg-white dark:bg-[#262626]' : 'bg-[#f1f5f9] dark:bg-[#1B1C1D] !border-[#e2e8f0] dark:!border-[#374151]')
        : (isObtained ? 'bg-[#18181b]' : 'bg-[#111114] !border-[#27272a]');
    const glowStyle = isObtained ? RARITY_GLOW[sprite.rarity] : undefined;

    return (
        <div
            onClick={interactive ? onClick : undefined}
            className={`relative ${panel ? "rounded-2xl" : "rounded-xl"} overflow-hidden transition-all duration-300 ${
                interactive ? 'cursor-pointer hover:scale-105' : ''
            } ${surface}`}
            style={{
                border: `1.5px solid ${borderColor}`,
                boxShadow: glowStyle,
            }}
        >
            {/* Unreleased overlay */}
            {sprite.isUnreleased && (
                <div className="absolute top-2 right-2 z-10">
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 uppercase tracking-wider">
                        {t('card.soon')}
                    </span>
                </div>
            )}

            {/* Obtained badge */}
            {isObtained && (
                <div className="absolute top-2 left-2 z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${panel ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-[#39ff14] shadow-[#39ff14]/40'}`}>
                        <Check className={`w-3 h-3 ${panel ? 'text-white' : 'text-black'}`} strokeWidth={3} />
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
                            !isObtained ? `grayscale ${'opacity-40'}` : 'drop-shadow-lg'
                        }`}
                        style={isObtained && glowStyle ? { filter: `drop-shadow(0 0 6px ${RARITY_BORDER[sprite.rarity]}80)` } : undefined}
                    />
                ) : (
                    <div className={`w-full h-full rounded-xl flex items-center justify-center ${panel ? 'bg-[#e2e8f0] dark:bg-[#374151]' : 'bg-[#27272a]'}`}>
                        <span className="text-[#374151] text-xs">?</span>
                    </div>
                )}

                {/* Shimmer overlay on missing */}
                {!isObtained && !panel && (
                    <div className="absolute inset-0 spirit-shimmer rounded-2xl" />
                )}
            </div>

            {/* Info */}
            <div className="px-2.5 pb-3 space-y-1">
                <p className={`text-xs ${panel ? '' : '3xl:text-sm'} font-bold truncate leading-tight ${
                    panel
                        ? (isObtained ? 'text-[#1e293b] dark:text-[#f8fafc]' : 'text-[#94a3b8] dark:text-[#64748b]')
                        : (isObtained ? 'text-white' : 'text-[#52525b]')
                }`}>
                    {sprite.name}
                </p>
                <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    isObtained
                        ? ((panel ? RARITY_BADGE_PANEL : RARITY_BADGE)[sprite.rarity] ?? 'bg-gray-500/20 text-gray-400')
                        : (panel ? 'bg-[#e2e8f0] dark:bg-[#374151] text-[#94a3b8] dark:text-[#64748b]' : 'bg-[#27272a] text-[#52525b]')
                }`}>
                    {sprite.rarity}
                </span>
            </div>
        </div>
    );
}
