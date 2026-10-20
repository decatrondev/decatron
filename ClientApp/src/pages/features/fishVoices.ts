// Voces de personaje (Fish Audio) aprobadas en el catálogo del admin (/admin/fish-voices).
import { useEffect, useState } from 'react';
import api from '../../services/api';

export interface FishVoiceOption {
    id: string;
    name: string;
    languages: string;
    author?: string | null;
    sampleUrl?: string | null;
    /** Voz propia del canal (rango Patrocinador o superior), no del catálogo global. */
    private?: boolean;
}

interface FishVoicesData {
    voices: FishVoiceOption[];
    /** Créditos por byte de texto (tarifa «fish» de credit_rates). */
    creditsPerByte: number;
    /** El rango permite buscar y agregar voces propias. */
    canAddPrivate: boolean;
    maxPrivate: number;
    privateCount: number;
}

const EMPTY: FishVoicesData = { voices: [], creditsPerByte: 0, canAddPrivate: false, maxPrivate: 0, privateCount: 0 };

let cache: FishVoicesData | null = null;
let pending: Promise<FishVoicesData> | null = null;
const listeners = new Set<(d: FishVoicesData) => void>();

function load(): Promise<FishVoicesData> {
    if (cache) return Promise.resolve(cache);
    pending ??= api.get('/tts/fish-voices')
        .then(res => {
            cache = {
                voices: res.data?.voices ?? [],
                creditsPerByte: Number(res.data?.creditsPerByte) || 0,
                canAddPrivate: !!res.data?.canAddPrivate,
                maxPrivate: Number(res.data?.maxPrivate) || 0,
                privateCount: Number(res.data?.privateCount) || 0,
            };
            return cache;
        })
        .catch(() => EMPTY)
        .finally(() => { pending = null; });
    return pending;
}

/** Vuelve a pedir la lista (tras agregar o quitar una voz propia) y avisa a los selectores abiertos. */
export async function refreshFishVoices(): Promise<void> {
    cache = null;
    const d = await load();
    listeners.forEach(fn => fn(d));
}

export function useFishVoices(): FishVoicesData & { loading: boolean } {
    const [data, setData] = useState<FishVoicesData>(cache ?? EMPTY);
    const [loading, setLoading] = useState(!cache);
    useEffect(() => {
        let alive = true;
        load().then(d => { if (alive) { setData(d); setLoading(false); } });
        const fn = (d: FishVoicesData) => { if (alive) setData(d); };
        listeners.add(fn);
        return () => { alive = false; listeners.delete(fn); };
    }, []);
    return { ...data, loading };
}

/** «Toji · español latino (es)» para el desplegable. */
export function fishVoiceLabel(v: FishVoiceOption): string {
    const base = v.languages ? `${v.name} (${v.languages.split(',').join(', ')})` : v.name;
    return v.private ? `${base} · mía` : base;
}

/** Costo orientativo para mostrar junto al selector: créditos cada 100 caracteres. */
export function fishCostPer100(creditsPerByte: number): string {
    return Math.round(creditsPerByte * 100).toLocaleString('es');
}
