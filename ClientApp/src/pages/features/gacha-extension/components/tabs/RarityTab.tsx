import { useState, useEffect } from 'react';
import { BarChart3, Save, RotateCcw, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../../services/api';
import type { GachaRarityConfig, RarityType } from '../../types';
import { RARITY_CONFIG, getRarityStars } from '../../types';

const cardClass = 'bg-ds-surface rounded-lg p-6 border border-ds-border ';
const inputClass = 'w-full px-4 py-2.5 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text focus:ring-2 focus:ring-ds-accent focus:border-transparent';

const RARITIES: RarityType[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const DEFAULTS: Record<RarityType, number> = { common: 50, uncommon: 25, rare: 15, epic: 7, legendary: 3 };

export const RarityTab: React.FC = () => {
    const [probabilities, setProbabilities] = useState<Record<RarityType, number>>({ ...DEFAULTS });
    const [coinProbabilities, setCoinProbabilities] = useState<Record<RarityType, number | null>>({ common: null, uncommon: null, rare: null, epic: null, legendary: null });
    const [coinsEnabled, setCoinsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const loadConfig = async () => {
        try {
            const [rarityRes, integrationRes] = await Promise.all([
                api.get('/gacha/rarity-config'),
                api.get('/gacha/integration-config')
            ]);
            const configs: GachaRarityConfig[] = rarityRes.data.configs || [];
            if (configs.length > 0) {
                const map = { ...DEFAULTS };
                const coinMap: Record<RarityType, number | null> = { common: null, uncommon: null, rare: null, epic: null, legendary: null };
                configs.forEach(c => {
                    if (c.rarity in map) {
                        map[c.rarity as RarityType] = c.probability;
                        coinMap[c.rarity as RarityType] = c.coinProbability ?? null;
                    }
                });
                setProbabilities(map);
                setCoinProbabilities(coinMap);
            }
            if (integrationRes.data.config) {
                setCoinsEnabled(integrationRes.data.config.coinsEnabled ?? false);
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

    const handleCoinChange = (rarity: RarityType, value: string) => {
        setCoinProbabilities(prev => ({ ...prev, [rarity]: value === '' ? null : Number(value) }));
        setSaved(false);
    };

    const coinTotal = Object.values(coinProbabilities).reduce((a, b) => a + (b ?? 0), 0);
    const hasCoinValues = Object.values(coinProbabilities).some(v => v !== null);
    const coinValid = !hasCoinValues || Math.abs(coinTotal - 100) < 0.01;

    const handleReset = () => {
        setProbabilities({ ...DEFAULTS });
        setCoinProbabilities({ common: null, uncommon: null, rare: null, epic: null, legendary: null });
        setSaved(false);
    };

    const handleSave = async () => {
        if (!isValid || !coinValid) return;
        setSaving(true);
        try {
            const payload = RARITIES.map(r => ({
                rarity: r,
                probability: probabilities[r],
                coinProbability: coinProbabilities[r]
            }));
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
        return <div className={cardClass}><p className="text-center text-ds-soft py-8">Cargando configuracion...</p></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-ds-text flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" /> Probabilidades de Rareza
                </h2>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2.5 border border-ds-border rounded-lg font-bold text-ds-soft hover:bg-ds-surface transition-colors">
                        <RotateCcw className="w-4 h-4" /> Restaurar
                    </button>
                    <button onClick={handleSave} disabled={saving || !isValid} className="flex items-center gap-2 px-4 py-2.5 bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 text-ds-on-accent font-bold rounded-lg transition-colors">
                        <Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Help Banner */}
            <div className="rounded-lg border border-ds-border bg-ds-bg overflow-hidden">
                <button onClick={() => setShowHelp(!showHelp)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                    <HelpCircle className="w-5 h-5 text-ds-soft flex-shrink-0" />
                    <span className="flex-1 text-sm font-bold text-ds-soft">Como funcionan las probabilidades</span>
                    {showHelp ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
                </button>
                {showHelp && (
                    <div className="px-4 pb-4 space-y-3 text-sm text-ds-soft">
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                            <span>Cada rareza tiene un <strong className="text-ds-text">porcentaje base</strong> de probabilidad de salir en un pull</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                            <span>El total debe sumar exactamente <strong className="text-ds-text">100%</strong></span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span>Si aceptas <strong className="text-ds-text">DecaCoins</strong>, puedes configurar probabilidades separadas para tiros con coins</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-ds-raised text-ds-text text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                            <span>Si dejas los coins vacios, usaran las mismas probabilidades de donacion</span>
                        </div>
                        <div className="mt-2 p-3 rounded-lg bg-ds-raised text-xs">
                            <strong className="text-ds-text">Tip:</strong> Los valores por defecto (50/25/15/7/3) son un buen punto de partida. Ajusta segun cuantas cartas tengas de cada rareza.
                        </div>
                    </div>
                )}
            </div>

            <div className={cardClass}>
                <div className="space-y-5">
                    {/* Header labels */}
                    <div className="flex items-center justify-end gap-2 text-xs font-bold text-ds-soft mb-2">
                        <span className="w-24 text-center">Donacion %</span>
                        {coinsEnabled && <span className="w-24 text-center ml-2">Coins %</span>}
                        <span className="w-6" />
                    </div>
                    {RARITIES.map(rarity => {
                        const rc = RARITY_CONFIG[rarity];
                        const pct = probabilities[rarity];
                        const coinPct = coinProbabilities[rarity];
                        return (
                            <div key={rarity} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rc.color }} />
                                        <span className="font-bold text-ds-text">{rc.label}</span>
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
                                        {coinsEnabled && (
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                placeholder={String(pct)}
                                                className={`${inputClass} w-24 text-center ml-2`}
                                                value={coinPct ?? ''}
                                                onChange={e => handleCoinChange(rarity, e.target.value)}
                                            />
                                        )}
                                        <span className="text-sm font-bold text-ds-soft w-6">%</span>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-3 rounded-full bg-ds-raised overflow-hidden">
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
                <div className="mt-6 pt-4 border-t border-ds-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-ds-text">Total</span>
                        <span className={`text-lg font-black ${isValid ? 'text-ds-ok' : 'text-ds-danger'}`}>
                            {total.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-ds-raised overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${isValid ? 'bg-ds-accent' : 'bg-ds-danger-solid'}`}
                            style={{ width: `${Math.min(total, 100)}%` }}
                        />
                    </div>
                    {!isValid && (
                        <p className="text-sm text-ds-danger mt-2 font-bold">
                            El total debe ser exactamente 100%. {total > 100 ? `Sobran ${(total - 100).toFixed(1)}%` : `Faltan ${(100 - total).toFixed(1)}%`}
                        </p>
                    )}
                    {coinsEnabled && hasCoinValues && (
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-sm font-bold text-ds-soft">Total Coins</span>
                            <span className={`text-sm font-black ${coinValid ? 'text-ds-ok' : 'text-ds-danger'}`}>
                                {coinTotal.toFixed(1)}%
                            </span>
                        </div>
                    )}
                    {coinsEnabled && hasCoinValues && !coinValid && (
                        <p className="text-sm text-ds-danger mt-1 font-bold">
                            Coins total debe ser 100%. {coinTotal > 100 ? `Sobran ${(coinTotal - 100).toFixed(1)}%` : `Faltan ${(100 - coinTotal).toFixed(1)}%`}
                        </p>
                    )}
                    {coinsEnabled && !hasCoinValues && (
                        <p className="text-xs text-ds-soft mt-2 italic">
                            Coins sin configurar — usaran las mismas probabilidades de donacion
                        </p>
                    )}
                </div>
            </div>

            {/* Visual distribution */}
            <div className={cardClass}>
                <h3 className="text-sm font-black text-ds-text mb-4">Distribucion Visual</h3>
                <div className="flex h-10 rounded-lg overflow-hidden">
                    {RARITIES.map(rarity => {
                        const rc = RARITY_CONFIG[rarity];
                        const pct = probabilities[rarity];
                        if (pct <= 0) return null;
                        return (
                            <div
                                key={rarity}
                                className="flex items-center justify-center text-ds-text text-xs font-bold transition-all duration-300 overflow-hidden"
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
                            <div key={rarity} className="flex items-center gap-1.5 text-xs text-ds-soft">
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
