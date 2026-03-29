/**
 * Timer Extension - useTimerPreview Hook
 *
 * Hook personalizado para manejar el estado y lógica del preview del timer.
 * Ahora sincroniza con el estado real del timer en el backend.
 */

import { useState, useEffect, useRef } from 'react';
import api from '../../../../services/api';
import { DEFAULT_PREVIEW_TIME, DEFAULT_PREVIEW_RUNNING } from '../constants';

export const useTimerPreview = (defaultDuration: number) => {
    const [previewTimeRemaining, setPreviewTimeRemaining] = useState(DEFAULT_PREVIEW_TIME);
    const [previewTotalDuration, setPreviewTotalDuration] = useState(DEFAULT_PREVIEW_TIME);
    const [previewIsRunning, setPreviewIsRunning] = useState(DEFAULT_PREVIEW_RUNNING);
    const [startTime, setStartTime] = useState<number | null>(null);

    const previewRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Sincronizar preview timer con cambios de defaultDuration
    useEffect(() => {
        // Sincroniza el preview con la configuración real del timer
        setPreviewTimeRemaining(defaultDuration);
        setPreviewTotalDuration(defaultDuration);
    }, [defaultDuration]);

    // Sincronizar con el estado real del timer desde el backend
    useEffect(() => {
        const fetchTimerState = async () => {
            try {
                const res = await api.get('/timer/state/current');
                if (res.data.success && res.data.state) {
                    const state = res.data.state;
                    const isRunning = state.status === 'running';
                    // Tratar auto_paused y stream_paused igual que paused para la visualización
                    const isPaused = state.status === 'paused' || state.status === 'auto_paused' || state.status === 'stream_paused';

                    // Solo sincronizar si hay un timer activo (running, paused, auto_paused o stream_paused)
                    if (isRunning || isPaused) {
                        setPreviewIsRunning(isRunning);
                        setPreviewTotalDuration(state.totalTime || defaultDuration);

                        if (isRunning && state.startedAt) {
                            // Calcular tiempo transcurrido
                            const startDate = new Date(state.startedAt);
                            const now = new Date();
                            const elapsedMs = now.getTime() - startDate.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000) - (state.elapsedPausedTime || 0);
                            const remaining = Math.max(0, state.totalTime - elapsedSeconds);

                            setPreviewTimeRemaining(remaining);
                            setStartTime(Date.now() - (elapsedSeconds * 1000));
                        } else {
                            setPreviewTimeRemaining(state.currentTime || defaultDuration);
                            setStartTime(null);
                        }
                    } else {
                        // Si no hay timer activo, usar valores de configuración
                        setPreviewIsRunning(false);
                        setPreviewTotalDuration(defaultDuration);
                        setPreviewTimeRemaining(defaultDuration);
                        setStartTime(null);
                    }
                } else {
                    // Si no hay estado, usar valores de configuración
                    setPreviewIsRunning(false);
                    setPreviewTotalDuration(defaultDuration);
                    setPreviewTimeRemaining(defaultDuration);
                    setStartTime(null);
                }
            } catch (error) {
                // Si hay error de red, NO detener el timer visualmente.
                // Permitir que el contador local siga funcionando para evitar "saltos" o detenciones falsas.
                console.warn('[PREVIEW] Error de conexión con estado del timer. Manteniendo estado local.', error);
                // setPreviewIsRunning(false); // <--- ELIMINADO para resiliencia
            }
        };

        fetchTimerState();
        const interval = setInterval(fetchTimerState, 2000); // Sincronizar cada 2 segundos

        return () => clearInterval(interval);
    }, [defaultDuration]);

    // Countdown del preview timer (solo para timer local cuando no hay backend activo)
    useEffect(() => {
        if (!previewIsRunning || !startTime || previewTimeRemaining <= 0) return;

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, previewTotalDuration - elapsed);
            setPreviewTimeRemaining(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [previewIsRunning, startTime, previewTotalDuration]);

    const playPreview = async () => {
        try {
            // Primero verificar el estado actual
            const stateRes = await api.get('/timer/state/current');

            const status = stateRes.data?.state?.status;
            if (status === 'paused' || status === 'auto_paused' || status === 'stream_paused') {
                // Si está pausado (manual o auto), resumir
                await api.post('/timer/control', { action: 'resume' });
            } else {
                // Si no hay timer o está stopped, iniciar nuevo
                await api.post('/timer/control', {
                    action: 'start',
                    duration: previewTotalDuration
                });
            }

            setPreviewIsRunning(true);
            setStartTime(Date.now());
        } catch (error) {
            console.error('Error al iniciar timer:', error);
        }
    };

    const pausePreview = async () => {
        try {
            await api.post('/timer/control', { action: 'pause' });
            setPreviewIsRunning(false);
            setStartTime(null);
        } catch (error) {
            console.error('Error al pausar timer:', error);
        }
    };

    const stopPreview = async () => {
        try {
            await api.post('/timer/control', { action: 'stop' });
            setPreviewIsRunning(false);
            setPreviewTimeRemaining(previewTotalDuration);
            setStartTime(null);
        } catch (error) {
            console.error('Error al detener timer:', error);
        }
    };

    // Legacy - mantener para compatibilidad
    const togglePreview = async () => {
        if (previewIsRunning) {
            await pausePreview();
        } else {
            await playPreview();
        }
    };

    const resetPreview = async () => {
        try {
            await api.post('/timer/control', { action: 'reset' });
            setPreviewTimeRemaining(previewTotalDuration);
            setPreviewIsRunning(false);
            setStartTime(null);
        } catch (error) {
            console.error('Error al resetear timer:', error);
        }
    };

    const setPreviewDuration = (duration: number) => {
        setPreviewTotalDuration(duration);
        setPreviewTimeRemaining(duration);
    };

    return {
        // Estado
        previewTimeRemaining,
        previewTotalDuration,
        previewIsRunning,
        previewRef,
        canvasRef,

        // Setters
        setPreviewTimeRemaining,
        setPreviewTotalDuration,
        setPreviewIsRunning,

        // Acciones
        playPreview,
        pausePreview,
        stopPreview,
        togglePreview,
        resetPreview,
        setPreviewDuration
    };
};
