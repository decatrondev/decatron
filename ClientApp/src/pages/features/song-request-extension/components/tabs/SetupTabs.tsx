import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CopyButton, Field, NumberInput, Select, Toggle, inputClass } from '../ui';
import { ROLES } from '../../constants/defaults';
import type { Role, TabId } from '../../types';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';

interface TabProps {
    cfg: SongRequestConfigState;
}

export function overlayUrls(channel: string, key: string) {
    const origin = window.location.origin;
    return {
        player: `${origin}/overlay/songrequest?channel=${channel}&key=${key}`,
        display: `${origin}/overlay/songrequest?channel=${channel}`,
    };
}

function UrlRow({ label, url, hint, secret }: { label: string; url: string; hint?: string; secret?: boolean }) {
    const { t } = useTranslation('overlays');
    return (
        <Field label={label} hint={hint}>
            <div className="flex gap-2">
                <input readOnly value={secret ? url.replace(/key=.*/, 'key=••••••••••••') : url} className={`${inputClass} font-mono text-xs 3xl:text-sm`} onFocus={e => e.target.select()} />
                <CopyButton text={url} label={t('songRequest.common.copy')} doneLabel={t('songRequest.common.copied')} />
            </div>
        </Field>
    );
}

// ── Guía ─────────────────────────────────────────────────────────────────

export function GuideTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: TabId) => void }) {
    const { t } = useTranslation('overlays');
    const s = cfg.server!;
    const urls = overlayUrls(s.channel, s.playerKey);
    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-[#2563eb] text-white font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] space-y-2">{body}</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {!cfg.enabled && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm 3xl:text-base">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        {t('songRequest.guide.disabledWarning')}{' '}
                        <button className="underline font-bold" onClick={() => onNavigate('basic')}>{t('songRequest.guide.goBasic')}</button>
                    </div>
                </div>
            )}
            <Card title={t('songRequest.guide.title')} description={t('songRequest.guide.description')}>
                <div className="space-y-6">
                    {step(1, t('songRequest.guide.step1Title'), <p>{t('songRequest.guide.step1Body')}</p>)}
                    {step(2, t('songRequest.guide.step2Title'), (
                        <>
                            <p>{t('songRequest.guide.step2Body')}</p>
                            <UrlRow label={t('songRequest.urls.player')} url={urls.player} secret hint={t('songRequest.urls.playerHint')} />
                        </>
                    ))}
                    {step(3, t('songRequest.guide.step3Title'), (
                        <>
                            <p>{t('songRequest.guide.step3Body')}</p>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('songRequest.guide.obs1')}</li>
                                <li>{t('songRequest.guide.obs2')}</li>
                                <li>{t('songRequest.guide.obs3')}</li>
                                <li>{t('songRequest.guide.obs4')}</li>
                            </ol>
                        </>
                    ))}
                    {step(4, t('songRequest.guide.step4Title'), (
                        <>
                            <p>{t('songRequest.guide.step4Body')}</p>
                            <UrlRow label={t('songRequest.urls.display')} url={urls.display} />
                        </>
                    ))}
                    {step(5, t('songRequest.guide.step5Title'), (
                        <>
                            <p>{t('songRequest.guide.step5Body')}</p>
                            <UrlRow label={t('songRequest.urls.public')} url={s.publicUrl} />
                        </>
                    ))}
                </div>
            </Card>
            <Card title={t('songRequest.guide.commandsTitle')}>
                <CommandList />
            </Card>
        </div>
    );
}

const COMMANDS: { cmd: string; key: string }[] = [
    { cmd: '!sr <link | nombre>', key: 'sr' }, { cmd: '!wrongsong', key: 'wrongsong' }, { cmd: '!queue', key: 'queue' },
    { cmd: '!song', key: 'song' }, { cmd: '!myqueue', key: 'myqueue' }, { cmd: '!skip', key: 'skip' },
    { cmd: '!srremove <#>', key: 'srremove' }, { cmd: '!sropen · !srclose', key: 'openclose' },
    { cmd: '!srpause · !srresume', key: 'pause' }, { cmd: '!srban [@usuario]', key: 'srban' },
];

