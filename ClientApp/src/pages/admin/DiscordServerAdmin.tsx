import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessagesSquare } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Progress, Segmented, Spinner, Switch } from '../../components/ds';
import { ConfigCard, ConfigHeader, ToggleRow, hintCls } from '../../components/dashboard/config';
import api from '../../services/api';

// Vista previa y carga de la plantilla del servidor de Discord (.dev/plans/DISCORD_SERVIDOR_PLAN.md). Textos: locales/{es,en}/discordserver.json.

interface TemplateInfo {
    name: string; version: string; roles: { active: number; total: number }; categories: { active: number; total: number };
    channels: { active: number; total: number }; languages: string[]; invite: { admin: string; minimal: string };
}
interface Item { seq: number; phase: string; kind: string; key: string; name: string; op: string; code: string; args: string[]; detail: string }
interface Preview {
    guild: { id: string; name: string; community: boolean; botIsAdmin: boolean }; hash: string; hasActions: boolean; counts: Record<string, number>; items: Item[];
}
interface Result { seq: number; kind: string; key: string; name: string; status: string; message: string }
interface Job { status: string; error: string | null; total: number; done: number; failed: number; results: Result[] }

const OP_TONE: Record<string, 'accent' | 'ok' | 'warn' | 'danger' | undefined> = {
    create: 'ok', update: 'ok', convert: 'ok', adopt: 'accent', blocked: 'danger', warn: 'warn', manual: 'warn', skip: undefined,
};

