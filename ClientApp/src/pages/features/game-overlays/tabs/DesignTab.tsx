/**
 * Pestaña Diseño: editor visual del overlay para un juego. Canvas con la
 * tarjeta arrastrable (datos simulados del backend) + propiedades: layout,
 * fondo, acento, elementos (visibilidad, fuente, tamaño), animaciones.
 * Todo esto es free para todos (decision de producto, plan §6).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Maximize2 } from 'lucide-react';
import { CanvasEditor } from '../../../../components/overlay-editor/CanvasEditor';
import { Card, SectionTitle, Label, SubLabel, SelectInput, ColorInput, Slider, Toggle, NumberInput, Checkbox } from '../../now-playing-extension/components/ui/SharedUI';
import { GameOverlayCard, CARD_LABELS } from '../GameOverlayCard';
import { CardView, availableViews, pickPromo } from '../slides';
import { gameOverlaysApi } from '../api';
import { CARD_SIZE_LIMITS, ElementConfig, ElementId, GAME_ACCENTS, GAME_IDS, GAME_NAMES, GAMES_WITH_STATS, GameId, GameVisualConfig, LAYOUT_DEFAULT_SIZE, LAYOUT_PRESETS, LIVE_ELEMENTS, LayoutPreset, LivePhaseId, LivePhaseInfo, OverlayState, PromoCatalog, PromoItem, SLIDE_VIEWS, STATS_ELEMENTS, STYLE_PRESET_ELEMENTS, STYLE_PRESETS, SlideView, StylePreset, AccountOverlayState, defaultGameConfig, formatTier } from '../types';

const FONT_FAMILIES = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Bebas Neue', 'Rajdhani', 'Exo 2', 'Press Start 2P', 'system-ui'];
const BASE_ELEMENT_ORDER: ElementId[] = ['emblem', 'gameLogo', 'rank', 'lp', 'accountName', 'session', 'recent', 'liveCharacter'];
const ALL_ELEMENT_ORDER: ElementId[] = [...BASE_ELEMENT_ORDER, ...STATS_ELEMENTS, ...LIVE_ELEMENTS];

const LIVE_SIM_PHASES: LivePhaseId[] = ['none', 'lobby', 'matchmaking', 'champselect', 'ingame', 'postgame'];

/** Fase en vivo simulada para diseñar lo que manda Decatron Desktop, con los íconos del preview. */
function simulateLive(phase: LivePhaseId, account: AccountOverlayState): LivePhaseInfo | null {
    if (phase === 'none') return null;
    const champs = (account.session?.matches ?? []).filter(m => m.character).map(m => ({ id: 0, name: m.character!, icon: m.characterIcon ?? null }));
    const c = (i: number) => champs[i % Math.max(1, champs.length)] ?? { id: 0, name: '?', icon: null };
    const base: LivePhaseInfo = { phase, queueId: 420, queueName: 'Ranked Solo/Duo', lobby: [], updatedAt: new Date().toISOString() };
    if (phase === 'lobby') base.lobby = [{ name: account.displayName, isMe: true, isLeader: true }, { name: 'Roba', isMe: false, isLeader: false, scout: { tier: 'GOLD', division: 'II', lp: 45, games: 20, winRate: 60, streak: 3, topChampions: ['Lee Sin 6-2', 'Vi 4-3'] } }, { name: 'Jesús', isMe: false, isLeader: false, scout: { tier: 'SILVER', division: 'I', lp: 80, games: 20, winRate: 45, streak: -2, topChampions: ['Lux 5-5'] } }];
    if (phase === 'champselect') base.champSelect = {
        myTeam: [0, 1, 2, 3, 4].map(i => ({ cellId: i, champion: i < 4 ? c(i) : null, position: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][i], isMe: i === 3, locked: i < 3 })),
        theirTeam: [5, 6, 7, 8, 9].map(i => ({ cellId: i, champion: i < 8 ? c(i) : null, isMe: false, locked: i < 7 })),
        myBans: [c(4)], theirBans: [c(1), c(2)], timerPhase: 'BAN_PICK', remainingMs: 21000, myPick: c(3), myPosition: 'BOTTOM', myTurn: true,
    };
    if (phase === 'champselect') base.coach = { kind: 'my_turn', comment: `Con ${c(3).name} vas cómoda contra su bot; cuidado con el ${c(5).name} en early.`, suggestion: c(3).name, tips: [], coachName: 'Coach', at: new Date().toISOString() };
    if (phase === 'postgame') base.coach = { kind: 'postgame', comment: 'Buen tempo en línea y muy bien las peleas del minuto 20+. Sigue mejorando el CS temprano: 6.1/min vs tu 7.2 habitual.', tips: ['Warda el río antes del min 3', 'Compra pinks al volver'], coachName: 'Coach', at: new Date().toISOString() };
    if (phase === 'ingame') base.game = { champion: c(0), position: 'BOTTOM', startedAt: new Date(Date.now() - 12 * 60000).toISOString(), gameMode: 'CLASSIC' };
    if (phase === 'ingame') base.prediction = { champion: c(0).name, openedAt: new Date(Date.now() - 3 * 60000).toISOString(), closesAt: new Date(Date.now() + 2 * 60000).toISOString(), poolWin: 1850, poolLoss: 620, betsWin: 9, betsLoss: 4, result: null, winners: 0, top: [] };
    if (phase === 'postgame') base.prediction = { champion: c(0).name, openedAt: new Date(Date.now() - 32 * 60000).toISOString(), closesAt: new Date(Date.now() - 27 * 60000).toISOString(), poolWin: 1850, poolLoss: 620, betsWin: 9, betsLoss: 4, result: 'win', resolvedAt: new Date().toISOString(), winners: 9, top: ['roba +210', 'jesus +140', 'maria +95'] };
    if (phase === 'postgame') base.postGame = {
        win: true, champion: c(0), kills: 11, deaths: 3, assists: 9, cs: 214, damage: 24300, visionScore: 21, durationSeconds: 1832, pointsDelta: 22,
        myTeam: [], theirTeam: [],
    };
    return base;
}

