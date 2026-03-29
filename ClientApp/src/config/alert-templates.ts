import type { AlertTemplateDefinition, AlertsGlobalConfig } from '../types/timer-alerts';

// ============================================================================
// PLANTILLAS PREDEFINIDAS PARA ALERTAS
// ============================================================================

/**
 * Plantilla MINIMAL
 * - Diseño simple y limpio
 * - Fondo negro semi-transparente
 * - Texto blanco sin efectos
 * - Animación sutil fade in/out
 */
export const MINIMAL_TEMPLATE: AlertsGlobalConfig = {
    enabled: true,
    position: { x: 960, y: 100 },
    size: { width: 600, height: 120 },
    duration: 5000, // 5 segundos
    style: {
        backgroundType: 'color',
        backgroundColor: '#1a1a1a',
        gradient: { color1: '#3b82f6', color2: '#8b5cf6', angle: 45 },
        backgroundImage: null,
        textColor: '#ffffff',
        fontSize: 32,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'normal',
        textShadow: 'none',
        borderEnabled: false,
        borderColor: '#ffffff',
        borderWidth: 2,
        borderRadius: 12,
        opacity: 85 // 85%
    },
    animation: {
        entrance: 'fade',
        exit: 'fade',
        speed: 'normal'
    }
};

/**
 * Plantilla COLORFUL
 * - Diseño vibrante y llamativo
 * - Gradiente dinámico según el evento
 * - Texto con sombra brillante (glow)
 * - Bordes redondeados con borde blanco
 * - Animación slide + bounce
 */
export const COLORFUL_TEMPLATE: AlertsGlobalConfig = {
    enabled: true,
    position: { x: 960, y: 100 },
    size: { width: 700, height: 140 },
    duration: 6000, // 6 segundos
    style: {
        backgroundType: 'gradient',
        backgroundColor: '#1a1a1a',
        gradient: {
            color1: '#3b82f6', // Azul brillante
            color2: '#8b5cf6', // Púrpura vibrante
            angle: 135 // Diagonal
        },
        backgroundImage: null,
        textColor: '#ffffff',
        fontSize: 36,
        fontFamily: '"Poppins", "Arial", sans-serif',
        fontWeight: 'bold',
        textShadow: 'glow', // Glow fuerte
        borderEnabled: true,
        borderColor: '#ffffff',
        borderWidth: 3,
        borderRadius: 25,
        opacity: 95 // 95%
    },
    animation: {
        entrance: 'slide',
        exit: 'fade',
        speed: 'normal'
    }
};

/**
 * Plantilla GAMING
 * - Estilo gamer/retro
 * - Fondo oscuro con borde neón
 * - Fuente tipo gaming (monospace bold)
 * - Borde brillante de colores
 * - Animación zoom con efecto de entrada dramático
 */
export const GAMING_TEMPLATE: AlertsGlobalConfig = {
    enabled: true,
    position: { x: 960, y: 100 },
    size: { width: 750, height: 150 },
    duration: 7000, // 7 segundos
    style: {
        backgroundType: 'color',
        backgroundColor: '#0a0a0a', // Negro casi puro
        gradient: {
            color1: '#00ff88', // Verde neón
            color2: '#00ffff', // Cian neón
            angle: 45
        },
        backgroundImage: null,
        textColor: '#00ff88', // Verde neón
        fontSize: 38,
        fontFamily: '"Courier New", "Consolas", monospace',
        fontWeight: 'bold',
        textShadow: 'strong', // Sombra fuerte
        borderEnabled: true,
        borderColor: '#00ff88', // Verde neón
        borderWidth: 4,
        borderRadius: 8, // Esquinas menos redondeadas (estilo retro)
        opacity: 98 // Casi opaco
    },
    animation: {
        entrance: 'zoom',
        exit: 'zoom',
        speed: 'fast'
    }
};

/**
 * Colección de todas las plantillas
 */
export const ALERT_TEMPLATES: Record<string, AlertTemplateDefinition> = {
    minimal: {
        name: 'Minimal',
        description: 'Diseño simple y limpio. Perfecto para overlays minimalistas.',
        global: MINIMAL_TEMPLATE
    },
    colorful: {
        name: 'Colorful',
        description: 'Diseño vibrante y llamativo. Gradientes dinámicos y animaciones suaves.',
        global: COLORFUL_TEMPLATE
    },
    gaming: {
        name: 'Gaming',
        description: 'Estilo gamer con bordes neón y fuente monospace. Para streams retro/gaming.',
        global: GAMING_TEMPLATE
    }
};

/**
 * Helper para obtener la configuración global de una plantilla
 */
export function getTemplateConfig(template: 'minimal' | 'colorful' | 'gaming' | 'custom'): AlertsGlobalConfig {
    if (template === 'custom') {
        return MINIMAL_TEMPLATE; // Default al custom
    }
    return ALERT_TEMPLATES[template]?.global || MINIMAL_TEMPLATE;
}

/**
 * Helper para aplicar colores específicos a eventos (para plantilla Colorful)
 */
export const EVENT_COLORS = {
    bits: {
        gradient: { color1: '#3b82f6', color2: '#8b5cf6', angle: 45 }, // Azul → Púrpura
        textColor: '#ffffff',
        borderColor: '#3b82f6'
    },
    follow: {
        gradient: { color1: '#ef4444', color2: '#ec4899', angle: 45 }, // Rojo → Rosa
        textColor: '#ffffff',
        borderColor: '#ef4444'
    },
    sub: {
        gradient: { color1: '#8b5cf6', color2: '#3b82f6', angle: 45 }, // Púrpura → Azul
        textColor: '#ffffff',
        borderColor: '#8b5cf6'
    },
    giftSub: {
        gradient: { color1: '#f59e0b', color2: '#ef4444', angle: 45 }, // Naranja → Rojo
        textColor: '#ffffff',
        borderColor: '#f59e0b'
    },
    raid: {
        gradient: { color1: '#10b981', color2: '#06b6d4', angle: 45 }, // Verde → Cian
        textColor: '#ffffff',
        borderColor: '#10b981'
    },
    hypeTrain: {
        gradient: { color1: '#ec4899', color2: '#f59e0b', angle: 45 }, // Rosa → Naranja
        textColor: '#ffffff',
        borderColor: '#ec4899'
    }
};