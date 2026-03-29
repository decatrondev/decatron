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

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const res = await api.get('/eventalerts/config');
      if (res.data.success && res.data.config?.data) {
        options?.onConfigLoaded?.(res.data.config.data);
      }
    } catch (error) {
      console.error('[EventAlerts] Error loading configuration:', error);
      setSaveMessage({ type: 'error', text: 'Error al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async (config: EventAlertsConfig) => {
    try {
      setSaving(true);
      setSaveMessage(null);
      await api.post('/eventalerts/config', { config });
      setSaveMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('[EventAlerts] Error saving configuration:', error);
      setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' });
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
