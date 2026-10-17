import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card, Spinner } from '../../../components/ds';
import buyerApi from '../../../services/buyerApi';

// Vista del admin del equipo: estado de las conexiones SIN pistas de credenciales (solo «configurado / sin configurar») y la única acción que
// le toca: reabrir la conexión de eventos. Quien las configura es el dueño.
interface State {
    twitchApp: { status: string } | null; twitchBot: boolean; discordBot: boolean;
    byo: Record<string, boolean>; byoAllowed: Record<string, boolean>;
    gateway: { status: string; guilds: number } | null;
    eventSub: { status: string; shards: number; shardsConnected: number; error: string | null } | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return <li className="py-2.5 flex items-center justify-between gap-4 text-sm"><span className="text-ds-soft">{label}</span><span>{children}</span></li>;
}

export default function BuyerSetupReadOnly() {
    const { t } = useTranslation('platform');
    const [s, setS] = useState<State | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try { setS((await buyerApi.get('/platform/buyer/state')).data); setFailed(false); } catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const restart = async () => {
        setBusy(true); setNote(null);
        try { await buyerApi.post('/platform/buyer/eventsub/restart'); setNote({ ok: true, text: t('tenants.eventSubOk') }); }
        catch (e: any) { setNote({ ok: false, text: t(`tenants.errors.${e?.response?.data?.code}`, { defaultValue: t('tenants.errors.generic') }) }); }
        await load();
        setBusy(false);
    };

    if (failed) return <Alert tone="danger">{t('buyer.errorLoad')}</Alert>;
    if (!s) return <div className="text-center"><Spinner /></div>;

    const plain = (k: string) => t(k).replace(/^\d+\.\s*/, ''); // los títulos del panel del dueño van numerados por orden de pasos
    const on = (v: boolean) => <Badge tone={v ? 'ok' : undefined}>{v ? t('buyer.readonly.configured') : t('tenants.notConfigured')}</Badge>;
    const es = s.eventSub;
    return (
        <div className="space-y-5">
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}
            <Card><div className="p-5 space-y-3">
                <div>
                    <h2 className="text-lg font-bold text-ds-text">{t('buyer.readonly.title')}</h2>
                    <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.readonly.help')}</p>
                </div>
                <ul className="divide-y divide-ds-border">
                    <Row label={plain('buyer.setup.appTitle')}>{on(s.twitchApp != null)}</Row>
                    <Row label={plain('buyer.setup.botTitle')}>{on(s.twitchBot)}</Row>
                    <Row label={plain('buyer.setup.discordTitle')}>{on(s.discordBot)}</Row>
                    {Object.keys(s.byo).sort().map(p => (
                        s.byoAllowed[p] === false
                            ? <Row key={p} label={t(`tenants.byo.providers.${p}.name`, { defaultValue: p })}><Badge>{t('buyer.transparency.notInPlan')}</Badge></Row>
                            : <Row key={p} label={t(`tenants.byo.providers.${p}.name`, { defaultValue: p })}>{on(s.byo[p])}</Row>
                    ))}
                </ul>
            </div></Card>

            <Card><div className="p-5 space-y-3">
                <div>
                    <h2 className="text-lg font-bold text-ds-text">{t('buyer.setup.eventsTitle')}</h2>
                    <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.setup.eventsHelp')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={es?.status === 'connected' ? 'ok' : es?.status === 'failed' ? 'danger' : 'warn'}>{t(`tenants.eventSubStatus.${es?.status ?? 'stopped'}`)}</Badge>
                    {es && es.shards > 0 && <span className="text-sm text-ds-soft">{t('tenants.eventSubShards', { n: es.shardsConnected, total: es.shards })}</span>}
                </div>
                <Button variant="secondary" loading={busy} disabled={!s.twitchApp || !s.twitchBot} onClick={restart}>{t('tenants.eventSubRestart')}</Button>
            </div></Card>
        </div>
    );
}
