/**
 * Carga un glb de mascota y reproduce el estado pedido según el manifest.
 * No asume nombres de clips: todo pasa por manifest.states (con fallback).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import type { PetManifest } from './types';
import { resolveState } from './types';

interface Props {
    url: string;
    manifest: PetManifest;
    state: string;
    /** Se llama cuando termina un clip sin loop (para encadenar `next`). */
    onClipEnd?: (state: string) => void;
    onLoaded?: (info: { clips: string[]; triangles: number; size: THREE.Vector3 }) => void;
}

export default function PetModel({ url, manifest, state, onClipEnd, onLoaded }: Props) {
    const group = useRef<THREE.Group>(null);
    const gltf = useGLTF(url);
    const { actions, mixer, names } = useAnimations(gltf.animations, group);
    const scene = useMemo(() => gltf.scene, [gltf.scene]);
    const lastAction = useRef<THREE.AnimationAction | null>(null);

    // Info del modelo cargado (una sola vez) + centrar en el suelo
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
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        onLoaded?.({ clips: names, triangles: Math.round(triangles), size });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene]);

    // Cambio de estado → crossFade al clip correspondiente
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

    return (
        <group ref={group} scale={manifest.scale} position={[0, manifest.groundOffset, 0]}>
            <primitive object={scene} />
        </group>
    );
}
