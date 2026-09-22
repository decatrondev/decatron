/**
 * Cerebro de la mascota: corre en el overlay (no en el backend).
 * idle → (timer) → camina a un punto | se sienta | (si lleva mucho sin eventos) duerme → idle.
 * Un PetEvent interrumpe lo que esté haciendo, dura `durationSec` y vuelve a idle.
 * Los estados se piden por nombre del manifest; si el modelo no trae un clip, PetModel usa el fallback.
 * Plan: .dev/plans/PETS_PLAN.md §5
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PetBehaviorConfig, PetEvent, PetManifest } from './types';
import { resolveState } from './types';
import type { PetEventBus } from './PetEventBus';

export type PetKind = 'idle' | 'walk' | 'sitDown' | 'sit' | 'standUp' | 'sleep' | 'event';

export interface PetBrainOutput {
    /** Estado del manifest a reproducir. */
    animState: string;
    kind: PetKind;
    x: number;
    /** -1 mira a la izquierda, 1 a la derecha. */
    facing: -1 | 1;
    bubble: string | null;
    onClipEnd: (state: string) => void;
}

interface Params {
    manifest: PetManifest;
    behavior: PetBehaviorConfig;
    /** Mitad del ancho visible, en unidades de mundo. */
    halfWidth: number;
    /** Velocidad al caminar en unidades de mundo por segundo. */
    walkSpeed: number;
    bus?: PetEventBus;
    /** Congela el cerebro (preview del panel sin animar). */
    paused?: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const hasOwnClip = (m: PetManifest, s: string) => resolveState(m, s)?.name === s;

export function usePetBrain({ manifest, behavior, halfWidth, walkSpeed, bus, paused }: Params): PetBrainOutput {
    const [kind, setKind] = useState<PetKind>('idle');
    const [animState, setAnimState] = useState('idle');
    const [bubble, setBubble] = useState<string | null>(null);
    const facingRef = useRef<-1 | 1>(1);
    const xRef = useRef(0);
    const targetRef = useRef(0);
    const untilRef = useRef(performance.now() + rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
    const lastEventAt = useRef(performance.now());
    const queue = useRef<PetEvent[]>([]);
    const [, tick] = useState(0);

    const go = useCallback((k: PetKind, anim: string, ms: number) => {
        setKind(k); setAnimState(anim); untilRef.current = performance.now() + ms;
    }, []);

    const worldX = useCallback((frac: number) => (frac - 0.5) * 2 * halfWidth, [halfWidth]);

    const chooseNext = useCallback(() => {
        const now = performance.now();
        const sleepy = behavior.sleepAfterSec > 0 && now - lastEventAt.current > behavior.sleepAfterSec * 1000;
        if (sleepy && kind !== 'sleep') {
            go('sleep', 'sleep', rand(behavior.sleepMinSec, behavior.sleepMaxSec) * 1000);
            return;
        }
        if (Math.random() < behavior.sitChance) {
            if (hasOwnClip(manifest, 'sitDown')) go('sitDown', 'sitDown', 60_000);
            else go('sit', 'sit', rand(behavior.sitMinSec, behavior.sitMaxSec) * 1000);
            return;
        }
        const xMin = worldX(behavior.walkArea.xMin), xMax = worldX(behavior.walkArea.xMax);
        let target = rand(xMin, xMax);
        if (Math.abs(target - xRef.current) < halfWidth * 0.15) target = xRef.current < (xMin + xMax) / 2 ? xMax : xMin; // que se note el paseo
        targetRef.current = Math.max(xMin, Math.min(xMax, target));
        facingRef.current = targetRef.current >= xRef.current ? 1 : -1;
        go('walk', 'walk', 120_000);
    }, [behavior, kind, manifest, go, worldX, halfWidth]);

    const startEvent = useCallback((e: PetEvent) => {
        lastEventAt.current = performance.now();
        setBubble(e.bubble ?? null);
        go('event', e.state || 'react', Math.max(1, e.durationSec) * 1000);
    }, [go]);

    // Estímulos externos: se encolan (máximo 5) y se reproducen uno tras otro.
    useEffect(() => {
        if (!bus) return;
        return bus.subscribe((e) => {
            if (queue.current.length >= 5) return;
            queue.current.push(e);
            tick(t => t + 1);
        });
    }, [bus]);

    // Fin de un clip sin loop → encadenar
    const onClipEnd = useCallback((ended: string) => {
        if (ended === 'sitDown') go('sit', 'sit', rand(behavior.sitMinSec, behavior.sitMaxSec) * 1000);
        else if (ended === 'standUp') go('idle', 'idle', rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
        else if (kind === 'event') { /* el evento dura durationSec aunque el clip termine antes */ }
    }, [go, behavior, kind]);

    useFrame((_, dt) => {
        if (paused) return;
        const now = performance.now();

        // Un evento interrumpe cualquier cosa (salvo otro evento en curso)
        if (kind !== 'event' && queue.current.length > 0) {
            startEvent(queue.current.shift()!);
            return;
        }

        if (kind === 'walk') {
            const dir = facingRef.current;
            const step = walkSpeed * dt;
            const remaining = (targetRef.current - xRef.current) * dir;
            if (remaining <= step) {
                xRef.current = targetRef.current;
                go('idle', 'idle', rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
            } else {
                xRef.current += dir * step;
            }
            tick(t => t + 1);
            return;
        }

        if (now < untilRef.current) return;

        switch (kind) {
            case 'idle': chooseNext(); break;
            case 'sit':
                if (hasOwnClip(manifest, 'standUp')) go('standUp', 'standUp', 60_000);
                else go('idle', 'idle', rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
                break;
            case 'sleep':
                lastEventAt.current = now; // al despertar, cuenta de nuevo
                go('idle', 'idle', rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
                break;
            case 'event':
                setBubble(null);
                if (queue.current.length > 0) startEvent(queue.current.shift()!);
                else go('idle', 'idle', rand(behavior.wanderMinSec, behavior.wanderMaxSec) * 1000);
                break;
            case 'sitDown': case 'standUp':
                // seguro por si nunca llega 'finished' (clip perdido): no quedarse trabado
                go('idle', 'idle', 2000);
                break;
        }
    });

    return { animState, kind, x: xRef.current, facing: facingRef.current, bubble, onClipEnd };
}
