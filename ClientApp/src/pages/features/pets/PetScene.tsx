/**
 * Escena 3D de la mascota: la usan el overlay de OBS y la preview del panel (mismo componente).
 * Cámara ortográfica: `petHeightPx` fija el alto real de la mascota en pantalla y `groundPx` dónde apoya las patas.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import PetModel, { type PetModelInfo } from './PetModel';
import { usePetBrain } from './usePetBrain';
import type { PetEventBus } from './PetEventBus';
import type { PetInstanceConfig, PetManifest, PetsConfig, PetTextStyle } from './types';

interface Props {
    config: PetsConfig;
    manifest: PetManifest;
    modelUrl: string;
    bus?: PetEventBus;
    paused?: boolean;
    /** Ancho/alto del canvas en px (por defecto config.overlay). */
    width?: number;
    height?: number;
    /** Fuerza un estado (demo/preview) en vez del cerebro. */
    forcedState?: string;
    onLoaded?: (info: PetModelInfo) => void;
}

const FALLBACK_HEIGHT = 3.6; // alto del Somali en unidades de mundo, hasta que el modelo cargue

function textStyle(s: PetTextStyle): React.CSSProperties {
    return {
        fontFamily: `'${s.font}', system-ui, sans-serif`,
        fontSize: s.size,
        color: s.color,
        background: s.background,
        textShadow: s.outline ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' : undefined,
        padding: '3px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        fontWeight: 600,
        lineHeight: 1.2,
        pointerEvents: 'none',
        userSelect: 'none',
    };
}

/** Cámara: zoom desde petHeightPx, centro para que y=0 caiga a groundPx del borde inferior, con inclinación opcional. */
function Rig({ width, height, petWorldHeight, petHeightPx, groundPx, tilt }: { width: number; height: number; petWorldHeight: number; petHeightPx: number; groundPx: number; tilt: number }) {
    const cam = useRef<THREE.OrthographicCamera>(null);
    const set = useThree(s => s.set);
    const zoom = petHeightPx / petWorldHeight;
    useEffect(() => {
        const c = cam.current; if (!c) return;
        const cy = (height / 2 - groundPx) / zoom;
        const a = tilt * (35 * Math.PI / 180);
        const D = 60;
        c.position.set(0, cy + Math.sin(a) * D, Math.cos(a) * D);
        c.up.set(0, 1, 0);
        c.lookAt(0, cy, 0);
        c.zoom = zoom;
        c.left = -width / 2; c.right = width / 2; c.top = height / 2; c.bottom = -height / 2;
        c.near = 0.1; c.far = 200;
        c.updateProjectionMatrix();
        set({ camera: c });
    }, [width, height, zoom, groundPx, tilt, set]);
    return <OrthographicCamera ref={cam} makeDefault />;
}

function Actor({ config, pet, manifest, modelUrl, bus, paused, forcedState, halfWidth, zoom, onLoaded }: {
    config: PetsConfig; pet: PetInstanceConfig; manifest: PetManifest; modelUrl: string; bus?: PetEventBus; paused?: boolean; forcedState?: string; halfWidth: number; zoom: number; onLoaded?: (i: PetModelInfo) => void;
}) {
    const [info, setInfo] = useState<PetModelInfo | null>(null);
    const brain = usePetBrain({ manifest, behavior: config.behavior, halfWidth, walkSpeed: config.overlay.walkSpeedPx / zoom, bus, paused: paused || !!forcedState });
    const group = useRef<THREE.Group>(null);
    const petH = info?.size.y ?? FALLBACK_HEIGHT;
    const petLen = Math.max(info?.size.x ?? 1, info?.size.z ?? 1);

    // Orientación: el modelo mira a -Z. Perfil derecha = -π/2, izquierda = +π/2, hacia cámara = π.
    // Quieta gira un poco hacia la cámara para que no sea un perfil plano; sentada/dormida, más.
    useFrame((_, dt) => {
        const g = group.current; if (!g) return;
        g.position.x = brain.x;
        const toward = brain.kind === 'walk' ? 0 : (brain.kind === 'sit' || brain.kind === 'sleep' || brain.kind === 'sitDown') ? 1.0 : 0.45;
        const target = brain.facing === 1 ? -Math.PI / 2 - toward : Math.PI / 2 + toward;
        g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 6);
    });

    const state = forcedState ?? brain.animState;
    return (
        <group ref={group}>
            <PetModel url={modelUrl} manifest={manifest} state={state} onClipEnd={brain.onClipEnd} onLoaded={(i) => { setInfo(i); onLoaded?.(i); }} />
            {config.overlay.shadow && <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={petLen * 2.2} blur={2.4} far={petH} frames={Infinity} />}
            {pet.showName && pet.name && (
                <Html position={[0, petH + 0.15, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                    <div style={textStyle(config.nameStyle)}>{pet.name}</div>
                </Html>
            )}
            {brain.bubble && (
                <Html position={[0, petH + (pet.showName ? 0.9 : 0.35), 0]} center zIndexRange={[11, 0]} style={{ pointerEvents: 'none' }}>
                    <div style={{ ...textStyle(config.bubbleStyle), borderRadius: 14, maxWidth: 320, whiteSpace: 'normal', textAlign: 'center' }}>{brain.bubble}</div>
                </Html>
            )}
        </group>
    );
}

export default function PetScene({ config, manifest, modelUrl, bus, paused, width, height, forcedState, onLoaded }: Props) {
    const w = width ?? config.overlay.width;
    const h = height ?? config.overlay.height;
    const [petWorldHeight, setPetWorldHeight] = useState(FALLBACK_HEIGHT);
    const zoom = config.overlay.petHeightPx / petWorldHeight;
    const halfWidth = useMemo(() => (w / zoom) / 2, [w, zoom]);
    const pet = config.pets[0];

    return (
        <Canvas
            shadows={false}
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
            style={{ width: w, height: h, background: 'transparent' }}
            frameloop="always"
        >
            <Rig width={w} height={h} petWorldHeight={petWorldHeight} petHeightPx={config.overlay.petHeightPx} groundPx={config.overlay.groundPx} tilt={config.overlay.cameraTilt} />
            <hemisphereLight intensity={1.0} groundColor="#3a3a3a" />
            <directionalLight position={[4, 8, 6]} intensity={1.5} />
            <Suspense fallback={null}>
                <Actor config={config} pet={pet} manifest={manifest} modelUrl={modelUrl} bus={bus} paused={paused} forcedState={forcedState} halfWidth={halfWidth} zoom={zoom}
                    onLoaded={(i) => { if (i.size.y > 0) setPetWorldHeight(i.size.y); onLoaded?.(i); }} />
            </Suspense>
        </Canvas>
    );
}
