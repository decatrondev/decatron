import React, { useState } from 'react';
import { Save, Check, Clock } from 'lucide-react';
import type { TierId, TierDuration, DurationUnit } from '../types';
import { CARD, INPUT, LABEL, DURATION_UNITS, UNIT_MS, TIER_OPTIONS } from '../constants';
import api from '../../../../services/api';
import { UserSearchInput, type AdminUser } from '../../../../components/admin/UserSearchInput';

export function TestingTab({ tierDurations, setTierDurations, onSaveDurations }: {
    tierDurations: Record<TierId, TierDuration>;
    setTierDurations: React.Dispatch<React.SetStateAction<Record<TierId, TierDuration>>>;
    onSaveDurations: (durations: Record<TierId, TierDuration>) => Promise<void>;
}) {
    // Se elige de una lista, no se escribe: un login mal tecleado asignaba el tier a
    // nadie y la pantalla decía "asignado" igual.
    const [target, setTarget]     = useState<AdminUser | null>(null);
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
        if (!target) return;
        setApplying(true);
        setResult(null);
        try {
            await api.post('/supporters/assign-tier', {
                twitchLogin: target.login,
                tier,
                isPermanent: cur.isPermanent,
                duration: cur.isPermanent ? null : cur.duration,
                unit:     cur.isPermanent ? null : cur.unit,
            });
            const durationLabel = cur.isPermanent
                ? 'permanentemente'
                : `por ${cur.duration} ${DURATION_UNITS.find(u => u.value === cur.unit)?.label.toLowerCase()}`;
            setResult({ type: 'success', text: `✅ Tier "${tier}" asignado a @${target.login} ${durationLabel}` });
            setTarget(null);
        } catch {
            setResult({ type: 'error', text: `❌ Error al asignar el tier a @${target.login}` });
        } finally {
            setApplying(false);
            setTimeout(() => setResult(null), 7000);
        }
    };

    const handleRemove = async () => {
        if (!target) return;
        const login = target.login;
        setApplying(true);
        setResult(null);
        try {
            await api.post('/supporters/assign-tier', {
                twitchLogin: login,
                tier: 'free', isPermanent: true, duration: null, unit: null,
            });
            setResult({ type: 'success', text: `✅ Tier removido de @${login} — cuenta en free` });
            setTarget(null);
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
                <h3 className="font-black text-ds-text text-lg mb-1 flex items-center gap-2">
                    ⚙️ Asignación manual de tier
                </h3>
                <p className="text-sm text-ds-soft mb-5">
                    Asigna o modifica el tier de cualquier usuario. Cada tier recuerda su propia configuración de duración.
                </p>

                <div className="space-y-5">
                    {/* Canal */}
                    <div>
                        <label className={`${LABEL} block mb-1.5`}>Usuario de Twitch</label>
                        <UserSearchInput
                            value={target}
                            onSelect={setTarget}
                            onClear={() => setTarget(null)}
                            inputClassName={INPUT}
                        />
                    </div>

                    {/* Tier selector */}
                    <div>
                        <label className={`${LABEL} block mb-2`}>Tier a asignar</label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIER_OPTIONS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTier(t.id)}
                                    className={`py-3 px-4 rounded-lg text-sm font-bold border-2 transition-all ${
                                        tier === t.id
                                            ? 'text-ds-text '
                                            : 'bg-ds-bg text-ds-soft border-ds-border hover:border-ds-faint'
                                    }`}
                                    style={tier === t.id ? { backgroundColor: t.color, borderColor: t.color } : {}}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration — per-tier, shown for the active tier only */}
                    <div className="border border-ds-border rounded-lg p-4 bg-ds-bg">
                        <p className={`${LABEL} mb-3`}>
                            Duración para{' '}
                            <span style={{ color: TIER_OPTIONS.find(t => t.id === tier)?.color }}>
                                {TIER_OPTIONS.find(t => t.id === tier)?.label}
                            </span>
                        </p>

                        <div className="flex items-center gap-3 mb-4">
                            <button
                                onClick={() => setDur({ isPermanent: false })}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                    !cur.isPermanent
                                        ? 'bg-ds-accent text-ds-on-accent border-transparent shadow'
                                        : 'bg-ds-surface text-ds-soft border-ds-border '
                                }`}
                            >
                                <Clock className="w-4 h-4 inline mr-1.5" />
                                Personalizada
                            </button>
                            <button
                                onClick={() => setDur({ isPermanent: true })}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                    cur.isPermanent
                                        ? 'bg-ds-accent text-ds-on-accent border-transparent shadow'
                                        : 'bg-ds-surface text-ds-soft border-ds-border '
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
                                    className={`${INPUT} w-28 bg-ds-surface `}
                                />
                                <select
                                    value={cur.unit}
                                    onChange={e => setDur({ unit: e.target.value as DurationUnit })}
                                    className={`${INPUT} bg-ds-surface `}
                                >
                                    {DURATION_UNITS.map(u => (
                                        <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Expiry preview */}
                        <div className="mt-3 text-xs text-ds-soft font-semibold">
                            {expiryPreview()}
                        </div>

                        {/* Save durations button */}
                        <button
                            onClick={handleSaveDurations}
                            disabled={savingDur}
                            className="ds-btn ds-btn--primary mt-3 w-full"
                        >
                            <Save className="w-4 h-4" />
                            {savingDur ? 'Guardando...' : 'Guardar duración predeterminada'}
                        </button>
                    </div>

                    {/* Quick presets — apply to current tier */}
                    <div>
                        <p className="text-xs text-ds-soft font-semibold mb-2 uppercase tracking-wide">Presets rápidos</p>
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
                                    className="ds-btn ds-btn--secondary"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`px-4 py-3 rounded-lg text-sm font-bold ${
                            result.type === 'success'
                                ? 'bg-ds-ok/10 text-ds-ok '
                                : 'bg-ds-danger/10 text-ds-danger '
                        }`}>
                            {result.text}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            onClick={handleApply}
                            disabled={applying || !target}
                            className="ds-btn ds-btn--primary ds-btn--lg flex-1"
                        >
                            <Check className="w-4 h-4" />
                            {applying ? 'Asignando...' : `Asignar "${tier}" a @${target?.login ?? '...'}`}
                        </button>
                        <button
                            onClick={handleRemove}
                            disabled={applying || !target}
                            className="px-5 py-3 border border-ds-danger/40 bg-ds-surface hover:bg-ds-danger/10 text-ds-danger rounded-lg font-bold transition-all disabled:opacity-60"
                        >
                            Quitar tier
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
