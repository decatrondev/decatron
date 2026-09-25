/**
 * Tarjeta del overlay de juegos: una cuenta, un juego. Renderiza los elementos
 * (emblema, rango, puntos, sesion, ultimas partidas, nombre, campeon en vivo)
 * segun el layout y la visibilidad/fuentes de la config. Es el mismo componente
 * que usa el editor para el preview, asi lo que se ve en el panel es lo que sale
 * en OBS.
 *
 * La tarjeta tiene una CAJA FIJA (config.size × config.scale): nada la estira. Todo
 * elemento encendido reserva su lugar aunque falte el dato ("—", casillas vacías),
 * los textos largos se recortan y lo que no entra queda oculto. Así no cambia de
 * tamaño al rotar cuentas ni vistas (LIVE_MATCH_OVERLAY_PLAN.md §2).
 */
import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { AccountOverlayState, AccountStats, ElementConfig, FontStyle, GameId, GameVisualConfig, LivePhaseInfo, MatchSummary, PointsSample, PromoItem, ROLE_LABELS, SessionState } from './types';
import { CardView, PROMO_MESSAGES } from './slides';
import { BrandMark } from '../../../brand/BrandMark';

interface Props {
    game: GameId;
    gameName: string;
    config: GameVisualConfig;
    account: AccountOverlayState;
    aggregate?: { wins: number; losses: number; pointsDelta: number | null } | null;
    accountIndex: number;
    accountCount: number;
    switchAnimation: 'fade' | 'slide' | 'none';
    formatTier: (tier: string) => string;
    /** Textos fijos de la tarjeta (por defecto en español; el overlay usa el idioma del canal). */
    labels?: Partial<CardLabels>;
    /** Vista actual de la rotación (ver slides.ts). undefined = principal. */
    view?: CardView;
    lang?: 'es' | 'en';
    /** Anuncio a mostrar cuando view === 'promo' (del catálogo del admin). null = mensaje de fábrica. */
    promo?: PromoItem | null;
    /** Solo para el editor: sin caja fija, para medir cuánto ocupa el contenido ("ajustar al contenido"). */
    measure?: boolean;
}

/**
 * La caja de la tarjeta: tamaño fijo, escala, fondo, línea de acento y sombra. El
 * envoltorio exterior ocupa lo que la caja mide en pantalla (size × scale) para que
 * el editor y OBS la ubiquen igual; el interior va en px reales y se escala.
 */
