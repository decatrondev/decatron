import React, { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { buildTokens, cssVars, type Appearance, type TournamentTokens } from './theme';

// Piezas del rediseño "gráfico de transmisión" de la vista publica de torneos
// (.dev/torneos/16-rediseno-publico.md). Todo se pinta con los tokens del streamer
// (theme.ts) via variables CSS --t-*, asi funcionan igual con fondo claro u oscuro.

/** Raiz de la pagina: variables de color, fondo y tipografia del torneo. */
export function TournamentThemeRoot({ appearance, children, className = '' }: { appearance: Appearance; children: ReactNode; className?: string }) {
    const t = buildTokens(appearance);
    return (
        <div style={rootStyle(t)} className={`font-barlow antialiased ${className}`}>
            {children}
        </div>
    );
}

export function rootStyle(t: TournamentTokens): CSSProperties {
    return {
        ...cssVars(t),
        // Conectores del bracket y la tipografia de datos (BracketTree los lee con respaldo).
        '--t-connector': t.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(14,19,32,0.2)',
        '--t-font-data': '"Barlow", sans-serif',
        '--t-gold-soft': t.isDark ? 'rgba(255,197,61,0.12)' : 'rgba(183,121,31,0.1)',
        '--t-gold-line': t.isDark ? 'rgba(255,197,61,0.55)' : 'rgba(183,121,31,0.5)',
        background: 'var(--t-bg)',
        color: 'var(--t-ink)',
        colorScheme: t.isDark ? 'dark' : 'light',
    } as CSSProperties;
}

// Esquina cortada en diagonal: el recurso de los marcadores de transmision.
export const CUT = 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)';
export const CUT_SMALL = 'polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%)';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'md' | 'lg' };

export function BroadcastButton({ variant = 'primary', size = 'md', className = '', style, children, ...rest }: ButtonProps) {
    const base =
        'inline-flex items-center justify-center gap-2 font-scoreboard font-extrabold tracking-wide transition-[filter,transform] active:translate-y-px disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]';
    const sizes = size === 'lg' ? 'text-xl 4xl:text-2xl px-7 4xl:px-9 py-3 4xl:py-4' : 'text-base 4xl:text-lg px-5 4xl:px-6 py-2 4xl:py-2.5';
    const look: CSSProperties =
        variant === 'primary'
            ? { background: 'var(--t-primary)', color: 'var(--t-on-primary)', clipPath: CUT }
            : variant === 'secondary'
              ? { background: 'transparent', color: 'var(--t-ink)', boxShadow: 'inset 0 0 0 2px var(--t-secondary)', clipPath: CUT }
              : { background: 'transparent', color: 'var(--t-muted)' };
    return (
        <button className={`${base} ${sizes} hover:brightness-110 ${className}`} style={{ ...look, ...style }} {...rest}>
            {children}
        </button>
    );
}

export const STATUS_TEXT: Record<string, string> = {
    draft: 'Próximamente',
    registration_open: 'Inscripciones abiertas',
    check_in: 'Check-in abierto',
    in_progress: 'En curso',
    finished: 'Terminado',
    archived: 'Terminado',
};

/** Aviso de estado. "En vivo" solo si el canal esta transmitiendo. */
export function StatusBug({ status, isLive }: { status: string; isLive: boolean }) {
    if (isLive && (status === 'in_progress' || status === 'check_in')) {
        return (
            <span className="inline-flex items-center gap-2 px-3 py-1 font-scoreboard font-extrabold text-base 4xl:text-lg" style={{ background: 'var(--t-live)', color: '#fff', clipPath: CUT_SMALL }}>
                <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-white" />
                </span>
                En vivo
            </span>
        );
    }
    const strong = status === 'registration_open' || status === 'check_in';
    return (
        <span
            className="inline-flex items-center px-3 py-1 font-scoreboard font-extrabold text-base 4xl:text-lg"
            style={
                strong
                    ? { background: 'var(--t-secondary)', color: 'var(--t-on-secondary)', clipPath: CUT_SMALL }
                    : { background: 'var(--t-surface-raised)', color: 'var(--t-ink)', clipPath: CUT_SMALL }
            }
        >
            {STATUS_TEXT[status] || status}
        </span>
    );
}

/** Dato corto del torneo (juego, modalidad, region). */
export function Chip({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center px-2.5 py-1 text-sm 4xl:text-base font-semibold rounded-sm" style={{ background: 'var(--t-surface-raised)', color: 'var(--t-ink)' }}>
            {children}
        </span>
    );
}

export function SectionTitle({ children, meta, action }: { children: ReactNode; meta?: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4 4xl:mb-6">
            <div className="min-w-0">
                <h2 className="font-scoreboard font-black text-3xl md:text-4xl 4xl:text-5xl leading-none">{children}</h2>
                {meta && <p className="mt-1.5 text-sm 4xl:text-base" style={{ color: 'var(--t-muted)' }}>{meta}</p>}
            </div>
            {action}
        </div>
    );
}

