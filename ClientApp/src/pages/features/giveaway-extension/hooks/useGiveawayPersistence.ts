/**
 * useGiveawayPersistence Hook
 * Maneja guardar/cargar configuraciones de giveaway
 */

import { useState, useCallback } from 'react';
import api from '../../../../services/api';
import type { GiveawayConfig, GiveawayHistoryEntry, GiveawayStatistics } from '../types';

interface UseGiveawayPersistenceProps {
    onConfigLoaded?: (config: GiveawayConfig) => void;
}

export const useGiveawayPersistence = (props?: UseGiveawayPersistenceProps) => {
    const { onConfigLoaded } = props || {};

    // ========================================================================
    // STATE
    // ========================================================================
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ========================================================================
    // LOAD CONFIGURATION
    // ========================================================================
    const loadConfiguration = useCallback(async () => {
        try {
            setLoading(true);
            setSaveMessage(null);

            const response = await api.get('/giveaway/config');

            if (response.data.success && response.data.config) {
                if (onConfigLoaded) {
                    onConfigLoaded(response.data.config);
                }
                return { success: true, config: response.data.config };
            } else {
                console.warn('No config found, using defaults');
                return { success: false, config: null };
            }
        } catch (err: any) {
            console.error('Error loading giveaway config:', err);
            setSaveMessage({
                type: 'error',
                text: err.response?.data?.message || 'Error al cargar configuración',
            });
            return { success: false, config: null };
        } finally {
            setLoading(false);
        }
    }, [onConfigLoaded]);

    // ========================================================================
    // SAVE CONFIGURATION
    // ========================================================================
    const saveConfiguration = useCallback(async (config: GiveawayConfig) => {
        try {
            setSaving(true);
            setSaveMessage(null);

            const response = await api.post('/giveaway/config', config);

            if (response.data.success) {
                setSaveMessage({
                    type: 'success',
                    text: '✅ Configuración guardada correctamente',
                });

                // Auto-hide success message after 3 seconds
                setTimeout(() => {
                    setSaveMessage(null);
                }, 3000);

                return { success: true };
            } else {
                throw new Error(response.data.message || 'Error al guardar configuración');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al guardar configuración';
            setSaveMessage({
                type: 'error',
                text: `❌ ${errorMsg}`,
            });
            return { success: false, message: errorMsg };
        } finally {
            setSaving(false);
        }
    }, []);

    // ========================================================================
    // LOAD HISTORY
    // ========================================================================
    const loadHistory = useCallback(async (limit: number = 50): Promise<GiveawayHistoryEntry[]> => {
        try {
            const response = await api.get('/giveaway/history', {
                params: { limit },
            });

            if (response.data.success) {
                return response.data.history || [];
            }
            return [];
        } catch (err: any) {
            console.error('Error loading giveaway history:', err);
            return [];
        }
    }, []);

    // ========================================================================
    // LOAD STATISTICS
    // ========================================================================
    const loadStatistics = useCallback(async (): Promise<GiveawayStatistics | null> => {
        try {
            const response = await api.get('/giveaway/statistics');

            if (response.data.success) {
                return response.data.statistics;
            }
            return null;
        } catch (err: any) {
            console.error('Error loading giveaway statistics:', err);
            return null;
        }
    }, []);

    // ========================================================================
    // DELETE HISTORY ENTRY
    // ========================================================================
    const deleteHistoryEntry = useCallback(async (id: string) => {
        try {
            const response = await api.delete(`/giveaway/history/${id}`);

            if (response.data.success) {
                return { success: true };
            } else {
                throw new Error(response.data.message || 'Error al eliminar entrada');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error al eliminar entrada';
            return { success: false, message: errorMsg };
        }
    }, []);

    // ========================================================================
    // EXPORT HISTORY
    // ========================================================================
    const exportHistory = useCallback(async (format: 'csv' | 'json') => {
        try {
            const response = await api.get('/giveaway/export', {
                params: { format },
                responseType: 'blob',
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `giveaway_history.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            return { success: true };
        } catch (err: any) {
            console.error('Error exporting history:', err);
            return { success: false, message: 'Error al exportar historial' };
        }
    }, []);

    // ========================================================================
    // RETURN
    // ========================================================================
    return {
        // State
        loading,
        saving,
        saveMessage,

        // Actions
        loadConfiguration,
        saveConfiguration,
        loadHistory,
        loadStatistics,
        deleteHistoryEntry,
        exportHistory,

        // Utilities
        setSaveMessage,
    };
};
