/**
 * Carga un glb de mascota y reproduce el estado pedido según el manifest.
 * No asume nombres de clips: todo pasa por manifest.states (con fallback).
 * Al cargar, apoya el modelo en y=0 y lo centra en x/z, así la escena no depende de cómo lo exportó el autor.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import type { PetManifest, PetSkinTint } from './types';
import { resolveState } from './types';
import { applySkinTint } from './tint';

export interface PetModelInfo {
    clips: string[];
    triangles: number;
    /** Tamaño en unidades de mundo ya con manifest.scale aplicado. */
    size: THREE.Vector3;
}

interface Props {
    url: string;
    manifest: PetManifest;
    state: string;
    /** Tinte del skin elegido (null = textura original). */
    skin?: PetSkinTint | null;
    /** Se llama cuando termina un clip sin loop (para encadenar `next`). Recibe el estado pedido. */
    onClipEnd?: (state: string) => void;
    onLoaded?: (info: PetModelInfo) => void;
}

/** Estados que se animan por código cuando el modelo no trae el clip. */
const PROCEDURAL = new Set(['react', 'sleep']);
const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export default function PetModel({ url, manifest, state, skin, onClipEnd, onLoaded }: Props) {
    const group = useRef<THREE.Group>(null);
    const gltf = useGLTF(url);
    const { actions, mixer, names } = useAnimations(gltf.animations, group);
    const scene = useMemo(() => gltf.scene, [gltf.scene]);
    const lastAction = useRef<THREE.AnimationAction | null>(null);
    const sizeRef = useRef(new THREE.Vector3(1, 3.6, 1));
    const stateStart = useRef(performance.now());
    useEffect(() => { stateStart.current = performance.now(); }, [state]);
    useEffect(() => { applySkinTint(scene, skin ?? null); }, [scene, skin]);

    // Huesos para lo procedural (por nombre del manifest); si faltan, solo se hace lo que no depende de huesos.
    const bones = useMemo(() => {
        const find = (key: string) => { const n = manifest.bones?.[key]; return n ? (scene.getObjectByName(n) as THREE.Object3D | undefined) ?? null : null; };
        return { head: find('head'), neck: find('neck'), earL: find('earL'), earR: find('earR'), tailBase: find('tailBase') };
    }, [scene, manifest.bones]);

    useEffect(() => {
        let triangles = 0;
        scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.frustumCulled = false; // los rigs animados salen del bounding original
                const geo = mesh.geometry;
                triangles += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3;
            }
        });
        // Apoyar en el suelo y centrar (en pose de reposo)
        scene.position.set(0, 0, 0);
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        scene.position.set(-center.x, -box.min.y, -center.z);
        sizeRef.current.copy(size);
        onLoaded?.({ clips: names, triangles: Math.round(triangles), size: size.clone().multiplyScalar(manifest.scale) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene]);

    useEffect(() => {
        const resolved = resolveState(manifest, state);
        if (!resolved || !resolved.def.clip) return;
        const action = actions[resolved.def.clip];
        if (!action) return;

        action.reset();
        action.setLoop(resolved.def.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        action.clampWhenFinished = !resolved.def.loop;
        action.timeScale = resolved.def.speed ?? 1;
        if (lastAction.current && lastAction.current !== action) {
            action.crossFadeFrom(lastAction.current, 0.25, true);
        }
        action.play();
        lastAction.current = action;

        if (!resolved.def.loop) {
            const handler = (e: { action: THREE.AnimationAction }) => {
                if (e.action === action) onClipEnd?.(state);
            };
            mixer.addEventListener('finished', handler);
            return () => mixer.removeEventListener('finished', handler);
        }
    }, [state, manifest, actions, mixer, onClipEnd]);

    useFrame(() => {
        const g = group.current; if (!g) return;
        const own = resolveState(manifest, state)?.name === state;
        const procedural = !own && PROCEDURAL.has(state);
        const t = (performance.now() - stateStart.current) / 1000;
        const H = sizeRef.current.y;
        let y = manifest.groundOffset, sy = 1;

        if (procedural && state === 'react') {
            // Dos saltitos, orejas paradas y cola arriba
            if (t < 1.1) y += H * 0.16 * Math.abs(Math.sin(t * Math.PI / 0.55));
            const k = easeOut(t * 3);
            if (bones.earL) bones.earL.rotation.x -= 0.35 * k;
            if (bones.earR) bones.earR.rotation.x -= 0.35 * k;
            if (bones.tailBase) bones.tailBase.rotation.x -= 0.5 * k;
            if (bones.head) bones.head.rotation.x -= 0.15 * k;
        } else if (procedural && state === 'sleep') {
            // Sobre la pose sentada: cabeza y cuello abajo, orejas atrás y respiración lenta
            const k = easeOut(t / 1.5);
            if (bones.neck) bones.neck.rotation.x += 0.45 * k;
            if (bones.head) bones.head.rotation.x += 0.55 * k;
            if (bones.earL) bones.earL.rotation.x += 0.4 * k;
            if (bones.earR) bones.earR.rotation.x += 0.4 * k;
            sy = 1 - 0.03 * k + 0.012 * k * Math.sin(t * 1.6);
        }
        g.position.y = y;
        g.scale.set(manifest.scale, manifest.scale * sy, manifest.scale);
    });

    return (
        <group ref={group} scale={manifest.scale} position={[0, manifest.groundOffset, 0]}>
            <primitive object={scene} />
        </group>
    );
}
