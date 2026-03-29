import React, { useState } from 'react';
import { Save, Check, Clock } from 'lucide-react';
import type { TierId, TierDuration, DurationUnit } from '../types';
import { CARD, INPUT, LABEL, DURATION_UNITS, UNIT_MS, TIER_OPTIONS } from '../constants';
import api from '../../../../services/api';

export function TestingTab({ tierDurations, setTierDurations, onSaveDurations }: {
    tierDurations: Record<TierId, TierDuration>;
    setTierDurations: React.Dispatch<React.SetStateAction<Record<TierId, TierDuration>>>;
    onSaveDurations: (durations: Record<TierId, TierDuration>) => Promise<void>;
}) {
    const [username, setUsername] = useState('');
    const [tier, setTier]         = useState<TierId>('supporter');
    const [applying, setApplying] = useState(false);
    const [savingDur, setSavingDur] = useState(false);
    const [result, setResult]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSaveDurations = async () => {
        setSavingDur(true);
        try {
            await onSaveDurations(tierDurations);
            setResult({ type: 'success', text: '✅ Configuración de duración guardada' });
        } catch {
            setResult({ type: 'error', text: '❌ Error al guardar la duración' });
        } finally {
            setSavingDur(false);
            setTimeout(() => setResult(null), 4000);
        }
    };

    const cur = tierDurations[tier];
    const setDur = (patch: Partial<TierDuration>) =>
        setTierDurations(prev => ({ ...prev, [tier]: { ...prev[tier], ...patch } }));

    const expiryPreview = () => {
        if (cur.isPermanent) return '∞ Nunca vence (tier_expires_at = NULL)';
        const ms = cur.duration * UNIT_MS[cur.unit];
        const expiry = new Date(Date.now() + ms);
        return `Vence: ${expiry.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}`;
    };

    const handleApply = async () => {
        if (!username.trim()) return;
        setApplying(true);
        setResult(null);
        try {
            await api.post('/supporters/assign-tier', {
                twitchLogin: username.trim().toLowerCase(),
                tier,
                isPermanent: cur.isPermanent,
                duration: cur.isPermanent ? null : cur.duration,
                unit:     cur.isPermanent ? null : cur.unit,
            });
            const durationLabel = cur.isPermanent
                ? 'permanentemente'
                : `por ${cur.duration} ${DURATION_UNITS.find(u => u.value === cur.unit)?.label.toLowerCase()}`;
            setResult({ type: 'success', text: `✅ Tier "${tier}" asignado a @${username} ${durationLabel}` });
            setUsername('');
        } catch {
            setResult({ type: 'error', text: `❌ Error al asignar el tier a @${username}` });
        } finally {
            setApplying(false);
            setTimeout(() => setResult(null), 7000);
        }
    };

    const handleRemove = async () => {
        if (!username.trim()) return;
        setApplying(true);
        setResult(null);
        try {
            await api.post('/supporters/assign-tier', {
                twitchLogin: username.trim().toLowerCase(),
                tier: 'free', isPermanent: true, duration: null, unit: null,
            });
            setResult({ type: 'success', text: `✅ Tier removido de @${username} — cuenta en free` });
            setUsername('');
        } catch {
            setResult({ type: 'error', text: '❌ Error al remover el tier' });
        } finally {
            setApplying(false);
            setTimeout(() => setResult(null), 5000);
        }
    };

    return (
        <div className="space-y-6">
            <div className={CARD}>
                <h3 className="font-black text-[#1e293b] dark:text-[#f8fafc] text-lg mb-1 flex items-center gap-2">
                    ⚙️ Asignación manual de tier
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-5">
                    Asigna o modifica el tier de cualquier usuario. Cada tier recuerda su propia configuración de duración.
                </p>

                <div className="space-y-5">
                    {/* Username */}
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Usuario de Twitch</label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] font-bold">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                className={`${INPUT} pl-8`}
                                placeholder="nombre_de_usuario"
                            />
                        </div>
                    </div>

                    {/* Tier selector */}
                    <div>
                        <label className={`${LABEL} block mb-2`}>Tier a asignar</label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIER_OPTIONS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTier(t.id)}
                                    className={`py-3 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                                        tier === t.id
                                            ? 'text-white shadow-lg'
                                            : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'
                                    }`}
                                    style={tier === t.id ? { backgroundColor: t.color, borderColor: t.color } : {}}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration — per-tier, shown for the active tier only */}
                    <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4 bg-[#f8fafc] dark:bg-[#262626]">
                        <p className={`${LABEL} mb-3`}>
                            Duración para{' '}
                            <span style={{ color: TIER_OPTIONS.find(t => t.id === tier)?.color }}>
                                {TIER_OPTIONS.find(t => t.id === tier)?.label}
                            </span>
                        </p>

                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={() => setDur({ isPermanent: false })}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                    !cur.isPermanent
                                        ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white border-transparent shadow'
                                        : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151]'
                                }`}
                            >
                                <Clock className="w-4 h-4 inline mr-1.5" />
                                Personalizada
                            </button>
                            <button
                                onClick={() => setDur({ isPermanent: true })}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                    cur.isPermanent
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-transparent shadow'
                                        : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151]'
                                }`}
                            >
                                ∞ Permanente
                            </button>
                        </div>

                        {!cur.isPermanent && (
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min={1}
                                    value={cur.duration}
                                    onChange={e => setDur({ duration: Math.max(1, Number(e.target.value)) })}
                                    className={`${INPUT} w-28 bg-white dark:bg-[#1B1C1D]`}
                                />
                                <select
                                    value={cur.unit}
                                    onChange={e => setDur({ unit: e.target.value as DurationUnit })}
                                    className={`${INPUT} bg-white dark:bg-[#1B1C1D]`}
                                >
                                    {DURATION_UNITS.map(u => (
                                        <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Expiry preview */}
                        <div className="mt-3 text-xs text-[#64748b] dark:text-[#94a3b8] font-semibold">
                            {expiryPreview()}
                        </div>

                        {/* Save durations button */}
                        <button
                            onClick={handleSaveDurations}
                            disabled={savingDur}
                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white text-sm font-bold transition-all"
                        >
                            <Save className="w-4 h-4" />
                            {savingDur ? 'Guardando...' : 'Guardar duración predeterminada'}
                        </button>
                    </div>

                    {/* Quick presets — apply to current tier */}
                    <div>
                        <p className="text-xs text-[#94a3b8] font-semibold mb-2 uppercase tracking-wide">Presets rápidos</p>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: '5 min',    d: 5,  u: 'minutes' as DurationUnit },
                                { label: '1 hora',   d: 1,  u: 'hours'   as DurationUnit },
                                { label: '1 día',    d: 1,  u: 'days'    as DurationUnit },
                                { label: '7 días',   d: 7,  u: 'days'    as DurationUnit },
                                { label: '1 mes',    d: 1,  u: 'months'  as DurationUnit },
                                { label: '3 meses',  d: 3,  u: 'months'  as DurationUnit },
                                { label: '1 año',    d: 1,  u: 'years'   as DurationUnit },
                                { label: '∞ Siempre', d: 0,  u: 'days'   as DurationUnit, permanent: true },
                            ].map(preset => (
                                <button
                                    key={preset.label}
                                    onClick={() => preset.permanent
                                        ? setDur({ isPermanent: true })
                                        : setDur({ isPermanent: false, duration: preset.d, unit: preset.u })
                                    }
                                    className="px-2 py-2 bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-xs font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] hover:text-[#1e293b] dark:hover:text-[#f8fafc] transition-all text-center"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`px-4 py-3 rounded-xl text-sm font-bold ${
                            result.type === 'success'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                            {result.text}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            onClick={handleApply}
                            disabled={applying || !username.trim()}
                            className="flex-1 py-3 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-60 text-white rounded-xl font-black transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" />
                            {applying ? 'Asignando...' : `Asignar "${tier}" a @${username || '...'}`}
                        </button>
                        <button
                            onClick={handleRemove}
                            disabled={applying || !username.trim()}
                            className="px-5 py-3 border border-red-200 dark:border-red-800 bg-white dark:bg-[#262626] hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl font-bold transition-all disabled:opacity-60"
                        >
                            Quitar tier
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
