/**
 * useGiveawayState Hook
 * Maneja el estado activo del giveaway y sincronización con el servidor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import i18n from 'i18next';
import api from '../../../../services/api';
import type { GiveawayState, GiveawayParticipant, GiveawayWinner } from '../types';

export const useGiveawayState = () => {
    // ========================================================================
    // STATE
    // ========================================================================
    const [activeState, setActiveState] = useState<GiveawayState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const finalizedAtRef = useRef<number | null>(null);
    // Giveaway terminado (completado o cancelado) que el streamer ya cerró en el panel: el servidor lo sigue devolviendo 30 s
    const dismissedIdRef = useRef<string | null>(null);

    // ========================================================================
    // FETCH ACTIVE GIVEAWAY
    // ========================================================================
    const fetchActiveGiveaway = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/giveaway/active');

            const g = response.data.success ? response.data.giveaway : null;
            if (g && (g.status === 'completed' || g.status === 'cancelled') && dismissedIdRef.current === String(g.giveawayId)) {
                setActiveState(null);
            } else if (g) {
                setActiveState(g);
            } else {
                setActiveState(null);
            }
        } catch (err: any) {
            console.error('Error fetching active giveaway:', err);
            setError(err.response?.data?.message || i18n.t('features:giveaway.hook.loadActiveErr'));
            setActiveState(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // ========================================================================
    // START GIVEAWAY
    // ========================================================================
    const startGiveaway = useCallback(async (config: any) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/giveaway/start', config);

            if (response.data.success) {
                await fetchActiveGiveaway();
                return { success: true, message: i18n.t('features:giveaway.hook.started') };
            } else {
                throw new Error(response.data.message || i18n.t('features:giveaway.hook.startErr'));
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || i18n.t('features:giveaway.hook.startErr');
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    }, [fetchActiveGiveaway]);

    // ========================================================================
    // END GIVEAWAY
    // ========================================================================
    const endGiveaway = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/giveaway/end');

            if (response.data.success) {
                await fetchActiveGiveaway();
                return { success: true, message: i18n.t('features:giveaway.hook.ended') };
            } else {
                throw new Error(response.data.message || i18n.t('features:giveaway.hook.endErr'));
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || i18n.t('features:giveaway.hook.endErr');
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    }, [fetchActiveGiveaway]);

    // ========================================================================
    // CANCEL GIVEAWAY
    // ========================================================================
    const cancelGiveaway = useCallback(async (reason?: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/giveaway/cancel', { reason });

            if (response.data.success) {
                await fetchActiveGiveaway();
                return { success: true, message: i18n.t('features:giveaway.hook.cancelled') };
            } else {
                throw new Error(response.data.message || i18n.t('features:giveaway.hook.cancelErr'));
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || i18n.t('features:giveaway.hook.cancelErr');
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    }, [fetchActiveGiveaway]);

    // ========================================================================
    // REROLL WINNER
    // ========================================================================
    const rerollWinner = useCallback(async (position?: number) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/giveaway/reroll', { position });

            if (response.data.success) {
                await fetchActiveGiveaway();
                return { success: true, message: i18n.t('features:giveaway.hook.rerolled'), winner: response.data.winner };
            } else {
                throw new Error(response.data.message || i18n.t('features:giveaway.hook.rerollErr'));
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || i18n.t('features:giveaway.hook.rerollErr');
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    }, [fetchActiveGiveaway]);

    // ========================================================================
    // DISQUALIFY WINNER
    // ========================================================================
    const disqualifyWinner = useCallback(async (username: string, reason?: string) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post('/giveaway/disqualify', { username, reason });

            if (response.data.success) {
                await fetchActiveGiveaway();
                return { success: true, message: i18n.t('features:giveaway.hook.disq') };
            } else {
                throw new Error(response.data.message || i18n.t('features:giveaway.hook.disqErr'));
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || i18n.t('features:giveaway.hook.disqErr');
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    }, [fetchActiveGiveaway]);

    // ========================================================================
    // GET PARTICIPANTS
    // ========================================================================
    const getParticipants = useCallback(async (): Promise<GiveawayParticipant[]> => {
        try {
            const response = await api.get('/giveaway/participants');

            if (response.data.success) {
                return response.data.participants || [];
            }
            return [];
        } catch (err: any) {
            console.error('Error fetching participants:', err);
            return [];
        }
    }, []);

    // ========================================================================
    // AUTO-REFRESH (Poll every 2 seconds when active)
    // ========================================================================
    useEffect(() => {
        // Initial fetch
        fetchActiveGiveaway();

        // Set up polling
        const interval = setInterval(() => {
            fetchActiveGiveaway();
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [fetchActiveGiveaway]);

    // Cerrar el giveaway terminado para poder iniciar otro enseguida (no espera los 30 s de gracia)
    const dismissFinished = useCallback(() => {
        setActiveState((prev) => {
            if (prev && (prev.status === 'completed' || prev.status === 'cancelled')) {
                dismissedIdRef.current = String(prev.giveawayId);
                return null;
            }
            return prev;
        });
    }, []);

    // Uno cancelado no tiene nada que mostrar: se cierra solo para dejar crear otro de inmediato
    useEffect(() => {
        if (activeState?.status === 'cancelled') dismissFinished();
    }, [activeState?.status, dismissFinished]);

    // ========================================================================
    // STOP POLLING AFTER 30 SECONDS IF FINALIZED
    // ========================================================================
    useEffect(() => {
        if (activeState?.status === 'completed' || activeState?.status === 'cancelled') {
            // Iniciar contador si no existe
            if (!finalizedAtRef.current) {
                finalizedAtRef.current = Date.now();
            }

            // Verificar cada segundo si ya pasaron 30 segundos
            const checkTimeout = setInterval(() => {
                if (finalizedAtRef.current) {
                    const secondsSinceEnd = (Date.now() - finalizedAtRef.current) / 1000;
                    if (secondsSinceEnd > 30) {
                        // Limpiar el estado después de 30 segundos
                        setActiveState(null);
                        finalizedAtRef.current = null;
                        clearInterval(checkTimeout);
                    }
                }
            }, 1000);

            return () => clearInterval(checkTimeout);
        } else {
            // Si el estado cambió a activo, resetear el contador
            finalizedAtRef.current = null;
        }
    }, [activeState?.status]);

    // ========================================================================
    // COMPUTED VALUES
    // ========================================================================
    // Un giveaway completado se sigue mostrando (resultado), pero ya no impide iniciar otro: ver `isRunning`
    const isActive = activeState?.status === 'active'
        || activeState?.status === 'selecting_winners'
        || activeState?.status === 'completed'
        || activeState?.status === 'cancelled';
    const isRunning = activeState?.status === 'active' || activeState?.status === 'selecting_winners';
    const participantCount = activeState?.totalParticipants || 0;
    const hasWinners = (activeState?.selectedWinners?.length || 0) > 0;

    // ========================================================================
    // RETURN
    // ========================================================================
    return {
        // State
        activeState,
        loading,
        error,

        // Computed
        isActive,
        isRunning,
        dismissFinished,
        participantCount,
        hasWinners,

        // Actions
        fetchActiveGiveaway,
        refreshState: fetchActiveGiveaway, // Alias for clarity
        startGiveaway,
        endGiveaway,
        cancelGiveaway,
        rerollWinner,
        disqualifyWinner,
        getParticipants,

        // Clear error
        clearError: () => setError(null),
    };
};
