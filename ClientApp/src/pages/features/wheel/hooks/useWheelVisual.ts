import { useMemo, useState } from 'react';
import { resolveVisual, type SoundKey, type WheelVisual } from '../../../../components/wheel/visualConfig';

/**
 * El aspecto de la rueda abierta. Lo que el streamer no configuro se cae al default
 * de Decatron, igual que en el overlay: asi el preview muestra lo mismo que se vera en
 * OBS incluso con una rueda recien creada, que no tiene ni una clave guardada.
 */
export function useWheelVisual() {
    const [visualRaw, setVisualRaw] = useState<unknown>(null);
    const visual: WheelVisual = useMemo(() => resolveVisual(visualRaw), [visualRaw]);

    const patchVisual = (cambios: Partial<WheelVisual>) =>
        setVisualRaw({ ...visual, ...cambios });

    const patchPointer = (cambios: Partial<WheelVisual['pointer']>) =>
        setVisualRaw({ ...visual, pointer: { ...visual.pointer, ...cambios } });

    const patchSound = (key: SoundKey, cambios: Partial<WheelVisual['sounds'][SoundKey]>) =>
        setVisualRaw({ ...visual, sounds: { ...visual.sounds, [key]: { ...visual.sounds[key], ...cambios } } });

    return { visual, setVisualRaw, patchVisual, patchPointer, patchSound };
}
