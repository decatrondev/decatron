/**
 * Timer Extension - useTimerPersistence Hook
 *
 * Hook personalizado para manejar la persistencia del timer (guardar/cargar configuración).
 */

import { useState } from 'react';
import api from '../../../../services/api';
import type { SaveMessageType } from '../types';

interface TimerConfig {
    defaultDuration: number;
    autoStart: boolean;
    displayConfig: any;
    progressBarConfig: any;
    styleConfig: any;
    animationConfig: any;
    themeConfig: any;
    eventsConfig: any;
    commandsConfig: any;
    alertsConfig: any;
    goalConfig: any;
    advancedConfig?: any;
    historyConfig?: any;
}

interface UseTimerPersistenceOptions {
    onConfigLoaded?: (config: any) => void;
    onFrontendInfoLoaded?: (url: string) => void;
}

export const useTimerPersistence = (options?: UseTimerPersistenceOptions) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<SaveMessageType>(null);

    // Cargar configuración desde el servidor
    const loadConfiguration = async () => {
        try {
            setLoading(true);
            const res = await api.get('/timer/config');
            if (res.data.success && res.data.config) {
                options?.onConfigLoaded?.(res.data.config);
            }
        } catch (error) {
            console.error('Error loading timer configuration:', error);
            setSaveMessage({ type: 'error', text: 'Error al cargar la configuración' });
        } finally {
            setLoading(false);
        }
    };

    // Cargar información del frontend (overlay URL)
    const loadFrontendInfo = async () => {
        try {
            const res = await api.get('/settings/frontend-info');
            if (res.data.success) {
                const { frontendUrl, channel } = res.data;
                const url = `${frontendUrl}/overlay/timer?channel=${channel.login}`;
                options?.onFrontendInfoLoaded?.(url);
            }
        } catch (error) {
            console.error('Error loading frontend info:', error);
            const fallbackUrl = `${window.location.origin}/overlay/timer?channel=channel`;
            options?.onFrontendInfoLoaded?.(fallbackUrl);
        }
    };

    // Guardar configuración en el servidor
    const saveConfiguration = async (config: TimerConfig) => {
        try {
            setSaving(true);
            setSaveMessage(null);


            await api.post('/timer/config', config);

            setSaveMessage({ type: 'success', text: 'Configuración guardada exitosamente' });

            setTimeout(() => {
                setSaveMessage(null);
            }, 3000);

            return true;
        } catch (error) {
            console.error('Error saving timer configuration:', error);
            setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' });
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Debug: Comparar configuración en memoria vs BD
    const debugConfig = async (currentConfig: TimerConfig) => {
        try {
            const res = await api.get('/timer/config');
            const stateRes = await api.get('/timer/state/current');
            setSaveMessage({ type: 'success', text: '✅ Config cargada correctamente' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch {
            setSaveMessage({ type: 'error', text: 'Error obteniendo config de BD' });
            setTimeout(() => setSaveMessage(null), 3000);
        }
    };

    // Copiar URL del overlay al portapapeles
    const copyOverlayUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setSaveMessage({ type: 'success', text: 'URL copiada al portapapeles' });
        setTimeout(() => setSaveMessage(null), 2000);
    };

    // Sincronizar timer activo cada segundo
    const syncTimerState = (onSync: (remainingSeconds: number) => void) => {
        const interval = setInterval(async () => {
            try {
                const stateRes = await api.get('/timer/state/current');
                if (stateRes.data.success && stateRes.data.state) {
                    const state = stateRes.data.state;

                    // Si hay timer activo (running o paused), actualizar con tiempo restante
                    if (state.status === 'running' || state.status === 'paused') {
                        let remainingSeconds = state.currentTime;

                        // Si está corriendo, calcular tiempo restante en tiempo real
                        if (state.status === 'running' && state.startedAt) {
                            const startDate = new Date(state.startedAt);
                            const now = new Date();
                            const elapsedMs = now.getTime() - startDate.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000) - (state.elapsedPausedTime || 0);
                            remainingSeconds = Math.max(0, state.totalTime - elapsedSeconds);
                        }

                        onSync(remainingSeconds);
                    }
                }
            } catch (err) {
                // Si no hay timer o error, no hacer nada
            }
        }, 1000);

        return () => clearInterval(interval);
    };

    return {
        // Estado
        loading,
        saving,
        saveMessage,

        // Setters
        setLoading,
        setSaving,
        setSaveMessage,

        // Acciones
        loadConfiguration,
        loadFrontendInfo,
        saveConfiguration,
        debugConfig,
        copyOverlayUrl,
        syncTimerState
    };
};
