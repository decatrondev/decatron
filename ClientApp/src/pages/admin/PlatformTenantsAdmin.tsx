import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Spinner } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import { ConfigCard, ConfigHeader } from '../../components/dashboard/config';
import api from '../../services/api';
import PlatformPlanModal from './PlatformPlanModal';

// Tenants de la plataforma (decatron.top). .dev/plans/plataforma/FASE4_DISENO.md, paso 4.
// El dueño carga aquí la app de Twitch de cada tenant. Los secretos son SOLO ESCRITURA: nunca se devuelven, solo «configurado, …últimos 4».

interface AppSummary { clientId: string; redirectUri: string | null; scopes: string | null; secretHint: string | null; status: string; lastValidatedAt: string | null }
interface BotSummary { username: string; twitchId: string; linkedAt: string | null }
interface DiscordSummary { botId: string; botName: string; linkedAt: string | null }
interface GatewayState { status: string; guilds: number; error: string | null; intentsMissing: boolean; memoryDeltaMb: number }
interface EventSubState { status: string; conduitId: string | null; shards: number; shardsConnected: number; error: string | null; lastEventAt: string | null }
interface SyncResult { channels: number; created: number; existing: number; errors: number; at: string }
interface Tenant { id: number; slug: string; name: string; status: string; mode: string; twitchApp: AppSummary | null; twitchBot: BotSummary | null; discordBot: DiscordSummary | null; gateway: GatewayState | null; eventSub: EventSubState | null; eventSubSync: SyncResult | null }
interface Form { clientId: string; clientSecret: string; redirectUri: string; scopes: string }

const EMPTY: Form = { clientId: '', clientSecret: '', redirectUri: '', scopes: '' };

