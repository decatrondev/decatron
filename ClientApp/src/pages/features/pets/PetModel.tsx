/**
 * Carga un glb de mascota y reproduce el estado pedido según el manifest.
 * No asume nombres de clips: todo pasa por manifest.states (con fallback).
 * Al cargar, apoya el modelo en y=0 y lo centra en x/z, así la escena no depende de cómo lo exportó el autor.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import type { PetManifest } from './types';
import { resolveState } from './types';

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
    /** Se llama cuando termina un clip sin loop (para encadenar `next`). Recibe el estado pedido. */
    onClipEnd?: (state: string) => void;
    onLoaded?: (info: PetModelInfo) => void;
}

export default function PetModel({ url, manifest, state, onClipEnd, onLoaded }: Props) {
    const group = useRef<THREE.Group>(null);
    const gltf = useGLTF(url);
    const { actions, mixer, names } = useAnimations(gltf.animations, group);
    const scene = useMemo(() => gltf.scene, [gltf.scene]);
    const lastAction = useRef<THREE.AnimationAction | null>(null);

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
        onLoaded?.({ clips: names, triangles: Math.round(triangles), size: size.multiplyScalar(manifest.scale) });
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

    return (
        <group ref={group} scale={manifest.scale} position={[0, manifest.groundOffset, 0]}>
            <primitive object={scene} />
        </group>
    );
}
