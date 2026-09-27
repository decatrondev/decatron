import { createContext, useContext } from 'react';
import type { AnimationDirection, AnimationType } from './types/index';

// Valores de General (duración, animación y volumen por defecto) para lo que se crea nuevo dentro de un evento
// (por ejemplo, una variante). Los provee la página de Event Alerts.

export interface GlobalAlertDefaults {
    duration: number;
    animation: AnimationType;
    direction: AnimationDirection;
    volume: number;
}

export const GlobalDefaultsContext = createContext<GlobalAlertDefaults>({ duration: 5, animation: 'fade', direction: 'center', volume: 80 });

export const useGlobalDefaults = () => useContext(GlobalDefaultsContext);
