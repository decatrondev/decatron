/**
 * SettingsExtras - Opciones configurables del giveaway que van en `settings`:
 * mensajes del bot, avisos de rechazo, topes de peso, recordatorios, anti cuentas duplicadas y roles.
 * Los campos de texto vacíos usan el texto por defecto (se muestra como guía).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, ShieldAlert, Scale, BellRing, Users, UserCog, Globe2, Check, X, Terminal } from 'lucide-react';
import api from '../../../../../services/api';
import type { GiveawaySettings, PlatformCapabilities } from '../../types';
import { DEFAULT_SETTINGS_TEXTS, REJECTION_REASONS, PLATFORM_LABELS, COMMAND_TEXTS } from '../../types';

interface SettingsExtrasProps {
    settings: GiveawaySettings;
    onUpdateSettings: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

const MESSAGE_FIELDS: { key: keyof GiveawaySettings['messages']; vars: string }[] = [
    { key: 'joined', vars: '{user} {count} {prize} {command}' },
    { key: 'winnerResponded', vars: '{winner} {prize}' },
    { key: 'completed', vars: '{responded} {total} {winner} {prize}' },
    { key: 'promoted', vars: '{winner} {timeout} {prize}' },
    { key: 'noResponseKept', vars: '{winner} {prize} {root}' },
    { key: 'noResponseKeptMany', vars: '{winners} {prize} {root}' },
    { key: 'noParticipants', vars: '{reason} {prize}' },
    { key: 'cancelled', vars: '{reason} {prize}' },
];

const NumberField: React.FC<{
    label: string;
    hint?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step, onChange }) => (
    <div>
        <label className="block text-sm font-bold text-ds-soft mb-2">{label}</label>
        <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange(Number.isFinite(n) ? n : 0);
            }}
            className="ds-input w-full"
        />
        {hint && <p className="text-xs text-ds-soft mt-1">{hint}</p>}
    </div>
);

const Toggle: React.FC<{ title: string; hint: string; value: boolean; onChange: (v: boolean) => void; on?: string; off?: string }> = ({
    title, hint, value, onChange, on, off,
}) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
    <div className="flex items-center justify-between gap-4 p-4 bg-ds-bg rounded-lg border border-ds-border">
        <div>
            <p className="font-bold text-ds-text">{title}</p>
            <p className="text-xs text-ds-soft">{hint}</p>
        </div>
        <button onClick={() => onChange(!value)} className={value ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
            {value ? (on ?? t('common.on')) : (off ?? t('common.off'))}
        </button>
    </div>
    );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; text?: string }> = ({ icon, title, text }) => (
    <div>
        <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">{icon}{title}</h3>
        {text && <p className="text-sm text-ds-soft mt-1">{text}</p>}
    </div>
);

/** Dónde se puede participar + qué se puede comprobar en cada plataforma (la tabla viene del servidor). */
const PlatformsSection: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    const [caps, setCaps] = useState<PlatformCapabilities | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/giveaway/platforms')
            .then((res) => {
                if (cancelled) return;
                if (res.data?.success) setCaps(res.data as PlatformCapabilities);
                else setFailed(true);
            })
            .catch(() => !cancelled && setFailed(true));
        return () => { cancelled = true; };
    }, []);

    const platforms = caps?.supported ? Object.keys(caps.supported) : [];
    const kickLinked = caps?.linked?.kick ?? false;
    const rules = settings.platforms;

    return (
        <div className="space-y-4">
            <SectionTitle
                icon={<Globe2 className="w-5 h-5 text-ds-accent-text" />}
                title={t('x.platWhere')}
                text={t('x.platWhereHint')}
            />
            <Toggle title="Twitch" hint={t('x.twitchHint')}
                value={rules.twitch} onChange={(v) => onUpdateSettings('platforms', { twitch: v })} on={t('x.accepts')} off={t('x.rejects')} />
            <Toggle title="Kick"
                hint={kickLinked ? t('x.kickHintLinked')
                    : t('x.kickHintUnlinked')}
                value={rules.kick && kickLinked}
                onChange={(v) => kickLinked && onUpdateSettings('platforms', { kick: v })} on={t('x.accepts')} off={t('x.rejects')} />

            {failed && <p className="text-xs text-ds-soft">{t('x.tableFailed')}</p>}

            {caps?.supported && caps.capabilities && (
                <div className="overflow-x-auto rounded-lg border border-ds-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-ds-bg text-left text-ds-soft">
                                <th className="p-3 font-bold">{t('x.whatChecked')}</th>
                                {platforms.map((p) => <th key={p} className="p-3 font-bold text-center">{PLATFORM_LABELS[p] ?? p}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {caps.capabilities.map((c) => (
                                <tr key={c} className="border-t border-ds-border">
                                    <td className="p-3">
                                        <p className="text-ds-text">{t(`caps.${c}`, { defaultValue: c })}</p>
                                        <p className="text-xs text-ds-soft">{t(`capsHint.${c}`, { defaultValue: '' })}</p>
                                    </td>
                                    {platforms.map((p) => {
                                        const ok = caps.supported[p]?.includes(c);
                                        return (
                                            <td key={p} className="p-3 text-center">
                                                {ok
                                                    ? <span className="inline-flex items-center gap-1 text-green-500"><Check className="w-4 h-4" />{t('common.yes')}</span>
                                                    : <span className="inline-flex items-center gap-1 text-ds-soft"><X className="w-4 h-4" />{t('x.notVerifiable')}</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border space-y-2">
                <p className="font-bold text-ds-text">{t('x.unverifTitle')}</p>
                <p className="text-xs text-ds-soft">{t('x.unverifHint')}</p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => onUpdateSettings('platforms', { unverifiable: 'allow' })}
                        className={rules.unverifiable === 'allow' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
                        {t('x.unverifAllow')}
                    </button>
                    <button onClick={() => onUpdateSettings('platforms', { unverifiable: 'reject' })}
                        className={rules.unverifiable === 'reject' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
                        {t('x.unverifReject')}
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Marco común de las pestañas: encabezado con icono, título y subtítulo, como el resto del panel. */
export const TabShell: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
            <div className="p-3 bg-ds-raised rounded-lg">{icon}</div>
            <div>
                <h2 className="text-2xl font-black text-ds-text">{title}</h2>
                <p className="text-sm text-ds-soft">{subtitle}</p>
            </div>
        </div>
        {children}
    </div>
);

/** Pestaña «Plataformas»: dónde se puede participar y qué se puede comprobar en cada una. */
export const PlatformsTab: React.FC<SettingsExtrasProps> = (props) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
    <TabShell icon={<Globe2 className="w-6 h-6 text-ds-text" />} title={t('x.platTitle')} subtitle={t('x.platSub')}>
        <PlatformsSection {...props} />
    </TabShell>
    );
};

/** Pestaña «Mensajes»: lo que dice el bot y los avisos de rechazo. */
export const MessagesTab: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
    <TabShell icon={<MessageSquare className="w-6 h-6 text-ds-text" />} title={t('x.msgTitle')} subtitle={t('x.msgSub')}>
        <>
            {/* Mensajes del bot */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<MessageSquare className="w-5 h-5 text-ds-accent-text" />}
                    title={t('x.msgOther')}
                    text={t('x.msgOtherHint')}
                />
                <div className="space-y-4">
                    {MESSAGE_FIELDS.map((f) => (
                        <div key={f.key}>
                            <label className="block text-sm font-bold text-ds-soft mb-1">{t(`msgFields.f_${f.key}`)}</label>
                            <textarea
                                value={settings.messages[f.key]}
                                onChange={(e) => onUpdateSettings('messages', { [f.key]: e.target.value })}
                                placeholder={f.key === 'cancelled' ? t('messages.noMessage') : DEFAULT_SETTINGS_TEXTS[f.key]}
                                rows={2}
                                className="ds-input w-full resize-none"
                            />
                            <p className="text-xs text-ds-soft mt-1">{t(`msgFields.h_${f.key}`)}. {t('messages.variables')}: <code>{f.vars}</code></p>
                        </div>
                    ))}
                </div>
            </div>

            <CommandTextsSection settings={settings} onUpdateSettings={onUpdateSettings} />

            {/* Rechazos */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<ShieldAlert className="w-5 h-5 text-ds-accent-text" />}
                    title={t('x.rejTitle')}
                    text={t('x.rejHint')}
                />
                <Toggle
                    title={t('x.rejAnnounce')}
                    hint={t('x.rejAnnounceHint')}
                    value={settings.rejections.announceInChat}
                    onChange={(v) => onUpdateSettings('rejections', { announceInChat: v })}
                />
                <div className="space-y-3">
                    {REJECTION_REASONS.map((r) => (
                        <div key={r.code}>
                            <label className="block text-sm font-bold text-ds-soft mb-1">{t(`reasons.${r.code}`)}</label>
                            <input
                                type="text"
                                value={settings.rejections.messages[r.code] ?? ''}
                                onChange={(e) =>
                                    onUpdateSettings('rejections', { messages: { ...settings.rejections.messages, [r.code]: e.target.value } })
                                }
                                placeholder={r.text}
                                className="ds-input w-full"
                            />
                        </div>
                    ))}
                    <p className="text-xs text-ds-soft">Variables: <code>{'{user} {prize} {command} {count}'}</code></p>
                </div>
            </div>

        </>
    </TabShell>
    );
};

export const SettingsExtras: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
        <>

            {/* Pesos */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<Scale className="w-5 h-5 text-ds-accent-text" />}
                    title={t('x.wlTitle')}
                    text={t('x.wlHint')}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberField label={t('x.wlPer')} min={1} step={1} value={settings.weightLimits.maxPerFactor}
                        onChange={(v) => onUpdateSettings('weightLimits', { maxPerFactor: v })} hint={t('x.wlPerHint')} />
                    <NumberField label={t('x.wlTotal')} min={1} step={1} value={settings.weightLimits.maxTotal}
                        onChange={(v) => onUpdateSettings('weightLimits', { maxTotal: v })} hint={t('x.wlTotalHint')} />
                    <NumberField label={t('x.wlMin')} min={0.01} step={0.1} value={settings.weightLimits.min}
                        onChange={(v) => onUpdateSettings('weightLimits', { min: v })} hint={t('x.wlMinHint')} />
                </div>
            </div>

            {/* Recordatorios */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<BellRing className="w-5 h-5 text-ds-accent-text" />}
                    title={t('x.remTitle')}
                    text={t('x.remHint')}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberField label={t('x.remStop')} min={0} step={5} value={settings.reminders.stopBeforeEndSeconds}
                        onChange={(v) => onUpdateSettings('reminders', { stopBeforeEndSeconds: v })} hint={t('x.remStopHint')} />
                    <NumberField label={t('x.remMax')} min={0} step={1} value={settings.reminders.maxAgeHours}
                        onChange={(v) => onUpdateSettings('reminders', { maxAgeHours: v })} hint={t('x.remMaxHint')} />
                </div>
            </div>

            {/* Cuentas duplicadas */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<Users className="w-5 h-5 text-ds-accent-text" />}
                    title={t('x.dupTitle')}
                    text={t('x.dupHint')}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberField label={t('x.dupCreation')} min={0} step={0.5} value={settings.multiAccount.sameCreationDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { sameCreationDays: v })} hint={t('x.dupDefault1')} />
                    <NumberField label={t('x.dupFollow')} min={0} step={0.5} value={settings.multiAccount.sameFollowDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { sameFollowDays: v })} hint={t('x.dupDefault1')} />
                    <NumberField label={t('x.dupNew')} min={0} step={1} value={settings.multiAccount.newAccountDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { newAccountDays: v })} hint={t('x.dupNewHint')} />
                </div>
            </div>

            {/* Roles */}
            <div className="space-y-4">
                <SectionTitle icon={<UserCog className="w-5 h-5 text-ds-accent-text" />} title={t('x.rolesTitle')} />
                <Toggle
                    title={t('x.streamerJoin')}
                    hint={t('x.streamerJoinHint')}
                    value={settings.roles.streamerCanJoin}
                    onChange={(v) => onUpdateSettings('roles', { streamerCanJoin: v })}
                    on={t('x.canJoin')} off={t('x.cannotJoin')}
                />
                <Toggle
                    title={t('x.leadMod')}
                    hint={t('x.leadModHint')}
                    value={settings.roles.leadModCountsAsMod}
                    onChange={(v) => onUpdateSettings('roles', { leadModCountsAsMod: v })}
                    on={t('x.counts')} off={t('x.notCounts')}
                />
            </div>

        </>
    );
};

const CMD_CONTROL: { id: string; cmd: string }[] = [
    { id: 'start', cmd: 'start [premio] [duración]' },
    { id: 'choose', cmd: 'choose [usuario]' },
    { id: 'reroll', cmd: 'reroll [@usuario]' },
    { id: 'pick', cmd: 'pick <usuario>' },
    { id: 'finish', cmd: 'finish' },
    { id: 'close', cmd: 'close' },
    { id: 'open', cmd: 'open' },
    { id: 'cancel', cmd: 'cancel' },
    { id: 'status', cmd: 'status' },
];

/** Pestaña «Comandos»: todos los comandos disponibles y qué hace cada uno (los textos que responde el bot están en Mensajes). */
export const CommandsTab: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    const root = settings.commands.root || '!giveaway';
    const winners = settings.commands.winnersCommand;
    return (
        <TabShell icon={<Terminal className="w-6 h-6 text-ds-text" />} title={t('x.cmdTitle')} subtitle={t('x.cmdSub')}>
            <>
                <Toggle
                    title={t('x.cmdOn')}
                    hint={t('x.cmdOnHint')}
                    value={settings.commands.enabled}
                    onChange={(v) => onUpdateSettings('commands', { enabled: v })}
                />

                <div className="space-y-3">
                    <SectionTitle icon={<Terminal className="w-5 h-5 text-ds-accent-text" />} title={t('x.cmdControl')} text={t('x.cmdControlHint')} />
                    <div className="overflow-x-auto rounded-lg border border-ds-border">
                        <table className="w-full text-sm">
                            <tbody>
                                {CMD_CONTROL.map((c) => (
                                    <tr key={c.id} className="border-t first:border-t-0 border-ds-border align-top">
                                        <td className="px-3 py-2 whitespace-nowrap"><code className="text-ds-accent-text">{root} {c.cmd}</code></td>
                                        <td className="px-3 py-2 text-ds-soft">{t(`cmdWhat.${c.id}`)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-3">
                    <SectionTitle icon={<Terminal className="w-5 h-5 text-ds-accent-text" />} title={t('x.cmdViewers')} text={t('x.cmdViewersHint')} />
                    <div className="overflow-x-auto rounded-lg border border-ds-border">
                        <table className="w-full text-sm">
                            <tbody>
                                <tr className="border-t-0 border-ds-border align-top"><td className="px-3 py-2 whitespace-nowrap"><code className="text-ds-accent-text">{t('x.entryCmd')}</code></td><td className="px-3 py-2 text-ds-soft">{t('x.vEnter')}</td></tr>
                                <tr className="border-t border-ds-border align-top"><td className="px-3 py-2 whitespace-nowrap"><code className="text-ds-accent-text">{t('x.entryCmd')} salir</code></td><td className="px-3 py-2 text-ds-soft">{t('x.vLeave')} {settings.commands.viewerLeave ? '' : t('x.offTag')}</td></tr>
                                <tr className="border-t border-ds-border align-top"><td className="px-3 py-2 whitespace-nowrap"><code className="text-ds-accent-text">{t('x.entryCmd')} yo</code></td><td className="px-3 py-2 text-ds-soft">{t('x.vMe')} {settings.commands.viewerStatus ? '' : t('x.offTag')}</td></tr>
                                <tr className="border-t border-ds-border align-top"><td className="px-3 py-2 whitespace-nowrap"><code className="text-ds-accent-text">{winners || '(apagado)'}</code></td><td className="px-3 py-2 text-ds-soft">{t('x.vWinners')}</td></tr>
                                <tr className="border-t border-ds-border align-top"><td className="px-3 py-2 whitespace-nowrap"><em className="text-ds-soft">{t('x.vAny')}</em></td><td className="px-3 py-2 text-ds-soft">{t('x.vAnyHint')}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-4">
                    <SectionTitle icon={<Terminal className="w-5 h-5 text-ds-accent-text" />} title={t('x.cmdSettings')} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('x.cmdRoot')}</label>
                            <input type="text" className="ds-input w-full" value={settings.commands.root} placeholder="!giveaway"
                                onChange={(e) => onUpdateSettings('commands', { root: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('x.cmdRole')}</label>
                            <select className="ds-input w-full" value={settings.commands.minRole}
                                onChange={(e) => onUpdateSettings('commands', { minRole: e.target.value as GiveawaySettings['commands']['minRole'] })}>
                                <option value="moderator">{t('x.roleMod')}</option>
                                <option value="lead_moderator">{t('x.roleLead')}</option>
                                <option value="broadcaster">{t('x.roleBroad')}</option>
                            </select>
                            <p className="text-xs text-ds-soft mt-1">{t('x.roleHint')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">{t('x.cmdWinners')}</label>
                            <input type="text" className="ds-input w-full" value={settings.commands.winnersCommand} placeholder="!ganadores"
                                onChange={(e) => onUpdateSettings('commands', { winnersCommand: e.target.value })} />
                            <p className="text-xs text-ds-soft mt-1">{t('x.emptyOff')}</p>
                        </div>
                    </div>
                    <Toggle title={t('x.vCanLeave')} hint={t('x.vCanLeaveHint')} value={settings.commands.viewerLeave} onChange={(v) => onUpdateSettings('commands', { viewerLeave: v })} />
                    <Toggle title={t('x.vCanMe')} hint={t('x.vCanMeHint')} value={settings.commands.viewerStatus} onChange={(v) => onUpdateSettings('commands', { viewerStatus: v })} />
                </div>
            </>
        </TabShell>
    );
};

/** Textos con los que el bot responde a los comandos (viven en la pestaña Mensajes). */
const CommandTextsSection: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
    return (
    <div className="space-y-3">
        <SectionTitle icon={<Terminal className="w-5 h-5 text-ds-accent-text" />} title={t('x.cmdAnswers')} text={t('x.cmdAnswersHint')} />
                    {COMMAND_TEXTS.map((c) => (
                        <div key={c.key}>
                            <label className="block text-xs font-bold text-ds-soft mb-1">{t(`cmdTexts.${c.key}`)}{c.vars && <span className="font-normal"> · <code>{c.vars}</code></span>}</label>
                            <input type="text" className="ds-input w-full" value={settings.commands.texts[c.key] ?? ''} placeholder={c.text}
                                onChange={(e) => onUpdateSettings('commands', { texts: { ...settings.commands.texts, [c.key]: e.target.value } })} />
                        </div>
                    ))}
                </div>
    );
};
