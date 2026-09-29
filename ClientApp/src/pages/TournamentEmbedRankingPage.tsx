import { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { buildTokens, type Appearance } from './tournament-public/theme';
import { rootStyle, CUT_SMALL } from './tournament-public/broadcast';

// Widget de clasificacion para OBS y para webs de terceros (rediseño de
// transmision R3, .dev/torneos/16-rediseno-publico.md). Sin nav ni sesion; el
// backend (TournamentEmbedController) tiene CORS abierto. Se refresca cada 30 s.
//
// Parametros:
//   layout=list (defecto)  columna vertical, para el costado del stream o un <iframe>
//   layout=bar             franja horizontal para la parte de abajo del stream
//   bg=transparent         fondo transparente (fuente de navegador de OBS)
//   limit=N                cuantos equipos/jugadores (defecto 10 en barra, 20 en lista)
//   theme=light|dark       fuerza el fondo; si no, el que eligio el streamer

interface RankingRow {
    rank: number;
    displayName: string;
    currentLp: number | null;
    valueText?: string | null;
    badge?: string | null;
}

interface Payload {
    editionName: string;
    subtitle?: string | null;
    appearance?: Appearance;
    ranking: RankingRow[];
}

export default function TournamentEmbedRankingPage() {
    const { channelName, editionSlug } = useParams<{ channelName: string; editionSlug: string }>();
    const [searchParams] = useSearchParams();
    const layout = searchParams.get('layout') === 'bar' ? 'bar' : 'list';
    const transparent = searchParams.get('bg') === 'transparent';
    const themeParam = searchParams.get('theme');
    const limit = searchParams.get('limit') || (layout === 'bar' ? '8' : '20');

    const [data, setData] = useState<Payload | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get(`/embed/torneo/${channelName}/${editionSlug}/ranking?limit=${limit}`);
                if (res.data?.success) {
                    setData(res.data);
                    setFailed(false);
                } else setFailed((prev) => prev || !data);
            } catch {
                setFailed((prev) => prev || !data);
            }
        };
        load();
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [channelName, editionSlug, limit]);

    // En OBS el fondo de la pagina tiene que ser transparente de verdad.
    useEffect(() => {
        if (!transparent) return;
        const prevBody = document.body.style.background;
        const prevHtml = document.documentElement.style.background;
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
        return () => {
            document.body.style.background = prevBody;
            document.documentElement.style.background = prevHtml;
        };
    }, [transparent]);

    if (failed && !data) {
        return <div style={{ fontFamily: 'sans-serif', color: '#9AA4B6', padding: 12, fontSize: 13 }}>Torneo no encontrado.</div>;
    }
    if (!data) return null;

    const appearance: Appearance = { ...(data.appearance || {}), theme: themeParam === 'light' || themeParam === 'dark' ? themeParam : data.appearance?.theme };
    const t = buildTokens(appearance);
    const style: CSSProperties = { ...rootStyle(t), background: transparent ? 'transparent' : 'var(--t-bg)' };
    const rows = data.ranking;
    const max = Math.max(1, ...rows.map((r) => valueOf(r) ?? 0));

    return (
        <div style={style} className={`font-barlow antialiased ${transparent ? '' : 'min-h-screen'}`}>
            {layout === 'bar' ? (
                <BarLayout data={data} rows={rows} max={max} logo={appearance.logoUrl} />
            ) : (
                <ListLayout data={data} rows={rows} max={max} logo={appearance.logoUrl} transparent={transparent} />
            )}
        </div>
    );
}

// Numero que llena la barra: puntos (Fortnite, viene en valueText) o LP (LoL).
function valueOf(r: RankingRow): number | null {
    if (r.currentLp != null) return r.currentLp;
    const n = parseInt(r.valueText ?? '', 10);
    return Number.isFinite(n) ? n : null;
}

function shownValue(r: RankingRow): string {
    if (r.valueText) return r.valueText.replace(/\s*pts$/, '');
    return r.currentLp != null ? `${r.currentLp}` : '—';
}

function unit(rows: RankingRow[]): string {
    return rows.some((r) => r.valueText?.endsWith('pts')) ? 'pts' : 'LP';
}

