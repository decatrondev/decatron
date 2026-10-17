import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, Input, Spinner } from '../../../components/ds';
import PlatformByoSection, { type ByoSummary } from '../../admin/PlatformByoSection';
import buyerApi from '../../../services/buyerApi';

// Pieza D: el comprador carga SUS credenciales. Secretos solo de escritura: nunca vuelven del servidor, solo «configurado, …últimos 4».
interface AppSummary { clientId: string; secretHint: string | null; status: string; lastValidatedAt: string | null }
interface BotSummary { username: string; linkedAt: string | null }
interface DiscordSummary { botName: string; linkedAt: string | null }
interface GatewayState { status: string; guilds: number; intentsMissing: boolean }
interface EventSubState { status: string; shards: number; shardsConnected: number; error: string | null }
interface Data {
    tenant: { slug: string; name: string; status: string };
    redirectUri: string;
    twitchApp: AppSummary | null; twitchBot: BotSummary | null; discordBot: DiscordSummary | null;
    byo: Record<string, ByoSummary | null>;
    byoAllowed: Record<string, boolean>;
    gateway: GatewayState | null; eventSub: EventSubState | null;
}
type Note = { ok: boolean; text: string } | null;

const BASE = '/platform/buyer';

// Fuera del componente: si se declarara dentro, cada tecla lo remontaria y los campos perderian el foco.
function Section({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
    return (
        <Card><div className="p-5 space-y-3">
            <div><h2 className="text-lg font-bold text-ds-text">{title}</h2>{help && <p className="text-sm text-ds-soft mt-1 leading-relaxed">{help}</p>}</div>
            {children}
        </div></Card>
    );
}

export default function BuyerSetup() {
    const { t, i18n } = useTranslation('platform');
    const [data, setData] = useState<Data | null>(null);
    const [failed, setFailed] = useState(false);
    const [note, setNote] = useState<Note>(null);
    const [busy, setBusy] = useState(false);
    const [clientId, setClientId] = useState('');
    const [secret, setSecret] = useState('');
    const [editApp, setEditApp] = useState(false);
    const [discordToken, setDiscordToken] = useState('');
    const [editDiscord, setEditDiscord] = useState(false);
    const [botUrl, setBotUrl] = useState('');
    const [confirm, setConfirm] = useState<'app' | 'bot' | 'discord' | null>(null);

    const load = useCallback(async () => {
        try { const r = await buyerApi.get(`${BASE}/tenant`); setData(r.data); setFailed(false); }
        catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const errText = (code?: string) => t(`tenants.errors.${code}`, { defaultValue: t('tenants.errors.generic') });
    const run = async (fn: () => Promise<unknown>, okText: string, after?: () => void) => {
        setBusy(true); setNote(null);
        try { await fn(); setNote({ ok: true, text: okText }); after?.(); await load(); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };
    const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => setNote({ ok: true, text: t('buyer.setup.copied') })).catch(() => { /* sin portapapeles */ }); };

    const saveApp = () => run(() => buyerApi.put(`${BASE}/twitch-app`, { clientId, clientSecret: secret }), t('tenants.saved'),
        () => { setEditApp(false); setClientId(''); setSecret(''); }); // el secreto no se queda en la memoria de la pantalla
    const saveDiscord = () => run(async () => {
        const r = await buyerApi.put(`${BASE}/discord-bot`, { token: discordToken });
        if (r.data?.gateway?.intentsMissing) throw { response: { data: { code: 'intents_missing' } } };
    }, t('tenants.discordConnected'), () => { setEditDiscord(false); setDiscordToken(''); });
    const makeBotLink = () => run(async () => { const r = await buyerApi.post(`${BASE}/bot-link`); setBotUrl(r.data.url); }, t('buyer.setup.linkReady'));

    if (failed) return <Alert tone="danger">{t('buyer.errorLoad')}</Alert>;
    if (!data) return <div className="text-center"><Spinner /></div>;

    const app = data.twitchApp;
    const es = data.eventSub;
    const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(i18n.language) : '—');
    return (
        <div className="space-y-5">
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            <Section title={t('buyer.setup.appTitle')} help={t('buyer.setup.appHelp')}>
                <div className="flex flex-wrap items-center gap-2">
                    {app ? <Badge tone={app.status === 'ok' ? 'ok' : 'warn'}>{t(`tenants.status.${app.status}`, { defaultValue: app.status })}</Badge> : <Badge>{t('tenants.notConfigured')}</Badge>}
                    {app && <span className="text-sm text-ds-soft break-all">{app.clientId}</span>}
                    {app?.secretHint && <span className="text-sm text-ds-faint">{t('tenants.secretSet', { hint: app.secretHint })}</span>}
                </div>
                <Field label={t('tenants.redirectUri')} hint={t('buyer.setup.redirectHint')}>
                    <div className="flex gap-2">
                        <Input readOnly value={data.redirectUri} onFocus={e => e.currentTarget.select()} />
                        <Button variant="secondary" onClick={() => copy(data.redirectUri)} aria-label={t('tenants.copy')}><Copy className="w-4 h-4" aria-hidden /></Button>
                    </div>
                </Field>
                {editApp || !app ? (
                    <div className="space-y-3">
                        <Field label={t('tenants.clientId')}><Input value={clientId} autoComplete="off" spellCheck={false} onChange={e => setClientId(e.target.value)} /></Field>
                        <Field label={t('tenants.clientSecret')} hint={t('tenants.secretHint')}>
                            <Input type="password" value={secret} autoComplete="new-password" spellCheck={false} onChange={e => setSecret(e.target.value)} />
                        </Field>
                        <div className="flex gap-2">
                            <Button loading={busy} disabled={clientId.trim().length < 20 || secret.trim().length < 20} onClick={saveApp}>{t('tenants.validateSave')}</Button>
                            {app && <Button variant="ghost" onClick={() => { setEditApp(false); setClientId(''); setSecret(''); }}>{t('tenants.close')}</Button>}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setEditApp(true)}>{t('tenants.replace')}</Button>
                        {confirm === 'app'
                            ? <Button variant="danger" loading={busy} onClick={() => run(() => buyerApi.delete(`${BASE}/twitch-app`), t('tenants.deleted'), () => setConfirm(null))}>{t('buyer.setup.confirmRemove')}</Button>
                            : <Button variant="ghost" onClick={() => setConfirm('app')}>{t('tenants.remove')}</Button>}
                    </div>
                )}
            </Section>

            <Section title={t('buyer.setup.botTitle')} help={t('buyer.setup.botHelp')}>
                <div className="flex flex-wrap items-center gap-2">
                    {data.twitchBot ? <><Badge tone="ok">{data.twitchBot.username}</Badge><span className="text-sm text-ds-faint">{t('tenants.botLinkedAt', { date: date(data.twitchBot.linkedAt) })}</span></> : <Badge>{t('tenants.botNone')}</Badge>}
                </div>
                {!app && <Alert tone="info">{t('tenants.errors.app_required')}</Alert>}
                {botUrl ? (
                    <div className="space-y-2">
                        <Alert tone="info">{t('buyer.setup.botLinkHelp')}</Alert>
                        <div className="flex flex-wrap gap-2">
                            <a href={botUrl} target="_blank" rel="noopener noreferrer"><Button><ExternalLink className="w-4 h-4 mr-1.5" aria-hidden />{t('buyer.setup.openLink')}</Button></a>
                            <Button variant="secondary" onClick={() => copy(botUrl)}>{t('tenants.copy')}</Button>
                            <Button variant="ghost" onClick={() => { setBotUrl(''); load(); }}>{t('buyer.setup.done')}</Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Button loading={busy} disabled={!app} onClick={makeBotLink}>{data.twitchBot ? t('tenants.botRelink') : t('tenants.botLink')}</Button>
                        {data.twitchBot && (confirm === 'bot'
                            ? <Button variant="danger" loading={busy} onClick={() => run(() => buyerApi.delete(`${BASE}/bot`), t('tenants.botUnlinked'), () => setConfirm(null))}>{t('buyer.setup.confirmRemove')}</Button>
                            : <Button variant="ghost" onClick={() => setConfirm('bot')}>{t('tenants.botUnlink')}</Button>)}
                    </div>
                )}
            </Section>

            <Section title={t('buyer.setup.eventsTitle')} help={t('buyer.setup.eventsHelp')}>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={es?.status === 'connected' ? 'ok' : es?.status === 'failed' ? 'danger' : 'warn'}>{t(`tenants.eventSubStatus.${es?.status ?? 'stopped'}`)}</Badge>
                    {es && es.shards > 0 && <span className="text-sm text-ds-soft">{t('tenants.eventSubShards', { n: es.shardsConnected, total: es.shards })}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" loading={busy} disabled={!app || !data.twitchBot} onClick={() => run(() => buyerApi.post(`${BASE}/eventsub/restart`), t('tenants.eventSubOk'))}>{t('tenants.eventSubRestart')}</Button>
                </div>
            </Section>

            <Section title={t('buyer.setup.discordTitle')} help={t('buyer.setup.discordHelp')}>
                <div className="flex flex-wrap items-center gap-2">
                    {data.discordBot ? <><Badge tone={data.gateway?.status === 'connected' ? 'ok' : 'warn'}>{data.discordBot.botName}</Badge>
                        {data.gateway && <span className="text-sm text-ds-soft">{t('tenants.discordGuilds', { n: data.gateway.guilds, mb: 0 })}</span>}</> : <Badge>{t('tenants.discordNone')}</Badge>}
                </div>
                {editDiscord || !data.discordBot ? (
                    <div className="space-y-3">
                        <Field label={t('tenants.discordToken')} hint={t('tenants.discordTokenHint')}>
                            <Input type="password" value={discordToken} autoComplete="new-password" spellCheck={false} onChange={e => setDiscordToken(e.target.value)} />
                        </Field>
                        <div className="flex gap-2">
                            <Button loading={busy} disabled={discordToken.trim().length < 50} onClick={saveDiscord}>{t('tenants.validateSave')}</Button>
                            {data.discordBot && <Button variant="ghost" onClick={() => { setEditDiscord(false); setDiscordToken(''); }}>{t('tenants.close')}</Button>}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setEditDiscord(true)}>{t('tenants.discordReplace')}</Button>
                        <Button variant="ghost" loading={busy} onClick={() => run(() => buyerApi.post(`${BASE}/discord-bot/restart`), t('tenants.discordConnected'))}>{t('tenants.discordRestart')}</Button>
                        {confirm === 'discord'
                            ? <Button variant="danger" loading={busy} onClick={() => run(() => buyerApi.delete(`${BASE}/discord-bot`), t('tenants.discordRemoved'), () => setConfirm(null))}>{t('buyer.setup.confirmRemove')}</Button>
                            : <Button variant="ghost" onClick={() => setConfirm('discord')}>{t('tenants.discordRemove')}</Button>}
                    </div>
                )}
            </Section>

            <Card><div className="p-5">
                <PlatformByoSection tenantId={0} tenantName={data.tenant.name} byo={data.byo} allowed={data.byoAllowed} onChanged={load} client={buyerApi} basePath={`${BASE}/byo`} />
            </div></Card>
        </div>
    );
}