export default function PlatformTenantsAdmin() {
    const { t, i18n } = useTranslation('platform');
    const navigate = useNavigate();
    const [items, setItems] = useState<Tenant[] | null>(null);
    const [totals, setTotals] = useState<{ connected: number; cap: number; rssMb: number } | null>(null);
    const [discordFor, setDiscordFor] = useState<Tenant | null>(null);
    const [discordToken, setDiscordToken] = useState('');
    const [rmDiscord, setRmDiscord] = useState<Tenant | null>(null);
    const [error, setError] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState<Tenant | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [toDelete, setToDelete] = useState<Tenant | null>(null);
    const [busy, setBusy] = useState(false);
    const [botLink, setBotLink] = useState<{ tenant: Tenant; url: string } | null>(null);
    const [unlinkBot, setUnlinkBot] = useState<Tenant | null>(null);
    const [planFor, setPlanFor] = useState<Tenant | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/platform/tenants');
            setItems(res.data.items);
            setTotals(res.data.gateways ?? null);
            setError(false);
        } catch { setError(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language);
    const errText = (code?: string) => t(`tenants.errors.${code}`, { defaultValue: t('tenants.errors.generic') });

    const openEdit = (row: Tenant) => {
        setForm({ ...EMPTY, clientId: row.twitchApp?.clientId ?? '', redirectUri: row.twitchApp?.redirectUri ?? '', scopes: row.twitchApp?.scopes ?? '' });
        setEditing(row);
    };

    const save = async () => {
        if (!editing) return;
        setBusy(true);
        try {
            await api.put(`/admin/platform/tenants/${editing.id}/twitch-app`, form);
            setNote({ ok: true, text: t('tenants.saved') });
            setEditing(null);
            setForm(EMPTY); // el secreto no se queda en memoria de la pantalla
            await load();
        } catch (e: any) {
            setNote({ ok: false, text: errText(e?.response?.data?.code) });
        }
        setBusy(false);
    };

    const remove = async () => {
        if (!toDelete) return;
        setBusy(true);
        try {
            await api.delete(`/admin/platform/tenants/${toDelete.id}/twitch-app`);
            setNote({ ok: true, text: t('tenants.deleted') });
            setToDelete(null);
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const makeBotLink = async (row: Tenant) => {
        setBusy(true);
        try {
            const res = await api.post(`/admin/platform/tenants/${row.id}/bot-link`);
            setBotLink({ tenant: row, url: res.data.url });
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const removeBot = async () => {
        if (!unlinkBot) return;
        setBusy(true);
        try {
            await api.delete(`/admin/platform/tenants/${unlinkBot.id}/bot`);
            setNote({ ok: true, text: t('tenants.botUnlinked') });
            setUnlinkBot(null);
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const saveDiscord = async () => {
        if (!discordFor) return;
        setBusy(true);
        try {
            const res = await api.put(`/admin/platform/tenants/${discordFor.id}/discord-bot`, { token: discordToken });
            const g: GatewayState | undefined = res.data.gateway;
            setNote(g?.status === 'connected' ? { ok: true, text: t('tenants.discordConnected') }
                : { ok: false, text: g?.intentsMissing ? t('tenants.errors.intents_missing') : t('tenants.discordSavedNotConnected') });
            setDiscordFor(null);
            setDiscordToken(''); // el token no se queda en memoria de la pantalla
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const restartEventSub = async (row: Tenant) => {
        setBusy(true);
        try {
            const res = await api.post(`/admin/platform/tenants/${row.id}/eventsub/restart`);
            const st: EventSubState | null = res.data.eventSub;
            setNote(st?.status === 'connected' ? { ok: true, text: t('tenants.eventSubOk') } : { ok: false, text: t(`tenants.errors.${st?.error ?? st?.status ?? 'generic'}`, { defaultValue: t('tenants.errors.generic') }) });
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const syncEventSub = async (row: Tenant) => {
        setBusy(true);
        try { await api.post(`/admin/platform/tenants/${row.id}/eventsub/sync`); await load(); setNote({ ok: true, text: t('tenants.eventSubSynced') }); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const restartDiscord = async (row: Tenant) => {
        setBusy(true);
        try { await api.post(`/admin/platform/tenants/${row.id}/discord-bot/restart`); await load(); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const removeDiscord = async () => {
        if (!rmDiscord) return;
        setBusy(true);
        try {
            await api.delete(`/admin/platform/tenants/${rmDiscord.id}/discord-bot`);
            setNote({ ok: true, text: t('tenants.discordRemoved') });
            setRmDiscord(null);
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    if (error) return <div className="panel-scale"><Alert tone="danger">{t('tenants.loadFailed')}</Alert></div>;
    if (!items) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<KeyRound />} title={t('tenants.title')} subtitle={t('tenants.subtitle')} />
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}
            {totals && <p className="text-sm text-ds-soft">{t('tenants.gatewayTotals', { connected: totals.connected, cap: totals.cap, rss: totals.rssMb })}</p>}

            {items.map(row => (
                <ConfigCard key={row.id} icon={<KeyRound />} title={`${row.name} (#${row.id})`} hint={row.slug}>
                    {row.id === 1 ? (
                        <p className="text-sm text-ds-soft">{t('tenants.legacy')}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={row.twitchApp?.status === 'ok' ? 'ok' : 'warn'}>
                                    {row.twitchApp ? t(`tenants.status.${row.twitchApp.status}`, { defaultValue: row.twitchApp.status }) : t('tenants.notConfigured')}
                                </Badge>
                                {row.twitchApp?.secretHint && <span className="text-sm text-ds-soft">{t('tenants.secretSet', { hint: row.twitchApp.secretHint })}</span>}
                            </div>
                            {row.twitchApp && (
                                <dl className="text-sm grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
                                    <dt className="text-ds-soft">{t('tenants.clientId')}</dt><dd className="text-ds-text break-all">{row.twitchApp.clientId}</dd>
                                    <dt className="text-ds-soft">{t('tenants.redirectUri')}</dt><dd className="text-ds-text break-all">{row.twitchApp.redirectUri ?? '—'}</dd>
                                    <dt className="text-ds-soft">{t('tenants.validatedAt')}</dt><dd className="text-ds-text">{row.twitchApp.lastValidatedAt ? fmt(row.twitchApp.lastValidatedAt) : '—'}</dd>
                                </dl>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setPlanFor(row)}>{t('tenants.plan.button')}</Button>
                                <Button size="sm" onClick={() => openEdit(row)}>{row.twitchApp ? t('tenants.replace') : t('tenants.load')}</Button>
                                {row.twitchApp && (
                                    <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={() => setToDelete(row)}>{t('tenants.remove')}</Button>
                                )}
                            </div>
                            {row.twitchApp && (
                                <div className="pt-3 border-t border-ds-border space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-ds-text">{t('tenants.botTitle')}</span>
                                        <Badge tone={row.twitchBot ? 'ok' : 'warn'}>{row.twitchBot ? `@${row.twitchBot.username}` : t('tenants.botNone')}</Badge>
                                        {row.twitchBot?.linkedAt && <span className="text-sm text-ds-soft">{t('tenants.botLinkedAt', { date: fmt(row.twitchBot.linkedAt) })}</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" loading={busy} onClick={() => makeBotLink(row)}>{row.twitchBot ? t('tenants.botRelink') : t('tenants.botLink')}</Button>
                                        {row.twitchBot && <Button size="sm" variant="ghost" onClick={() => setUnlinkBot(row)}>{t('tenants.botUnlink')}</Button>}
                                    </div>
                                </div>
                            )}
                            <div className="pt-3 border-t border-ds-border space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-ds-text">{t('tenants.eventSubTitle')}</span>
                                    <Badge tone={row.eventSub?.status === 'connected' ? 'ok' : 'warn'}>
                                        {t(`tenants.eventSubStatus.${row.eventSub?.status ?? 'stopped'}`, { defaultValue: row.eventSub?.status ?? 'stopped' })}
                                    </Badge>
                                    {row.eventSub?.status === 'connected' && <span className="text-sm text-ds-soft">{t('tenants.eventSubShards', { n: row.eventSub.shardsConnected, total: row.eventSub.shards })}</span>}
                                    {row.eventSub?.lastEventAt && <span className="text-sm text-ds-soft">{t('tenants.eventSubLast', { date: fmt(row.eventSub.lastEventAt) })}</span>}
                                </div>
                                {row.eventSubSync && <p className="text-sm text-ds-soft">{t('tenants.eventSubSync', { channels: row.eventSubSync.channels, created: row.eventSubSync.created, existing: row.eventSubSync.existing, errors: row.eventSubSync.errors })}</p>}
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" loading={busy} onClick={() => restartEventSub(row)}>{t('tenants.eventSubRestart')}</Button>
                                    {row.eventSub?.status === 'connected' && <Button size="sm" variant="ghost" loading={busy} onClick={() => syncEventSub(row)}>{t('tenants.eventSubSyncBtn')}</Button>}
                                </div>
                            </div>
                            <div className="pt-3 border-t border-ds-border space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-bold text-ds-text">{t('tenants.discordTitle')}</span>
                                    {row.discordBot ? (
                                        <Badge tone={row.gateway?.status === 'connected' ? 'ok' : 'warn'}>
                                            {row.discordBot.botName} · {t(`tenants.gatewayStatus.${row.gateway?.status ?? 'stopped'}`, { defaultValue: row.gateway?.status ?? 'stopped' })}
                                        </Badge>
                                    ) : <Badge tone="warn">{t('tenants.discordNone')}</Badge>}
                                    {row.gateway?.status === 'connected' && <span className="text-sm text-ds-soft">{t('tenants.discordGuilds', { n: row.gateway.guilds, mb: row.gateway.memoryDeltaMb })}</span>}
                                </div>
                                {row.gateway?.error && <Alert tone="danger">{t(`tenants.errors.${row.gateway.error}`, { defaultValue: t('tenants.errors.generic') })}</Alert>}
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => { setDiscordToken(''); setDiscordFor(row); }}>{row.discordBot ? t('tenants.discordReplace') : t('tenants.discordLoad')}</Button>
                                    {row.discordBot && <Button size="sm" variant="ghost" loading={busy} onClick={() => restartDiscord(row)}>{t('tenants.discordRestart')}</Button>}
                                    {row.discordBot && <Button size="sm" variant="ghost" onClick={() => setRmDiscord(row)}>{t('tenants.discordRemove')}</Button>}
                                </div>
                            </div>
                        </div>
                    )}
                </ConfigCard>
            ))}

            {planFor && <PlatformPlanModal tenantId={planFor.id} tenantName={planFor.name} tenantSlug={planFor.slug} onClose={() => setPlanFor(null)} onChanged={load} />}

            {editing && (
                <ModalShell
                    title={t('tenants.formTitle', { name: editing.name })} size="lg" onClose={() => { if (!busy) { setEditing(null); setForm(EMPTY); } }}
                    actions={<>
                        <Button variant="ghost" onClick={() => { setEditing(null); setForm(EMPTY); }} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button onClick={save} loading={busy} disabled={!form.clientId.trim() || !form.clientSecret.trim()}>{t('tenants.validateSave')}</Button>
                    </>}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-ds-soft">{t('tenants.formHelp')}</p>
                        <Field label={t('tenants.clientId')}><Input value={form.clientId} onChange={set('clientId')} autoComplete="off" spellCheck={false} /></Field>
                        <Field label={t('tenants.clientSecret')} hint={t('tenants.secretHint')}>
                            <Input type="password" value={form.clientSecret} onChange={set('clientSecret')} autoComplete="new-password" spellCheck={false} />
                        </Field>
                        <Field label={t('tenants.redirectUri')} hint={t('tenants.redirectHint')}><Input value={form.redirectUri} onChange={set('redirectUri')} placeholder="https://decatron.net/api/auth/callback" autoComplete="off" /></Field>
                        <Field label={t('tenants.scopes')} hint={t('tenants.scopesHint')}><Input value={form.scopes} onChange={set('scopes')} autoComplete="off" spellCheck={false} /></Field>
                    </div>
                </ModalShell>
            )}

            {botLink && (
                <ModalShell
                    title={t('tenants.botLinkTitle', { name: botLink.tenant.name })} size="lg" onClose={() => setBotLink(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setBotLink(null)}>{t('tenants.close')}</Button>
                        <Button onClick={() => navigator.clipboard?.writeText(botLink.url)}>{t('tenants.copy')}</Button>
                    </>}
                >
                    <div className="space-y-3">
                        <p className="text-sm text-ds-soft">{t('tenants.botLinkHelp')}</p>
                        <Input readOnly value={botLink.url} onFocus={e => e.currentTarget.select()} />
                    </div>
                </ModalShell>
            )}

            {discordFor && (
                <ModalShell
                    title={t('tenants.discordFormTitle', { name: discordFor.name })} size="lg" onClose={() => { if (!busy) { setDiscordFor(null); setDiscordToken(''); } }}
                    actions={<>
                        <Button variant="ghost" onClick={() => { setDiscordFor(null); setDiscordToken(''); }} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button onClick={saveDiscord} loading={busy} disabled={discordToken.trim().length < 50}>{t('tenants.validateSave')}</Button>
                    </>}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-ds-soft">{t('tenants.discordHelp')}</p>
                        <Field label={t('tenants.discordToken')} hint={t('tenants.discordTokenHint')}>
                            <Input type="password" value={discordToken} onChange={e => setDiscordToken(e.target.value)} autoComplete="new-password" spellCheck={false} />
                        </Field>
                    </div>
                </ModalShell>
            )}

            {rmDiscord && (
                <ModalShell
                    title={t('tenants.discordRemoveTitle')} size="md" onClose={() => !busy && setRmDiscord(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setRmDiscord(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" onClick={removeDiscord} loading={busy}>{t('tenants.discordRemove')}</Button>
                    </>}
                >
                    <p className="text-ds-soft">{t('tenants.discordRemoveText', { name: rmDiscord.name })}</p>
                </ModalShell>
            )}

            {unlinkBot && (
                <ModalShell
                    title={t('tenants.botUnlinkTitle')} size="md" onClose={() => !busy && setUnlinkBot(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setUnlinkBot(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" onClick={removeBot} loading={busy}>{t('tenants.botUnlink')}</Button>
                    </>}
                >
                    <p className="text-ds-soft">{t('tenants.botUnlinkText', { name: unlinkBot.name })}</p>
                </ModalShell>
            )}

            {toDelete && (
                <ModalShell
                    title={t('tenants.removeTitle')} size="md" onClose={() => !busy && setToDelete(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" onClick={remove} loading={busy}>{t('tenants.remove')}</Button>
                    </>}
                >
                    <p className="text-ds-soft">{t('tenants.removeText', { name: toDelete.name })}</p>
                </ModalShell>
            )}
        </div>
    );
}
