/**
 * Catálogo único de voces: estándar (Piper) y premium (Polly).
 *
 * Antes cada pantalla llevaba su propia lista escrita a mano y ninguna coincidía con las
 * demás: Speak Chat ofrecía 16 voces y las alertas 21. Peor todavía, el idioma se
 * guardaba en un campo aparte de la voz, así que nada impedía guardar "voz japonesa +
 * idioma español" — que es exactamente lo que hacía que una alerta sonara en japonés
 * después de configurarla en español.
 *
 * Aquí el idioma es un filtro del catálogo, no un dato independiente. Cada voz trae el
 * suyo y esa combinación deja de poder existir.
 */

import { useEffect, useState } from 'react';
import api from '../../services/api';

export interface StandardVoice {
    id: string;              // es_MX-claude-high
    name: string;            // Claude
    quality: string;         // medium | high
    language: string;        // es-MX
    languageName: string;    // Español (México)
    languagePrefix: string;  // es
}

export interface PremiumVoice {
    id: string;              // Lupe
    name: string;            // Lupe
    gender: string;          // Female | Male
    language: string;        // es-US
    languageName: string;    // Español (EE. UU.)
    languagePrefix: string;  // es
    engines: string[];       // ['standard', 'neural']
    supportsNeural: boolean;
}

export interface CatalogLanguage {
    code: string;            // es-MX
    label: string;           // Español (México)
    /** Voz estándar (Piper, gratis). NO es el motor "standard" de Polly. */
    hasStandard: boolean;
    hasPremium: boolean;
    /** Polly con motor standard — dentro de premium, la calidad normal (1x). */
    hasPremiumNormal: boolean;
    /** Polly con motor neural — dentro de premium, la alta calidad (4x). */
    hasPremiumHigh: boolean;
}

export interface VoiceCatalog {
    standard: { available: boolean; voices: StandardVoice[] };
    premium: { available: boolean; voices: PremiumVoice[] };
    languages: CatalogLanguage[];
}

const EMPTY: VoiceCatalog = {
    standard: { available: false, voices: [] },
    premium: { available: false, voices: [] },
    languages: [],
};

/**
 * Cacheado en el módulo. El catálogo es el mismo para todos los usuarios y el servidor
 * ya lo guarda un día entero; no tiene sentido volver a pedirlo al cambiar de pantalla.
 */
let cached: VoiceCatalog | null = null;
let inFlight: Promise<VoiceCatalog> | null = null;

function fetchCatalog(): Promise<VoiceCatalog> {
    if (cached) return Promise.resolve(cached);

    // Varias pantallas pueden montarse a la vez. Sin esto, cada una lanzaría su propia
    // petición para acabar guardando lo mismo.
    if (!inFlight) {
        inFlight = api.get('/tts/voices')
            .then(res => {
                cached = {
                    standard: res.data?.standard ?? EMPTY.standard,
                    premium: res.data?.premium ?? EMPTY.premium,
                    languages: res.data?.languages ?? [],
                };
                return cached;
            })
            .catch(() => EMPTY)
            .finally(() => { inFlight = null; });
    }

    return inFlight;
}

export function useVoiceCatalog() {
    const [catalog, setCatalog] = useState<VoiceCatalog>(cached ?? EMPTY);
    const [loading, setLoading] = useState(cached === null);

    useEffect(() => {
        if (cached !== null) return;

        let active = true;
        fetchCatalog()
            .then(c => { if (active) setCatalog(c); })
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, []);

    return { catalog, loading };
}

/**
 * Compara idiomas por su prefijo ISO ("es"), no por el código completo.
 *
 * Piper tiene es_MX y es_AR; Polly tiene es-US y es-ES. Exigir coincidencia exacta
 * dejaría sin voz estándar a quien tenga configurado es-US, que es el valor por defecto
 * de casi todas las features.
 */
function samePrefix(a: string, b?: string): boolean {
    return a.substring(0, 2).toLowerCase() === (b ?? 'es').substring(0, 2).toLowerCase();
}

/** Voces estándar del idioma pedido. Vacío si Piper no lo cubre (japonés, coreano). */
export function standardVoicesForLanguage(
    catalog: VoiceCatalog,
    languageCode?: string,
): StandardVoice[] {
    return catalog.standard.voices.filter(v => samePrefix(v.language, languageCode));
}

/**
 * Voces premium del idioma pedido, opcionalmente solo las que admiten un motor.
 * Filtrar por motor evita ofrecer una voz que no puede hacer neural cuando el usuario
 * ya eligió neural, que terminaría en un fallo de síntesis en pleno directo.
 */
export function premiumVoicesForLanguage(
    catalog: VoiceCatalog,
    languageCode?: string,
    engine?: string,
): PremiumVoice[] {
    return catalog.premium.voices.filter(v =>
        samePrefix(v.language, languageCode) &&
        (!engine || v.engines.includes(engine)));
}

/**
 * Los idiomas que se pueden ofrecer con la configuración actual.
 *
 * Es el paso que faltaba. La calidad recorta el catálogo de verdad: 13 idiomas existen
 * solo en alta calidad y 6 solo en normal —el ruso entre ellos—, así que enseñar la lista
 * completa lleva a elegir un idioma y encontrarse el selector de voces vacío.
 */
export function languagesFor(
    catalog: VoiceCatalog,
    provider: 'piper' | 'polly',
    engine?: 'standard' | 'neural',
): CatalogLanguage[] {
    if (provider === 'piper') return catalog.languages.filter(l => l.hasStandard);
    if (engine === 'neural') return catalog.languages.filter(l => l.hasPremiumHigh);
    if (engine === 'standard') return catalog.languages.filter(l => l.hasPremiumNormal);
    return catalog.languages.filter(l => l.hasPremium);
}

/** Etiqueta legible de un idioma; el código pelado solo si no está en el catálogo. */
export function languageLabel(catalog: VoiceCatalog, code?: string): string {
    if (!code) return '';
    return catalog.languages.find(l => l.code.toLowerCase() === code.toLowerCase())?.label ?? code;
}

/** Datos de una voz premium por id, para poder mostrar su nombre e idioma reales. */
export function findPremiumVoice(catalog: VoiceCatalog, voiceId?: string): PremiumVoice | undefined {
    if (!voiceId) return undefined;
    return catalog.premium.voices.find(v => v.id === voiceId);
}

/**
 * Si la combinación guardada tiene sentido. Devuelve el problema en texto, o null si
 * está bien.
 *
 * Es la comprobación que no existía: una voz japonesa con idioma español pasaba el
 * guardado sin una sola queja y solo se descubría al oír la alerta.
 */
export function describeVoiceMismatch(
    catalog: VoiceCatalog,
    voiceId?: string,
    languageCode?: string,
): string | null {
    const voice = findPremiumVoice(catalog, voiceId);
    if (!voice || !languageCode) return null;
    if (samePrefix(voice.language, languageCode)) return null;

    return `La voz ${voice.name} es de ${voice.languageName}, pero el idioma configurado es otro. Se oirá en ${voice.languageName}.`;
}
