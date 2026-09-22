/**
 * Tipos del catálogo de mascotas (espejo de Decatron.Core.Models.Pets.PetManifest).
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