function Header({ data, logo }: { data: Payload; logo?: string | null }) {
    return (
        <div className="flex items-stretch" style={{ background: 'var(--t-primary)', color: 'var(--t-on-primary)', clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}>
            {logo && <img src={logo} alt="" className="w-11 h-11 object-contain p-1 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.18)' }} />}
            <div className="px-3 py-1.5 pr-6 min-w-0">
                <p className="font-scoreboard font-black text-xl leading-none truncate">{data.editionName}</p>
                {data.subtitle && <p className="text-xs font-semibold leading-tight mt-0.5 opacity-85 truncate">{data.subtitle}</p>}
            </div>
        </div>
    );
}

function ListLayout({ data, rows, max, logo, transparent }: { data: Payload; rows: RankingRow[]; max: number; logo?: string | null; transparent: boolean }) {
    return (
        <div className="p-2 max-w-[380px]">
            <Header data={data} logo={logo} />
            <ol className="mt-1 space-y-[3px]">
                {rows.map((r, i) => {
                    const v = valueOf(r);
                    const pct = v != null && v > 0 ? Math.max(4, (v / max) * 100) : 0;
                    return (
                        <li
                            key={`${r.rank}-${r.displayName}`}
                            className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5 relative overflow-hidden"
                            style={{ background: transparent ? 'color-mix(in srgb, var(--t-surface) 88%, transparent)' : 'var(--t-surface)' }}
                        >
                            {/* barra de fondo proporcional al lider */}
                            <span
                                className="absolute inset-y-0 left-0"
                                style={{ width: `${pct}%`, background: `color-mix(in srgb, var(--t-primary) ${i === 0 ? 32 : 18}%, transparent)`, clipPath: CUT_SMALL }}
                            />
                            <span className="relative font-scoreboard font-black text-xl leading-none text-center" style={{ color: r.rank === 1 ? 'var(--t-gold)' : 'var(--t-muted)' }}>
                                {r.rank}
                            </span>
                            <span className="relative min-w-0 flex items-center gap-1.5">
                                <span className="font-semibold text-[15px] truncate">{r.displayName}</span>
                                {r.badge && (
                                    <span className="text-[10px] font-bold px-1 py-px flex-shrink-0" style={{ background: 'var(--t-gold)', color: '#1A1300' }}>
                                        {r.badge}
                                    </span>
                                )}
                            </span>
                            <span className="relative font-scoreboard font-black text-xl leading-none">{shownValue(r)}</span>
                        </li>
                    );
                })}
            </ol>
            <p className="mt-1 text-[10px] text-right" style={{ color: 'var(--t-muted)' }}>
                {unit(rows)} · Decatron
            </p>
        </div>
    );
}

/** Franja inferior de transmision: cabecera a la izquierda y los primeros en fila. */
function BarLayout({ data, rows, max, logo }: { data: Payload; rows: RankingRow[]; max: number; logo?: string | null }) {
    return (
        <div className="p-2 flex items-stretch gap-1 w-full overflow-hidden">
            <div className="flex-shrink-0 max-w-[340px]">
                <Header data={data} logo={logo} />
            </div>
            <ol className="flex items-stretch gap-1 min-w-0 flex-1 overflow-hidden">
                {rows.map((r, i) => {
                    const v = valueOf(r);
                    const pct = v != null && v > 0 ? Math.max(6, (v / max) * 100) : 0;
                    return (
                        <li
                            key={`${r.rank}-${r.displayName}`}
                            className="relative flex items-center gap-2 px-3 min-w-[150px] max-w-[240px] flex-1 overflow-hidden"
                            style={{ background: 'color-mix(in srgb, var(--t-surface) 92%, transparent)', clipPath: CUT_SMALL }}
                        >
                            <span className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: 'var(--t-surface-raised)' }} />
                            <span className="absolute left-0 bottom-0 h-[3px]" style={{ width: `${pct}%`, background: i === 0 ? 'var(--t-gold)' : 'var(--t-primary)' }} />
                            <span className="font-scoreboard font-black text-2xl leading-none" style={{ color: r.rank === 1 ? 'var(--t-gold)' : 'var(--t-muted)' }}>
                                {r.rank}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-sm truncate">{r.displayName}</span>
                                <span className="block font-scoreboard font-black text-lg leading-none">
                                    {shownValue(r)} <span className="text-xs font-semibold" style={{ color: 'var(--t-muted)' }}>{unit(rows)}</span>
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
