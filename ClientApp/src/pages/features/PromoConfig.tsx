import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import TabIcon from '../../components/dashboard/TabIcon';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, NumberInput, Toggle } from '../../components/overlay-editor/ui';
import { LinkRow, Warning, useOverlayStatus } from '../../components/overlay-editor/OverlayLinks';
import { PromoZoom, type ZonePlacement } from '../../components/promo-overlay/PromoPreview';
import { docUrl } from '../docs/registry';
import { useBrand } from '../../brand/BrandContext';
import type { PromoDesign, PromoContent } from '../../components/promo-overlay/types';

// Promociones, panel del streamer (.dev/plans/overlay-promo/PLAN.md, fase 2): una pestaña Guía primera con el enlace de OBS y
// su estado, y otra con las piezas que se están mostrando. La personalización por streamer llega en la fase siguiente.

type TabId = 'guide' | 'pieces' | 'settings';
const TABS: { id: TabId; icon: string }[] = [{ id: 'guide', icon: '📚' }, { id: 'pieces', icon: '🖼️' }, { id: 'settings', icon: '⚙️' }];

interface Piece {
    id: number; kind: string; titleEs: string; titleEn: string; bodyEs: string; bodyEn: string; zone: string; platforms: string;
    durationSeconds: number; priority: number; weight: number; startsAt: string | null; endsAt: string | null; templateId: number | null;
    linkUrl: string | null; showQr: boolean; imageUrl: string | null; icon: string | null;
}
interface Catalog {
    pieces: Piece[];
    templates: { id: number; zone: string; design: PromoDesign }[];
    zones: (ZonePlacement & { key: string; nameEs: string; nameEn: string })[];
    limits: { minGapSeconds: number; hourlyCapSeconds: number };
    mine: Mine;
}
interface Mine { paused: boolean; disabledPieces: number[]; minGapSeconds: number | null; hourlyCapSeconds: number | null }

const overlayUrl = (channel: string, source?: 'twitch' | 'kick') => `${window.location.origin}/overlay/promo?channel=${channel}${source ? `&source=${source}` : ''}`;

