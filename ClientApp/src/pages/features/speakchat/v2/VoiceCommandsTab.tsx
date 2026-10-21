// Comandos de voz: !goku, !thanos… cada uno con su nombre, su voz, sus permisos y sus enfriamientos.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Card, Field, Toggle as Switch, inputClass } from '../../../../components/overlay-editor/ui';
import { RuleVoiceFields, RuleCooldownFields } from '../CommandVoice';
import { RolesField, ROLE_KEYS } from './ActivationTab';
import type { FishVoiceOption } from '../../fishVoices';
import type { VoiceCatalog } from '../../../../components/tts/useVoiceCatalog';
import type { SpeakChatState } from './useSpeakChatConfig';

interface Props { sc: SpeakChatState; voiceCatalog: VoiceCatalog; fishVoices: FishVoiceOption[] }

export default function VoiceCommandsTab({ sc, voiceCatalog, fishVoices }: Props) {
    const { t } = useTranslation('speakchat');
    const { config, limits, usage, updateRule, updateRole, addCommand, removeRule } = sc;
    const [open, setOpen] = useState<Record<number, boolean>>({});
    const rules = config.activation.rules;
    const entries = rules.map((rule, idx) => ({ rule, idx })).filter(({ rule }) => rule.type === 'command' && rule.voice);
    const used = entries.length;
    const atLimit = used >= limits.max;
    const paidAvailable = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);
    const names = rules.filter(r => r.type === 'command').map(r => (r.commandName ?? '').trim().toLowerCase());

    return (
        <div className="space-y-6">
            <Card title={t('v2.voiceCommands.title')} description={t('v2.voiceCommands.description')}>
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

            {entries.length === 0 && <p className="text-sm 3xl:text-base text-ds-soft">{t('v2.voiceCommands.empty')}</p>}

            {entries.map(({ rule, idx }) => {
                const expanded = !!open[idx];
                const dup = names.filter(n => n === (rule.commandName ?? '').trim().toLowerCase()).length > 1;
                const on = ROLE_KEYS.filter(k => rule.roles?.[k]).map(k => t(`v2.roles.${k}`)).join(', ') || t('v2.commands.nobody');
                return (
                    <div key={idx} className="bg-ds-surface rounded-lg border border-ds-border">
                        <div className="flex flex-wrap items-center justify-between gap-3 p-5 3xl:p-6">
                            <Switch checked={rule.enabled} onChange={v => updateRule(idx, { enabled: v })}
                                label={rule.commandName || '!'} hint={`${t(`v2.engine.${rule.voice!.engine}`)} · ${on}`} />
                            <div className="flex items-center gap-1">
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" onClick={() => removeRule(idx)} title={t('commandVoice.remove')} aria-label={t('commandVoice.remove')}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-expanded={expanded}
                                    aria-label={expanded ? t('v2.commands.collapse') : t('v2.commands.expand')}
                                    onClick={() => setOpen(o => ({ ...o, [idx]: !o[idx] }))}>
                                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        {expanded && (
                            <div className="border-t border-ds-border bg-ds-bg p-5 3xl:p-6 space-y-5">
                                <Field label={t('v2.commands.commandName')} hint={t('v2.voiceCommands.nameHint')}>
                                    <input value={rule.commandName ?? ''} onChange={e => updateRule(idx, { commandName: e.target.value })} placeholder="!goku" className={`${inputClass} sm:w-56`} />
                                </Field>
                                {dup && <p className="text-xs 3xl:text-sm text-ds-warn">{t('commandVoice.duplicate')}</p>}
                                <RuleVoiceFields rule={rule} config={config} voiceCatalog={voiceCatalog} fishVoices={fishVoices} paidAvailable={paidAvailable} onChange={p => updateRule(idx, p)} />
                                <RuleCooldownFields rule={rule} config={config} onChange={p => updateRule(idx, p)} />
                                <RolesField rule={rule} onToggle={(k, v) => updateRole(idx, k, v)} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
