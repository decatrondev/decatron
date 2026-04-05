import { useState, useEffect } from 'react';
import { BarChart3, Save, RotateCcw } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaRarityConfig, RarityType } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent';

const RARITIES: RarityType[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const DEFAULTS: Record<RarityType, number> = { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 3 };

export const RarityTab: React.FC = () => {
    const [probabilities, setProbabilities] = useState<Record<RarityType, number>>({ ...DEFAULTS });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const loadConfig = async () => {
        try {
            const { data } = await api.get('/gacha/rarity-config');
            const configs: GachaRarityConfig[] = data.configs || [];
            if (configs.length > 0) {
                const map = { ...DEFAULTS };
                configs.forEach(c => {
                    if (c.rarity in map) map[c.rarity as RarityType] = c.probability;
                });
                setProbabilities(map);
            }
        } catch (err) {
            console.error('Error loading rarity config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadConfig(); }, []);

    const total = Object.values(probabilities).reduce((a, b) => a + b, 0);
    const isValid = Math.abs(total - 100) < 0.01;

    const handleChange = (rarity: RarityType, value: number) => {
        setProbabilities(prev => ({ ...prev, [rarity]: value }));
        setSaved(false);
    };

    const handleReset = () => {
        setProbabilities({ ...DEFAULTS });
        setSaved(false);
    };

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        try {
            const payload = RARITIES.map(r => ({ rarity: r, probability: probabilities[r] }));
            await api.post('/gacha/rarity-config', payload);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving rarity config:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className={cardClass}><p className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">Cargando configuracion...</p></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" /> Probabilidades de Rareza
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl font-bold text-[#64748b] hover:bg-gray-50 dark:hover:bg-[#374151]/50 transition-colors">
                        <RotateCcw className="w-4 h-4" /> Restaurar
                    </button>
                    <button onClick={handleSave} disabled={saving || !isValid} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
                    </button>
                </div>
            </div>

            <div className={cardClass}>
                <div className="space-y-5">
                    {RARITIES.map(rarity => {
                        const rc = RARITY_CONFIG[rarity];
                        const pct = probabilities[rarity];
                        return (
                            <div key={rarity} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rc.color }} />
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{rc.label}</span>
                                        <span className="text-sm" style={{ color: rc.color }}>{getRarityStars(rarity)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            className={`${inputClass} w-24 text-center`}
                                            value={pct}
                                            onChange={e => handleChange(rarity, Number(e.target.value))}
                                        />
                                        <span className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8] w-6">%</span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-3 rounded-full bg-[#f1f5f9] dark:bg-[#374151] overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: rc.color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Total bar */}
                <div className="mt-6 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-[#1e293b] dark:text-[#f8fafc]">Total</span>
                        <span className={`text-lg font-black ${isValid ? 'text-green-500' : 'text-red-500'}`}>
                            {total.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-[#f1f5f9] dark:bg-[#374151] overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(total, 100)}%` }}
                        />
                    </div>
                    {!isValid && (
                        <p className="text-sm text-red-500 mt-2 font-bold">
                            El total debe ser exactamente 100%. {total > 100 ? `Sobran ${(total - 100).toFixed(1)}%` : `Faltan ${(100 - total).toFixed(1)}%`}
                        </p>
                    )}
                </div>
            </div>

            {/* Visual distribution */}
            <div className={cardClass}>
                <h3 className="text-sm font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">Distribucion Visual</h3>
                <div className="flex h-10 rounded-xl overflow-hidden">
                    {RARITIES.map(rarity => {
                        const rc = RARITY_CONFIG[rarity];
                        const pct = probabilities[rarity];
                        if (pct <= 0) return null;
                        return (
                            <div
                                key={rarity}
                                className="flex items-center justify-center text-white text-xs font-bold transition-all duration-300 overflow-hidden"
                                style={{ width: `${(pct / Math.max(total, 1)) * 100}%`, backgroundColor: rc.color }}
                                title={`${rc.label}: ${pct}%`}
                            >
                                {pct >= 5 && `${pct}%`}
                            </div>
                        );
                    })}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                    {RARITIES.map(rarity => {
                        const rc = RARITY_CONFIG[rarity];
                        return (
                            <div key={rarity} className="flex items-center gap-1.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rc.color }} />
                                {rc.label}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
