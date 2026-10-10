import React from 'react';
import type { PageConfig, TierConfig } from './types';
import { ExternalLink } from 'lucide-react';

export function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-ds-accent' : 'bg-ds-raised'}`}
        >
            <span className={`absolute top-1 w-4 h-4 bg-ds-surface rounded-full shadow transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    );
}

export function MiniPreview({ config, tiers }: { config: PageConfig; tiers: TierConfig[] }) {
    const progress = config.monthlyGoal > 0
        ? Math.min(100, (config.monthlyRaised / config.monthlyGoal) * 100)
        : 0;

    return (
        <div className="space-y-3 text-xs overflow-hidden">
            {/* Hero */}
            <div
                className="rounded-lg p-4 text-ds-text text-center"
                style={{ background: `linear-gradient(135deg, ${config.heroFrom}, ${config.heroTo})` }}
            >
                <div className="text-lg mb-0.5">🤖</div>
                <p className="font-black text-sm leading-tight">{config.title || 'Apoya a Decatron'}</p>
                <p className="text-ds-text/75 mt-0.5 text-[10px] leading-tight">{config.tagline || ''}</p>

                {config.showProgressBar && config.monthlyGoal > 0 && (
                    <div className="mt-3">
                        <div className="flex justify-between text-ds-text/70 mb-1 text-[10px]">
                            <span>${config.monthlyRaised}</span>
                            <span>${config.monthlyGoal}/mes</span>
                        </div>
                        <div className="h-2 bg-ds-surface/20 rounded-full overflow-hidden">
                            <div className="h-full bg-ds-surface rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Tier cards mini */}
            <div className="space-y-2">
                {tiers.map(tier => (
                    <div
                        key={tier.id}
                        className="rounded-lg border p-3"
                        style={{
                            borderColor: tier.highlighted ? tier.color : '',
                            borderWidth: tier.highlighted ? '2px' : '1px',
                            background: tier.highlighted ? tier.color + '10' : '',
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-black" style={{ color: tier.color }}>
                                {tier.badgeEmoji} {tier.name}
                            </span>
                            <span className="font-bold text-ds-text">
                                {tier.monthlyPrice ? `$${tier.monthlyPrice}/mes` : '—'}
                            </span>
                        </div>
                        {tier.highlighted && (
                            <div className="mt-1">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-ds-text" style={{ backgroundColor: tier.color }}>
                                    ⭐ Más popular
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Supporters wall mini */}
            {config.showSupportersWall && (
                <div className="bg-ds-bg rounded-lg p-3">
                    <p className="font-bold text-ds-soft mb-2">👥 Supporters</p>
                    <div className="flex flex-wrap gap-1.5">
                        {['A', 'B', 'C', 'D', 'E'].map(l => (
                            <div key={l} className="w-7 h-7 rounded-full bg-ds-accent flex items-center justify-center text-ds-on-accent font-bold text-[10px]">
                                {l}
                            </div>
                        ))}
                        <div className="w-7 h-7 rounded-full bg-ds-raised flex items-center justify-center text-ds-soft text-[10px] font-bold">
                            +N
                        </div>
                    </div>
                </div>
            )}

            {/* Founders mini */}
            {config.showFoundersSection && (
                <div className="rounded-lg border-2 border-ds-warn/40 bg-ds-warn/10 p-3">
                    <p className="font-black text-ds-warn">🌟 Fundadores</p>
                    <p className="text-ds-warn text-[10px]">Apoyo permanente al proyecto</p>
                </div>
            )}
        </div>
    );
}
