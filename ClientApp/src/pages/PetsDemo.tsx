/**
 * Mascotas — demo de Fase 0 (solo para revisar el modelo, sin config ni SignalR).
 * Carga el catálogo, pide una URL firmada del glb y reproduce cada estado por botón.
 * Plan: .dev/plans/PETS_PLAN.md
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Stats } from '@react-three/drei';
import * as THREE from 'three';
import api from '../services/api';
import PetModel from './features/pets/PetModel';
import type { PetManifest } from './features/pets/types';
import { resolveState } from './features/pets/types';

type Bg = 'transparent' | 'dark' | 'green';

export default function PetsDemo() {
    const [catalog, setCatalog] = useState<PetManifest[]>([]);
    const [manifest, setManifest] = useState<PetManifest | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [state, setState] = useState('idle');
    const [bg, setBg] = useState<Bg>('dark');
    const [showStats, setShowStats] = useState(true);
    const [info, setInfo] = useState<{ clips: string[]; triangles: number; size: THREE.Vector3 } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<PetManifest[]>('/pets/catalog')
            .then((r) => { setCatalog(r.data); if (r.data[0]) setManifest(r.data[0]); })
            .catch((e) => setError(e?.response?.data?.message || e.message));
    }, []);

    useEffect(() => {
        if (!manifest) return;
        setUrl(null);
        api.get<{ url: string }>(`/pets/models/${manifest.id}/sign`)
            .then((r) => setUrl(r.data.url))
            .catch((e) => setError(e?.response?.data?.message || e.message));
    }, [manifest]);

    // Encadena `next` cuando termina un clip sin loop (sitDown → sit, standUp → idle)
    const onClipEnd = useCallback((ended: string) => {
        if (!manifest) return;
        const next = manifest.states[ended]?.next;
        if (next) setState(next);
    }, [manifest]);

    const bgStyle = bg === 'dark' ? '#1a1a2e' : bg === 'green' ? '#00ff00' : 'transparent';

    return (
        <div className="p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Mascotas — demo del modelo (Fase 0)</h1>
                <p className="text-sm opacity-70">Revisión del modelo base antes de armar el overlay real. No hay nada configurable todavía.</p>
            </div>

            {error && <div className="rounded bg-red-900/40 border border-red-500 p-3 text-sm">{error}</div>}

            <div className="flex flex-wrap gap-2 items-center text-sm">
                <label>Modelo:</label>
                <select className="bg-gray-800 rounded px-2 py-1" value={manifest?.id ?? ''} onChange={(e) => setManifest(catalog.find((m) => m.id === e.target.value) ?? null)}>
                    {catalog.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.triangles} tris)</option>)}
                </select>
                <label className="ml-4">Fondo:</label>
                {(['dark', 'green', 'transparent'] as Bg[]).map((b) => (
                    <button key={b} onClick={() => setBg(b)} className={`px-2 py-1 rounded ${bg === b ? 'bg-purple-600' : 'bg-gray-700'}`}>{b}</button>
                ))}
                <label className="ml-4 flex items-center gap-1"><input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} /> FPS</label>
            </div>

            {manifest && (
                <div className="flex flex-wrap gap-2 text-sm">
                    {Object.entries(manifest.states).map(([name, def]) => {
                        const resolved = resolveState(manifest, name);
                        const missing = !def.clip;
                        return (
                            <button
                                key={name}
                                onClick={() => setState(name)}
                                title={missing ? `El modelo no trae este clip; usa "${resolved?.name ?? 'nada'}"` : `clip: ${def.clip}`}
                                className={`px-3 py-1 rounded ${state === name ? 'bg-purple-600' : 'bg-gray-700'} ${missing ? 'opacity-60 border border-dashed border-yellow-500' : ''}`}
                            >
                                {name}{missing ? ' *' : ''}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="rounded-lg overflow-hidden border border-gray-700" style={{ height: 480, background: bgStyle }}>
                {url && manifest ? (
                    <Canvas shadows camera={{ position: [0, 3, 9], fov: 35 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
                        <hemisphereLight intensity={0.9} groundColor="#444" />
                        <directionalLight position={[4, 8, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
                        <Suspense fallback={null}>
                            <PetModel url={url} manifest={manifest} state={state} onClipEnd={onClipEnd} onLoaded={setInfo} />
                            <ContactShadows position={[0, manifest.groundOffset, 0]} opacity={0.5} scale={12} blur={2.2} far={4} />
                        </Suspense>
                        <OrbitControls target={[0, 1, 0]} enablePan={false} />
                        {showStats && <Stats />}
                    </Canvas>
                ) : (
                    <div className="h-full flex items-center justify-center opacity-60">Cargando modelo…</div>
                )}
            </div>

            {info && manifest && (
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded bg-gray-800/60 p-3 space-y-1">
                        <div><b>Triángulos:</b> {info.triangles.toLocaleString()}</div>
                        <div><b>Tamaño (x·y·z):</b> {info.size.x.toFixed(2)} · {info.size.y.toFixed(2)} · {info.size.z.toFixed(2)}</div>
                        <div><b>Clips en el glb:</b> {info.clips.join(', ')}</div>
                        <div className="opacity-70">* = estado sin clip propio en este modelo (usa fallback)</div>
                    </div>
                    <div className="rounded bg-gray-800/60 p-3 space-y-1">
                        <div><b>Crédito (obligatorio, {manifest.credit.license}):</b></div>
                        <div>
                            "<a className="underline" href={manifest.credit.url} target="_blank" rel="noreferrer">{manifest.credit.title}</a>" por{' '}
                            <a className="underline" href={manifest.credit.authorUrl} target="_blank" rel="noreferrer">{manifest.credit.author}</a>,{' '}
                            <a className="underline" href={manifest.credit.licenseUrl} target="_blank" rel="noreferrer">{manifest.credit.license}</a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