/** Vacio que dice que va a aparecer ahi y cuando. */
export function EmptyBlock({ children }: { children: ReactNode }) {
    return (
        <div className="px-5 4xl:px-8 py-8 4xl:py-12 text-center text-base 4xl:text-lg rounded-sm" style={{ background: 'var(--t-surface)', color: 'var(--t-muted)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
            {children}
        </div>
    );
}

/** true un instante despues de montar: las barras crecen una sola vez al entrar. */
export function useMounted() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return mounted;
}

export interface BarRow {
    key: string | number;
    rank: number;
    name: string;
    sub?: ReactNode;
    // Numero grande a la derecha y cuanto llena la barra (proporcional al lider).
    value: number | null;
    valueText: string;
    badges?: ReactNode;
    detail?: ReactNode;
}

/**
 * La clasificacion como barras de puntos: el elemento protagonista del rediseño.
 * Nombre a la izquierda (siempre sobre fondo liso, se lee con cualquier color),
 * barra proporcional al lider con corte diagonal, y el valor en tipografia de
 * marcador. En celular la barra va debajo del nombre.
 */
export function PointsBars({ rows, expandedKey, onToggle, compact = false }: { rows: BarRow[]; expandedKey?: string | number | null; onToggle?: (key: string | number) => void; compact?: boolean }) {
    const mounted = useMounted();
    const max = Math.max(1, ...rows.map((r) => r.value ?? 0));

    return (
        <ol className="space-y-1.5 4xl:space-y-2">
            {rows.map((r, i) => {
                const pct = r.value != null && r.value > 0 ? Math.max(3, (r.value / max) * 100) : 0;
                const leader = r.rank === 1 && (r.value ?? 0) > 0;
                const fill = leader ? 'var(--t-primary)' : `color-mix(in srgb, var(--t-primary) ${Math.max(30, 78 - i * 7)}%, var(--t-surface-raised))`;
                const expanded = expandedKey === r.key;
                const clickable = !!onToggle && !!r.detail;
                const Tag = clickable ? 'button' : 'div';
                return (
                    <li key={r.key} style={{ background: 'var(--t-surface)', boxShadow: expanded ? 'inset 3px 0 0 var(--t-primary)' : 'inset 0 0 0 1px var(--t-line)' }}>
                        <Tag
                            {...(clickable ? { type: 'button', onClick: () => onToggle!(r.key), 'aria-expanded': expanded } : {})}
                            className={`w-full text-left grid items-center gap-x-3 4xl:gap-x-5 gap-y-2 px-3 md:px-4 4xl:px-6 ${compact ? 'py-2 4xl:py-3' : 'py-3 4xl:py-4'} ${
                                clickable ? 'hover:bg-[color:var(--t-surface-raised)] transition-colors' : ''
                            } grid-cols-[2.25rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_minmax(0,1.1fr)_minmax(0,1.6fr)_5.5rem] 4xl:grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,1.6fr)_7rem]`}
                        >
                            <span
                                className={`font-scoreboard font-black leading-none ${compact ? 'text-2xl' : 'text-3xl 4xl:text-4xl'}`}
                                style={{ color: r.rank === 1 ? 'var(--t-gold)' : 'var(--t-muted)' }}
                            >
                                {r.rank}
                            </span>
                            <span className="min-w-0">
                                <span className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold truncate ${compact ? 'text-base' : 'text-lg 4xl:text-xl'}`}>{r.name}</span>
                                    {r.badges}
                                </span>
                                {r.sub && <span className="block text-sm 4xl:text-base truncate" style={{ color: 'var(--t-muted)' }}>{r.sub}</span>}
                            </span>
                            <span className="md:order-none order-last col-span-3 md:col-span-1 block h-2 md:h-7 4xl:h-9 relative" style={{ background: 'var(--t-surface-raised)' }}>
                                <span
                                    className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                                    style={{ width: mounted ? `${pct}%` : '0%', background: fill, clipPath: CUT_SMALL }}
                                />
                            </span>
                            <span className="flex items-center justify-end gap-1.5">
                                <span className={`font-scoreboard font-black leading-none text-right ${compact ? 'text-2xl' : 'text-3xl 4xl:text-4xl'}`}>{r.valueText}</span>
                                {clickable && (
                                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--t-muted)' }} />
                                )}
                            </span>
                        </Tag>
                        {expanded && r.detail && (
                            <div className="px-3 md:px-4 4xl:px-6 pb-4" style={{ borderTop: '1px solid var(--t-line)' }}>
                                {r.detail}
                            </div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

/** Insignia chica dentro de una fila (campeon, match point, clasifica). */
export function RowBadge({ tone, children }: { tone: 'gold' | 'live' | 'accent'; children: ReactNode }) {
    const style: CSSProperties =
        tone === 'gold'
            ? { background: 'var(--t-gold)', color: '#1A1300' }
            : tone === 'live'
              ? { background: 'var(--t-live)', color: '#fff' }
              : { background: 'var(--t-secondary)', color: 'var(--t-on-secondary)' };
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs 4xl:text-sm font-bold rounded-sm" style={style}>
            {children}
        </span>
    );
}
