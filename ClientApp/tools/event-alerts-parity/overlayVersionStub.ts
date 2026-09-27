// Sin vigilante de versión en el banco (pediría /index.html cada 5 minutos).
export function startVersionWatcher(): () => void { return () => {}; }
export function reloadOverlay(): void {}
