import { ChevronDown, ChevronUp } from 'lucide-react';
import { cardClass, inputClass, labelClass, sectionTitle, sectionDesc, Toggle, RULE_META } from './shared';
import type { ActivationRule, ChannelPointsReward, ConfigProps, RoleConfig } from './types';

interface ActivationTabProps extends Pick<ConfigProps, 'config'> {
    rewards: ChannelPointsReward[];
    rewardsError: boolean;
    expandedRules: Record<number, boolean>;
    setExpandedRules: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    updateRule: (idx: number, patch: Partial<ActivationRule>) => void;
    updateRoleInRule: (idx: number, role: keyof RoleConfig, value: boolean) => void;
}

export default function ActivationTab({ config, rewards, rewardsError, expandedRules, setExpandedRules, updateRule, updateRoleInRule }: ActivationTabProps) {
    return (
        <div className="space-y-4">
            <div className={cardClass}>
                <p className={sectionTitle}>⚡ Reglas de activación</p>
                <p className={sectionDesc}>
                    Habilita una o más reglas. Si cualquier regla activa se cumple, el mensaje se lee.
                    Puedes tener varias activas al mismo tiempo.
                </p>
            </div>

            {config.activation.rules.map((rule, idx) => {
                const meta = RULE_META[rule.type];
                return (
                    <div key={rule.type} className={cardClass + ' !p-0 overflow-hidden'}>
                        {/* Header de la regla */}
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <Toggle
                                    checked={rule.enabled}
                                    onChange={v => updateRule(idx, { enabled: v })}
                                />
                                <div>
                                    <p className="font-bold text-ds-text">
                                        {meta.emoji} {meta.label}
                                    </p>
                                    <p className="text-xs text-ds-soft">{meta.desc}</p>
                                </div>
                            </div>
                            {rule.type !== 'all' && (
                                <button
                                    onClick={() => setExpandedRules(e => ({ ...e, [idx]: !e[idx] }))}
                                    className="ds-btn ds-btn--ghost ds-icon-btn"
                                >
                                    {expandedRules[idx] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            )}
                        </div>

                        {/* Body expandible */}
                        {expandedRules[idx] && rule.type !== 'all' && (
                            <div className="border-t border-ds-border p-6 space-y-5 bg-ds-bg">

                                {rule.type === 'command' && (
                                    <div>
                                        <label className={labelClass}>Nombre del comando</label>
                                        <input
                                            value={rule.commandName ?? '!tts'}
                                            onChange={e => updateRule(idx, { commandName: e.target.value })}
                                            placeholder="!tts"
                                            className={`${inputClass} w-48`}
                                        />
                                        <p className="text-xs text-ds-soft mt-1">
                                            Ej: <code className="bg-ds-raised px-1 rounded">!tts Hola streamer</code> → lee "Hola streamer"
                                        </p>
                                    </div>
                                )}

                                {rule.type === 'bits' && (
                                    <div>
                                        <label className={labelClass}>Bits mínimos</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={rule.minBits ?? 100}
                                            onChange={e => updateRule(idx, { minBits: parseInt(e.target.value) || 1 })}
                                            className={`${inputClass} w-32`}
                                        />
                                    </div>
                                )}

                                {rule.type === 'channelPoints' && (
                                    <div>
                                        <label className={labelClass}>Recompensa de puntos de canal</label>

                                        {rewards.length > 0 ? (
                                            <>
                                                <select
                                                    value={rule.rewardId ?? ''}
                                                    onChange={e => updateRule(idx, { rewardId: e.target.value })}
                                                    className={inputClass}
                                                >
                                                    <option value="">— Elige una recompensa —</option>
                                                    {rewards.map(r => (
                                                        <option key={r.id} value={r.id}>
                                                            {r.title} ({r.cost} puntos)
                                                        </option>
                                                    ))}
                                                    {/* La recompensa guardada puede haberse borrado en Twitch */}
                                                    {rule.rewardId && !rewards.some(r => r.id === rule.rewardId) && (
                                                        <option value={rule.rewardId}>
                                                            Recompensa desconocida ({rule.rewardId.slice(0, 8)}…)
                                                        </option>
                                                    )}
                                                </select>
                                                <p className="text-xs text-ds-soft mt-1">
                                                    Recomendado: que la recompensa pida texto al viewer — ese texto es lo que se lee.
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <input
                                                    value={rule.rewardId ?? ''}
                                                    onChange={e => updateRule(idx, { rewardId: e.target.value })}
                                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                                    className={`${inputClass} font-mono`}
                                                />
                                                <p className="text-xs text-ds-soft mt-1">
                                                    {rewardsError
                                                        ? 'No se pudieron cargar tus recompensas (token expirado o canal sin afiliación). Pega el ID a mano.'
                                                        : 'No hay recompensas de puntos en este canal. Créalas en Twitch o pega el ID a mano.'}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Roles */}
                                <div>
                                    <label className={labelClass}>¿Quién puede usar esta regla?</label>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { key: 'everyone',    label: '🌐 Todos' },
                                            { key: 'subscriber',  label: '⭐ Subs' },
                                            { key: 'vip',         label: '💎 VIPs' },
                                            { key: 'moderator',   label: '🛡️ Mods' },
                                            { key: 'broadcaster', label: '🎙️ Streamer' },
                                        ] as const).map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => updateRoleInRule(idx, key, !(rule.roles?.[key] ?? false))}
                                                className={(rule.roles?.[key] ?? false) ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
