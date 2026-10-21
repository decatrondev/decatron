// Comandos: las formas de activar Speak Chat. Cada comando (!tts, !goku…) puede tener su voz, sus permisos y sus enfriamientos.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Card, Field, NumberInput, Toggle as Switch, inputClass } from '../../../../components/overlay-editor/ui';
import CommandVoice from '../CommandVoice';
import type { FishVoiceOption } from '../../fishVoices';
import type { VoiceCatalog } from '../../../../components/tts/useVoiceCatalog';
import type { ActivationRule, RoleConfig } from '../types';
import type { SpeakChatState } from './useSpeakChatConfig';

const ROLE_KEYS: (keyof RoleConfig)[] = ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'];

interface Props {
    sc: SpeakChatState;
    voiceCatalog: VoiceCatalog;
    fishVoices: FishVoiceOption[];
}

export default function CommandsTab({ sc, voiceCatalog, fishVoices }: Props) {
    const { t } = useTranslation('speakchat');
    const { config, limits, usage, rewards, rewardsError, updateRule, updateRole, addCommand, removeRule } = sc;
    const [open, setOpen] = useState<Record<number, boolean>>({});
    const rules = config.activation.rules;
    const firstCommand = rules.findIndex(r => r.type === 'command');
    const used = rules.filter(r => r.type === 'command' && r.voice).length;
    const atLimit = used >= limits.max;
    const paidAvailable = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);
    const names = rules.filter(r => r.type === 'command').map(r => (r.commandName ?? '').trim().toLowerCase());
    const isDuplicate = (r: ActivationRule) => r.type === 'command' && names.filter(n => n === (r.commandName ?? '').trim().toLowerCase()).length > 1;

    const rolesSummary = (r: ActivationRule) => {
        const on = ROLE_KEYS.filter(k => r.roles?.[k]);
        return on.length === 0 ? t('v2.commands.nobody') : on.map(k => t(`v2.roles.${k}`)).join(', ');
    };

    return (
        <div className="space-y-6">
            <Card title={t('v2.commands.title')} description={t('v2.commands.description')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm 3xl:text-base text-ds-soft">
                        {t('commandVoice.counter', { used, max: limits.max })}
                        {atLimit && <span className="text-ds-warn"> · {t('commandVoice.limitReached')}</span>}
                    </p>
                    <button type="button" className="ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap" disabled={atLimit}
                        onClick={() => { const idx = addCommand(); setOpen(o => ({ ...o, [idx]: true })); }}>
                        <Plus className="w-4 h-4" /> {t('commandVoice.add')}
                    </button>
                </div>
            </Card>

            {rules.map((rule, idx) => {
                const expanded = !!open[idx];
                const title = rule.type === 'command' ? t('v2.rules.command.label') + ' · ' + (rule.commandName || '!tts') : t(`v2.rules.${rule.type}.label`);
                return (
                    <div key={idx} className="bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-5 3xl:p-6">
                            <Switch
                                checked={rule.enabled}
                                onChange={v => updateRule(idx, { enabled: v })}
                                label={title}
                                hint={[t(`v2.rules.${rule.type}.desc`), rule.type !== 'all' ? rolesSummary(rule) : null,
                                    rule.type === 'command' && rule.voice ? t(`v2.engine.${rule.voice.engine}`) : null].filter(Boolean).join(' · ')}
                            />
                            <div className="flex items-center gap-1">
                                {rule.type === 'command' && idx !== firstCommand && (
                                    <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" onClick={() => removeRule(idx)} title={t('commandVoice.remove')} aria-label={t('commandVoice.remove')}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-expanded={expanded}
                                    aria-label={expanded ? t('v2.commands.collapse') : t('v2.commands.expand')}
                                    onClick={() => setOpen(o => ({ ...o, [idx]: !o[idx] }))}>
                                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {expanded && (
                            <div className="border-t border-ds-border bg-ds-bg p-5 3xl:p-6 space-y-5">
                                {rule.type === 'command' && (
                                    <>
                                        <Field label={t('v2.commands.commandName')} hint={t('v2.commands.commandHint')}>
                                            <input value={rule.commandName ?? '!tts'} onChange={e => updateRule(idx, { commandName: e.target.value })} placeholder="!tts" className={`${inputClass} sm:w-56`} />
                                        </Field>
                                        {isDuplicate(rule) && <p className="text-xs 3xl:text-sm text-ds-warn">{t('commandVoice.duplicate')}</p>}
                                        <CommandVoice rule={rule} config={config} voiceCatalog={voiceCatalog} fishVoices={fishVoices} paidAvailable={paidAvailable}
                                            onChange={patch => updateRule(idx, patch)} />
                                    </>
                                )}

                                {rule.type === 'bits' && (
                                    <Field label={t('v2.commands.minBits')}>
                                        <div className="sm:w-40"><NumberInput value={rule.minBits ?? 100} min={1} onChange={v => updateRule(idx, { minBits: v || 1 })} /></div>
                                    </Field>
                                )}

                                {rule.type === 'channelPoints' && (
                                    <Field label={t('v2.commands.reward')} hint={rewards.length > 0 ? t('v2.commands.rewardHint') : rewardsError ? t('v2.commands.rewardsError') : t('v2.commands.noRewards')}>
                                        {rewards.length > 0 ? (
                                            <select value={rule.rewardId ?? ''} onChange={e => updateRule(idx, { rewardId: e.target.value })} className={inputClass}>
                                                <option value="">{t('v2.commands.chooseReward')}</option>
                                                {rewards.map(r => <option key={r.id} value={r.id}>{r.title} ({t('v2.commands.points', { amount: r.cost.toLocaleString() })})</option>)}
                                                {/* La recompensa guardada puede haberse borrado en Twitch */}
                                                {rule.rewardId && !rewards.some(r => r.id === rule.rewardId) && (
                                                    <option value={rule.rewardId}>{t('v2.commands.unknownReward', { id: rule.rewardId.slice(0, 8) })}</option>
                                                )}
                                            </select>
                                        ) : (
                                            <input value={rule.rewardId ?? ''} onChange={e => updateRule(idx, { rewardId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${inputClass} font-mono`} />
                                        )}
                                    </Field>
                                )}

                                {(rule.type === 'roles' || rule.type === 'all') && (
                                    <p className="text-sm 3xl:text-base text-ds-warn">{t('v2.commands.costWarning')}</p>
                                )}

                                {rule.type !== 'all' && (
                                    <Field label={t('v2.commands.whoCan')}>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLE_KEYS.map(key => (
                                                <button key={key} type="button" aria-pressed={!!rule.roles?.[key]}
                                                    onClick={() => updateRole(idx, key, !(rule.roles?.[key] ?? false))}
                                                    className={rule.roles?.[key] ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>
                                                    {t(`v2.roles.${key}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
