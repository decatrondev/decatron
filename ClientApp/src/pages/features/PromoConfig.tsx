import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import TabIcon from '../../components/dashboard/TabIcon';
import { usePermissions } from '../../hooks/usePermissions';
import { Card, Field, NumberInput, Select, Toggle, inputClass } from '../../components/overlay-editor/ui';
import { LinkRow, Warning, useOverlayStatus } from '../../components/overlay-editor/OverlayLinks';
import { PromoZoom } from '../../components/promo-overlay/PromoPreview';
import { docUrl } from '../docs/registry';
import { useBrand } from '../../brand/BrandContext';
import type { PromoContent } from '../../components/promo-overlay/types';
import { TimingTab } from './promo-extension/TimingTab';
import { PositionTab } from './promo-extension/PositionTab';
import { DesignTab } from './promo-extension/DesignTab';
import { StatsTab } from './promo-extension/StatsTab';
import type { SlotValues } from '../../components/promo-overlay/slots';
import { OwnCardsSection } from './promo-extension/OwnCardsSection';
import { ShowNowButton } from './promo-extension/ShowNowButton';
import { TriggersCard, type Triggers } from './promo-extension/TriggersCard';
import { isEmptyPieceOv, isPinnedLocked, emptyPieceOv, type Limits, type OwnCard, type Piece, type PieceOv, type Template, type Zone, type ZoneOv } from './promo-extension/types';

// Promociones, panel del streamer (.dev/plans/overlay-promo/PLAN.md, fase 2): una pestaña Guía primera con el enlace de OBS y
// su estado, y otra con las piezas que se están mostrando. La personalización por streamer llega en la fase siguiente.

type TabId = 'guide' | 'pieces' | 'timing' | 'position' | 'design' | 'stats' | 'settings';
const TABS: { id: TabId; icon: string }[] = [{ id: 'guide', icon: '📚' }, { id: 'pieces', icon: '🖼️' }, { id: 'timing', icon: '⏱️' }, { id: 'position', icon: '📍' }, { id: 'design', icon: '🎨' }, { id: 'stats', icon: '📊' }, { id: 'settings', icon: '⚙️' }];

