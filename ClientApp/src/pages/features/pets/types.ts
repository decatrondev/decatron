/**
 * Tipos del sistema de mascotas (espejo de Decatron.Core.Models.Pets + config_json de pet_configs).
 * Plan: .dev/plans/PETS_PLAN.md
 */
export interface PetStateDef {
    clip: string | null;
    loop: boolean;
    speed: number;
    next?: string | null;
    fallback?: string | null;
}

export interface PetCredit {
    title: string;
    author: string;
    authorUrl: string;
    url: string;
    license: string;
    licenseUrl: string;
}

export interface PetManifest {
    id: string;
    name: string;
    credit: PetCredit;
    triangles: number;
    scale: number;
    groundOffset: number;
    states: Record<string, PetStateDef>;
    skins: Record<string, string | null>;
}

/** Resuelve un estado a su definición real siguiendo `fallback` (máximo 3 saltos). */
export function resolveState(manifest: PetManifest, name: string): { name: string; def: PetStateDef } | null {
    let current = name;
    for (let i = 0; i < 3; i++) {
        const def = manifest.states[current];
        if (!def) return null;
        if (def.clip) return { name: current, def };
        if (!def.fallback) return null;
        current = def.fallback;
    }
    return null;
}

// ---------------- config_json ----------------

export interface PetInstanceConfig {
    model: string;
    skin: string;
    name: string;
    showName: boolean;
}

export interface PetOverlayConfig {
    /** Tamaño de la fuente de navegador en OBS. */
    width: number;
    height: number;
    /** Alto de la mascota en píxeles (escala real en pantalla). */
    petHeightPx: number;
    /** Distancia del borde inferior a las patas, en píxeles. */
    groundPx: number;
    shadow: boolean;
    /** Velocidad al caminar, en píxeles por segundo. */
    walkSpeedPx: number;
    /** Inclinación de cámara (0 = perfil puro, 1 = vista desde arriba). */
    cameraTilt: number;
}

export interface PetBehaviorConfig {
    wanderMinSec: number;
    wanderMaxSec: number;
    /** Probabilidad (0-1) de sentarse cuando le toca hacer algo. */
    sitChance: number;
    /** Cuánto se queda sentada, en segundos. */
    sitMinSec: number;
    sitMaxSec: number;
    /** Tras cuánto tiempo sin eventos se duerme (0 = nunca). */
    sleepAfterSec: number;
    sleepMinSec: number;
    sleepMaxSec: number;
    /** Zona por la que camina, como fracción del ancho (0-1). */
    walkArea: { xMin: number; xMax: number };
}

export interface PetTextStyle {
    font: string;
    size: number;
    color: string;
    background: string;
    outline: boolean;
}

export interface PetsConfig {
    version: number;
    pets: PetInstanceConfig[];
    overlay: PetOverlayConfig;
    behavior: PetBehaviorConfig;
    nameStyle: PetTextStyle;
    bubbleStyle: PetTextStyle;
    /** Fase 2: reacciones y comandos (PETS_PLAN.md D1/D2). Se guardan tal cual aunque el panel aún no los edite. */
    reactions?: Record<string, unknown>;
    commands?: unknown[];
}

export const PET_LIMITS = {
    minWidth: 320, maxWidth: 3840,
    minHeight: 120, maxHeight: 2160,
    minPetHeight: 60, maxPetHeight: 1200,
};

export function defaultPetsConfig(modelId = 'somali'): PetsConfig {
    return {
        version: 1,
        pets: [{ model: modelId, skin: 'default', name: 'Michi', showName: true }],
        overlay: { width: 1920, height: 320, petHeightPx: 220, groundPx: 16, shadow: true, walkSpeedPx: 110, cameraTilt: 0.25 },
        behavior: {
            wanderMinSec: 6, wanderMaxSec: 20,
            sitChance: 0.35, sitMinSec: 8, sitMaxSec: 25,
            sleepAfterSec: 180, sleepMinSec: 30, sleepMaxSec: 90,
            walkArea: { xMin: 0.05, xMax: 0.95 },
        },
        nameStyle: { font: 'Inter', size: 16, color: '#ffffff', background: 'rgba(0,0,0,0.55)', outline: false },
        bubbleStyle: { font: 'Inter', size: 18, color: '#111827', background: '#ffffff', outline: false },
    };
}

/** Mezcla lo guardado con los defaults para que un config viejo nunca rompa el overlay. */
export function resolvePetsConfig(raw: Partial<PetsConfig> | null | undefined, fallbackModel = 'somali'): PetsConfig {
    const d = defaultPetsConfig(fallbackModel);
    if (!raw) return d;
    const pets = Array.isArray(raw.pets) && raw.pets.length > 0
        ? raw.pets.map(p => ({ ...d.pets[0], ...p }))
        : d.pets;
    return {
        version: 1,
        pets,
        overlay: { ...d.overlay, ...(raw.overlay ?? {}) },
        behavior: { ...d.behavior, ...(raw.behavior ?? {}), walkArea: { ...d.behavior.walkArea, ...(raw.behavior?.walkArea ?? {}) } },
        nameStyle: { ...d.nameStyle, ...(raw.nameStyle ?? {}) },
        bubbleStyle: { ...d.bubbleStyle, ...(raw.bubbleStyle ?? {}) },
        reactions: raw.reactions,
        commands: raw.commands,
    };
}

/** Estímulo que llega por SignalR ("PetEvent") o desde la pestaña Testing. */
export interface PetEvent {
    state: string;
    durationSec: number;
    bubble?: string | null;
    source?: string;
}

/** Respuesta de GET /api/pets/overlay/{channel}. */
export interface PetsPublicResponse {
    success: boolean;
    enabled: boolean;
    channelKey: string;
    config?: Partial<PetsConfig>;
    models?: { manifest: PetManifest; url: string }[];
}

/** Respuesta de GET /api/pets/config. */
export interface PetsPanelData {
    success: boolean;
    isEnabled: boolean;
    config: Partial<PetsConfig> | null;
    catalog: PetManifest[];
    overlayUrlTemplate: string;
}
