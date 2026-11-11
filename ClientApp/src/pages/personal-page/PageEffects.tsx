import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gateVars } from './AgeGate';
import type { PersonalPageContent, PersonalPageEffects } from './shared';

// Efectos de la página personal (subfase 5.10), lista cerrada y todo apagado por defecto: partículas de fondo, brillo en
// redes y enlaces, estela del cursor y transición de entrada. Canvas propio, sin librerías. Con «reducir movimiento»
// no se dibujan partículas, estela ni brillo y la transición queda en un aparecer muy corto. El visitante puede pausar.

export const DEFAULT_EFFECTS: PersonalPageEffects = { particles: 'none', density: 'medium', color: 'accent', shine: false, cursor: 'none', entrance: 'none' };
export const EFFECT_PARTICLES = ['none', 'sparkles', 'snow', 'confetti', 'bubbles'] as const;
export const EFFECT_DENSITIES = ['low', 'medium', 'high'] as const;
export const EFFECT_COLORS = ['accent', 'white'] as const;
export const EFFECT_CURSORS = ['none', 'dots', 'sparkles'] as const;
export const EFFECT_ENTRANCES = ['none', 'fade', 'rise', 'cascade'] as const;

export function effectsOf(c: PersonalPageContent): PersonalPageEffects {
    return { ...DEFAULT_EFFECTS, ...(c.effects ?? {}) };
}

/** Hay algo que se mueve solo (partículas o estela): es lo que el visitante puede pausar. */
export const hasMovingEffects = (fx: PersonalPageEffects) => fx.particles !== 'none' || fx.cursor !== 'none';
/** Lo que este visitante puede pausar: partículas, o la estela si usa mouse (en celular la estela no existe). */
export const hasPausableEffects = (fx: PersonalPageEffects) => fx.particles !== 'none'
    || (fx.cursor !== 'none' && typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
export const hasAnyEffect = (fx: PersonalPageEffects) => hasMovingEffects(fx) || fx.shine || fx.entrance !== 'none';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** «Reducir movimiento» del sistema del visitante; `override` lo fuerza (la vista previa del panel lo simula). */
export function useReducedMotion(override?: boolean): boolean {
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(REDUCE_QUERY).matches);
    useEffect(() => {
        const mq = window.matchMedia?.(REDUCE_QUERY);
        if (!mq) return;
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return override ?? reduced;
}

const PAUSE_KEY = 'decatron:pp-fx-paused';

/** Pausa de efectos que eligió el visitante, recordada en su navegador (todas las páginas). */
export function usePausedEffects(): [boolean, () => void] {
    const [paused, setPaused] = useState(() => { try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; } });
    const toggle = useCallback(() => setPaused(p => {
        try { localStorage.setItem(PAUSE_KEY, p ? '0' : '1'); } catch { /* sin storage: dura esta visita */ }
        return !p;
    }), []);
    return [paused, toggle];
}

/** Evento para volver a mostrar la transición de entrada en la vista previa del panel. */
export const REPLAY_EVENT = 'pp-fx-replay';

// ---------------- color ----------------

type RGB = [number, number, number];
function hexToRgb(hex: string): RGB {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    const n = m ? parseInt(m[1], 16) : 0x5B8CFF;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

/** Tonos de las partículas: el acento con una variante clara y una oscura, o blanco (gris en tema claro para que se vea). */
function palette(color: string, accent: string, theme: string): RGB[] {
    if (color === 'white') return theme === 'light' ? [[138, 147, 163], [168, 175, 188]] : [[255, 255, 255], [226, 230, 238]];
    const a = hexToRgb(accent);
    return [a, mix(a, [255, 255, 255], 0.45), mix(a, [0, 0, 0], 0.25)];
}

// ---------------- partículas ----------------

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; rot: number; vr: number; phase: number; c: RGB }

/** Cantidad por estilo y nivel, para una pantalla de escritorio; se reduce con el área (menos en celular). */
const COUNTS: Record<string, [number, number, number]> = {
    sparkles: [12, 24, 40], snow: [30, 60, 110], confetti: [18, 36, 64], bubbles: [8, 16, 28],
};

function spawn(style: string, w: number, h: number, colors: RGB[], anywhere: boolean): Particle {
    const c = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * w;
    const base = { x, rot: Math.random() * Math.PI * 2, phase: Math.random() * Math.PI * 2, c };
    switch (style) {
        case 'snow': return { ...base, y: anywhere ? Math.random() * h : -6, vx: 0, vy: 14 + Math.random() * 22, r: 1.2 + Math.random() * 2.4, a: 0.35 + Math.random() * 0.45, vr: 0 };
        case 'confetti': return { ...base, y: anywhere ? Math.random() * h : -10, vx: (Math.random() - 0.5) * 14, vy: 24 + Math.random() * 30, r: 3 + Math.random() * 2.5, a: 0.75 + Math.random() * 0.25, vr: (Math.random() - 0.5) * 3 };
        case 'bubbles': return { ...base, y: anywhere ? Math.random() * h : h + 16, vx: 0, vy: -(10 + Math.random() * 16), r: 4 + Math.random() * 10, a: 0.22 + Math.random() * 0.3, vr: 0 };
        default: return { ...base, y: Math.random() * h, vx: (Math.random() - 0.5) * 4, vy: -(2 + Math.random() * 5), r: 1.6 + Math.random() * 2.6, a: 1, vr: 0 };
    }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    // Destello de cuatro puntas (curvas hacia adentro): más propio que un círculo y liviano de dibujar
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2.4);
    ctx.quadraticCurveTo(x, y, x + r * 2.4, y);
    ctx.quadraticCurveTo(x, y, x, y + r * 2.4);
    ctx.quadraticCurveTo(x, y, x - r * 2.4, y);
    ctx.quadraticCurveTo(x, y, x, y - r * 2.4);
    ctx.fill();
}

