/**
 * Skins por tinte: ajuste HSL de la textura base en el shader (onBeforeCompile), sin texturas extra.
 * Solo se aplica a materiales con mapa de color (el cuerpo); ojos/bigotes quedan igual.
 */
import * as THREE from 'three';
import type { PetSkinTint } from './types';

const GLSL_HSL = `
uniform float uPetHue;
uniform float uPetSat;
uniform float uPetLight;
vec3 petRgb2hsl(vec3 c) {
    float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
    float l = (mx + mn) * 0.5, h = 0.0, s = 0.0, d = mx - mn;
    if (d > 1e-5) {
        s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
        if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
        else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
        else h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
    }
    return vec3(h, s, l);
}
float petHue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0; if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}
vec3 petHsl2rgb(vec3 hsl) {
    if (hsl.y < 1e-5) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(petHue2rgb(p, q, hsl.x + 1.0/3.0), petHue2rgb(p, q, hsl.x), petHue2rgb(p, q, hsl.x - 1.0/3.0));
}
vec3 petTint(vec3 rgb) {
    vec3 hsl = petRgb2hsl(rgb);
    hsl.x = fract(hsl.x + uPetHue / 360.0);
    hsl.y = clamp(hsl.y * uPetSat, 0.0, 1.0);
    hsl.z = clamp(hsl.z * uPetLight, 0.0, 1.0);
    return petHsl2rgb(hsl);
}
`;

/** Aplica (o quita, con null) el tinte a todos los materiales con mapa del objeto. Idempotente. */
export function applySkinTint(root: THREE.Object3D, tint: PetSkinTint | null) {
    root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
            const m = mat as THREE.MeshStandardMaterial & { userData: { petTint?: { hue: THREE.IUniform; sat: THREE.IUniform; light: THREE.IUniform } } };
            if (!m.map) continue;
            if (!m.userData.petTint) {
                const u = { hue: { value: 0 }, sat: { value: 1 }, light: { value: 1 } };
                m.userData.petTint = u;
                m.onBeforeCompile = (shader) => {
                    shader.uniforms.uPetHue = u.hue; shader.uniforms.uPetSat = u.sat; shader.uniforms.uPetLight = u.light;
                    shader.fragmentShader = shader.fragmentShader
                        .replace('#include <common>', '#include <common>\n' + GLSL_HSL)
                        .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n\tdiffuseColor.rgb = petTint(diffuseColor.rgb);\n#endif');
                };
                m.customProgramCacheKey = () => 'petTint';
                m.needsUpdate = true;
            }
            const u = m.userData.petTint;
            u.hue.value = tint?.hue ?? 0;
            u.sat.value = tint?.saturation ?? 1;
            u.light.value = tint?.lightness ?? 1;
        }
    });
}

/** Color aproximado del skin para el selector del panel (a partir de un marrón base tipo Somali). */
export function skinSwatch(tint: PetSkinTint | null): string {
    const base = { h: 24, s: 0.55, l: 0.45 };
    if (!tint) return `hsl(${base.h} ${base.s * 100}% ${base.l * 100}%)`;
    const h = (base.h + tint.hue + 360) % 360;
    const s = Math.min(1, base.s * tint.saturation);
    const l = Math.min(1, base.l * tint.lightness);
    return `hsl(${h} ${s * 100}% ${l * 100}%)`;
}
