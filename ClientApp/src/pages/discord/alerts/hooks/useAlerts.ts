import { useState, useCallback, useRef } from 'react';
import api from '../../../../services/api';
import type { LiveAlert, ChannelStatus, DiscordChannel, SearchResult } from '../types';

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [channelStatuses, setChannelStatuses] = useState<ChannelStatus[]>([]);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const loadAlerts = useCallback(async (guildId: string) => {
    setLoadingAlerts(true);
    try {
      const res = await api.get(`/discord/alerts/${guildId}`);
      if (res.data.success) setAlerts(res.data.alerts);
    } catch (err) { console.error(err); }
    finally { setLoadingAlerts(false); }
  }, []);

  const loadStatuses = useCallback(async (guildId: string) => {
    try {
      const res = await api.get(`/discord/alerts/${guildId}/status`);
      if (res.data.success) setChannelStatuses(res.data.statuses);
    } catch (err) { console.error(err); }
  }, []);

  const startAutoRefresh = useCallback((guildId: string) => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(() => loadStatuses(guildId), 120000);
  }, [loadStatuses]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval.current) { clearInterval(refreshInterval.current); refreshInterval.current = null; }
  }, []);

  const searchChannel = useCallback((query: string) => {
    setSearchQuery(query); setSearchResult(null); setSearchError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (query.length < 2) return;
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/discord/alerts/search/${query.toLowerCase().trim()}`);
        if (res.data.success) setSearchResult(res.data.channel);
        else setSearchError(res.data.error || 'Canal no encontrado');
      } catch { setSearchError('Error al buscar'); }
      finally { setSearching(false); }
    }, 600);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchQuery(''); setSearchResult(null); setSearchError('');
  }, []);

  const addAlert = useCallback(async (guildId: string, payload: any): Promise<boolean> => {
    try {
      const res = await api.post(`/discord/alerts/${guildId}`, payload);
      if (res.data.success) {
        setAlerts(prev => [...prev, res.data.alert]);
        return true;
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Error al agregar');
    }
    return false;
  }, []);

  const toggleAlert = useCallback(async (alert: LiveAlert) => {
    try {
      await api.put(`/discord/alerts/${alert.id}`, { enabled: !alert.enabled });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a));
    } catch (err) { console.error(err); }
  }, []);

  const updateAlertChannel = useCallback(async (alert: LiveAlert, discordChannelId: string, channels: DiscordChannel[]) => {
    const ch = channels.find(c => c.id === discordChannelId);
    try {
      await api.put(`/discord/alerts/${alert.id}`, { discordChannelId, discordChannelName: ch?.name || '' });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, discordChannelId, discordChannelName: ch?.name || '' } : a));
    } catch (err) { console.error(err); }
  }, []);

  const updateAlertMention = useCallback(async (alert: LiveAlert) => {
    try {
      await api.put(`/discord/alerts/${alert.id}`, { mentionEveryone: !alert.mentionEveryone });
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, mentionEveryone: !a.mentionEveryone } : a));
    } catch (err) { console.error(err); }
  }, []);

  const deleteAlert = useCallback(async (alertId: number) => {
    try {
      await api.delete(`/discord/alerts/${alertId}`);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      return true;
    } catch (err) { console.error(err); return false; }
  }, []);

  const saveEditAlert = useCallback(async (alertId: number, payload: any, channels: DiscordChannel[]) => {
    const ch = channels.find(c => c.id === payload.discordChannelId);
    try {
      await api.put(`/discord/alerts/${alertId}`, payload);
      setAlerts(prev => prev.map(a => a.id === alertId ? {
        ...a, ...payload,
        discordChannelName: ch?.name || a.discordChannelName,
        customMessage: payload.customMessage || null,
        staticThumbnailUrl: payload.thumbnailMode === 'static' ? payload.staticThumbnailUrl : null,
        footerText: payload.footerText || null,
      } : a));
      return true;
    } catch { return false; }
  }, []);

  const getStatus = useCallback((channelName: string) => {
    return channelStatuses.find(s => s.channelName === channelName);
  }, [channelStatuses]);

  return {
    alerts, loadingAlerts, channelStatuses,
    searchQuery, searchResult, searching, searchError,
    loadAlerts, loadStatuses, startAutoRefresh, stopAutoRefresh,
    searchChannel, resetSearch,
    addAlert, toggleAlert, updateAlertChannel, updateAlertMention, deleteAlert, saveEditAlert,
    getStatus,
  };
};