function drawParticle(ctx: CanvasRenderingContext2D, style: string, p: Particle, t: number) {
    switch (style) {
        case 'snow':
            ctx.fillStyle = rgba(p.c, p.a);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            return;
        case 'confetti': {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            // El ancho cambia con un seno: parece que el papel gira en el aire
            ctx.scale(Math.cos(p.phase + t * 2.2), 1);
            ctx.fillStyle = rgba(p.c, p.a);
            ctx.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
            ctx.restore();
            return;
        }
        case 'bubbles':
            ctx.strokeStyle = rgba(p.c, p.a);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = rgba(p.c, p.a * 0.9);
            ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, Math.max(0.8, p.r * 0.16), 0, Math.PI * 2); ctx.fill();
            return;
        default: {
            const tw = 0.5 + 0.5 * Math.sin(p.phase + t * 1.6);
            ctx.fillStyle = rgba(p.c, 0.15 + 0.75 * tw);
            star(ctx, p.x, p.y, p.r * (0.55 + 0.45 * tw));
        }
    }
}

function step(style: string, p: Particle, dt: number, t: number, w: number, h: number, colors: RGB[]): Particle {
    p.x += (p.vx + (style === 'snow' ? Math.sin(p.phase + t * 0.9) * 10 : style === 'bubbles' ? Math.sin(p.phase + t * 1.3) * 8 : 0)) * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const out = p.y > h + 20 || p.y < -30 || p.x < -30 || p.x > w + 30;
    if (style === 'sparkles') {
        // Los destellos suben muy despacio y reaparecen en otro lugar
        if (p.y < -10 || out) return spawn(style, w, h, colors, true);
        return p;
    }
    return out ? spawn(style, w, h, colors, false) : p;
}

interface LayerProps { fx: PersonalPageEffects; accent: string; theme: string; embedded?: boolean; paused: boolean }

/**
 * Partículas detrás de toda la página. Se dibuja dentro de la raíz de la plantilla con z-index -1 (la raíz aísla su
 * propio apilado), así queda encima del fondo y debajo del contenido. En la página: fijo a la pantalla; en el panel:
 * del tamaño de la vista previa.
 */