export default function DiscordServerAdmin() {
    const { t } = useTranslation('discordserver');
    const navigate = useNavigate();
    const [info, setInfo] = useState<TemplateInfo | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [guildId, setGuildId] = useState('');
    const [opts, setOpts] = useState({ applyGuildSettings: false, enableCommunity: false, postSeedMessages: true, applyAutomod: false });
    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'actions' | 'all'>('actions');
    const [confirmName, setConfirmName] = useState('');
    const [job, setJob] = useState<Job | null>(null);
    const [starting, setStarting] = useState(false);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        api.get('/admin/discord-server/template').then(r => setInfo(r.data)).catch(() => setLoadError(true));
        return () => { if (timer.current) window.clearInterval(timer.current); };
    }, []);

    const runPreview = useCallback(async () => {
        setPreviewing(true); setError(null); setJob(null); setConfirmName('');
        try {
            const res = await api.post('/admin/discord-server/preview', { guildId: guildId.trim(), ...opts });
            if (res.data?.success) setPreview(res.data as Preview);
            else { setPreview(null); setError(res.data?.code ?? 'unexpected'); }
        } catch (e: any) {
            setPreview(null); setError(e?.response?.data?.code ?? 'unexpected');
        } finally { setPreviewing(false); }
    }, [guildId, opts]);

    const poll = (id: string) => {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = window.setInterval(async () => {
            try {
                const res = await api.get(`/admin/discord-server/jobs/${id}`);
                setJob(res.data as Job);
                if (res.data.status !== 'running' && timer.current) { window.clearInterval(timer.current); timer.current = null; }
            } catch { /* se reintenta en el siguiente ciclo */ }
        }, 1500);
    };

    const apply = async () => {
        if (!preview) return;
        setStarting(true); setError(null);
        try {
            const res = await api.post('/admin/discord-server/apply', { guildId: guildId.trim(), ...opts, planHash: preview.hash, confirmGuildName: confirmName });
            if (res.data?.jobId && res.data.status === 'running') { setJob({ status: 'running', error: null, total: res.data.total, done: 0, failed: 0, results: [] }); poll(res.data.jobId); }
            else setError(res.data?.error ?? 'unexpected');
        } catch { setError('unexpected'); }
        finally { setStarting(false); }
    };

    const detailText = (i: Item) => {
        const params: Record<string, string> = {};
        i.args.forEach((a, n) => { params[`a${n}`] = a; });
        return t(`detail.${i.code}`, { ...params, defaultValue: i.detail });
    };

    const phases = preview ? Array.from(new Set(preview.items.map(i => i.phase))) : [];
    const visible = (i: Item) => view === 'all' || !['skip'].includes(i.op);
    const nameOk = preview != null && confirmName === preview.guild.name;
    const idOk = /^\d{15,22}$/.test(guildId.trim());

    if (loadError) return <div className="panel-scale"><Alert tone="danger">{t('loadFailed')}</Alert></div>;
    if (!info) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<MessagesSquare />} title={t('title')} subtitle={t('subtitle')} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ConfigCard icon={<MessagesSquare />} title={t('guide.title')}>
                    <p className="text-sm text-ds-soft mb-3">{t('guide.intro')}</p>
                    <ol className="list-decimal pl-5 space-y-1.5 text-sm text-ds-text">
                        {[1, 2, 3, 4, 5, 6].map(n => <li key={n}>{t(`guide.step${n}`)}</li>)}
                    </ol>
                </ConfigCard>

                <ConfigCard icon={<MessagesSquare />} title={`${t('template.title')}: ${info.name}`} hint={t('template.version', { v: info.version })}>
                    <ul className="text-sm text-ds-text space-y-1">
                        <li>{t('template.roles', { a: info.roles.active, t: info.roles.total })}</li>
                        <li>{t('template.categories', { a: info.categories.active, t: info.categories.total })}</li>
                        <li>{t('template.channels', { a: info.channels.active, t: info.channels.total })}</li>
                        <li>{t('template.languages', { l: info.languages.join(', ').toUpperCase() })}</li>
                    </ul>
                    <div className="flex flex-wrap gap-3 mt-4 text-sm">
                        <a href={info.invite.admin} target="_blank" rel="noopener noreferrer" className="font-bold text-ds-accent-text hover:underline">{t('template.inviteAdmin')} →</a>
                        <a href={info.invite.minimal} target="_blank" rel="noopener noreferrer" className="font-bold text-ds-accent-text hover:underline">{t('template.inviteMinimal')} →</a>
                    </div>
                </ConfigCard>
            </div>

            <ConfigCard icon={<MessagesSquare />} title={t('form.title')}>
                <div className="space-y-5">
                    <Field label={t('form.guildId')} hint={t('form.guildIdHint')}>
                        <Input inputMode="numeric" value={guildId} placeholder={t('form.guildIdPlaceholder')} maxLength={22}
                            onChange={e => setGuildId(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                    <ToggleRow title={t('form.optMessages')} description={t('form.optMessagesHint')} checked={opts.postSeedMessages} onChange={v => setOpts(o => ({ ...o, postSeedMessages: v }))} />
                    <ToggleRow title={t('form.optSettings')} description={t('form.optSettingsHint')} checked={opts.applyGuildSettings} onChange={v => setOpts(o => ({ ...o, applyGuildSettings: v }))} />
                    <ToggleRow title={t('form.optCommunity')} description={t('form.optCommunityHint')} checked={opts.enableCommunity} onChange={v => setOpts(o => ({ ...o, enableCommunity: v }))} />
                    <ToggleRow title={t('form.optAutomod')} description={t('form.optAutomodHint')} checked={opts.applyAutomod} onChange={v => setOpts(o => ({ ...o, applyAutomod: v }))} />
                    <Button onClick={runPreview} loading={previewing} disabled={previewing || !idOk}>{previewing ? t('form.previewing') : t('form.preview')}</Button>
                </div>
            </ConfigCard>

            {error && <Alert tone="danger">{t(`errors.${error}`, { defaultValue: t('errors.unexpected') })}</Alert>}

            {preview && (
                <ConfigCard icon={<MessagesSquare />} title={t('summary.title')} hint={t('summary.server', { name: preview.guild.name })}>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Badge tone={preview.guild.community ? 'ok' : 'warn'}>{preview.guild.community ? t('summary.community') : t('summary.noCommunity')}</Badge>
                        <Badge tone={preview.guild.botIsAdmin ? 'ok' : 'warn'}>{preview.guild.botIsAdmin ? t('summary.botAdmin') : t('summary.botNotAdmin')}</Badge>
                        {Object.entries(preview.counts).map(([op, n]) => <Badge key={op} tone={OP_TONE[op]}>{t(`ops.${op}`)}: {n}</Badge>)}
                    </div>
                    {!preview.hasActions && <Alert tone="ok">{t('summary.nothing')}</Alert>}
                    <div className="my-4">
                        <Segmented value={view} onChange={v => setView(v as 'actions' | 'all')}
                            items={[{ id: 'actions', label: t('summary.onlyActions') }, { id: 'all', label: t('summary.all') }]} />
                    </div>

                    <div className="space-y-6">
                        {phases.map(ph => {
                            const items = preview.items.filter(i => i.phase === ph && visible(i));
                            if (items.length === 0) return null;
                            return (
                                <div key={ph}>
                                    <h3 className="text-sm font-black text-ds-text mb-2">{t(`phases.${ph}`)}</h3>
                                    <ul className="space-y-1.5">
                                        {items.map(i => (
                                            <li key={i.seq} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 rounded-lg bg-ds-bg border border-ds-border">
                                                <span className="min-w-[8rem]"><Badge tone={OP_TONE[i.op]}>{t(`ops.${i.op}`)}</Badge></span>
                                                <span className="font-semibold text-sm text-ds-text break-all">{i.kind === 'manual' ? t(`manualNames.${i.key}`, { defaultValue: i.name }) : i.name}</span>
                                                <span className="text-xs text-ds-soft basis-full sm:basis-auto sm:flex-1">{detailText(i)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </ConfigCard>
            )}

            {preview && preview.hasActions && (
                <ConfigCard icon={<MessagesSquare />} title={t('apply.title')} hint={t('apply.intro')}>
                    <div className="space-y-4">
                        {(preview.counts['blocked'] ?? 0) > 0 && <Alert tone="warn">{t('apply.hasBlocked')}</Alert>}
                        <Field label={t('apply.confirmLabel')} hint={preview.guild.name}>
                            <Input value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder={preview.guild.name} />
                        </Field>
                        <Button onClick={apply} loading={starting || job?.status === 'running'} disabled={!nameOk || starting || job?.status === 'running'}>{t('apply.button')}</Button>
                    </div>
                </ConfigCard>
            )}

            {job && (
                <ConfigCard icon={<MessagesSquare />} title={t('apply.results')}>
                    <div className="space-y-4">
                        {job.status === 'running' && <>
                            <p className="text-sm text-ds-soft">{t('apply.running', { done: job.done, total: job.total })}</p>
                            <Progress value={job.total > 0 ? Math.round((job.done / job.total) * 100) : 0} />
                        </>}
                        {job.status === 'done' && <Alert tone={job.failed > 0 ? 'warn' : 'ok'}>{t('apply.done', { done: job.done, failed: job.failed })}</Alert>}
                        {job.status === 'failed' && <Alert tone="danger">{t(`errors.${job.error ?? 'unexpected'}`, { defaultValue: t('apply.failed') })}</Alert>}
                        {job.failed > 0 && (
                            <ul className="space-y-1.5">
                                {job.results.filter(r => r.status === 'failed').map(r => (
                                    <li key={r.seq} className="px-3 py-2 rounded-lg bg-ds-bg border border-ds-border text-sm">
                                        <Badge tone="danger">{t('apply.failedStatus')}</Badge> <span className="font-semibold text-ds-text">{r.name}</span>
                                        <span className={`${hintCls} ml-2`}>{r.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {job.status !== 'running' && <Button variant="secondary" onClick={runPreview}>{t('apply.again')}</Button>}
                    </div>
                </ConfigCard>
            )}
        </div>
    );
}
