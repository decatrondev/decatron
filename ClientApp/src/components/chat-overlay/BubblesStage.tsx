import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { MessageView, nameColorOf, textStyle } from './ChatRenderer';
import { CANVAS, type BubbleMovement, type BubbleZone, type ChatMsg, type ChatOverlayConfig, type ChatPart } from './types';

// Modo burbujas (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 2): cada mensaje aparece en un lugar del lienzo de
// 1920×1080, se mueve y se va. La posición y el movimiento se calculan fuera de React (un solo ciclo de
// animación que escribe el transform de cada burbuja), así veinte burbujas no provocan veinte renders por cuadro.

const ENTER_MS = 320;
const EXIT_MS = 520;
const OVERLAP_GAP = 10;
const PLACE_TRIES = 24;
const EMOTE_ONLY_MAX = 8;

interface BubbleView { id: string; msg: ChatMsg; emoteOnly: boolean; scale: number }

interface Phys {
    id: string;
    state: 'pending' | 'live' | 'leaving';
    w: number; h: number; x: number; y: number;
    vx: number; vy: number;
    kind: Exclude<BubbleMovement, 'random'>;
    phase: number;
    born: number;
    leaveAt: number;
    scale: number;
    /** Para quitar las de una persona baneada */
    user: string; channel: string; shared: boolean;
}

type Rect = { x: number; y: number; w: number; h: number };
const intersects = (a: Rect, b: Rect, gap = 0) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** Un mensaje de solo emotes (y espacios) se dibuja grande y sin globo */
function isEmoteOnly(parts: ChatPart[]): boolean {
    const emotes = parts.filter(p => p.t === 'emote').length;
    return emotes > 0 && emotes <= EMOTE_ONLY_MAX && parts.every(p => p.t === 'emote' || (p.t === 'text' && !(p.v ?? '').trim()));
}

function plainLength(parts: ChatPart[]): number {
    return parts.reduce((n, p) => n + (p.t === 'text' ? (p.v ?? '').length : 3), 0);
}