export function ParticleLayer({ fx, accent, theme, embedded, paused }: LayerProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const colors = palette(fx.color, accent, theme);
        const level = Math.max(0, EFFECT_DENSITIES.indexOf(fx.density as typeof EFFECT_DENSITIES[number]));
        let w = 0, h = 0, raf = 0, last = 0, visible = true;
        let parts: Particle[] = [];
        const resize = () => {
            const host = embedded ? canvas.parentElement : null;
            w = host ? host.clientWidth : window.innerWidth;
            h = host ? host.clientHeight : window.innerHeight;
            const area = w * h;
            const dpr = Math.min(window.devicePixelRatio || 1, embedded || area > 4_000_000 ? 1.5 : 2);
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Menos partículas en pantallas chicas; en la vista previa se cuenta solo lo visible (no todo el alto)
            const screenArea = embedded ? w * Math.min(h, 900) : area;
            const factor = Math.max(0.4, Math.min(1.25, Math.sqrt(screenArea / (1280 * 800))));
            const target = Math.round((COUNTS[fx.particles]?.[level] ?? 0) * factor * (embedded ? Math.max(1, h / 900) : 1));
            parts = Array.from({ length: Math.min(target, 160) }, () => spawn(fx.particles, w, h, colors, true));
        };
        const frame = (now: number) => {
            raf = requestAnimationFrame(frame);
            if (!visible || document.hidden) { last = now; return; }
            const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
            last = now;
            const t = now / 1000;
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < parts.length; i++) {
                parts[i] = step(fx.particles, parts[i], dt, t, w, h, colors);
                drawParticle(ctx, fx.particles, parts[i], t);
            }
        };
        resize();
        const ro = embedded && canvas.parentElement ? new ResizeObserver(resize) : null;
        if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
        else window.addEventListener('resize', resize);
        // Fuera de la pantalla (miniaturas, vista previa escondida) no se dibuja
        const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); });
        io.observe(canvas);
        if (!paused) raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
            io.disconnect();
            window.removeEventListener('resize', resize);
            ctx.clearRect(0, 0, w, h);
        };
    }, [fx.particles, fx.density, fx.color, accent, theme, embedded, paused]);
    return <canvas ref={ref} className={embedded ? 'ppfx-canvas ppfx-canvas-embedded' : 'ppfx-canvas'} aria-hidden="true" />;
}

// ---------------- estela del cursor ----------------

interface TrailPoint { x: number; y: number; vx: number; vy: number; life: number; r: number; c: RGB }

/** Estela detrás del puntero. Solo con mouse (en celular no hay puntero que seguir); nunca reemplaza el cursor. */
export function CursorTrail({ fx, accent, theme, embedded, paused }: LayerProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    const [finePointer] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);
    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || paused || !finePointer) return;
        const colors = palette('accent', accent, theme);
        const host = embedded ? canvas.parentElement : null;
        let w = 0, h = 0, raf = 0, last = 0, running = false;
        let points: TrailPoint[] = [];
        let prev: { x: number; y: number } | null = null;
        const resize = () => {
            w = host ? host.clientWidth : window.innerWidth;
            h = host ? host.clientHeight : window.innerHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        const frame = (now: number) => {
            const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
            last = now;
            ctx.clearRect(0, 0, w, h);
            points = points.filter(p => (p.life -= dt) > 0);
            for (const p of points) {
                p.x += p.vx * dt; p.y += p.vy * dt;
                const k = Math.min(1, p.life / 0.6);
                ctx.fillStyle = rgba(p.c, 0.85 * k);
                if (fx.cursor === 'sparkles') star(ctx, p.x, p.y, p.r * (0.4 + 0.6 * k));
                else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k, 0, Math.PI * 2); ctx.fill(); }
            }
            // Sin nada que dibujar se detiene: no gasta batería con el mouse quieto
            if (points.length > 0) raf = requestAnimationFrame(frame);
            else { running = false; last = 0; }
        };
        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            let x = e.clientX, y = e.clientY;
            if (host) {
                const rect = host.getBoundingClientRect();
                const scale = rect.width / (host.offsetWidth || rect.width || 1);
                x = (x - rect.left) / scale; y = (y - rect.top) / scale;
                if (x < 0 || y < 0 || x > w || y > h) return;
            }
            const dist = prev ? Math.hypot(x - prev.x, y - prev.y) : 99;
            if (dist < (fx.cursor === 'sparkles' ? 10 : 5)) return;
            prev = { x, y };
            const c = colors[Math.floor(Math.random() * colors.length)];
            if (fx.cursor === 'sparkles') points.push({ x, y, vx: (Math.random() - 0.5) * 40, vy: 10 + Math.random() * 30, life: 0.6 + Math.random() * 0.3, r: 2 + Math.random() * 2, c });
            else points.push({ x, y, vx: 0, vy: 0, life: 0.6, r: 3.4, c });
            if (points.length > 40) points.splice(0, points.length - 40);
            if (!running) { running = true; raf = requestAnimationFrame(frame); }
        };
        resize();
        const ro = host ? new ResizeObserver(resize) : null;
        if (ro && host) ro.observe(host);
        else window.addEventListener('resize', resize);
        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', onMove);
            ctx.clearRect(0, 0, w, h);
        };
    }, [fx.cursor, accent, theme, embedded, paused, finePointer]);
    if (!finePointer) return null;
    return <canvas ref={ref} className={embedded ? 'ppfx-trail ppfx-trail-embedded' : 'ppfx-trail'} aria-hidden="true" />;
}