function CommandList() {
    const { t } = useTranslation('overlays');
    return (
        <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
            {COMMANDS.map(c => (
                <div key={c.key} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-2">
                    <code className="font-mono text-sm 3xl:text-base font-bold text-[#2563eb] dark:text-[#60a5fa] sm:w-56 shrink-0">{c.cmd}</code>
                    <span className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8]">{t(`songRequest.commandHelp.${c.key}`)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Básico ───────────────────────────────────────────────────────────────

export function BasicTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const s = cfg.server!;
    const urls = overlayUrls(s.channel, s.playerKey);
    const set = cfg.settings;

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.basic.moduleTitle')}>
                <Toggle checked={cfg.enabled} onChange={cfg.toggleEnabled} label={t('songRequest.basic.enabled')} hint={t('songRequest.basic.enabledHint')} />
            </Card>

            <Card title={t('songRequest.basic.limitsTitle')} description={t('songRequest.basic.limitsDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label={t('songRequest.basic.maxQueue')} hint={t('songRequest.basic.zeroUnlimited')}>
                        <NumberInput value={set.maxQueueSize} min={0} max={500} onChange={v => cfg.updateSettings({ maxQueueSize: v })} />
                    </Field>
                    <Field label={t('songRequest.basic.maxPerUser')} hint={t('songRequest.basic.zeroUnlimited')}>
                        <NumberInput value={set.maxPerUser} min={0} max={100} onChange={v => cfg.updateSettings({ maxPerUser: v })} />
                    </Field>
                    <Field label={t('songRequest.basic.queuePreview')} hint={t('songRequest.basic.queuePreviewHint')}>
                        <NumberInput value={set.queuePreviewCount} min={1} max={10} onChange={v => cfg.updateSettings({ queuePreviewCount: v })} />
                    </Field>
                </div>
            </Card>

            <Card title={t('songRequest.basic.linksTitle')}>
                <div className="space-y-4">
                    <UrlRow label={t('songRequest.urls.player')} url={urls.player} secret hint={t('songRequest.urls.playerHint')} />
                    <UrlRow label={t('songRequest.urls.display')} url={urls.display} />
                    <UrlRow label={t('songRequest.urls.public')} url={s.publicUrl} />
                    <button
                        onClick={() => { if (window.confirm(t('songRequest.basic.regenerateConfirm'))) cfg.regenerateKey(); }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm 3xl:text-base font-bold bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                    >
                        <RefreshCw className="w-4 h-4" /> {t('songRequest.basic.regenerate')}
                    </button>
                </div>
            </Card>
        </div>
    );
}

// ── Comandos ─────────────────────────────────────────────────────────────

export function CommandsTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const set = cfg.settings;
    const roleOptions = ROLES.map(r => ({ value: r as Role, label: t(`songRequest.roles.${r}`) }));
    const setPerm = (patch: Partial<typeof set.permissions>) => cfg.updateSettings({ permissions: { ...set.permissions, ...patch } });

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.commands.permissionsTitle')} description={t('songRequest.commands.permissionsDescription')}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label={t('songRequest.commands.permRequest')} hint={t('songRequest.commands.permRequestHint')}>
                        <Select value={set.permissions.request} onChange={v => setPerm({ request: v })} options={roleOptions} />
                    </Field>
                    <Field label={t('songRequest.commands.permSkip')} hint={t('songRequest.commands.permSkipHint')}>
                        <Select value={set.permissions.skip} onChange={v => setPerm({ skip: v })} options={roleOptions} />
                    </Field>
                    <Field label={t('songRequest.commands.permManage')} hint={t('songRequest.commands.permManageHint')}>
                        <Select value={set.permissions.manage} onChange={v => setPerm({ manage: v })} options={roleOptions} />
                    </Field>
                </div>
                <p className="text-xs 3xl:text-sm text-[#94a3b8] mt-3">{t('songRequest.commands.controlTotalNote')}</p>
            </Card>

            <Card title={t('songRequest.commands.voteTitle')}>
                <div className="space-y-4">
                    <Toggle checked={set.skipVoteEnabled} onChange={v => cfg.updateSettings({ skipVoteEnabled: v })} label={t('songRequest.commands.voteEnabled')} hint={t('songRequest.commands.voteHint')} />
                    {set.skipVoteEnabled && (
                        <div className="max-w-xs">
                            <Field label={t('songRequest.commands.votesRequired')}>
                                <NumberInput value={set.skipVotesRequired} min={1} max={1000} onChange={v => cfg.updateSettings({ skipVotesRequired: v })} />
                            </Field>
                        </div>
                    )}
                </div>
            </Card>

            <Card title={t('songRequest.guide.commandsTitle')}>
                <CommandList />
            </Card>
        </div>
    );
}

// ── Mensajes ─────────────────────────────────────────────────────────────

const VARIABLES = ['{user}', '{title}', '{artist}', '{requester}', '{position}', '{url}', '{list}', '{count}', '{votes}', '{needed}', '{max}', '{target}', '{command}'];

export function MessagesTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const defaults = cfg.server!.messageDefaults;
    const custom = cfg.settings.messages;

    const setMessage = (key: string, value: string | null) => {
        const next = { ...custom };
        if (value === null) delete next[key];
        else next[key] = value;
        cfg.updateSettings({ messages: next });
    };

    return (
        <div className="space-y-6">
            <Card title={t('songRequest.messages.title')} description={t('songRequest.messages.description')}>
                <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map(v => <code key={v} className="px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#262626] text-xs 3xl:text-sm font-mono text-[#2563eb] dark:text-[#60a5fa]">{v}</code>)}
                </div>
            </Card>
            <Card>
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                    {Object.keys(defaults).map(key => {
                        const isCustom = key in custom;
                        const muted = isCustom && custom[key] === '';
                        return (
                            <div key={key} className="py-3 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t(`songRequest.messageKeys.${key}`, { defaultValue: key })}</span>
                                    <div className="flex gap-3 text-xs 3xl:text-sm">
                                        <button className="text-[#64748b] hover:text-[#1e293b] dark:hover:text-white underline" onClick={() => setMessage(key, muted ? null : '')}>
                                            {muted ? t('songRequest.messages.unmute') : t('songRequest.messages.mute')}
                                        </button>
                                        {isCustom && !muted && (
                                            <button className="text-[#64748b] hover:text-[#1e293b] dark:hover:text-white underline" onClick={() => setMessage(key, null)}>
                                                {t('songRequest.messages.reset')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {muted ? (
                                    <p className="text-xs 3xl:text-sm italic text-[#94a3b8]">{t('songRequest.messages.muted')}</p>
                                ) : (
                                    <textarea
                                        rows={2}
                                        maxLength={400}
                                        className={inputClass}
                                        placeholder={defaults[key]}
                                        value={isCustom ? custom[key] : ''}
                                        onChange={e => setMessage(key, e.target.value === '' ? null : e.target.value)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