export function CardBox({ config, animation, measure, children, style }: {
    config: GameVisualConfig; animation?: string; measure?: boolean; children: ReactNode; style?: CSSProperties;
}) {
    const accent = config.accent ?? '#c8aa6e';
    const chrome = config.chrome;
    const isBar = config.layout === 'bar';
    const scale = config.scale || 1;
    const radius = config.background.type === 'transparent' ? 0 : isBar ? Math.min(config.background.radius, 8) : config.background.radius;
    const bg: CSSProperties = config.background.type === 'transparent'
        ? {}
        : { background: hexToRgba(config.background.color, config.background.opacity), borderRadius: radius };
    const accentLine: CSSProperties = chrome.accentLine
        ? (isBar ? { borderTop: `${chrome.accentWidth}px solid ${accent}` } : { borderLeft: `${chrome.accentWidth}px solid ${accent}` })
        : {};
    const box: CSSProperties = {
        ...bg, ...accentLine, ...style,
        boxSizing: 'border-box',
        boxShadow: chrome.shadow ? '0 4px 16px rgba(0,0,0,.35)' : undefined,
        overflow: measure ? 'visible' : 'hidden',
        width: measure ? undefined : config.size.width,
        height: measure ? undefined : config.size.height,
        display: measure ? 'inline-flex' : 'flex',
        animation,
    };
    return (
        <div style={{ position: 'relative', width: measure ? undefined : config.size.width * scale, height: measure ? undefined : config.size.height * scale, display: measure ? 'inline-block' : undefined }}>
            {/* Con alto fijo, los hijos de un flex con overflow hidden se encogen a 0: que cada fila conserve su alto y se recorte el sobrante. */}
            <style>{'.go-box>*{flex-shrink:0}'}</style>
            <div style={{ transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left', width: measure ? undefined : config.size.width }}>
                <div className="go-box" style={box}>{children}</div>
            </div>
        </div>
    );
}

/** Anuncio de Decatron: logo + mensaje + decatron.net. Tapa la tarjeta de la cuenta unos segundos, en la misma caja. */
export function PromoCard({ config, lang = 'es', animation, promo, measure }: { config: GameVisualConfig; lang?: 'es' | 'en'; animation?: string; promo?: PromoItem | null; measure?: boolean }) {
    const msgs = PROMO_MESSAGES[lang];
    const title = promo?.title ?? msgs.title;
    const line = promo?.line ?? msgs.lines[Math.floor(Date.now() / 60000) % msgs.lines.length];
    const image = promo?.imageUrl || '/brand/decatron-lockup-light.png';
    // Un anuncio con imagen propia manda esa; si no, el logo que se edita en /admin/brand.
    const logo = (variant: 'bar' | 'card', fallback: ReactNode) =>
        promo?.imageUrl ? fallback : <BrandMark slot="games-promo" variant={variant} theme="dark" fallback={fallback} />;
    const url = <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>decatron<span style={{ color: '#3b82f6' }}>.net</span></div>;
    // Con fondo transparente el anuncio igual lleva fondo: sin él no se lee sobre el juego.
    const forcedBg: CSSProperties = config.background.type === 'transparent'
        ? { background: 'rgba(15,17,21,.9)', borderRadius: 12 }
        : { background: hexToRgba(config.background.color, Math.max(config.background.opacity, 70)) };
    const font: CSSProperties = { fontFamily: 'Inter, system-ui, sans-serif' };
    if (config.layout === 'bar' || config.layout === 'compact') {
        return (
            <CardBox config={config} animation={animation} measure={measure} style={{ ...forcedBg, ...font, padding: '6px 18px', alignItems: 'center', gap: 18 }}>
                {logo('bar', <img src={image} alt="Decatron" style={{ height: 40, width: 'auto', maxWidth: 160, objectFit: 'contain', flexShrink: 0 }} />)}
                <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: '#c9d1d9', whiteSpace: 'normal', flex: 1, flexShrink: 1, minWidth: 0, overflow: 'hidden', maxHeight: '3.9em' }}>{line}</div>
                <span style={{ width: 1, height: 26, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, minWidth: 'max-content', paddingRight: 4 }}><span style={{ fontSize: 9, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{title}</span>{url}</div>
            </CardBox>
        );
    }
    return (
        <CardBox config={config} animation={animation} measure={measure} style={{ ...forcedBg, ...font, padding: '14px 18px', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', maxWidth: config.layout === 'emblem-only' ? 200 : 380 }}>
            {logo('card', <img src={image} alt="Decatron" style={{ width: '70%', maxWidth: 200, height: 'auto', maxHeight: '40%', objectFit: 'contain' }} />)}
            <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.3, whiteSpace: 'normal', overflow: 'hidden' }}>{line}</div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
            {url}
        </CardBox>
    );
}

export interface CardLabels {
    today: string; inGame: string; noMatches: string;
    winrate: string; last: string; season: string; streakWin: string; streakLoss: string; topChamps: string; mastery: string; lpGraph: string; games: string;
    lobby: string; matchmaking: string; champSelect: string; postGame: string; victory: string; defeat: string; yourTurn: string; bans: string; team: string; enemy: string;
    prediction: string; predWin: string; predLoss: string; predClosesIn: string; predClosed: string; predRefund: string; predWinners: string; predHint: string; predNoBets: string;
    /** Marcadores cuando falta el dato: la caja es fija y cada elemento reserva su lugar. */
    noPoints: string; noSession: string; noData: string; noStreak: string; offGame: string; unranked: string;
}
export const CARD_LABELS: Record<'es' | 'en', CardLabels> = {
    es: { today: 'Hoy', inGame: 'En partida', noMatches: 'Sin partidas en esta sesión', winrate: 'Winrate', last: 'últimas', season: 'temporada', streakWin: 'victorias seguidas', streakLoss: 'derrotas seguidas', topChamps: 'Top campeones', mastery: 'Maestría', lpGraph: 'LP de hoy', games: 'partidas',
          lobby: 'En lobby', matchmaking: 'Buscando partida', champSelect: 'Selección de campeón', postGame: 'Fin de partida', victory: 'Victoria', defeat: 'Derrota', yourTurn: '¡Tu turno!', bans: 'Bans', team: 'Equipo', enemy: 'Rival',
          prediction: 'Predicción del chat', predWin: 'Gana', predLoss: 'Pierde', predClosesIn: 'cierra en', predClosed: 'cerrada', predRefund: 'Sin apuestas en contra: puntos devueltos', predWinners: 'acertaron', predHint: '!pred win|loss [puntos]', predNoBets: 'Nadie apostó todavía',
          noPoints: '—', noSession: 'sin partidas', noData: 'sin datos', noStreak: 'sin racha', offGame: 'Fuera de partida', unranked: 'Sin clasificar' },
    en: { today: 'Today', inGame: 'In game', noMatches: 'No matches this session', winrate: 'Winrate', last: 'last', season: 'season', streakWin: 'win streak', streakLoss: 'loss streak', topChamps: 'Top champions', mastery: 'Mastery', lpGraph: "Today's LP", games: 'games',
          lobby: 'In lobby', matchmaking: 'Finding match', champSelect: 'Champion select', postGame: 'Game over', victory: 'Victory', defeat: 'Defeat', yourTurn: 'Your turn!', bans: 'Bans', team: 'Team', enemy: 'Enemy',
          prediction: 'Chat prediction', predWin: 'Win', predLoss: 'Loss', predClosesIn: 'closes in', predClosed: 'closed', predRefund: 'No bets against: points refunded', predWinners: 'got it right', predHint: '!pred win|loss [points]', predNoBets: 'No bets yet',
          noPoints: '—', noSession: 'no games', noData: 'no data', noStreak: 'no streak', offGame: 'Not in game', unranked: 'Unranked' },
};

export function formatTierLabel(t: string): string { const x = t.toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); }

export const WIN = '#4ade80';
export const LOSS = '#f87171';
export const NEUTRAL = '#8b949e';

export function fontStyle(f?: FontStyle, fallbackSize = 14): CSSProperties {
    return {
        fontFamily: f?.family ? `"${f.family}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif',
        fontSize: f?.size ?? fallbackSize,
        fontWeight: f?.weight ?? 500,
        color: f?.color ?? '#ffffff',
        textShadow: f?.shadow ? '0 1px 3px rgba(0,0,0,.6)' : undefined,
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
    };
}

export function hexToRgba(hex: string, opacityPct: number): string {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(100, opacityPct)) / 100})`;
}

function RecentMatches({ matches, cfg }: { matches: MatchSummary[]; cfg: ElementConfig; noMatches?: string }) {
    const count = cfg.count ?? 5;
    const list: (MatchSummary | null)[] = matches.filter(m => m.result !== 'remake').slice(0, count);
    // Caja fija: siempre `count` casillas, las que faltan van vacías.
    while (list.length < count) list.push(null);
    const EMPTY = 'rgba(255,255,255,.08)';

    if (cfg.style === 'icons') {
        return (
            <div style={{ display: 'flex', gap: 5 }}>
                {list.map((m, i) => m ? (
                    <div key={m.id} title={`${m.character ?? ''} ${m.kills ?? ''}/${m.deaths ?? ''}/${m.assists ?? ''}`} style={{
                        width: 30, height: 30, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                        border: `2px solid ${m.result === 'win' ? WIN : LOSS}`, background: '#1c1f26', boxShadow: '0 1px 2px rgba(0,0,0,.4)',
                    }}>
                        {m.characterIcon
                            ? <img src={m.characterIcon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: m.result === 'win' ? WIN : LOSS, fontFamily: 'Inter, sans-serif' }}>{m.result === 'win' ? 'W' : 'L'}</div>}
                    </div>
                ) : <div key={`e${i}`} style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0, border: `2px solid ${EMPTY}`, boxSizing: 'border-box' }} />)}
            </div>
        );
    }

    if (cfg.style === 'cards') {
        return (
            <div style={{ display: 'flex', gap: 6 }}>
                {list.map((m, i) => m ? (
                    <div key={m.id} title={m.character ?? ''} style={{
                        width: 44, padding: '4px 6px', borderRadius: 6, textAlign: 'center', boxSizing: 'border-box',
                        background: m.result === 'win' ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
                        borderBottom: `2px solid ${m.result === 'win' ? WIN : LOSS}`,
                        fontFamily: 'Inter, sans-serif', color: '#e6edf3',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{m.result === 'win' ? 'W' : 'L'}</div>
                        <div style={{ fontSize: 10, color: NEUTRAL, whiteSpace: 'nowrap' }}>{m.kills != null ? `${m.kills}/${m.deaths}/${m.assists}` : m.placement != null ? `#${m.placement}` : '\u00a0'}</div>
                    </div>
                ) : <div key={`e${i}`} style={{ width: 44, height: 38, borderRadius: 6, boxSizing: 'border-box', background: EMPTY, borderBottom: `2px solid ${EMPTY}` }} />)}
            </div>
        );
    }

    // dots (default): mas reciente a la izquierda
    return (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {list.map((m, i) => (
                <span key={m?.id ?? `e${i}`} title={m?.character ?? ''} style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: !m ? EMPTY : m.result === 'win' ? WIN : m.result === 'loss' ? LOSS : NEUTRAL,
                    boxShadow: m ? '0 1px 2px rgba(0,0,0,.4)' : undefined,
                }} />
            ))}
        </div>
    );
}

