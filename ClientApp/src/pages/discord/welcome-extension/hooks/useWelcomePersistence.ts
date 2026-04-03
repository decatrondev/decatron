import { useState, useCallback, useRef } from 'react';
import api from '../../../../services/api';
import type { WelcomeConfigApi, DiscordChannel, DiscordRole, LinkedGuild } from '../types';

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

interface UseWelcomePersistenceOptions {
  onConfigLoaded?: (config: WelcomeConfigApi) => void;
}

export const useWelcomePersistence = (options?: UseWelcomePersistenceOptions) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);

  // Ref para el callback — evita stale closures en loadGuildData
  const onConfigLoadedRef = useRef(options?.onConfigLoaded);
  onConfigLoadedRef.current = options?.onConfigLoaded;

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 4000);
  }, []);

  const loadGuilds = useCallback(async (): Promise<LinkedGuild[]> => {
    try {
      setLoading(true);
      const res = await api.get('/discord/linked');
      if (res.data.success) {
        setLinkedGuilds(res.data.guilds);
        return res.data.guilds;
      }
      return [];
    } catch (error) {
      console.error('Error loading guilds:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGuildData = useCallback(async (guildId: string) => {
    try {
      const [chRes, rolesRes, cfgRes] = await Promise.all([
        api.get(`/discord/channels/${guildId}`),
        api.get(`/discord/welcome/${guildId}/roles`),
        api.get(`/discord/welcome/${guildId}`),
      ]);

      if (chRes.data.success) setChannels(chRes.data.channels);
      if (rolesRes.data.success) setRoles(rolesRes.data.roles || []);

      if (cfgRes.data.config) {
        onConfigLoadedRef.current?.(cfgRes.data.config);
      }
    } catch (error) {
      console.error('Error loading guild data:', error);
      showMessage('error', 'Error al cargar datos del servidor');
    }
  }, [showMessage]);

  const saveConfiguration = useCallback(async (guildId: string, config: WelcomeConfigApi) => {
    try {
      setSaving(true);
      setSaveMessage(null);
      const res = await api.put(`/discord/welcome/${guildId}`, config);
      if (res.data.success) {
        showMessage('success', 'Configuracion guardada correctamente');
      } else {
        showMessage('error', res.data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showMessage('error', 'Error al guardar la configuracion');
    } finally {
      setSaving(false);
    }
  }, [showMessage]);

  const sendTest = useCallback(async (guildId: string, type: 'welcome' | 'goodbye') => {
    try {
      const res = await api.post(`/discord/welcome/${guildId}/test`, { type });
      console.log('[TEST] response:', res.data);
      if (res.data.success) {
        showMessage('success', `Prueba de ${type === 'welcome' ? 'bienvenida' : 'despedida'} enviada`);
        return true;
      } else {
        showMessage('error', res.data.error || 'Error al enviar prueba');
        return false;
      }
    } catch (error: any) {
      console.error('[TEST] error:', error.response?.data || error.message || error);
      showMessage('error', error.response?.data?.error || error.message || 'Error al enviar la prueba');
      return false;
    }
  }, [showMessage]);

  return {
    loading,
    saving,
    saveMessage,
    linkedGuilds,
    channels,
    roles,
    loadGuilds,
    loadGuildData,
    saveConfiguration,
    sendTest,
  };
};