export function useBubbles(config: ChatOverlayConfig) {
    const [list, setList] = useState<BubbleView[]>([]);
    const phys = useRef(new Map<string, Phys>());
    const els = useRef(new Map<string, HTMLDivElement>());
    const cfg = useRef(config);
    cfg.current = config;

    const register = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) {
            // React vuelve a llamar a este ref en cada render: solo las que aún no tienen lugar se esconden
            const p = phys.current.get(id);
            if (!p || p.state === 'pending') { el.style.visibility = 'hidden'; el.style.opacity = '0'; }
            else el.style.visibility = 'visible';
            els.current.set(id, el);
        } else {
            els.current.delete(id);
        }
    }, []);

    const push = useCallback((msg: ChatMsg) => {
        if (phys.current.has(msg.id)) return;
        const c = cfg.current.bubbles;
        const emoteOnly = isEmoteOnly(msg.parts);
        const scale = c.sizeByLength && !emoteOnly ? Math.min(1.3, Math.max(0.9, 0.9 + plainLength(msg.parts) / 220)) : 1;
        phys.current.set(msg.id, {
            id: msg.id, state: 'pending', w: 0, h: 0, x: 0, y: 0, vx: 0, vy: 0, kind: 'stay',
            phase: Math.random() * Math.PI * 2, born: 0, leaveAt: 0, scale,
            user: msg.user.login, channel: msg.channel.login, shared: msg.channel.shared,
        });
        setList(prev => [...prev, { id: msg.id, msg, emoteOnly, scale }]);
    }, []);

    const startLeaving = (p: Phys) => {
        if (p.state === 'leaving') return;
        p.state = 'leaving';
        p.leaveAt = performance.now();
    };

    /** Busca un lugar libre para una burbuja ya medida; null si no lo hay */
    const findSpot = (p: Phys): { x: number; y: number } | null => {
        const c = cfg.current.bubbles;
        const w = p.w * p.scale, h = p.h * p.scale;
        const allow = c.zones.filter(z => z.kind === 'allow');
        const deny = c.zones.filter(z => z.kind === 'deny');
        const areas: BubbleZone[] = allow.length > 0 ? allow : [{ id: 'all', kind: 'allow', x: 0, y: 0, width: CANVAS.width, height: CANVAS.height }];
        const total = areas.reduce((n, z) => n + z.width * z.height, 0);
        const others = [...phys.current.values()].filter(o => o.id !== p.id && o.state !== 'pending')
            .map<Rect>(o => ({ x: o.x, y: o.y, w: o.w * o.scale, h: o.h * o.scale }));

        for (let i = 0; i < PLACE_TRIES; i++) {
            let pick = Math.random() * total;
            const zone = areas.find(z => (pick -= z.width * z.height) <= 0) ?? areas[0];
            const x = zone.x + Math.random() * Math.max(0, zone.width - w);
            const y = zone.y + Math.random() * Math.max(0, zone.height - h);
            const rect: Rect = { x, y, w, h };
            if (deny.some(z => intersects(rect, { x: z.x, y: z.y, w: z.width, h: z.height }))) continue;
            if (c.avoidOverlap && others.some(o => intersects(rect, o, OVERLAP_GAP))) continue;
            return { x, y };
        }
        return null;
    };

    // Cuando entran burbujas nuevas: se miden, se les busca lugar y se muestran
    useLayoutEffect(() => {
        const dropped: string[] = [];
        for (const p of phys.current.values()) {
            if (p.state !== 'pending') continue;
            const el = els.current.get(p.id);
            if (!el) continue;
            const c = cfg.current.bubbles;

            const live = [...phys.current.values()].filter(o => o.state === 'live');
            if (live.length >= c.maxBubbles) {
                if (c.whenFull === 'skip') { dropped.push(p.id); continue; }
                // La más vieja deja lugar
                startLeaving(live.reduce((a, b) => (a.born <= b.born ? a : b)));
            }

            p.w = el.offsetWidth;
            p.h = el.offsetHeight;
            const spot = findSpot(p);
            if (!spot) {
                if (c.whenFull === 'skip') { dropped.push(p.id); continue; }
                // Sin lugar libre en una pantalla llena: se acepta encimarse antes que perder el mensaje
                const w = p.w * p.scale, h = p.h * p.scale;
                p.x = Math.random() * Math.max(0, CANVAS.width - w);
                p.y = Math.random() * Math.max(0, CANVAS.height - h);
            } else {
                p.x = spot.x; p.y = spot.y;
            }

            const kinds: Exclude<BubbleMovement, 'random'>[] = ['float', 'drift', 'bounce', 'fall', 'stay'];
            p.kind = c.movement === 'random' ? kinds[Math.floor(Math.random() * kinds.length)] : c.movement;
            const angle = Math.random() * Math.PI * 2;
            if (p.kind === 'float') { p.vx = 0; p.vy = -c.speed; }
            else if (p.kind === 'fall') { p.vx = 0; p.vy = c.speed; }
            else if (p.kind === 'drift') { p.vx = Math.cos(angle) * c.speed * 0.6; p.vy = Math.sin(angle) * c.speed * 0.6; }
            else if (p.kind === 'bounce') { p.vx = Math.cos(angle) * c.speed * 1.3; p.vy = Math.sin(angle) * c.speed * 1.3; }
            p.state = 'live';
            p.born = performance.now();
            el.style.visibility = 'visible';
        }
        if (dropped.length) {
            dropped.forEach(id => { phys.current.delete(id); els.current.delete(id); });
            setList(prev => prev.filter(b => !dropped.includes(b.id)));
        }
    }, [list]);

    // Un solo ciclo de animación para todas
    useEffect(() => {
        let raf = 0;
        let last = performance.now();
        const frame = (now: number) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            const c = cfg.current.bubbles;
            const done: string[] = [];

            for (const p of phys.current.values()) {
                if (p.state === 'pending') continue;
                const el = els.current.get(p.id);
                if (!el) continue;
                const age = now - p.born;
                if (p.state === 'live' && age >= c.durationSeconds * 1000) startLeaving(p);

                const w = p.w * p.scale, h = p.h * p.scale;
                if (p.kind === 'float' || p.kind === 'fall') {
                    p.y += p.vy * dt;
                    if (p.state === 'live' && (p.y + h < -10 || p.y > CANVAS.height + 10)) startLeaving(p);
                } else if (p.kind === 'drift' || p.kind === 'bounce') {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
                    if (p.x + w > CANVAS.width) { p.x = CANVAS.width - w; p.vx = -Math.abs(p.vx); }
                    if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
                    if (p.y + h > CANVAS.height) { p.y = CANVAS.height - h; p.vy = -Math.abs(p.vy); }
                }
                const sway = p.kind === 'float' || p.kind === 'fall' ? Math.sin(age / 700 + p.phase) * 14 : 0;

                const enter = Math.min(1, age / ENTER_MS);
                let opacity = enter;
                let scale = p.scale * (0.7 + 0.3 * (1 - (1 - enter) * (1 - enter)));
                if (p.state === 'leaving') {
                    const t = Math.min(1, (now - p.leaveAt) / EXIT_MS);
                    opacity *= 1 - t;
                    scale *= 1 - 0.1 * t;
                    if (t >= 1) done.push(p.id);
                }
                el.style.transform = `translate(${p.x + sway}px, ${p.y}px) scale(${scale})`;
                el.style.opacity = String(opacity);
            }

            if (done.length) {
                done.forEach(id => { phys.current.delete(id); els.current.delete(id); });
                setList(prev => prev.filter(b => !done.includes(b.id)));
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(raf);
    }, []);

    const remove = useCallback((id: string) => {
        const p = phys.current.get(id);
        if (!p) return;
        if (p.state === 'pending') { phys.current.delete(id); setList(prev => prev.filter(b => b.id !== id)); }
        else startLeaving(p);
    }, []);

    const removeUser = useCallback((login: string, channel: string) => {
        for (const p of [...phys.current.values()]) {
            if (p.user === login && (p.channel === channel || !p.shared)) remove(p.id);
        }
    }, [remove]);

    const clear = useCallback(() => {
        for (const p of phys.current.values()) {
            if (p.state === 'pending') phys.current.delete(p.id);
            else startLeaving(p);
        }
        setList(prev => prev.filter(b => phys.current.has(b.id)));
    }, []);

    return { list, push, remove, removeUser, clear, register };
}

