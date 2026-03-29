/**
 * useGiveawayState Hook
 * Maneja el estado activo del giveaway y sincronización con el servidor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

    // ========================================================================
    // FETCH ACTIVE GIVEAWAY
    // ========================================================================
    const fetchActiveGiveaway = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/giveaway/active');

            if (response.data.success && response.data.giveaway) {
                setActiveState(response.data.giveaway);
            } else {
                setActiveState(null);
            }
        } catch (err: any) {
            console.error('Error fetching active giveaway:', err);
            setError(err.response?.data?.message || 'Error al cargar giveaway activo');
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
                return { success: true, message: 'Giveaway iniciado correctamente' };
            } else {
                throw new Error(response.data.message || 'Error al iniciar giveaway');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al iniciar giveaway';
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
                return { success: true, message: 'Giveaway finalizado correctamente' };
            } else {
                throw new Error(response.data.message || 'Error al finalizar giveaway');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al finalizar giveaway';
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
                return { success: true, message: 'Giveaway cancelado correctamente' };
            } else {
                throw new Error(response.data.message || 'Error al cancelar giveaway');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al cancelar giveaway';
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
                return { success: true, message: 'Nuevo ganador seleccionado', winner: response.data.winner };
            } else {
                throw new Error(response.data.message || 'Error al re-sortear ganador');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al re-sortear ganador';
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
                return { success: true, message: 'Ganador descalificado' };
            } else {
                throw new Error(response.data.message || 'Error al descalificar ganador');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al descalificar ganador';
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
    const isActive = activeState?.status === 'active'
        || activeState?.status === 'selecting_winners'
        || activeState?.status === 'completed'
        || activeState?.status === 'cancelled';
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