export default function PromoConfig() {
    const { t, i18n } = useTranslation('promo');
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permsLoading } = usePermissions();
    const { resolve } = useBrand();
    const { status, loaded } = useOverlayStatus('/promo-panel/status');
    const [tab, setTab] = useState<TabId>(() => { try { return (sessionStorage.getItem('promo-tab') as TabId) || 'guide'; } catch { return 'guide'; } });
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mine, setMine] = useState<Mine | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

    useEffect(() => { try { sessionStorage.setItem('promo-tab', tab); } catch { /* sin storage */ } }, [tab]);
    useEffect(() => {
        if (!permsLoading && !hasMinimumLevel('moderation')) navigate('/dashboard');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permsLoading]);
    useEffect(() => {
        api.get('/promo-panel/catalog').then(r => { setCatalog(r.data); setMine(r.data.mine); }).catch(e => setError(e?.response?.status === 403 ? 'forbidden' : 'loadFailed'));
    }, []);

    const channel = status.overlayKey || 'tu_canal';
    const both = !!status.hasTwitch && !!status.hasKick;
    const connected = (n: number) => n > 0;
    const copy = { copyLabel: t('panel.guide.copy'), copiedLabel: t('panel.guide.copied') };
    const url = overlayUrl(channel);
    const dateFmt = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }), [lang]);

    const change = (patch: Partial<Mine>) => { setMine(m => (m ? { ...m, ...patch } : m)); setDirty(true); };
    const toggle = (id: number, on: boolean) => change({ disabledPieces: on ? (mine?.disabledPieces ?? []).filter(x => x !== id) : [...(mine?.disabledPieces ?? []), id] });
    const save = async () => {
        if (!mine) return;
        setSaving(true);
        try {
            await api.put('/promo-panel/settings', { paused: mine.paused, disabledPieces: mine.disabledPieces, minGapSeconds: mine.minGapSeconds, hourlyCapSeconds: mine.hourlyCapSeconds });
            setDirty(false);
            setMessage({ ok: true, text: t('panel.settings.saved') });
        } catch { setMessage({ ok: false, text: t('panel.settings.saveFailed') }); }
        setSaving(false);
        window.setTimeout(() => setMessage(null), 4000);
    };

    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-ds-accent text-ds-on-accent font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-ds-soft space-y-2">{body}</div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            <div className="panel-scale max-w-[1200px] mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate('/overlays')} className="ds-btn ds-btn--secondary ds-icon-btn" aria-label={t('panel.back')}><ArrowLeft className="w-5 h-5 text-ds-soft" /></button>
                    <div>
                        <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('panel.title')}</h1>
                        <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('panel.subtitle')}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {dirty && <span className="text-xs 3xl:text-sm font-bold text-ds-warn">{t('panel.settings.unsaved')}</span>}
                        <button onClick={save} disabled={!dirty || saving} className={dirty && !saving ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{saving ? t('panel.settings.saving') : t('panel.settings.save')}</button>
                    </div>
                </div>
                {message && <div className={`mb-6 p-4 rounded-lg border ${message.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger'}`}>{message.text}</div>}

                <div className="bg-ds-surface rounded-lg border border-ds-border p-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        {TABS.map(item => (
                            <button key={item.id} onClick={() => setTab(item.id)}
                                className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}>
                                <TabIcon emoji={item.icon} />{t(`panel.tabs.${item.id}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <div className="p-4 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-ds-danger mb-6">{t(`panel.${error}`)}</div>}

                {tab === 'guide' && (
                    <Card title={t('panel.guide.title')} description={t('panel.guide.description')}>
                        <div className="space-y-6">
                            {step(1, t('panel.guide.step1Title'), (
                                <>
                                    <p>{t('panel.guide.step1Body')}</p>
                                    <LinkRow url={url} name={both ? t('panel.guide.linkAll') : undefined} recommended={both} connected={connected(both ? status.all : status.total)} loaded={loaded} {...copy}
                                        extra={<a href={url} target="_blank" rel="noreferrer" className="ds-btn ds-btn--secondary shrink-0"><ExternalLink className="w-4 h-4" /> {t('panel.guide.open')}</a>} />
                                    <ol className="list-decimal pl-5 space-y-1">
                                        <li>{t('panel.guide.obs1')}</li><li>{t('panel.guide.obs2')}</li><li>{t('panel.guide.obs3')}</li>
                                    </ol>
                                    {both && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer font-bold text-ds-text">{t('panel.guide.advanced')}</summary>
                                            <div className="space-y-4 mt-3">
                                                <LinkRow url={overlayUrl(channel, 'twitch')} name={t('panel.guide.linkTwitch')} connected={connected(status.twitch)} loaded={loaded} {...copy} />
                                                <LinkRow url={overlayUrl(channel, 'kick')} name={t('panel.guide.linkKick')} connected={connected(status.kick)} loaded={loaded} {...copy} />
                                            </div>
                                        </details>
                                    )}
                                    {status.warnings.includes('mixed') && <Warning title={t('panel.guide.warnMixedTitle')} text={t('panel.guide.warnMixed')} />}
                                    {status.warnings.includes('repeated') && <Warning title={t('panel.guide.warnRepeatedTitle')} text={t('panel.guide.warnRepeated')} />}
                                </>
                            ))}
                            {step(2, t('panel.guide.step2Title'), <p>{t('panel.guide.step2Body')}</p>)}
                            {catalog && step(3, t('panel.guide.step3Title'), <p>{t('panel.guide.step3Body', { gap: catalog.limits.minGapSeconds, cap: catalog.limits.hourlyCapSeconds })}</p>)}
                            {step(4, t('panel.guide.step4Title'), <p>{t('panel.guide.step4Body')} <Link to={docUrl('private', 'features/promo')} className="underline text-ds-accent-text">{t('panel.guide.step4Link')}</Link></p>)}
                        </div>
                    </Card>
                )}

                {tab === 'pieces' && (
                    <Card title={t('panel.pieces.title')} description={t('panel.pieces.description')}>
                        {catalog && catalog.pieces.length === 0 && <p className="text-ds-soft">{t('panel.pieces.empty')}</p>}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {catalog?.pieces.map(p => {
                                const tpl = catalog.templates.find(x => x.id === p.templateId) ?? catalog.templates.find(x => x.zone === p.zone);
                                const zone = catalog.zones.find(z => z.key === p.zone);
                                const content: PromoContent = {
                                    title: (lang === 'en' && p.titleEn) || p.titleEs, body: (lang === 'en' && p.bodyEn) || p.bodyEs,
                                    link: p.linkUrl, imageUrl: p.imageUrl, icon: p.icon, showQr: p.showQr,
                                };
                                return (
                                    <div key={p.id} className={`rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3 min-w-0 ${mine?.disabledPieces.includes(p.id) ? 'opacity-50' : ''}`}>
                                        <Toggle checked={!mine?.disabledPieces.includes(p.id)} onChange={on => toggle(p.id, on)} label={content.title || p.titleEs} hint={mine?.disabledPieces.includes(p.id) ? t('panel.pieces.off') : t('panel.pieces.on')} />
                                        {tpl && <PromoZoom design={tpl.design} content={content} resolveImage={resolve}
                                            vars={{ channel, commands: '!title · !game', link: (p.linkUrl || 'https://decatron.net').replace(/^https:\/\//, '') }} />}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs 3xl:text-sm text-ds-soft">
                                            <span>{t('panel.pieces.zone')}: {zone ? (lang === 'en' ? zone.nameEn : zone.nameEs) || p.zone : p.zone}</span>
                                            <span>{t('panel.pieces.seconds', { n: p.durationSeconds })}</span>
                                            <span>{t('panel.pieces.priority', { n: p.priority })}</span>
                                            {p.platforms === 'twitch' && <span>{t('panel.pieces.onlyTwitch')}</span>}
                                            {p.platforms === 'kick' && <span>{t('panel.pieces.onlyKick')}</span>}
                                            {p.startsAt && <span>{t('panel.pieces.from', { date: dateFmt.format(new Date(p.startsAt)) })}</span>}
                                            {p.endsAt && <span>{t('panel.pieces.until', { date: dateFmt.format(new Date(p.endsAt)) })}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}
                {tab === 'settings' && mine && catalog && (
                    <Card title={t('panel.settings.title')} description={t('panel.settings.description')}>
                        <div className="space-y-6">
                            <Toggle checked={mine.paused} onChange={v => change({ paused: v })} label={t('panel.settings.pause')} hint={t('panel.settings.pauseHint')} />
                            <div>
                                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{t('panel.settings.gap')}</h4>
                                <p className="text-sm 3xl:text-base text-ds-soft mb-2">{t('panel.settings.gapHint', { n: catalog.limits.minGapSeconds })}</p>
                                <div className="max-w-xs"><NumberInput value={mine.minGapSeconds ?? catalog.limits.minGapSeconds} min={catalog.limits.minGapSeconds} max={3600} step={10}
                                    onChange={v => change({ minGapSeconds: v <= catalog.limits.minGapSeconds ? null : v })} /></div>
                            </div>
                            <div>
                                <h4 className="font-bold text-ds-text text-sm 3xl:text-base">{t('panel.settings.cap')}</h4>
                                <p className="text-sm 3xl:text-base text-ds-soft mb-2">{t('panel.settings.capHint', { n: catalog.limits.hourlyCapSeconds })}</p>
                                <div className="max-w-xs"><NumberInput value={mine.hourlyCapSeconds ?? catalog.limits.hourlyCapSeconds} min={0} max={catalog.limits.hourlyCapSeconds} step={30}
                                    onChange={v => change({ hourlyCapSeconds: v >= catalog.limits.hourlyCapSeconds ? null : v })} /></div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
