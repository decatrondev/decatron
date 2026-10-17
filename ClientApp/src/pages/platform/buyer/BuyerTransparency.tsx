import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Card, Spinner } from '../../../components/ds';
import buyerApi from '../../../services/buyerApi';

// Transparencia para el comprador: qué permisos de Twitch pide la plataforma (y por qué) y qué incluye su plan. Todo viene del servidor:
// el catálogo de permisos tiene un único origen (TwitchScopeCatalog) y el plan sale de las mismas filas que aplican los límites.
interface ScopeRow { scope: string; module: string | null; es: string; en: string; moduleIncluded: boolean }
interface Cap { key: string; kind: 'flag' | 'quota'; group: string; description: string; unit: string | null; included: boolean; limit: number | null }
interface Data {
    plan: {
        subscription: { planName: string; status: string; sandboxEndsAt: string | null; endsAt: string | null } | null;
        usage: { key: string; periodStart: string; used: number }[];
        channels: { used: number; limit: number | null };
        admins: { used: number; limit: number | null };
    } | null;
    capabilities: Cap[];
    scopes: { streamer: ScopeRow[]; bot: ScopeRow[]; moderation: ScopeRow[] };
}

function ScopeList({ rows, en }: { rows: ScopeRow[]; en: boolean }) {
    const { t } = useTranslation('platform');
    return (
        <ul className="divide-y divide-ds-border">
            {rows.map(r => (
                <li key={r.scope} className="py-2.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                        <code className="text-xs text-ds-faint break-all">{r.scope}</code>
                        <p className="text-sm text-ds-soft">{en ? r.en : r.es}</p>
                    </div>
                    {r.module && <Badge tone={r.moduleIncluded ? undefined : 'warn'}>{t(`buyer.transparency.cap.${r.module}`, { defaultValue: r.module })}{r.moduleIncluded ? '' : ` · ${t('buyer.transparency.notInPlan')}`}</Badge>}
                </li>
            ))}
        </ul>
    );
}

export default function BuyerTransparency() {
    const { t, i18n } = useTranslation('platform');
    const [data, setData] = useState<Data | null>(null);
    const [failed, setFailed] = useState(false);
    const en = !!i18n.language?.startsWith('en');

    useEffect(() => { buyerApi.get('/platform/buyer/transparency').then(r => setData(r.data)).catch(() => setFailed(true)); }, []);

    if (failed) return null; // el resto del panel sigue funcionando; el error de carga ya lo muestra la pantalla principal
    if (!data) return <div className="text-center"><Spinner /></div>;

    const label = (c: Cap) => t(`buyer.transparency.cap.${c.key}`, { defaultValue: c.description });
    const modules = data.capabilities.filter(c => c.kind === 'flag' && c.key.startsWith('module.'));
    const byo = data.capabilities.filter(c => c.key.startsWith('byo.'));
    const quotas = data.capabilities.filter(c => c.kind === 'quota');
    const used = (key: string) => {
        if (key === 'quota.channels') return data.plan?.channels.used;
        if (key === 'quota.admins') return data.plan?.admins.used;
        return data.plan?.usage.filter(u => u.key === key).sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0]?.used;
    };
    const sub = data.plan?.subscription;

    return (
        <div className="space-y-5">
            <Card><div className="p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-bold text-ds-text">{t('buyer.transparency.planTitle', { name: sub?.planName ?? '—' })}</h2>
                    <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.transparency.planHelp')}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-ds-text mb-2">{t('buyer.transparency.modules')}</h3>
                    <div className="flex flex-wrap gap-2">
                        {modules.map(c => <Badge key={c.key} tone={c.included ? 'ok' : undefined}>{label(c)}{c.included ? '' : ` · ${t('buyer.transparency.notInPlan')}`}</Badge>)}
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-ds-text mb-2">{t('buyer.transparency.quotas')}</h3>
                    <ul className="divide-y divide-ds-border">
                        {quotas.map(c => {
                            const u = used(c.key);
                            return (
                                <li key={c.key} className="py-2 flex items-center justify-between gap-4 text-sm">
                                    <span className="text-ds-soft">{label(c)}</span>
                                    <span className="text-ds-text font-semibold">{u != null ? `${u} / ` : ''}{c.limit == null ? t('buyer.transparency.unlimited') : c.limit}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-ds-text mb-1">{t('buyer.transparency.byo')}</h3>
                    <p className="text-sm text-ds-soft mb-2 leading-relaxed">{t('buyer.transparency.byoHelp')}</p>
                    <div className="flex flex-wrap gap-2">
                        {byo.map(c => <Badge key={c.key} tone={c.included ? 'ok' : undefined}>{label(c)}{c.included ? '' : ` · ${t('buyer.transparency.notInPlan')}`}</Badge>)}
                    </div>
                </div>
            </div></Card>

            <Card><div className="p-5 space-y-4">
                <div>
                    <h2 className="text-lg font-bold text-ds-text">{t('buyer.transparency.scopesTitle')}</h2>
                    <p className="text-sm text-ds-soft mt-1 leading-relaxed">{t('buyer.transparency.scopesHelp')}</p>
                </div>
                <div>
                    <h3 className="text-sm font-bold text-ds-text mb-1">{t('buyer.transparency.scopesStreamer')}</h3>
                    <p className="text-xs text-ds-faint mb-1">{t('buyer.transparency.scopesStreamerHelp')}</p>
                    <ScopeList rows={data.scopes.streamer} en={en} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-ds-text mb-1">{t('buyer.transparency.scopesBot')}</h3>
                    <p className="text-xs text-ds-faint mb-1">{t('buyer.transparency.scopesBotHelp')}</p>
                    <ScopeList rows={data.scopes.bot} en={en} />
                </div>
            </div></Card>
        </div>
    );
}
