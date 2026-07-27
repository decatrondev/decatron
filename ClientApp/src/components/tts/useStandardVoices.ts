/**
 * Catálogo de voces estándar (Piper), las del nivel gratuito.
 *
 * Se sirven desde el servidor, así que a diferencia de las voces del navegador —que
 * dependían de cada máquina y no sonaban dentro de OBS— la lista es la misma para
 * todo el mundo y lo que se elige aquí es exactamente lo que se va a oír.
 */

import { useEffect, useState } from 'react';
import api from '../../services/api';

export interface StandardVoice {
    id: string;              // es_MX-claude-high
    speaker: string;         // Claude
    quality: string;         // medium | high
    language: string;        // es_MX
    languageName: string;    // Español (México)
    languagePrefix: string;  // es
}

/** Se cachea en el módulo: el catálogo no cambia salvo que se instalen voces nuevas. */
let cached: StandardVoice[] | null = null;

export function useStandardVoices() {
    const [voices, setVoices] = useState<StandardVoice[]>(cached ?? []);
    const [loading, setLoading] = useState(cached === null);

    useEffect(() => {
        if (cached !== null) return;

        let active = true;
        api.get('/tts/standard-voices')
            .then(res => {
                if (!active) return;
                cached = res.data?.voices ?? [];
                setVoices(cached);
            })
            .catch(() => { if (active) setVoices([]); })
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, []);

    return { voices, loading };
}

/** Voces del idioma pedido. Vacío si Piper no cubre ese idioma (japonés, coreano). */
export function standardVoicesForLanguage(
    voices: StandardVoice[],
    languageCode?: string,
): StandardVoice[] {
    const prefix = (languageCode ?? 'es').substring(0, 2).toLowerCase();
    return voices.filter(v => v.languagePrefix === prefix);
}