export function fmtK(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)); }

function ChampRow({ name, icon, right, sub, font }: { name: string; icon?: string | null; right: string; sub?: string; font: CSSProperties }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, overflow: 'hidden', background: '#1c1f26', flexShrink: 0 }}>
                {icon && <img src={icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
            </div>
            <div style={{ ...font, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                {sub && <span style={{ fontSize: '0.8em', color: NEUTRAL }}>{sub}</span>}
            </div>
            <span style={{ ...font, fontWeight: 700 }}>{right}</span>
        </div>
    );
}

function LpGraph({ history, height, accent, label, noData, width = 220 }: { history: PointsSample[]; height: number; accent: string; label: string; noData: string; width?: number }) {
    if (history.length < 2) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: NEUTRAL, fontFamily: 'Inter, sans-serif' }}>{label}</div>
                <div style={{ width, height, borderRadius: 4, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: NEUTRAL, fontSize: 11, fontFamily: 'Inter, sans-serif' }}>{noData}</div>
            </div>
        );
    }
    const w = width, h = height, pad = 3;
    const vals = history.map(p => p.absolute);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = Math.max(1, max - min);
    const x = (i: number) => pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
    const d = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.absolute).toFixed(1)}`).join(' ');
    const delta = vals[vals.length - 1] - vals[0];
    const color = delta > 0 ? WIN : delta < 0 ? LOSS : accent;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: NEUTRAL, fontFamily: 'Inter, sans-serif' }}>
                <span>{label}</span><span style={{ color, fontWeight: 700 }}>{delta > 0 ? '+' : ''}{delta}</span>
            </div>
            <svg width={w} height={h} style={{ display: 'block' }}>
                <path d={`${d} L${x(history.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`} fill={color} opacity={0.15} />
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(history.length - 1)} cy={y(vals[vals.length - 1])} r={3} fill={color} />
            </svg>
        </div>
    );
}

/** Reloj de 1 s solo mientras hay partida en curso (para el mm:ss). */
export function useTicker(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [active]);
    return now;
}

export function fmtDuration(sec: number): string { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; }

export function ChampIcon({ champ, size = 30, ring, dim }: { champ?: { name: string; icon?: string | null } | null; size?: number; ring?: string; dim?: boolean }) {
    return (
        <div title={champ?.name ?? ''} style={{ width: size, height: size, borderRadius: 6, overflow: 'hidden', background: '#1c1f26', flexShrink: 0, border: ring ? `2px solid ${ring}` : '2px solid transparent', opacity: dim ? 0.45 : 1, boxShadow: ring ? `0 0 8px ${ring}` : undefined }}>
            {champ?.icon && <img src={champ.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        </div>
    );
}

/** Línea de estado en vivo: lobby / buscando / selección / en partida mm:ss / fin. Reemplaza al "En partida" de la Riot API cuando hay Desktop. */
export function LiveStatusLine({ live, font, L, accent, now }: { live: LivePhaseInfo; font: CSSProperties; L: CardLabels; accent: string; now: number }) {
    const dot = (color: string) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />;
    const row = (children: JSX.Element | (JSX.Element | string | null)[]) => <div style={{ ...font, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>;
    switch (live.phase) {
        case 'lobby': {
            // Con scouting (3b): "Roba · Oro II · 55%" por miembro; sin él, solo el nombre.
            const others = live.lobby.filter(m => !m.isMe).map(m => {
                const sc = m.scout;
                if (!sc) return m.name;
                const parts = [m.name];
                if (sc.tier) parts.push(`${formatTierLabel(sc.tier)}${sc.division ? ' ' + sc.division : ''}`);
                if (sc.winRate != null && sc.games >= 5) parts.push(`${sc.winRate}%`);
                return parts.join(' · ');
            });
            return row([dot(NEUTRAL), <span key="t">{L.lobby}{live.queueName ? ` · ${live.queueName}` : ''}{others.length ? ` · ${others.join(' | ')}` : ''}</span>]);
        }
        case 'matchmaking':
            return row([dot(accent), <span key="t">{L.matchmaking}{live.queueName ? ` · ${live.queueName}` : ''}</span>]);
        case 'champselect': {
            const cs = live.champSelect;
            return row([dot(accent), <span key="t">{L.champSelect}{cs?.myPick ? ` · ${cs.myPick.name}` : ''}{cs?.myTurn ? <span style={{ color: accent, marginLeft: 6, fontWeight: 800 }}>{L.yourTurn}</span> : null}</span>]);
        }
        case 'ingame': {
            const g = live.game;
            const started = g?.startedAt ? new Date(g.startedAt).getTime() : null;
            const elapsed = started ? Math.max(0, (now - started) / 1000) : null;
            return row([dot(LOSS), g?.champion && <ChampIcon key="i" champ={g.champion} size={20} />, <span key="t">{L.inGame}{g?.champion ? ` · ${g.champion.name}` : ''}{g?.position ? ` · ${ROLE_LABELS[g.position] ?? g.position}` : ''}{elapsed != null ? ` · ${fmtDuration(elapsed)}` : ''}</span>]);
        }
        case 'postgame': {
            const pg = live.postGame;
            if (!pg) return row([dot(NEUTRAL), <span key="t">{L.postGame}</span>]);
            return row([dot(pg.win ? WIN : LOSS), <span key="t" style={{ color: pg.win ? WIN : LOSS, fontWeight: 800 }}>{pg.win ? L.victory : L.defeat}</span>, <span key="k">{pg.kills}/{pg.deaths}/{pg.assists}</span>]);
        }
        default:
            return null;
    }
}
function StatsBlocks({ el, stats, session, rank, L, accent, isVisible, graphWidth }: {
    el: GameVisualConfig['elements']; stats?: AccountStats | null; session?: SessionState | null; rank?: AccountOverlayState['rank'];
    L: CardLabels; accent: string; isVisible: (id: keyof GameVisualConfig['elements']) => boolean; graphWidth?: number;
}) {
    const hasSession = !!session && session.wins >= 0 && session.losses >= 0;
    const blocks: JSX.Element[] = [];
    const caption = (t: string) => <span style={{ color: NEUTRAL, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>{t}</span>;

    if (isVisible('winrate')) {
        const scope = el.winrate?.scope ?? 'ranked';
        let value: number | null | undefined; let sub = '';
        if (scope === 'session' && hasSession) { value = session!.winRate; sub = `${session!.wins}W ${session!.losses}L · ${L.today.toLowerCase()}`; }
        else if (scope === 'recent' && stats) { value = stats.winRate; sub = `${L.last} ${stats.sampleSize} ${L.games}`; }
        else if (rank && !rank.isUnranked) { value = rank.winRate; sub = `${rank.wins}W ${rank.losses}L · ${L.season}`; }
        const color = value == null ? NEUTRAL : value >= 55 ? WIN : value < 45 ? LOSS : '#e6edf3';
        blocks.push(
            <div key="winrate" style={{ display: 'flex', alignItems: 'baseline', gap: 8, ...fontStyle(el.winrate?.font, 14) }}>
                <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.winrate}</span>
                <span style={{ color, fontWeight: 700 }}>{value == null ? '—' : `${Math.round(value)}%`}</span>
                <span style={{ color: NEUTRAL, fontSize: '0.8em', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value == null ? L.noData : sub}</span>
            </div>
        );
    }

    if (isVisible('kdaCs')) {
        const metrics = el.kdaCs?.metrics ?? ['kda', 'cs'];
        const has = !!stats && stats.sampleSize > 0;
        const parts: { k: string; v: string }[] = [];
        if (metrics.includes('kda')) parts.push({ k: 'KDA', v: has && stats!.avgKda != null ? `${stats!.avgKda.toFixed(1)} (${stats!.avgKills?.toFixed(1)}/${stats!.avgDeaths?.toFixed(1)}/${stats!.avgAssists?.toFixed(1)})` : '—' });
        if (metrics.includes('cs')) parts.push({ k: 'CS/min', v: has && stats!.avgCsPerMin != null ? stats!.avgCsPerMin.toFixed(1) : '—' });
        if (metrics.includes('damage')) parts.push({ k: 'DMG', v: has && stats!.avgDamage != null ? fmtK(stats!.avgDamage) : '—' });
        if (metrics.includes('vision')) parts.push({ k: 'VS', v: has && stats!.avgVisionScore != null ? stats!.avgVisionScore.toFixed(0) : '—' });
        if (parts.length) blocks.push(
            <div key="kdaCs" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, ...fontStyle(el.kdaCs?.font, 13), whiteSpace: 'normal' }}>
                {parts.map(p => <span key={p.k} style={{ whiteSpace: 'nowrap' }}><span style={{ color: NEUTRAL, fontSize: '0.8em', marginRight: 4 }}>{p.k}</span>{p.v}</span>)}
                {has && stats!.mainRole && <span style={{ color: accent, fontSize: '0.8em', fontWeight: 700 }}>{ROLE_LABELS[stats!.mainRole] ?? stats!.mainRole}</span>}
            </div>
        );
    }

    if (isVisible('streak')) {
        const streak = hasSession && session!.streak ? session!.streak : stats?.streak ?? 0;
        const on = Math.abs(streak) >= 2;
        blocks.push(
            <div key="streak" style={{ display: 'flex', alignItems: 'center', gap: 6, ...fontStyle(el.streak?.font, 13) }}>
                {on
                    ? <><span style={{ color: streak > 0 ? WIN : LOSS }}>{streak > 0 ? '🔥' : '❄️'} {Math.abs(streak)}</span><span style={{ color: NEUTRAL, fontSize: '0.85em' }}>{streak > 0 ? L.streakWin : L.streakLoss}</span></>
                    : <span style={{ color: NEUTRAL }}>— <span style={{ fontSize: '0.85em' }}>{L.noStreak}</span></span>}
            </div>
        );
    }

    const emptyRow = (key: string, font: CSSProperties) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />
            <span style={{ ...font, color: NEUTRAL, flex: 1 }}>—</span>
        </div>
    );

    if (isVisible('topChamps')) {
        const font = fontStyle(el.topChamps?.font, 12);
        const n = el.topChamps?.count ?? 3;
        const rows = (stats?.topCharacters ?? []).slice(0, n);
        blocks.push(
            <div key="topChamps" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {caption(L.topChamps)}
                {rows.map(c => (
                    <ChampRow key={c.name} name={c.name} icon={c.icon} font={font}
                        right={`${c.winRate ?? Math.round(100 * c.wins / Math.max(1, c.games))}%`}
                        sub={`${c.wins}W ${c.losses}L${c.avgKda != null ? ` · ${c.avgKda.toFixed(1)} KDA` : ''}`} />
                ))}
                {Array.from({ length: n - rows.length }, (_, i) => emptyRow(`tc${i}`, font))}
            </div>
        );
    }

    if (isVisible('mastery')) {
        const font = fontStyle(el.mastery?.font, 12);
        const n = el.mastery?.count ?? 3;
        const rows = (stats?.mastery ?? []).slice(0, n);
        blocks.push(
            <div key="mastery" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {caption(L.mastery)}
                {rows.map(m => <ChampRow key={m.name} name={m.name} icon={m.icon} font={font} right={`M${m.level}`} sub={`${fmtK(m.points)} pts`} />)}
                {Array.from({ length: n - rows.length }, (_, i) => emptyRow(`ma${i}`, font))}
            </div>
        );
    }

    if (isVisible('lpGraph')) {
        blocks.push(<LpGraph key="lpGraph" history={hasSession ? session!.pointsHistory ?? [] : []} height={el.lpGraph?.height ?? 48} accent={accent} label={L.lpGraph} noData={L.noData} width={graphWidth} />);
    }

    return blocks.length ? <>{blocks}</> : null;
}

export function GameOverlayCard({ game, gameName, config, account, aggregate, accountIndex, accountCount, switchAnimation, formatTier, labels, view, lang, promo, measure }: Props) {
    const L = { ...CARD_LABELS.es, ...labels };
    const el = config.elements;
    const accent = config.accent ?? '#c8aa6e';
    const chrome = config.chrome;
    const rank = account.rank;
    const session = account.session;
    // Offline (canal sin stream) el backend manda wins/losses = -1: hay rango y
    // partidas pero no sesion -> la fila "Hoy" queda en gris ("sin partidas").
    const hasSession = !!session && session.wins >= 0 && session.losses >= 0;
    const wins = aggregate?.wins ?? session?.wins ?? 0;
    const losses = aggregate?.losses ?? session?.losses ?? 0;
    const delta = aggregate ? aggregate.pointsDelta : session?.pointsDelta ?? null;
    const pointsLabel = rank?.pointsLabel ?? '';
    const isVisible = (id: keyof typeof el) => el[id]?.visible !== false;
    const live = account.livePhase && account.livePhase.phase !== 'none' ? account.livePhase : null;
    const now = useTicker(live?.phase === 'ingame');

    const switchAnim = switchAnimation === 'none' ? undefined : `go-${switchAnimation}-in 0.35s ease`;
    const emblemSize = el.emblem?.size ?? 96;
    const layout = config.layout;
    const horizontal = layout === 'compact' || layout === 'bar';
    const isBar = layout === 'bar';
    // Ancho útil para el gráfico de LP: la caja menos el padding lateral.
    const graphWidth = Math.max(80, config.size.width - 36);
    const clip: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

    const rankText = rank
        ? (rank.isUnranked ? L.unranked : `${formatTier(rank.tier)}${rank.division ? ` ${rank.division}` : ''}`)
        : '—';
    const queueTag = chrome.queueTag && rank?.queue === 'RANKED_FLEX_SR' ? 'Flex' : null;
    // Caja fija: sin LP igual se reserva la fila.
    const pointsText = rank && !rank.isUnranked && rank.points != null
        ? `${rank.points} ${pointsLabel}${rank.isExact ? '' : ' ≈'}`.trim()
        : L.noPoints;

    const deltaText = delta == null ? null : `${delta > 0 ? '+' : ''}${delta}${pointsLabel ? ' ' + pointsLabel : ''}`;
    const deltaColor = delta == null ? NEUTRAL : delta > 0 ? WIN : delta < 0 ? LOSS : NEUTRAL;

    if (view === 'promo') return <PromoCard config={config} lang={lang} animation={switchAnim} promo={promo} measure={measure} />;

    // ─── Piezas reutilizadas por los layouts ────────────────────────────────
    const emblem = (size: number) => (rank?.emblem
        ? <img src={rank.emblem} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
        : <div style={{ width: size, height: size, flexShrink: 0 }} />);

    const sessionRow = (style: CSSProperties = {}) => (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, ...fontStyle(el.session?.font, 15), ...style }}>
            <span style={{ color: NEUTRAL, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{L.today}</span>
            {(hasSession || aggregate)
                ? <>
                    <span><span style={{ color: WIN }}>{wins}W</span> <span style={{ color: NEUTRAL }}>·</span> <span style={{ color: LOSS }}>{losses}L</span></span>
                    {el.session?.showDelta !== false && <span style={{ color: deltaColor, fontWeight: 700 }}>{deltaText ?? '—'}</span>}
                </>
                : <span style={{ color: NEUTRAL }}>{L.noSession}</span>}
        </div>
    );

    // Estado en vivo: con Desktop, la fase real; sin Desktop, "En partida" de la Riot API; si no, "Fuera de partida" (reserva la fila).
    const liveRow = () => {
        const font = fontStyle(el.liveCharacter?.font, 13);
        if (live) return <LiveStatusLine live={live} font={font} L={L} accent={accent} now={now} />;
        const inGame = !!account.live?.inGame;
        return (
            <div style={{ ...font, display: 'flex', alignItems: 'center', gap: 6, color: inGame ? font.color : NEUTRAL }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: inGame ? LOSS : NEUTRAL, boxShadow: inGame ? `0 0 6px ${LOSS}` : undefined, flexShrink: 0 }} />
                {inGame && account.live?.characterIcon && <img src={account.live.characterIcon} alt="" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                <span style={clip}>{inGame ? `${L.inGame}${account.live?.character ? ` · ${account.live.character}` : ''}` : L.offGame}</span>
            </div>
        );
    };

    const boxProps = { config, animation: switchAnim, measure };

    if (layout === 'emblem-only') {
        return (
            <CardBox {...boxProps} style={{ padding: 10, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {emblem(emblemSize)}
                {isVisible('rank') && <div style={{ ...fontStyle(el.rank?.font, 26), fontSize: (el.rank?.font?.size ?? 26) * 0.7, maxWidth: '100%' }}>{rankText}</div>}
                {isVisible('lp') && <div style={{ ...fontStyle(el.lp?.font, 16), fontSize: (el.lp?.font?.size ?? 16) * 0.8, maxWidth: '100%' }}>{pointsText}</div>}
            </CardBox>
        );
    }

    // Vistas de la rotación ("tipo GIF"): misma cabecera, cuerpo distinto, MISMA caja.
    // Fuerzan visibles los elementos de la vista aunque estén apagados en la principal.
    if (view && view !== 'main') {
        const header = (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {rank?.emblem && emblem(emblemSize * 0.5)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ ...fontStyle(el.rank?.font, 26), fontSize: (el.rank?.font?.size ?? 26) * 0.7 }}>{rankText}<span style={{ ...fontStyle(el.lp?.font, 16), fontSize: '0.65em', marginLeft: 8, display: 'inline' }}>{pointsText}</span></div>
                    {isVisible('accountName') && <div style={fontStyle(el.accountName?.font, 13)}>{account.displayName}</div>}
                </div>
            </div>
        );
        const on = (ids: (keyof typeof el)[], extra?: Partial<Record<keyof typeof el, Partial<ElementConfig>>>) => {
            const e: typeof el = { ...el };
            for (const id of ids) e[id] = { ...(el[id] ?? { visible: true }), ...(extra?.[id] ?? {}), visible: true };
            return e;
        };
        let body: JSX.Element | null = null;
        if (view === 'stats') {
            const e = on(['winrate', 'kdaCs', 'streak'], { winrate: { scope: el.winrate?.scope ?? 'recent' }, kdaCs: { metrics: el.kdaCs?.metrics?.length ? el.kdaCs.metrics : ['kda', 'cs', 'damage', 'vision'] } });
            body = <StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => ['winrate', 'kdaCs', 'streak'].includes(id as string)} />;
        } else if (view === 'champs') {
            const e = on(['topChamps', 'mastery']);
            body = <div style={{ display: 'flex', gap: 18, minWidth: 0 }}><StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => ['topChamps', 'mastery'].includes(id as string)} /></div>;
        } else if (view === 'graph') {
            // El gráfico toma el alto que sobra en la caja (cabecera + sesión + partidas + separaciones), nunca la desborda.
            const headerH = Math.max(emblemSize * 0.5, 40) + (isVisible('gameLogo') ? 14 : 0);
            const padV = horizontal ? (isBar ? 12 : 20) : 28;
            const free = horizontal ? config.size.height - padV - 14 - 22 - 34 - 8 : config.size.height - padV - headerH - 22 - 34 - 14 - 30;
            const e = on(['lpGraph'], { lpGraph: { height: Math.max(24, Math.min(el.lpGraph?.height ?? 48, free)) } });
            body = (
                <>
                    {sessionRow({ fontSize: (el.session?.font?.size ?? 15) * 1.2 })}
                    <StatsBlocks el={e} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => id === 'lpGraph'} graphWidth={horizontal ? Math.max(120, Math.floor(config.size.width * 0.45)) : graphWidth} />
                    <RecentMatches matches={session?.matches ?? []} cfg={{ ...(el.recent ?? { visible: true }), style: el.recent?.style === 'dots' ? 'icons' : el.recent?.style }} />
                </>
            );
        }
        return (
            <CardBox {...boxProps} style={{
                padding: horizontal ? (isBar ? '6px 18px' : '10px 16px') : '14px 18px',
                flexDirection: horizontal ? 'row' : 'column', alignItems: horizontal ? 'center' : 'stretch', gap: horizontal ? 16 : 10,
            }}>
                {isVisible('gameLogo') && <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>{gameName}</div>}
                {header}
                {horizontal
                    ? <div style={{ display: 'flex', flexDirection: isBar ? 'row' : 'column', gap: isBar ? 16 : 6, alignItems: isBar ? 'center' : 'stretch', borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14, minWidth: 0, flex: 1 }}>{body}</div>
                    : body}
            </CardBox>
        );
    }

    // Barra: una tira horizontal fina para el borde superior/inferior del stream.
    // Todo en una linea con separadores; las stats/ultimas partidas van inline en vez de apiladas.
    if (isBar) {
        const sep = <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />;
        const items: JSX.Element[] = [];
        if (isVisible('emblem')) items.push(<span key="emblem">{emblem(emblemSize * 0.4)}</span>);
        if (isVisible('rank')) items.push(<span key="rank" style={{ ...fontStyle(el.rank?.font, 26), fontSize: (el.rank?.font?.size ?? 26) * 0.7 }}>{rankText}{queueTag ? <span style={{ fontSize: '0.5em', color: accent, marginLeft: 6, letterSpacing: 1 }}>{queueTag.toUpperCase()}</span> : null}</span>);
        if (isVisible('lp')) items.push(<span key="lp" style={fontStyle(el.lp?.font, 16)}>{pointsText}</span>);
        if (isVisible('session')) items.push(<span key="session">{sessionRow({ gap: 8 })}</span>);
        if (isVisible('recent')) items.push(<span key="recent"><RecentMatches matches={session?.matches ?? []} cfg={{ ...(el.recent ?? { visible: true }), count: Math.min(el.recent?.count ?? 5, 8) }} /></span>);
        // En barra no hay lugar para listas ni gráfico: solo winrate/KDA/racha.
        const barEl = { ...el, topChamps: { ...el.topChamps, visible: false }, mastery: { ...el.mastery, visible: false }, lpGraph: { ...el.lpGraph, visible: false } } as typeof el;
        const stats = <StatsBlocks el={barEl} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={id => barEl[id]?.visible === true} />;
        if (isVisible('accountName')) items.push(<span key="name" style={{ ...fontStyle(el.accountName?.font, 13), color: el.accountName?.font?.color ?? NEUTRAL }}>{account.displayName}{chrome.accountCounter && accountCount > 1 ? ` ${accountIndex + 1}/${accountCount}` : ''}</span>);
        if (isVisible('liveCharacter')) items.push(<span key="live">{liveRow()}</span>);
        return (
            <CardBox {...boxProps} style={{ padding: '6px 18px', alignItems: 'center', gap: 14 }}>
                {isVisible('gameLogo') && <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>{gameName}</span>}
                {items.flatMap((it, i) => i === 0 ? [it] : [<span key={`sep-${i}`} style={{ display: 'contents' }}>{sep}</span>, it])}
                <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>{stats}</span>
            </CardBox>
        );
    }

    // Tarjeta (vertical) y Compacto (dos columnas: emblema | rango + LP + sesion en una fila; stats en una columna aparte).
    return (
        <CardBox {...boxProps} style={{
            padding: horizontal ? '10px 16px' : '14px 18px',
            flexDirection: horizontal ? 'row' : 'column',
            alignItems: horizontal ? 'center' : 'stretch',
            gap: horizontal ? 16 : 10,
        }}>
            {/* Cabecera: emblema + rango + puntos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {isVisible('emblem') && emblem(horizontal ? emblemSize * 0.6 : emblemSize)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    {isVisible('gameLogo') && <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, fontFamily: 'Inter, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>{gameName}</div>}
                    {isVisible('rank') && (
                        <div style={{ ...fontStyle(el.rank?.font, 26), display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={clip}>{rankText}</span>
                            {queueTag && <span style={{ fontSize: '0.45em', fontWeight: 600, color: accent, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>{queueTag}</span>}
                        </div>
                    )}
                    {isVisible('lp') && <div style={fontStyle(el.lp?.font, 16)}>{pointsText}</div>}
                    {isVisible('accountName') && (
                        <div style={{ ...fontStyle(el.accountName?.font, 13), display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={clip}>{account.displayName}</span>
                            {chrome.accountCounter && accountCount > 1 && <span style={{ color: NEUTRAL, fontSize: 11, flexShrink: 0 }}>{accountIndex + 1}/{accountCount}</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Sesion */}
            {isVisible('session') && sessionRow(horizontal ? { flexDirection: 'column', gap: 2, borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14 } : {})}

            {/* Ultimas partidas */}
            {isVisible('recent') && <RecentMatches matches={session?.matches ?? []} cfg={el.recent ?? { visible: true }} />}

            {/* Estadísticas (fase "LoL enriquecido"); en compacto van en una columna aparte */}
            {horizontal
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '1px solid rgba(255,255,255,.12)', paddingLeft: 14, minWidth: 0 }}><StatsBlocks el={el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={isVisible} graphWidth={180} /></div>
                : <StatsBlocks el={el} stats={account.stats} session={session} rank={rank} L={L} accent={accent} isVisible={isVisible} graphWidth={graphWidth} />}

            {/* Estado en vivo (reserva su fila siempre) */}
            {isVisible('liveCharacter') && liveRow()}
        </CardBox>
    );
}
