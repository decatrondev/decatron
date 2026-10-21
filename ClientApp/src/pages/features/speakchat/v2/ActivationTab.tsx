// Activación: qué hace que un mensaje se lea (comando principal, bits, puntos de canal, rol, todos) y quién puede usarlo.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Field, NumberInput, Toggle as Switch, inputClass } from '../../../../components/overlay-editor/ui';
import { RuleCooldownFields } from '../CommandVoice';
import type { ActivationRule, RoleConfig } from '../types';
import type { SpeakChatState } from './useSpeakChatConfig';

export const ROLE_KEYS: (keyof RoleConfig)[] = ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'];

export function RolesField({ rule, onToggle }: { rule: ActivationRule; onToggle: (key: keyof RoleConfig, value: boolean) => void }) {
    const { t } = useTranslation('speakchat');
    return (
        <Field label={t('v2.commands.whoCan')}>
            <div className="flex flex-wrap gap-2">
                {ROLE_KEYS.map(key => (
                    <button key={key} type="button" aria-pressed={!!rule.roles?.[key]} onClick={() => onToggle(key, !(rule.roles?.[key] ?? false))}
                        className={rule.roles?.[key] ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>
                        {t(`v2.roles.${key}`)}
                    </button>
                ))}
            </div>
        </Field>
    );
}

export default function ActivationTab({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { config, rewards, rewardsError, updateRule, updateRole } = sc;
    const [open, setOpen] = useState<Record<number, boolean>>({});
    // Los comandos con voz propia (!goku) viven en su pestaña
    const entries = config.activation.rules.map((rule, idx) => ({ rule, idx })).filter(({ rule }) => !(rule.type === 'command' && rule.voice));

    const rolesSummary = (r: ActivationRule) => {
        const on = ROLE_KEYS.filter(k => r.roles?.[k]);
        return on.length === 0 ? t('v2.commands.nobody') : on.map(k => t(`v2.roles.${k}`)).join(', ');
    };

    return (
        <div className="space-y-6">
            <p className="text-sm 3xl:text-base text-ds-soft">{t('v2.activation.intro')}</p>
            {entries.map(({ rule, idx }) => {
                const expanded = !!open[idx];
                const title = rule.type === 'command' ? `${t('v2.rules.command.label')} · ${rule.commandName || '!tts'}` : t(`v2.rules.${rule.type}.label`);
                return (
                    <div key={idx} className="bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-5 3xl:p-6">
                            <Switch checked={rule.enabled} onChange={v => updateRule(idx, { enabled: v })} label={title}
                                hint={[t(`v2.rules.${rule.type}.desc`), rule.type !== 'all' ? rolesSummary(rule) : null].filter(Boolean).join(' · ')} />
                            <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-expanded={expanded}
                                aria-label={expanded ? t('v2.commands.collapse') : t('v2.commands.expand')}
                                onClick={() => setOpen(o => ({ ...o, [idx]: !o[idx] }))}>
                                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                        {expanded && (
                            <div className="border-t border-ds-border bg-ds-bg p-5 3xl:p-6 space-y-5">
                                {rule.type === 'command' && (
                                    <>
                                        <Field label={t('v2.commands.commandName')} hint={t('v2.commands.commandHint')}>
                                            <input value={rule.commandName ?? '!tts'} onChange={e => updateRule(idx, { commandName: e.target.value })} placeholder="!tts" className={`${inputClass} sm:w-56`} />
                                        </Field>
                                        <RuleCooldownFields rule={rule} config={config} onChange={patch => updateRule(idx, patch)} />
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
                                                {rule.rewardId && !rewards.some(r => r.id === rule.rewardId) && (
                                                    <option value={rule.rewardId}>{t('v2.commands.unknownReward', { id: rule.rewardId.slice(0, 8) })}</option>
                                                )}
                                            </select>
                                        ) : (
                                            <input value={rule.rewardId ?? ''} onChange={e => updateRule(idx, { rewardId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className={`${inputClass} font-mono`} />
                                        )}
                                    </Field>
                                )}
                                {(rule.type === 'roles' || rule.type === 'all') && <p className="text-sm 3xl:text-base text-ds-warn">{t('v2.commands.costWarning')}</p>}
                                {rule.type !== 'all' && <RolesField rule={rule} onToggle={(k, v) => updateRole(idx, k, v)} />}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
