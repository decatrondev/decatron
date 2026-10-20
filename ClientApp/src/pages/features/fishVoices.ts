// Voces de personaje (Fish Audio) aprobadas en el catálogo del admin (/admin/fish-voices).
import { useEffect, useState } from 'react';
import api from '../../services/api';

export interface FishVoiceOption {
    id: string;
    name: string;
    languages: string;
    author?: string | null;
    sampleUrl?: string | null;
}

interface FishVoicesData {
    voices: FishVoiceOption[];
    /** Créditos por byte de texto (tarifa «fish» de credit_rates). */
    creditsPerByte: number;
}

let cache: FishVoicesData | null = null;
let pending: Promise<FishVoicesData> | null = null;

function load(): Promise<FishVoicesData> {
    if (cache) return Promise.resolve(cache);
    pending ??= api.get('/tts/fish-voices')
        .then(res => {
            cache = { voices: res.data?.voices ?? [], creditsPerByte: Number(res.data?.creditsPerByte) || 0 };
            return cache;
        })
        .catch(() => ({ voices: [], creditsPerByte: 0 }))
        .finally(() => { pending = null; });
    return pending;
}

export function useFishVoices(): FishVoicesData & { loading: boolean } {
    const [data, setData] = useState<FishVoicesData>(cache ?? { voices: [], creditsPerByte: 0 });
    const [loading, setLoading] = useState(!cache);
    useEffect(() => {
        let alive = true;
        load().then(d => { if (alive) { setData(d); setLoading(false); } });
        return () => { alive = false; };
    }, []);
    return { ...data, loading };
}

/** «Toji · español latino (es)» para el desplegable. */
export function fishVoiceLabel(v: FishVoiceOption): string {
    return v.languages ? `${v.name} (${v.languages.split(',').join(', ')})` : v.name;
}

/** Costo orientativo para mostrar junto al selector: créditos cada 100 caracteres. */
export function fishCostPer100(creditsPerByte: number): string {
    return Math.round(creditsPerByte * 100).toLocaleString('es');
}
