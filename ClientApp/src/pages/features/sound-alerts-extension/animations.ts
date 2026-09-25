// Entrada y salida de la alerta: las usa el overlay y la vista previa del dashboard.

export const ALERT_KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes slideOut { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes bounceIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
@keyframes bounceOut { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); } 100% { transform: scale(0); opacity: 0; } }
@keyframes zoomIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes zoomOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0); opacity: 0; } }
`;

const NAMES: Record<string, [string, string]> = {
    slide: ['slideIn', 'slideOut'],
    bounce: ['bounceIn', 'bounceOut'],
    zoom: ['zoomIn', 'zoomOut'],
};

export function animationDurationMs(speed: string, type?: string): number {
    if (type === 'none') return 0;
    if (speed === 'slow') return 1000;
    if (speed === 'fast') return 300;
    return 500;
}

export function alertAnimation(type: string, speed: string, entering: boolean): string {
    // Antes "sin animación" hacía un fundido igual que "fade"; ahora aparece y desaparece de golpe
    if (type === 'none') return 'none';
    const [enter, exit] = NAMES[type] ?? ['fadeIn', 'fadeOut'];
    return `${entering ? enter : exit} ${animationDurationMs(speed) / 1000}s ease-in-out`;
}
