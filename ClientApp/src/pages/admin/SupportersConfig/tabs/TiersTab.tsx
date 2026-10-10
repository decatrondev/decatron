import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TierConfig } from '../types';
import { CARD, INPUT, LABEL } from '../constants';
import { Toggle } from '../shared';

export function TiersTab({ tiers, onChange }: { tiers: TierConfig[]; onChange: (tiers: TierConfig[]) => void }) {
    const updateTier = (id: string, patch: Partial<TierConfig>) => {
        onChange(tiers.map(t => t.id === id ? { ...t, ...patch } : t));
    };

    const addBenefit = (tierId: string) => {
        const tier = tiers.find(t => t.id === tierId);
        if (!tier) return;
        updateTier(tierId, { benefits: [...tier.benefits, ''] });
    };

    const updateBenefit = (tierId: string, idx: number, value: string) => {
        const tier = tiers.find(t => t.id === tierId);
        if (!tier) return;
        const benefits = [...tier.benefits];
        benefits[idx] = value;
        updateTier(tierId, { benefits });
    };

    const removeBenefit = (tierId: string, idx: number) => {
        const tier = tiers.find(t => t.id === tierId);
        if (!tier) return;
        updateTier(tierId, { benefits: tier.benefits.filter((_, i) => i !== idx) });
    };

    return (
        <div className="space-y-6">
            {tiers.map(tier => (
                <div key={tier.id} className={`${CARD} relative`}>
                    {tier.highlighted && (
                        <div className="absolute -top-3 left-6">
                            <span className="bg-ds-accent text-ds-on-accent text-xs font-black px-3 py-1 rounded-full">
                                ⭐ Más popular
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-5">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: tier.color + '20' }}
                        >
                            {tier.badgeEmoji}
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={tier.name}
                                onChange={e => updateTier(tier.id, { name: e.target.value })}
                                className="font-black text-xl text-ds-text bg-transparent border-b-2 border-transparent hover:border-ds-border focus:border-ds-accent outline-none transition-colors pb-0.5 w-full"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-ds-soft">Destacar</span>
                            <Toggle value={tier.highlighted} onChange={() => updateTier(tier.id, { highlighted: !tier.highlighted })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        {/* Badge emoji */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Badge emoji</label>
                            <input
                                type="text"
                                value={tier.badgeEmoji}
                                onChange={e => updateTier(tier.id, { badgeEmoji: e.target.value })}
                                className={INPUT}
                                maxLength={4}
                            />
                        </div>

                        {/* Monthly price */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Precio mensual (USD)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-ds-soft font-bold">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={tier.monthlyPrice ?? ''}
                                    onChange={e => updateTier(tier.id, { monthlyPrice: e.target.value ? Number(e.target.value) : null })}
                                    className={INPUT}
                                    placeholder="—"
                                />
                                <span className="text-xs text-ds-soft">/mes</span>
                            </div>
                        </div>

                        {/* Permanent price */}
                        <div>
                            <label className={`${LABEL} block mb-1.5`}>Precio permanente (USD)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-ds-soft font-bold">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={tier.permanentPrice ?? ''}
                                    onChange={e => updateTier(tier.id, { permanentPrice: e.target.value ? Number(e.target.value) : null })}
                                    className={INPUT}
                                    placeholder="—"
                                />
                                <span className="text-xs text-ds-soft">único</span>
                            </div>
                        </div>
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-3 mb-5">
                        <label className={LABEL}>Color de acento</label>
                        <input
                            type="color"
                            value={tier.color}
                            onChange={e => updateTier(tier.id, { color: e.target.value })}
                            className="w-10 h-8 rounded-lg cursor-pointer border border-ds-border"
                        />
                        <span className="text-sm font-mono text-ds-soft">{tier.color}</span>
                    </div>

                    {/* Benefits */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className={LABEL}>Beneficios</label>
                            <button
                                onClick={() => addBenefit(tier.id)}
                                className="flex items-center gap-1.5 text-xs font-bold text-ds-accent-text hover:text-ds-accent-text transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Agregar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {tier.benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-ds-ok text-sm">✓</span>
                                    <input
                                        type="text"
                                        value={benefit}
                                        onChange={e => updateBenefit(tier.id, idx, e.target.value)}
                                        className={`${INPUT} flex-1`}
                                        placeholder="Descripción del beneficio..."
                                    />
                                    <button
                                        onClick={() => removeBenefit(tier.id, idx)}
                                        className="p-1.5 text-ds-soft hover:text-ds-danger transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {tier.benefits.length === 0 && (
                                <p className="text-sm text-ds-soft text-center py-4">
                                    Sin beneficios. Agrega uno arriba.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
