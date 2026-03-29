// Hook for Goals persistence (save/load from server)

import { useState, useCallback } from 'react';
import type { GoalsConfig } from '../types';

interface SaveMessage {
    type: 'success' | 'error';
    text: string;
}

interface UseGoalsPersistenceOptions {
    onConfigLoaded?: (config: GoalsConfig) => void;
}

export const useGoalsPersistence = (options?: UseGoalsPersistenceOptions) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
    const [overlayUrl, setOverlayUrl] = useState<string>('');
    const [channelLogin, setChannelLogin] = useState<string>('');

    // Cargar información del frontend (channel, overlay URL)
    const loadFrontendInfo = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('/api/settings/frontend-info', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const channel = data.channelLogin || data.username || '';
                setChannelLogin(channel);

                // Construir URL del overlay
                const baseUrl = window.location.origin;
                const url = `${baseUrl}/overlay/goals?channel=${channel}`;
                setOverlayUrl(url);
            }
        } catch (error) {
            console.error('Error loading frontend info:', error);
        }
    }, []);

    // Cargar configuración desde el servidor
    const loadConfiguration = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No token found');
            }

            const response = await fetch('/api/goals/config', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📥 Goals config loaded:', data);

                if (data.config && options?.onConfigLoaded) {
                    options.onConfigLoaded(data.config);
                }
            } else if (response.status === 404) {
                // No config yet, use defaults
                console.log('📥 No goals config found, using defaults');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading goals config:', error);
            setSaveMessage({
                type: 'error',
                text: 'Error al cargar la configuración'
            });
            setTimeout(() => setSaveMessage(null), 3000);
        } finally {
            setLoading(false);
        }
    }, [options]);

    // Guardar configuración en el servidor
    const saveConfiguration = useCallback(async (config: GoalsConfig) => {
        setSaving(true);
        setSaveMessage(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No token found');
            }

            const response = await fetch('/api/goals/config', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                setSaveMessage({
                    type: 'success',
                    text: 'Configuración guardada exitosamente'
                });
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error saving goals config:', error);
            setSaveMessage({
                type: 'error',
                text: 'Error al guardar la configuración'
            });
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(null), 3000);
        }
    }, []);

    // Copiar URL del overlay al portapapeles
    const copyOverlayUrl = useCallback(async () => {
        if (!overlayUrl) return false;

        try {
            await navigator.clipboard.writeText(overlayUrl);
            setSaveMessage({
                type: 'success',
                text: 'URL copiada al portapapeles'
            });
            setTimeout(() => setSaveMessage(null), 2000);
            return true;
        } catch (error) {
            console.error('Error copying URL:', error);
            setSaveMessage({
                type: 'error',
                text: 'Error al copiar URL'
            });
            setTimeout(() => setSaveMessage(null), 2000);
            return false;
        }
    }, [overlayUrl]);

    // Debug: log current config
    const debugConfig = useCallback(async (currentConfig: GoalsConfig) => {
        console.log('=== DEBUG: GOALS CONFIG EN MEMORIA ===');
        console.log(JSON.stringify(currentConfig, null, 2));

        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('/api/goals/config', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('=== DEBUG: GOALS CONFIG EN BASE DE DATOS ===');
                console.log(JSON.stringify(data, null, 2));
            }
        } catch (error) {
            console.error('Debug error:', error);
        }
    }, []);

    return {
        // Estado
        loading,
        saving,
        saveMessage,
        overlayUrl,
        channelLogin,

        // Acciones
        loadFrontendInfo,
        loadConfiguration,
        saveConfiguration,
        copyOverlayUrl,
        debugConfig
    };
};

export type UseGoalsPersistenceReturn = ReturnType<typeof useGoalsPersistence>;