interface Props {
    slug: string;
    game: GameId;
    games: Record<GameId, GameVisualConfig>;
    canvas: { width: number; height: number };
    /** false = tier gratis: la tarjeta de Decatron no se puede apagar. */
    canHidePromo: boolean;
    onSelectGame: (g: GameId) => void;
    onChange: (game: GameId, patch: Partial<GameVisualConfig>) => void;
    onCanvasChange: (c: { width: number; height: number }) => void;
}

export const DesignTab: React.FC<Props> = ({ slug, game, games, canvas, canHidePromo, onSelectGame, onChange, onCanvasChange }) => {
    const { t, i18n } = useTranslation('games', { keyPrefix: 'gameOverlays.design' });
    const lang: 'es' | 'en' = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
    const cfg = games[game];
    const [preview, setPreview] = useState<OverlayState | null>(null);
    const [selected, setSelected] = useState<ElementId>('rank');
    // Qué vista se diseña en el canvas (la rotación real corre en el overlay, aquí se elige a mano).
    const [previewView, setPreviewView] = useState<CardView>('main');
    const [liveSim, setLiveSim] = useState<LivePhaseId>('none');
    const promoForced = !canHidePromo;
    // Anuncios del catálogo del admin, para verlos en el preview tal como salen en OBS.
    const [promoCatalog, setPromoCatalog] = useState<PromoCatalog | null>(null);
    const [previewPromo, setPreviewPromo] = useState<PromoItem | null>(null);
    useEffect(() => {
        let alive = true;
        gameOverlaysApi.promos(lang).then(c => { if (alive) { setPromoCatalog(c); setPreviewPromo(pickPromo(c.items)); } }).catch(() => {});
        return () => { alive = false; };
    }, [lang]);

    // "Ajustar al contenido": una copia de la tarjeta sin caja fija, fuera de pantalla, para medirla.
    const measureRef = useRef<HTMLDivElement>(null);
    const [fitPending, setFitPending] = useState(false);
    const fitToContent = useCallback(() => {
        const node = measureRef.current?.firstElementChild as HTMLElement | null;
        if (!node) return;
        const r = node.getBoundingClientRect();
        const width = Math.min(CARD_SIZE_LIMITS.maxWidth, Math.max(CARD_SIZE_LIMITS.minWidth, Math.ceil(r.width) + 2));
        const height = Math.min(CARD_SIZE_LIMITS.maxHeight, Math.max(CARD_SIZE_LIMITS.minHeight, Math.ceil(r.height) + 2));
        onChange(game, { size: { width, height } });
    }, [game, onChange]);
    useEffect(() => {
        if (!fitPending) return;
        setFitPending(false);
        // Espera al render con la config nueva antes de medir.
        const t = setTimeout(fitToContent, 50);
        return () => clearTimeout(t);
    }, [fitPending, fitToContent]);
    const setLayout = (l: LayoutPreset) => { onChange(game, { layout: l, size: { ...LAYOUT_DEFAULT_SIZE[l] } }); setFitPending(true); };
    const toggleView = (v: SlideView) => {
        const views = cfg.slides.views.includes(v) ? cfg.slides.views.filter(x => x !== v) : [...cfg.slides.views, v];
        if (views.length === 0) return;
        onChange(game, { slides: { ...cfg.slides, views } });
    };
    // Los widgets de estadisticas solo existen donde el proveedor da esos datos (hoy LoL).
    const hasStats = GAMES_WITH_STATS.includes(game);
    const ELEMENT_ORDER = hasStats ? ALL_ELEMENT_ORDER : BASE_ELEMENT_ORDER;
    useEffect(() => { if (!hasStats && STATS_ELEMENTS.includes(selected)) setSelected('rank'); }, [hasStats, selected]);

    const applyPreset = (preset: StylePreset) => {
        const show = new Set(STYLE_PRESET_ELEMENTS[preset]);
        const elements: GameVisualConfig['elements'] = { ...cfg.elements };
        for (const id of ALL_ELEMENT_ORDER) elements[id] = { ...(elements[id] ?? defaultGameConfig(game).elements[id]!), visible: show.has(id) };
        onChange(game, { elements });
        setFitPending(true);
    };

    useEffect(() => {
        let alive = true;
        gameOverlaysApi.preview(slug, game).then(r => { if (alive && r.success) setPreview(r.state); }).catch(() => {});
        return () => { alive = false; };
    }, [slug, game]);

    // Carga la fuente elegida desde Google Fonts para el preview (el overlay hace lo mismo).
    const fontsInUse = useMemo(() => {
        const set = new Set<string>();
        for (const id of ELEMENT_ORDER) { const f = cfg.elements[id]?.font?.family; if (f && f !== 'system-ui' && f !== 'Inter') set.add(f); }
        return [...set];
    }, [cfg]);
    useEffect(() => {
        if (fontsInUse.length === 0) return;
        const id = 'go-fonts';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
        link.href = `https://fonts.googleapis.com/css2?${fontsInUse.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    }, [fontsInUse]);

    const previewAccount = preview?.accounts?.[0];
    const account = previewAccount ? { ...previewAccount, livePhase: simulateLive(liveSim, previewAccount) } : undefined;
    const el = cfg.elements[selected] ?? { visible: true };
    const setEl = (patch: Partial<ElementConfig>) => onChange(game, { elements: { ...cfg.elements, [selected]: { ...el, ...patch } } });
    const setFont = (patch: Partial<NonNullable<ElementConfig['font']>>) => setEl({ font: { ...el.font, ...patch } });
    const hasFont = !['emblem', 'recent', 'lpGraph'].includes(selected);
    const toggleMetric = (m: 'kda' | 'cs' | 'damage' | 'vision') => {
        const cur = el.metrics ?? ['kda', 'cs'];
        setEl({ metrics: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] });
    };

    return (
        <div className="space-y-5">
            <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <SectionTitle>{t('title')} · {GAME_NAMES[game]}</SectionTitle>
                        <SubLabel>{t('hint')}</SubLabel>
                    </div>
                    <div className="flex items-center gap-2">
                        <SelectInput value={game} onChange={v => onSelectGame(v as GameId)} options={GAME_IDS.map(g => ({ value: g, label: `${GAME_NAMES[g]}${games[g].enabled ? '' : ` (${t('disabled')})`}` }))} />
                        <button onClick={() => { if (confirm(t('confirmReset'))) onChange(game, { ...defaultGameConfig(game), enabled: cfg.enabled, accounts: cfg.accounts, rotation: cfg.rotation, sessionScope: cfg.sessionScope }); }}
                            className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm flex items-center gap-2 border border-[#374151]" title={t('reset')}>
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="mt-4">
                    <CanvasEditor
                        width={canvas.width}
                        height={canvas.height}
                        snap={10}
                        onMove={(_, position) => onChange(game, { position })}
                        items={account ? [{
                            id: 'card',
                            position: cfg.position,
                            node: (
                                // La caja fija se marca con un borde punteado: lo que no entra en ella no se ve en OBS.
                                <div style={{ outline: '1px dashed rgba(96,165,250,.6)', outlineOffset: 0 }}>
                                    <GameOverlayCard game={game} gameName={GAME_NAMES[game]} config={cfg} account={account} view={previewView} promo={previewPromo}
                                        accountIndex={0} accountCount={preview?.accounts.length ?? 1} switchAnimation="none" formatTier={formatTier} lang={lang} labels={CARD_LABELS[lang]} />
                                </div>
                            ),
                        }] : []}
                    />
                    {account && (
                        <div ref={measureRef} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
                            <GameOverlayCard game={game} gameName={GAME_NAMES[game]} config={{ ...cfg, scale: 1 }} account={{ ...account, livePhase: null }} view={previewView} promo={previewPromo} measure
                                accountIndex={0} accountCount={preview?.accounts.length ?? 1} switchAnimation="none" formatTier={formatTier} lang={lang} labels={CARD_LABELS[lang]} />
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[11px] text-[#94a3b8] mr-1">{t('view')}:</span>
                    {([...(hasStats ? availableViews(cfg, account) : ['main' as SlideView]), 'promo'] as CardView[]).map(v => (
                        <button key={v} onClick={() => setPreviewView(v)} className={`px-2.5 py-1 rounded-lg text-xs border ${previewView === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'}`}>
                            {v === 'promo' ? t('promoView') : t(`slideViews.${v}`)}
                        </button>
                    ))}
                </div>
                {hasStats && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[11px] text-[#94a3b8] mr-1" title={t('desktopSimHint')}>Desktop:</span>
                        {LIVE_SIM_PHASES.map(p => (
                            <button key={p} onClick={() => setLiveSim(p)} className={`px-2.5 py-1 rounded-lg text-xs border ${liveSim === p ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'}`}>{t(`liveSim.${p}`)}</button>
                        ))}
                    </div>
                )}
                <div className="flex flex-wrap items-end gap-4 mt-3">
                    <div className="w-40"><Label>{t('canvas')}</Label>
                        <SelectInput value={`${canvas.width}x${canvas.height}`} onChange={v => { const [w, h] = v.split('x').map(Number); onCanvasChange({ width: w, height: h }); }}
                            options={[{ value: '1920x1080', label: '1920×1080' }, { value: '1280x720', label: '1280×720' }, { value: '2560x1440', label: '2560×1440' }, { value: '3840x2160', label: '3840×2160' }]} />
                    </div>
                    <div className="w-28"><Label>{t('posX')}</Label><NumberInput value={cfg.position.x} onChange={x => onChange(game, { position: { ...cfg.position, x } })} min={0} max={canvas.width} /></div>
                    <div className="w-28"><Label>{t('posY')}</Label><NumberInput value={cfg.position.y} onChange={y => onChange(game, { position: { ...cfg.position, y } })} min={0} max={canvas.height} /></div>
                    <div className="w-28"><Label>{t('boxWidth')}</Label><NumberInput value={cfg.size.width} onChange={w => onChange(game, { size: { ...cfg.size, width: Math.max(CARD_SIZE_LIMITS.minWidth, Math.min(CARD_SIZE_LIMITS.maxWidth, w)) } })} min={CARD_SIZE_LIMITS.minWidth} max={CARD_SIZE_LIMITS.maxWidth} /></div>
                    <div className="w-28"><Label>{t('boxHeight')}</Label><NumberInput value={cfg.size.height} onChange={h => onChange(game, { size: { ...cfg.size, height: Math.max(CARD_SIZE_LIMITS.minHeight, Math.min(CARD_SIZE_LIMITS.maxHeight, h)) } })} min={CARD_SIZE_LIMITS.minHeight} max={CARD_SIZE_LIMITS.maxHeight} /></div>
                    <div className="w-40"><Label>{t('scale')}</Label><Slider value={Math.round((cfg.scale ?? 1) * 100)} onChange={v => onChange(game, { scale: Math.max(CARD_SIZE_LIMITS.minScale, Math.min(CARD_SIZE_LIMITS.maxScale, v / 100)) })} min={CARD_SIZE_LIMITS.minScale * 100} max={CARD_SIZE_LIMITS.maxScale * 100} unit="%" /></div>
                    <button onClick={fitToContent} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-xs flex items-center gap-2 border border-[#374151]" title={t('fitHint')}>
                        <Maximize2 className="w-3.5 h-3.5" />{t('fit')}
                    </button>
                </div>
                <p className="text-[11px] text-[#6b7280] mt-2">{t('boxHint')}</p>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <SectionTitle>{t('card')}</SectionTitle>
                    <div className="space-y-4 mt-3">
                        <div>
                            <Label>Layout</Label>
                            <div className="grid grid-cols-4 gap-2 mt-1">
                                {LAYOUT_PRESETS.map(l => (
                                    <button key={l} onClick={() => setLayout(l)} className={`px-2 py-2 rounded-lg text-xs border ${cfg.layout === l ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'}`}>{t(`layouts.${l}`)}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>{t('accent')}</Label>
                            <ColorInput value={cfg.accent ?? GAME_ACCENTS[game]} onChange={v => onChange(game, { accent: v })} />
                            <button className="text-[11px] text-[#94a3b8] underline mt-1" onClick={() => onChange(game, { accent: GAME_ACCENTS[game] })}>{t('useGameColor')}</button>
                        </div>
                        <div>
                            <Label>{t('background')}</Label>
                            <SelectInput value={cfg.background.type} onChange={v => onChange(game, { background: { ...cfg.background, type: v as any } })} options={[{ value: 'solid', label: t('bgSolid') }, { value: 'transparent', label: t('bgTransparent') }]} />
                        </div>
                        {cfg.background.type === 'solid' && (
                            <>
                                <div><Label>{t('bgColor')}</Label><ColorInput value={cfg.background.color} onChange={v => onChange(game, { background: { ...cfg.background, color: v } })} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>{t('opacity')}</Label><Slider value={cfg.background.opacity} onChange={v => onChange(game, { background: { ...cfg.background, opacity: v } })} min={0} max={100} unit="%" /></div>
                                    <div><Label>{t('radius')}</Label><Slider value={cfg.background.radius} onChange={v => onChange(game, { background: { ...cfg.background, radius: v } })} min={0} max={32} unit="px" /></div>
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-3 gap-3">
                            <div><Label>{t('animIn')}</Label><SelectInput value={cfg.animation.in} onChange={v => onChange(game, { animation: { ...cfg.animation, in: v as any } })} options={[{ value: 'fade', label: t('animFade') }, { value: 'slide', label: t('animSlide') }, { value: 'none', label: t('animNone') }]} /></div>
                            <div><Label>{t('animOut')}</Label><SelectInput value={cfg.animation.out} onChange={v => onChange(game, { animation: { ...cfg.animation, out: v as any } })} options={[{ value: 'fade', label: t('animFade') }, { value: 'slide', label: t('animSlide') }, { value: 'none', label: t('animNone') }]} /></div>
                            <div><Label>{t('animSwitch')}</Label><SelectInput value={cfg.animation.accountSwitch} onChange={v => onChange(game, { animation: { ...cfg.animation, accountSwitch: v as any } })} options={[{ value: 'slide', label: t('animSlide') }, { value: 'fade', label: t('animFade') }, { value: 'none', label: t('animNone') }]} /></div>
                        </div>
                        <div>
                            <Label>{t('chrome')}</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <Checkbox checked={cfg.chrome.accentLine} onChange={v => onChange(game, { chrome: { ...cfg.chrome, accentLine: v } })} label={t('chromeAccentLine')} />
                                <Checkbox checked={cfg.chrome.shadow} onChange={v => onChange(game, { chrome: { ...cfg.chrome, shadow: v } })} label={t('chromeShadow')} />
                                <Checkbox checked={cfg.chrome.queueTag} onChange={v => onChange(game, { chrome: { ...cfg.chrome, queueTag: v } })} label={t('chromeQueueTag')} />
                                <Checkbox checked={cfg.chrome.accountCounter} onChange={v => onChange(game, { chrome: { ...cfg.chrome, accountCounter: v } })} label={t('chromeAccountCounter')} />
                            </div>
                            {cfg.chrome.accentLine && <div className="mt-2"><Label>{t('chromeAccentWidth')}</Label><Slider value={cfg.chrome.accentWidth} onChange={v => onChange(game, { chrome: { ...cfg.chrome, accentWidth: v } })} min={1} max={12} unit="px" /></div>}
                        </div>
                    </div>
                </Card>

                <Card>
                    <SectionTitle>{t('elements')}</SectionTitle>
                    {hasStats && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="text-[11px] text-[#94a3b8]">{t('preset')}:</span>
                            {STYLE_PRESETS.map(p => (
                                <button key={p} onClick={() => applyPreset(p)} className="px-2.5 py-1 rounded-lg text-xs border bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]" title={t('presetHint')}>{t(`presets.${p}`)}</button>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {ELEMENT_ORDER.map(id => {
                            const visible = cfg.elements[id]?.visible !== false;
                            return (
                                <button key={id} onClick={() => setSelected(id)} className={`px-2.5 py-1.5 rounded-lg text-xs border ${selected === id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#111214] border-[#374151] text-[#e6edf3] hover:bg-[#262626]'} ${visible ? '' : 'line-through opacity-60'}`}>
                                    {t(`elementNames.${id}`)}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 space-y-4">
                        <Toggle checked={el.visible !== false} onChange={v => setEl({ visible: v })} label={`${t('show')} ${t(`elementNames.${selected}`).toLowerCase()}`} size="sm" />

                        {selected === 'emblem' && (
                            <div><Label>{t('size')}</Label><Slider value={el.size ?? 96} onChange={v => setEl({ size: v })} min={32} max={200} unit="px" /></div>
                        )}
                        {selected === 'recent' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div><Label>{t('count')}</Label><NumberInput value={el.count ?? 5} onChange={v => setEl({ count: v })} min={1} max={20} /></div>
                                <div><Label>{t('style')}</Label><SelectInput value={el.style ?? 'dots'} onChange={v => setEl({ style: v as any })} options={[{ value: 'dots', label: t('styleDots') }, { value: 'cards', label: t('styleCards') }, ...(hasStats ? [{ value: 'icons', label: t('styleIcons') }] : [])]} /></div>
                            </div>
                        )}
                        {selected === 'winrate' && (
                            <div><Label>{t('whichWinrate')}</Label>
                                <SelectInput value={el.scope ?? 'ranked'} onChange={v => setEl({ scope: v as any })} options={[{ value: 'ranked', label: t('wrRanked') }, { value: 'recent', label: t('wrRecent') }, { value: 'session', label: t('wrSession') }]} />
                            </div>
                        )}
                        {selected === 'kdaCs' && (
                            <div><Label>{t('metrics')}</Label>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('kda')} onChange={() => toggleMetric('kda')} label="KDA" />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('cs')} onChange={() => toggleMetric('cs')} label={t('metricCs')} />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('damage')} onChange={() => toggleMetric('damage')} label={t('metricDamage')} />
                                    <Checkbox checked={(el.metrics ?? ['kda', 'cs']).includes('vision')} onChange={() => toggleMetric('vision')} label={t('metricVision')} />
                                </div>
                            </div>
                        )}
                        {(selected === 'topChamps' || selected === 'mastery') && (
                            <div><Label>{t('count')}</Label><NumberInput value={el.count ?? 3} onChange={v => setEl({ count: v })} min={1} max={5} /></div>
                        )}
                        {selected === 'lpGraph' && (
                            <div><Label>{t('graphHeight')}</Label><Slider value={el.height ?? 48} onChange={v => setEl({ height: v })} min={24} max={120} unit="px" /></div>
                        )}
                        {selected === 'streak' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.streak')}</p>}
                        {selected === 'topChamps' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.topChamps')}</p>}
                        {selected === 'mastery' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.mastery')}</p>}
                        {selected === 'lpGraph' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.lpGraph')}</p>}
                        {selected === 'champSelect' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.champSelect')}</p>}
                        {selected === 'postGame' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.postGame')}</p>}
                        {selected === 'prediction' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.prediction')}</p>}
                        {selected === 'coachSay' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.coachSay')}</p>}
                        {selected === 'liveCharacter' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.liveCharacter')}</p>}
                        {selected === 'session' && (
                            <Checkbox checked={el.showDelta !== false} onChange={v => setEl({ showDelta: v })} label={t('showDelta')} />
                        )}
                        {hasFont && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>{t('font')}</Label>
                                        <SelectInput value={el.font?.family ?? 'Inter'} onChange={v => setFont({ family: v })} options={FONT_FAMILIES.map(f => ({ value: f, label: f }))} />
                                    </div>
                                    <div>
                                        <Label>{t('weight')}</Label>
                                        <SelectInput value={String(el.font?.weight ?? 500)} onChange={v => setFont({ weight: Number(v) })} options={[400, 500, 600, 700, 800].map(w => ({ value: String(w), label: String(w) }))} />
                                    </div>
                                </div>
                                <div><Label>{t('size')}</Label><Slider value={el.font?.size ?? 14} onChange={v => setFont({ size: v })} min={8} max={72} unit="px" /></div>
                                <div><Label>{t('color')}</Label><ColorInput value={el.font?.color ?? '#ffffff'} onChange={v => setFont({ color: v })} /></div>
                                <Checkbox checked={!!el.font?.shadow} onChange={v => setFont({ shadow: v })} label={t('shadow')} />
                            </div>
                        )}
                        {selected === 'gameLogo' && <p className="text-[11px] text-[#6b7280]">{t('elementHelp.gameLogo')}</p>}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Card>
                    <SectionTitle>{t('slides')}</SectionTitle>
                    <SubLabel>{t('slidesHint')}</SubLabel>
                    <div className="space-y-4 mt-3">
                        <Toggle checked={cfg.slides.enabled} onChange={v => onChange(game, { slides: { ...cfg.slides, enabled: v } })} label={t('slidesToggle')} size="sm" disabled={!hasStats} />
                        {!hasStats && <p className="text-[11px] text-[#6b7280]">{t('slidesOnlyStats')}</p>}
                        {hasStats && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>{t('secondsPerView')}</Label><NumberInput value={cfg.slides.seconds} onChange={v => onChange(game, { slides: { ...cfg.slides, seconds: Math.max(4, v) } })} min={4} max={120} /></div>
                                    <div><Label>{t('slidesAnimation')}</Label><SelectInput value={cfg.slides.animation ?? 'fade'} onChange={v => onChange(game, { slides: { ...cfg.slides, animation: v as any } })} options={[{ value: 'fade', label: t('animFade') }, { value: 'slide', label: t('animSlide') }, { value: 'none', label: t('animNone') }]} /></div>
                                </div>
                                <div>
                                    <Label>{t('views')}</Label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        {SLIDE_VIEWS.map(v => (
                                            <Checkbox key={v} checked={cfg.slides.views.includes(v)} onChange={() => toggleView(v)} label={t(`slideViews.${v}`)} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </Card>

                <Card>
                    <SectionTitle>{t('promo')}</SectionTitle>
                    <SubLabel>{t('promoHint')}</SubLabel>
                    <div className="space-y-4 mt-3">
                        <Toggle checked={promoForced || cfg.promo.enabled} onChange={v => onChange(game, { promo: { ...cfg.promo, enabled: v } })} label={t('promoToggle')} size="sm" disabled={promoForced} />
                        {promoForced && <p className="text-[11px] text-[#94a3b8]">{t('promoForced')} <a href="/supporters" className="text-blue-400 underline">{t('seePlans')}</a></p>}
                        <p className="text-[11px] text-[#6b7280]">{t('promoManaged', { every: promoCatalog?.everySeconds ?? 180, n: promoCatalog?.items.length ?? 0 })}</p>
                        <p className="text-[11px] text-[#6b7280]">{t('promoNote')}</p>
                    </div>
                </Card>
            </div>
        </div>
    );
};
