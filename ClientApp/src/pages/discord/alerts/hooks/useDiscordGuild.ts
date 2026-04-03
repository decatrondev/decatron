import { useState, useCallback } from 'react';
import api from '../../../../services/api';
import type { LinkedGuild, DiscordChannel, BotStatus } from '../types';

interface SaveMessage { type: 'success' | 'error'; text: string; }

export const useDiscordGuild = () => {
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<LinkedGuild | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, guildsRes] = await Promise.all([
        api.get('/discord/status'),
        api.get('/discord/linked'),
      ]);
      if (statusRes.data.success) setBotStatus(statusRes.data);
      let guilds: LinkedGuild[] = [];
      if (guildsRes.data.success) {
        guilds = guildsRes.data.guilds;
        setLinkedGuilds(guilds);
      }
      return guilds;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const selectGuild = useCallback(async (guild: LinkedGuild) => {
    setSelectedGuild(guild);
    setLoadingChannels(true);
    try {
      const res = await api.get(`/discord/channels/${guild.guildId}`);
      if (res.data.success) setChannels(res.data.channels);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const startDiscordAuth = useCallback(async () => {
    try {
      const res = await api.get('/discord/auth');
      if (res.data.success) window.location.href = res.data.url;
    } catch (err) { console.error(err); }
  }, []);

  const unlinkGuild = useCallback(async (guildId: string) => {
    try {
      await api.delete(`/discord/unlink/${guildId}`);
      setLinkedGuilds(prev => prev.filter(g => g.guildId !== guildId));
      setSelectedGuild(prev => prev?.guildId === guildId ? null : prev);
    } catch (err) { console.error(err); }
  }, []);

  return {
    loading, botStatus, linkedGuilds, selectedGuild, channels, loadingChannels,
    saveMessage, showMsg,
    loadData, selectGuild, startDiscordAuth, unlinkGuild,
  };
};
