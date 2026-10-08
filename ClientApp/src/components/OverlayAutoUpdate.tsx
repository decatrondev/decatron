import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { startVersionWatcher } from '../utils/overlayVersion';

/**
 * Mantiene al día cualquier overlay de OBS (rutas /overlay/*): cuando se despliega una versión nueva, la fuente
 * se recarga sola en un momento tranquilo, sin que el streamer tenga que actualizarla. Se monta una vez en App,
 * después de las rutas, así que un overlay que ya trae su propia regla de "no recargar ahora" (Speak Chat) la
 * conserva: el vigilante de overlayVersion es único por página y gana el primero.
 */
export default function OverlayAutoUpdate() {
    const { pathname } = useLocation();
    const isOverlay = pathname.startsWith('/overlay/');

    useEffect(() => (isOverlay ? startVersionWatcher() : undefined), [isOverlay]);

    return null;
}