export type BubblesEngine = ReturnType<typeof useBubbles>;

function BubbleNode({ b, config, register }: { b: BubbleView; config: ChatOverlayConfig; register: BubblesEngine['register'] }) {
    const { bubbles, emotes, text } = config;
    const accent = nameColorOf(b.msg, config);

    const outer: CSSProperties = {
        position: 'absolute', left: 0, top: 0, width: 'max-content', maxWidth: bubbles.maxWidth, willChange: 'transform, opacity',
        transformOrigin: '50% 50%',
    };

    if (b.emoteOnly) {
        const size = emotes.sizePx * bubbles.emoteOnlyScale;
        return (
            <div ref={el => register(b.id, el)} style={{ ...outer, textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    {b.msg.parts.filter(p => p.t === 'emote').map((p, i) => (
                        <img key={i} src={p.u} alt={p.n} style={{ display: 'block', height: size }} />
                    ))}
                </div>
                <div style={{ fontSize: text.fontSize * 0.7, fontWeight: 800, color: accent, marginTop: 2 }}>{b.msg.user.name}</div>
            </div>
        );
    }

    const radius = bubbles.shape === 'rect' ? 10 : bubbles.shape === 'comic' ? 22 : 30;
    const border = bubbles.userBorder ? `3px solid ${accent}` : '3px solid transparent';
    return (
        <div ref={el => register(b.id, el)} style={outer}>
            <div style={{ position: 'relative', background: bubbles.background, border, borderRadius: radius, padding: '10px 20px' }}>
                <MessageView msg={b.msg} config={config} />
                {bubbles.shape === 'comic' && (
                    <span
                        style={{
                            position: 'absolute', left: 26, bottom: -11, width: 18, height: 18, background: bubbles.background,
                            borderRight: border, borderBottom: border, transform: 'rotate(45deg)', borderBottomRightRadius: 4,
                        }}
                    />
                )}
            </div>
        </div>
    );
}

/** Todo el lienzo de 1920×1080 con las burbujas; sin eventos de mouse para no tapar nada en OBS */
export default function BubblesStage({ engine, config }: { engine: BubblesEngine; config: ChatOverlayConfig }) {
    return (
        <div style={{ position: 'absolute', left: 0, top: 0, width: CANVAS.width, height: CANVAS.height, overflow: 'hidden', pointerEvents: 'none', ...textStyle(config) }}>
            {engine.list.map(b => <BubbleNode key={b.id} b={b} config={config} register={engine.register} />)}
        </div>
    );
}
