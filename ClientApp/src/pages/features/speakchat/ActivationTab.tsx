import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FishVoiceOption } from '../fishVoices';
import type { VoiceCatalog } from '../../../components/tts/useVoiceCatalog';
import CommandVoice from './CommandVoice';
import { cardClass, inputClass, labelClass, sectionTitle, sectionDesc, Toggle, RULE_META } from './shared';
import type { ActivationRule, ChannelPointsReward, ConfigProps, RoleConfig, VoiceCommandLimits } from './types';

interface ActivationTabProps extends Pick<ConfigProps, 'config'> {
    rewards: ChannelPointsReward[];
    rewardsError: boolean;
    expandedRules: Record<number, boolean>;
    setExpandedRules: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    updateRule: (idx: number, patch: Partial<ActivationRule>) => void;
    updateRoleInRule: (idx: number, role: keyof RoleConfig, value: boolean) => void;
    voiceCatalog: VoiceCatalog;
    fishVoices: FishVoiceOption[];
    paidAvailable: boolean;
    limits: VoiceCommandLimits;
    addCommand: () => void;
    removeRule: (idx: number) => void;
}

export default function ActivationTab({ config, rewards, rewardsError, expandedRules, setExpandedRules, updateRule, updateRoleInRule, voiceCatalog, fishVoices, paidAvailable, limits, addCommand, removeRule }: ActivationTabProps) {
    const { t } = useTranslation('speakchat');
    const firstCommand = config.activation.rules.findIndex(r => r.type === 'command');
    const used = config.activation.rules.filter(r => r.type === 'command' && r.voice).length;
    const atLimit = used >= limits.max;
    const names = config.activation.rules.filter(r => r.type === 'command').map(r => (r.commandName ?? '').trim().toLowerCase());
    const isDuplicate = (r: ActivationRule) => r.type === 'command' && names.filter(n => n === (r.commandName ?? '').trim().toLowerCase()).length > 1;
    return (
        <div className="space-y-4">
            <div className={cardClass}>
                <p className={sectionTitle}>⚡ Reglas de activación</p>
                <p className={sectionDesc}>
                    Habilita una o más reglas. Si cualquier regla activa se cumple, el mensaje se lee.
                    Puedes tener varias activas al mismo tiempo.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={addCommand} disabled={atLimit}>
                        <Plus className="w-4 h-4" /> {t('commandVoice.add')}
                    </button>
                    <span className="text-xs text-ds-soft">{t('commandVoice.counter', { used, max: limits.max })}</span>
                    {atLimit && <span className="text-xs text-ds-warn">{t('commandVoice.limitReached')}</span>}
                </div>
            </div>

            {config.activation.rules.map((rule, idx) => {
                const meta = RULE_META[rule.type];
                return (
                    <div key={idx} className={cardClass + ' !p-0 overflow-hidden'}>
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
                            <div className="flex items-center gap-2">
                            {rule.type === 'command' && idx !== firstCommand && (
                                <button
                                    onClick={() => removeRule(idx)}
                                    className="ds-btn ds-btn--ghost ds-icon-btn"
                                    title={t('commandVoice.remove')}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            {(
                                <button
                                    onClick={() => setExpandedRules(e => ({ ...e, [idx]: !e[idx] }))}
                                    className="ds-btn ds-btn--ghost ds-icon-btn"
                                >
                                    {expandedRules[idx] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            )}
                            </div>
                        </div>

                        {/* Body expandible */}
                        {expandedRules[idx] && (
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

                                {isDuplicate(rule) && <p className="text-xs text-ds-warn">{t('commandVoice.duplicate')}</p>}

                                {rule.type === 'command' && (
                                    <CommandVoice
                                        rule={rule} config={config}
                                        voiceCatalog={voiceCatalog} fishVoices={fishVoices} paidAvailable={paidAvailable}
                                        onChange={patch => updateRule(idx, patch)}
                                    />
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

                                {/* Plataformas: Kick no tiene bits ni puntos de Twitch, así que esas dos reglas son solo de Twitch */}
                                {(rule.type === 'command' || rule.type === 'roles' || rule.type === 'all') && (
                                    <div>
                                        <label className={labelClass}>{t('platform.label')}</label>
                                        <select
                                            value={rule.platform ?? 'twitch'}
                                            onChange={e => updateRule(idx, { platform: e.target.value as 'all' | 'twitch' | 'kick' })}
                                            className={`${inputClass} w-full sm:w-72`}
                                        >
                                            <option value="all">{t('platform.all')}</option>
                                            <option value="twitch">{t('platform.twitch')}</option>
                                            <option value="kick">{t('platform.kick')}</option>
                                        </select>
                                        <p className="text-xs text-ds-soft mt-1">{t('platform.hint')}</p>
                                    </div>
                                )}

                                {/* Roles */}
                                {rule.type !== 'all' && (
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
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
