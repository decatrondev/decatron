import { useState } from 'react';
import api from '../../../../services/api';
import type { EventAlertsConfig } from '../types/index';

type SaveMessageType = { type: 'success' | 'error'; text: string } | null;

interface UseEventAlertsPersistenceOptions {
  onConfigLoaded?: (config: EventAlertsConfig) => void;
}

export const useEventAlertsPersistence = (options?: UseEventAlertsPersistenceOptions) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessageType>(null);

  /** `platform` "kick" carga la configuración de Kick (o la principal como copia si todavía no existe); sin él, la principal. */
  const loadConfiguration = async (platform?: 'twitch' | 'kick'): Promise<{ isCopy: boolean } | null> => {
    try {
      setLoading(true);
      const res = await api.get('/eventalerts/config', platform === 'kick' ? { params: { platform } } : undefined);
      if (res.data.success && res.data.config?.data) {
        options?.onConfigLoaded?.(res.data.config.data);
      }
      return { isCopy: !!res.data.isCopy };
    } catch (error) {
      console.error('[EventAlerts] Error loading configuration:', error);
      setSaveMessage({ type: 'error', text: 'Error al cargar la configuración' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** Devuelve true si se guardó. */
  const saveConfiguration = async (config: EventAlertsConfig, platform?: 'twitch' | 'kick'): Promise<boolean> => {
    try {
      setSaving(true);
      setSaveMessage(null);
      await api.post('/eventalerts/config', { config }, platform === 'kick' ? { params: { platform } } : undefined);
      setSaveMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      setTimeout(() => setSaveMessage(null), 3000);
      return true;
    } catch (error) {
      console.error('[EventAlerts] Error saving configuration:', error);
      setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    saveMessage,
    loadConfiguration,
    saveConfiguration,
  };
};