// ---------------- botón «Pausar efectos» ----------------

/** Botón fijo para pausar o reanudar partículas y estela; se ubica a la izquierda del de silenciar si existe. */
export function PauseEffectsButton({ content, paused, onToggle, besideMute }: { content: PersonalPageContent; paused: boolean; onToggle: () => void; besideMute: boolean }) {
    const { t } = useTranslation('personal-page');
    const label = paused ? t('effects.resume') : t('effects.pause');
    return (
        <button type="button" onClick={onToggle} aria-pressed={paused} aria-label={label} title={label}
            style={{ ...gateVars(content), position: 'fixed', right: besideMute ? 72 : 16, bottom: 16, zIndex: 55, width: 48, height: 48, borderRadius: '50%', border: '1px solid var(--ag-line)',
                background: 'var(--ag-panel)', color: 'var(--ag-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {paused ? <path d="M7 5v14l11-7z" fill="currentColor" /> : <><path d="M9 5v14" /><path d="M15 5v14" /></>}
            </svg>
        </button>
    );
}

// ---------------- brillo y transición (CSS) ----------------

const ROOTS = ['.pp-scene-root', '.bd-root', '.ch-root', '.in-root', '.po-root'];
const WRAPS = ['.pp-wrap', '.bd-wrap', '.ch-wrap', '.in-wrap', '.po-wrap'];
/** Superficies que se tocan en cada plantilla: redes, enlaces, filas y casillas */
export const FX_SURFACES = ['.pp-tile', '.pp-link', '.bd-row', '.bd-stamp', '.ch-row', '.in-cell', '.po-big', '.po-line a', '.po-custom', '.po-adult', '.ls-row'];

const under = (prefix: string, list: string[], suffix = '') => list.map(s => `${prefix} ${s}${suffix}`).join(',');
const child = (prefix: string, list: string[], suffix = '') => list.map(s => `${prefix} > ${s}${suffix}`).join(',');

export const FX_CSS = `
${child('.ppfx-bg', ROOTS)}{isolation:isolate;position:relative}
.ppfx-canvas{position:fixed;inset:0;z-index:-1;pointer-events:none}
.ppfx-canvas-embedded{position:absolute;left:0;top:0}
.ppfx-trail{position:fixed;inset:0;z-index:58;pointer-events:none}
.ppfx-trail-embedded{position:absolute;left:0;top:0;z-index:5}
${under('.ppfx-shine', FX_SURFACES)}{background-image:linear-gradient(105deg,transparent 38%,var(--ppfx-shine) 50%,transparent 62%);background-repeat:no-repeat;background-size:260% 100%;background-position:130% 0;transition:background-position .7s cubic-bezier(.3,.6,.2,1)}
@media (hover:hover){${under('.ppfx-shine', FX_SURFACES, ':hover')}{background-position:-30% 0}}
${under('.ppfx-shine', FX_SURFACES, ':focus-visible')},${under('.ppfx-shine', FX_SURFACES, ':active')}{background-position:-30% 0}
.ppfx-shine .pp-network:focus-visible .pp-tile{background-position:-30% 0}
@keyframes ppfx-fade{from{opacity:0}to{opacity:1}}
@keyframes ppfx-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
${child('.ppfx-in-fade', ROOTS)}{animation:ppfx-fade .6s ease-out both}
${ROOTS.map(r => WRAPS.map(w => `.ppfx-in-rise > ${r} > ${w}`).join(',')).join(',')}{animation:ppfx-rise .7s cubic-bezier(.2,.7,.2,1) both}
${child('.ppfx-in-cascade', ROOTS)}{animation:ppfx-fade .35s ease-out both}
${under('.ppfx-in-cascade', FX_SURFACES)}{animation:ppfx-rise .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--ppfx-i, 0) * 55ms + 120ms)}
${child('.ppfx-in-short', ROOTS)}{animation:ppfx-fade .15s ease-out both}
`;