interface Catalog {
    pieces: Piece[];
    templates: Template[];
    zones: Zone[];
    limits: Limits;
    mine: Mine;
    pieceOverrides: ({ pieceId: number } & PieceOv)[];
    zoneOverrides: ({ zoneKey: string } & ZoneOv)[];
    templateOverrides: { templateId: number; values: SlotValues }[];
    ownCards: OwnCard[];
    ownQuota: { max: number };
    /** Veces que salió cada pieza en este canal en los últimos 30 días. */
    views: Record<string, number>;
}
interface CmdSettings { enabled: boolean; name: string; cooldownSeconds: number; minRole: 'moderator' | 'vip' | 'subscriber' | 'everyone' }
interface Mine { paused: boolean; disabledPieces: number[]; minGapSeconds: number | null; hourlyCapSeconds: number | null; command: CmdSettings; triggers: Triggers }

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
    const [pieceOv, setPieceOv] = useState<Record<number, PieceOv>>({});
    const [zoneOv, setZoneOv] = useState<Record<string, ZoneOv>>({});
    const [styleOv, setStyleOv] = useState<Record<number, SlotValues>>({});
    const saved = useRef<{ pieces: Record<number, PieceOv>; zones: Record<string, ZoneOv>; styles: Record<number, SlotValues> }>({ pieces: {}, zones: {}, styles: {} });
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';

    useEffect(() => { try { sessionStorage.setItem('promo-tab', tab); } catch { /* sin storage */ } }, [tab]);
    useEffect(() => {
        if (!permsLoading && !hasMinimumLevel('moderation')) navigate('/dashboard');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permsLoading]);
    // Solo vuelve a leer las tarjetas propias: no pisa lo que el streamer ya cambió y aún no guardó en las demás pestañas.
    const reloadCatalog = async () => {
        const r = await api.get('/promo-panel/catalog');
        setCatalog(c => (c ? { ...c, ownCards: r.data.ownCards, ownQuota: r.data.ownQuota } : c));
    };
    useEffect(() => {
        api.get('/promo-panel/catalog').then(r => {
            const c: Catalog = r.data;
            const p: Record<number, PieceOv> = {}; c.pieceOverrides.forEach(o => { p[o.pieceId] = { durationSeconds: o.durationSeconds, templateId: o.templateId, scalePercent: o.scalePercent }; });
            const z: Record<string, ZoneOv> = {}; c.zoneOverrides.forEach(o => { z[o.zoneKey] = { anchor: o.anchor, marginX: o.marginX, marginY: o.marginY }; });
            const st: Record<number, SlotValues> = {}; (c.templateOverrides ?? []).forEach(o => { if (Object.keys(o.values).length) st[o.templateId] = o.values; });
            saved.current = { pieces: p, zones: z, styles: st };
            setPieceOv(p); setZoneOv(z); setStyleOv(st); setCatalog(c); setMine(c.mine);
        }).catch(e => setError(e?.response?.status === 403 ? 'forbidden' : 'loadFailed'));
    }, []);

    const channel = status.overlayKey || 'tu_canal';
    const both = !!status.hasTwitch && !!status.hasKick;
    const connected = (n: number) => n > 0;
    const copy = { copyLabel: t('panel.guide.copy'), copiedLabel: t('panel.guide.copied') };
    const url = overlayUrl(channel);
    const dateFmt = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }), [lang]);

    const change = (patch: Partial<Mine>) => { setMine(m => (m ? { ...m, ...patch } : m)); setDirty(true); };
    const changeCmd = (patch: Partial<CmdSettings>) => change({ command: { ...(mine as Mine).command, ...patch } });
    const toggle = (id: number, on: boolean) => change({ disabledPieces: on ? (mine?.disabledPieces ?? []).filter(x => x !== id) : [...(mine?.disabledPieces ?? []), id] });
    const changePiece = (id: number, patch: Partial<PieceOv>) => { setPieceOv(m => ({ ...m, [id]: { ...emptyPieceOv, ...m[id], ...patch } })); setDirty(true); };
    const changeStyle = (templateId: number, values: SlotValues) => { setStyleOv(m => { const { [templateId]: _old, ...rest } = m; return Object.keys(values).length ? { ...rest, [templateId]: values } : rest; }); setDirty(true); };
    const changeZone = (key: string, v: ZoneOv) => { setZoneOv(m => ({ ...m, [key]: v })); setDirty(true); };
    const resetZone = (key: string) => { setZoneOv(m => { const { [key]: _gone, ...rest } = m; return rest; }); setDirty(true); };
    // Las zonas como las ve este canal: la del dueño, o la que el streamer movió.
    const zonesNow = useMemo(() => (catalog?.zones ?? []).map(z => (zoneOv[z.key] ? { ...z, ...zoneOv[z.key] } : z)), [catalog, zoneOv]);
    const save = async () => {
        if (!mine) return;
        setSaving(true);
        try {
            await api.put('/promo-panel/settings', { paused: mine.paused, disabledPieces: mine.disabledPieces, minGapSeconds: mine.minGapSeconds, hourlyCapSeconds: mine.hourlyCapSeconds, command: mine.command, triggers: mine.triggers });
            // Lo que cambió de piezas y zonas: solo se envía la diferencia con lo último guardado.
            const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
            for (const id of new Set([...Object.keys(saved.current.pieces), ...Object.keys(pieceOv)].map(Number))) {
                const cur = isEmptyPieceOv(pieceOv[id]) ? undefined : pieceOv[id];
                const old = isEmptyPieceOv(saved.current.pieces[id]) ? undefined : saved.current.pieces[id];
                if (!same(cur, old)) await api.put(`/promo-panel/piece/${id}`, cur ?? emptyPieceOv);
            }
            for (const key of new Set([...Object.keys(saved.current.zones), ...Object.keys(zoneOv)])) {
                if (same(zoneOv[key], saved.current.zones[key])) continue;
                if (zoneOv[key]) await api.put(`/promo-panel/zone/${key}`, zoneOv[key]); else await api.delete(`/promo-panel/zone/${key}`);
            }
            for (const id of new Set([...Object.keys(saved.current.styles), ...Object.keys(styleOv)].map(Number))) {
                if (!same(styleOv[id], saved.current.styles[id])) await api.put(`/promo-panel/template/${id}`, { values: styleOv[id] ?? {} });
            }
            saved.current = { pieces: { ...pieceOv }, zones: { ...zoneOv }, styles: { ...styleOv } };
            setDirty(false);
            setMessage({ ok: true, text: t('panel.settings.saved') });
        } catch (e: any) {
            const code = e?.response?.data?.errors?.[0];
            setMessage({ ok: false, text: ['cmdInvalid', 'cmdReserved', 'cmdCustom'].includes(code) ? t(`panel.command.${code}`) : ['triggerPieceInvalid', 'pinnedFloor', 'durationRange', 'scaleRange', 'templateInvalid', 'anchorInvalid', 'marginRange', 'slotUnknown', 'slotValueInvalid', 'slotValuesInvalid'].includes(code) ? t(`panel.errors.${code}`) : t('panel.settings.saveFailed') });
        }
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
                                const locked = isPinnedLocked(p, catalog.ownCards);
                                const content: PromoContent = {
                                    title: (lang === 'en' && p.titleEn) || p.titleEs, body: (lang === 'en' && p.bodyEn) || p.bodyEs,
                                    link: p.linkUrl, imageUrl: p.imageUrl, icon: p.icon, showQr: p.showQr,
                                };
                                return (
                                    <div key={p.id} className={`rounded-lg border border-ds-border bg-ds-raised/40 p-3 space-y-3 min-w-0 ${!locked && mine?.disabledPieces.includes(p.id) ? 'opacity-50' : ''}`}>
                                        <Toggle checked={locked || !mine?.disabledPieces.includes(p.id)} disabled={locked} onChange={on => toggle(p.id, on)} label={content.title || p.titleEs}
                                            hint={locked ? t('panel.pieces.pinned') : mine?.disabledPieces.includes(p.id) ? t('panel.pieces.off') : t('panel.pieces.on')} />
                                        {tpl && <PromoZoom design={tpl.design} content={content} resolveImage={resolve}
                                            vars={{ channel, commands: '!title · !game', link: (p.linkUrl || 'https://decatron.net').replace(/^https:\/\//, '') }} />}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs 3xl:text-sm text-ds-soft">
                                            <span>{t('panel.pieces.zone')}: {zone ? (lang === 'en' ? zone.nameEn : zone.nameEs) || p.zone : p.zone}</span>
                                            <span>{t('panel.pieces.seconds', { n: p.durationSeconds })}</span>
                                            <span>{t('panel.pieces.shown', { n: catalog.views?.[p.id] ?? 0 })}</span>
                                            <span>{t('panel.pieces.priority', { n: p.priority })}</span>
                                            {p.platforms === 'twitch' && <span>{t('panel.pieces.onlyTwitch')}</span>}
                                            {p.platforms === 'kick' && <span>{t('panel.pieces.onlyKick')}</span>}
                                            {p.startsAt && <span>{t('panel.pieces.from', { date: dateFmt.format(new Date(p.startsAt)) })}</span>}
                                            {p.endsAt && <span>{t('panel.pieces.until', { date: dateFmt.format(new Date(p.endsAt)) })}</span>}
                                        </div>
                                        <ShowNowButton pieceId={p.id} />
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}
                {tab === 'pieces' && catalog && mine && (
                    <OwnCardsSection cards={catalog.ownCards} max={catalog.ownQuota.max} templates={catalog.templates} zones={zonesNow} limits={catalog.limits} lang={lang} channel={channel}
                        botActive={catalog.pieces.some(p => !mine.disabledPieces.includes(p.id) || p.isPinned)} onChanged={reloadCatalog} />
                )}
                {tab === 'timing' && catalog && (
                    <TimingTab pieces={catalog.pieces} cards={catalog.ownCards} limits={catalog.limits} overrides={pieceOv} lang={lang} onChange={changePiece} />
                )}
                {tab === 'position' && catalog && (
                    <PositionTab zones={zonesNow} defaults={catalog.zones} overrides={zoneOv} pieces={catalog.pieces} templates={catalog.templates} limits={catalog.limits}
                        lang={lang} channel={channel} onChange={changeZone} onReset={resetZone} />
                )}
                {tab === 'design' && catalog && (
                    <DesignTab pieces={catalog.pieces} cards={catalog.ownCards} templates={catalog.templates} zones={zonesNow} limits={catalog.limits} overrides={pieceOv} styles={styleOv} lang={lang} channel={channel} onChange={changePiece} onStyleChange={changeStyle} />
                )}
                {tab === 'stats' && catalog && <StatsTab pieces={catalog.pieces} cards={catalog.ownCards} lang={lang} />}
                {tab === 'settings' && mine && catalog && (
                    <div className="space-y-6">
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
                    <TriggersCard triggers={mine.triggers} pieces={catalog.pieces} ownCards={catalog.ownCards} lang={lang} onChange={triggers => change({ triggers })} />
                    <Card title={t('panel.command.title')} description={t('panel.command.description')}>
                        <div className="space-y-6">
                            <Toggle checked={mine.command.enabled} onChange={v => changeCmd({ enabled: v })} label={t('panel.command.enable')} hint={t('panel.command.enableHint')} />
                            {mine.command.enabled && (
                                <>
                                    <Field label={t('panel.command.name')} hint={t('panel.command.nameHint')}>
                                        <div className="flex items-center gap-2 max-w-xs">
                                            <span className="text-ds-soft font-bold">!</span>
                                            <input className={inputClass} value={mine.command.name} maxLength={20} onChange={e => changeCmd({ name: e.target.value.replace(/^!/, '') })} />
                                        </div>
                                    </Field>
                                    <Field label={t('panel.command.role')} hint={t('panel.command.roleHint')}>
                                        <div className="max-w-xs"><Select value={mine.command.minRole} onChange={v => changeCmd({ minRole: v })}
                                            options={(['moderator', 'vip', 'subscriber', 'everyone'] as const).map(r => ({ value: r, label: t(`panel.command.roles.${r}`) }))} /></div>
                                    </Field>
                                    <Field label={t('panel.command.cooldown')} hint={t('panel.command.cooldownHint')}>
                                        <div className="max-w-xs"><NumberInput value={mine.command.cooldownSeconds} min={0} max={600} step={5} onChange={v => changeCmd({ cooldownSeconds: v })} /></div>
                                    </Field>
                                    <div className="text-sm 3xl:text-base text-ds-soft space-y-1">
                                        <p>{t('panel.command.usage', { name: mine.command.name || 'dpromo' })}</p>
                                        <p>{t('panel.command.otherBot')}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
