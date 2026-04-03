import { useState, useCallback } from 'react';
import api from '../../../../services/api';
import type { LinkedGuild, DiscordChannel, LevelsStats, ActiveBoost, XpRole, XpBoost, XpUser } from '../types';

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

interface UseLevelsPersistenceOptions {
  onConfigLoaded?: (config: any) => void;
}

export const useLevelsPersistence = (options?: UseLevelsPersistenceOptions) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [stats, setStats] = useState<LevelsStats>({ totalUsers: 0, avgLevel: 0, totalMessages: 0 });
  const [activeBoost, setActiveBoost] = useState<ActiveBoost | null>(null);
  const [roles, setRoles] = useState<XpRole[]>([]);
  const [boosts, setBoosts] = useState<XpBoost[]>([]);
  const [users, setUsers] = useState<XpUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [storePurchases, setStorePurchases] = useState<any[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [discordRoles, setDiscordRoles] = useState<{ id: string; name: string }[]>([]);

  const showMsg = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 4000);
  }, []);

  const loadGuilds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/discord/linked');
      const guilds = res.data?.guilds || [];
      setLinkedGuilds(guilds);
      return guilds as LinkedGuild[];
    } catch { return []; }
    finally { setLoading(false); }
  }, []);

  const loadGuildData = useCallback(async (guildId: string) => {
    try {
      setLoading(true);
      const [configRes, channelsRes, rolesRes, achievementsRes, storeRes, discordRolesRes] = await Promise.all([
        api.get(`/discord/levels/${guildId}`),
        api.get(`/discord/channels/${guildId}`),
        api.get(`/discord/levels/${guildId}/roles`),
        api.get(`/discord/levels/${guildId}/achievements`),
        api.get(`/discord/levels/${guildId}/store`),
        api.get(`/discord/welcome/${guildId}/roles`),
      ]);

      setChannels(channelsRes.data?.channels || channelsRes.data || []);

      if (configRes.data?.success) {
        options?.onConfigLoaded?.(configRes.data.config);
        setStats(configRes.data.stats || { totalUsers: 0, avgLevel: 0, totalMessages: 0 });
        setActiveBoost(configRes.data.activeBoost || null);
      }

      if (rolesRes.data?.success) {
        setRoles(rolesRes.data.roles || []);
      }
      if (achievementsRes.data?.success) {
        setAchievements(achievementsRes.data.achievements || []);
      }
      if (storeRes.data?.success) {
        setStoreItems(storeRes.data.items || []);
      }
      if (discordRolesRes.data?.success) {
        setDiscordRoles(discordRolesRes.data.roles || []);
      }
    } catch (err) {
      console.error('Error loading guild data:', err);
    } finally {
      setLoading(false);
    }
  }, [options?.onConfigLoaded]);

  const saveConfiguration = useCallback(async (guildId: string, config: any) => {
    try {
      setSaving(true);
      await api.put(`/discord/levels/${guildId}`, config);
      showMsg('success', 'Configuracion guardada!');
      // Reload config to confirm persistence
      const configRes = await api.get(`/discord/levels/${guildId}`);
      if (configRes.data?.success) {
        options?.onConfigLoaded?.(configRes.data.config);
        setStats(configRes.data.stats || { totalUsers: 0, avgLevel: 0, totalMessages: 0 });
        setActiveBoost(configRes.data.activeBoost || null);
      }
    } catch (err) {
      showMsg('error', 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [showMsg, options?.onConfigLoaded]);

  // Roles
  const createDefaultRoles = useCallback(async (guildId: string) => {
    try {
      await api.post(`/discord/levels/${guildId}/roles/create-defaults`);
      // Also sync to Discord immediately
      await api.post(`/discord/levels/${guildId}/roles/sync-discord`);
      const res = await api.get(`/discord/levels/${guildId}/roles`);
      if (res.data?.success) setRoles(res.data.roles || []);
      showMsg('success', 'Roles creados y sincronizados con Discord!');
    } catch { showMsg('error', 'Error al crear roles'); }
  }, [showMsg]);

  const syncRolesToDiscord = useCallback(async (guildId: string) => {
    try {
      const syncRes = await api.post(`/discord/levels/${guildId}/roles/sync-discord`);
      console.log('[Levels] Sync response:', syncRes.data);
      const res = await api.get(`/discord/levels/${guildId}/roles`);
      if (res.data?.success) setRoles(res.data.roles || []);
      showMsg('success', 'Roles sincronizados con Discord!');
    } catch (err: any) {
      console.error('[Levels] Sync error:', err.response?.data || err);
      showMsg('error', err.response?.data?.error || 'Error al sincronizar roles');
    }
  }, [showMsg]);

  const updateRole = useCallback(async (guildId: string, roleId: number, data: any) => {
    try {
      await api.put(`/discord/levels/${guildId}/roles/${roleId}`, data);
      const res = await api.get(`/discord/levels/${guildId}/roles`);
      if (res.data?.success) setRoles(res.data.roles || []);
    } catch { showMsg('error', 'Error al actualizar rol'); }
  }, [showMsg]);

  const deleteRole = useCallback(async (guildId: string, roleId: number) => {
    try {
      await api.delete(`/discord/levels/${guildId}/roles/${roleId}`);
      setRoles(prev => prev.filter(r => r.id !== roleId));
    } catch { showMsg('error', 'Error al eliminar rol'); }
  }, [showMsg]);

  const deleteAllRoles = useCallback(async (guildId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/roles`);
      setRoles([]);
      showMsg('success', 'Todos los roles eliminados!');
    } catch { showMsg('error', 'Error al eliminar roles'); }
  }, [showMsg]);

  const cleanupDiscordRoles = useCallback(async (guildId: string) => {
    try {
      const res = await api.post(`/discord/levels/${guildId}/roles/cleanup-discord`);
      showMsg('success', `${res.data?.deleted || 0} roles huerfanos eliminados de Discord!`);
    } catch { showMsg('error', 'Error al limpiar roles de Discord'); }
  }, [showMsg]);

  // Achievements
  const toggleAchievement = useCallback(async (guildId: string, id: number, enabled: boolean) => {
    try {
      await api.put(`/discord/levels/${guildId}/achievements/${id}`, { enabled });
      setAchievements(prev => prev.map(a => a.id === id ? { ...a, enabled } : a));
    } catch { showMsg('error', 'Error al actualizar achievement'); }
  }, [showMsg]);

  const createAchievement = useCallback(async (guildId: string, data: any) => {
    try {
      await api.post(`/discord/levels/${guildId}/achievements`, data);
      const res = await api.get(`/discord/levels/${guildId}/achievements`);
      if (res.data?.success) setAchievements(res.data.achievements || []);
      showMsg('success', 'Achievement creado!');
    } catch { showMsg('error', 'Error al crear achievement'); }
  }, [showMsg]);

  const deleteAchievement = useCallback(async (guildId: string, id: number) => {
    try {
      await api.delete(`/discord/levels/${guildId}/achievements/${id}`);
      setAchievements(prev => prev.filter(a => a.id !== id));
    } catch { showMsg('error', 'Error al eliminar achievement'); }
  }, [showMsg]);

  const resetUserAchievements = useCallback(async (guildId: string, userId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/achievements/user/${userId}`);
      showMsg('success', 'Achievements del usuario reseteados!');
    } catch { showMsg('error', 'Error al resetear achievements'); }
  }, [showMsg]);

  const resetAllAchievements = useCallback(async (guildId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/achievements/all-users`);
      showMsg('success', 'Achievements de todos los usuarios reseteados!');
    } catch { showMsg('error', 'Error al resetear achievements'); }
  }, [showMsg]);

  const fullResetUser = useCallback(async (guildId: string, userId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/users/${userId}/full-reset`);
      showMsg('success', 'Reset completo: XP, achievements y seasonal!');
    } catch { showMsg('error', 'Error al hacer reset completo'); }
  }, [showMsg]);

  const resetSeasonal = useCallback(async (guildId: string, month?: string) => {
    try {
      const params = month ? `?month=${month}` : '';
      await api.delete(`/discord/levels/${guildId}/seasonal${params}`);
      showMsg('success', 'Leaderboard mensual reseteado!');
    } catch { showMsg('error', 'Error al resetear seasonal'); }
  }, [showMsg]);

  // Store
  const createStoreItem = useCallback(async (guildId: string, data: any) => {
    try {
      await api.post(`/discord/levels/${guildId}/store`, data);
      const res = await api.get(`/discord/levels/${guildId}/store`);
      if (res.data?.success) setStoreItems(res.data.items || []);
      showMsg('success', 'Item creado!');
    } catch { showMsg('error', 'Error al crear item'); }
  }, [showMsg]);

  const updateStoreItem = useCallback(async (guildId: string, itemId: number, data: any) => {
    try {
      await api.put(`/discord/levels/${guildId}/store/${itemId}`, data);
      const res = await api.get(`/discord/levels/${guildId}/store`);
      if (res.data?.success) setStoreItems(res.data.items || []);
    } catch { showMsg('error', 'Error al actualizar item'); }
  }, [showMsg]);

  const deleteStoreItem = useCallback(async (guildId: string, itemId: number) => {
    try {
      await api.delete(`/discord/levels/${guildId}/store/${itemId}`);
      setStoreItems(prev => prev.filter(i => i.id !== itemId));
    } catch { showMsg('error', 'Error al eliminar item'); }
  }, [showMsg]);

  const resetAllPurchases = useCallback(async (guildId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/store/purchases`);
      setStorePurchases([]);
      showMsg('success', 'Historial de compras reseteado!');
    } catch { showMsg('error', 'Error al resetear compras'); }
  }, [showMsg]);

  const resetUserPurchases = useCallback(async (guildId: string, userId: string) => {
    try {
      await api.delete(`/discord/levels/${guildId}/store/purchases/${userId}`);
      showMsg('success', 'Compras del usuario reseteadas!');
    } catch { showMsg('error', 'Error al resetear compras'); }
  }, [showMsg]);

  const loadPendingPurchases = useCallback(async (guildId: string) => {
    try {
      const res = await api.get(`/discord/levels/${guildId}/store/pending`);
      if (res.data?.success) setPendingPurchases(res.data.pending || []);
    } catch {}
  }, []);

  const deliverPurchase = useCallback(async (guildId: string, purchaseId: number) => {
    try {
      await api.put(`/discord/levels/${guildId}/store/purchases/${purchaseId}/deliver`);
      setPendingPurchases(prev => prev.filter(p => p.id !== purchaseId));
      showMsg('success', 'Canje entregado!');
    } catch { showMsg('error', 'Error al entregar'); }
  }, [showMsg]);

  const loadStorePurchases = useCallback(async (guildId: string) => {
    try {
      const res = await api.get(`/discord/levels/${guildId}/store/purchases`);
      if (res.data?.success) setStorePurchases(res.data.purchases || []);
    } catch {}
  }, []);

  const syncUsersRoles = useCallback(async (guildId: string) => {
    try {
      await api.post(`/discord/levels/${guildId}/roles/sync-users`);
      showMsg('success', 'Roles sincronizados para todos los usuarios!');
    } catch { showMsg('error', 'Error al sincronizar roles de usuarios'); }
  }, [showMsg]);

  const addRole = useCallback(async (guildId: string, data: any) => {
    try {
      await api.post(`/discord/levels/${guildId}/roles`, data);
      const res = await api.get(`/discord/levels/${guildId}/roles`);
      if (res.data?.success) setRoles(res.data.roles || []);
    } catch { showMsg('error', 'Error al agregar rol'); }
  }, [showMsg]);

  // Boosts
  const loadBoosts = useCallback(async (guildId: string) => {
    try {
      const res = await api.get(`/discord/levels/${guildId}/boosts`);
      if (res.data?.success) setBoosts(res.data.boosts || []);
    } catch {}
  }, []);

  const createBoost = useCallback(async (guildId: string, multiplier: number, hours: number) => {
    try {
      await api.post(`/discord/levels/${guildId}/boosts`, { multiplier, hours });
      showMsg('success', `Boost ${multiplier}x activado!`);
      // Reload
      const [configRes, boostsRes] = await Promise.all([
        api.get(`/discord/levels/${guildId}`),
        api.get(`/discord/levels/${guildId}/boosts`),
      ]);
      if (configRes.data?.activeBoost) setActiveBoost(configRes.data.activeBoost);
      if (boostsRes.data?.success) setBoosts(boostsRes.data.boosts || []);
    } catch { showMsg('error', 'Error al crear boost'); }
  }, [showMsg]);

  // Users
  const loadUsers = useCallback(async (guildId: string, search?: string, page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      const res = await api.get(`/discord/levels/${guildId}/users?${params}`);
      if (res.data?.success) {
        setUsers(res.data.users || []);
        setUsersTotal(res.data.total || 0);
      }
    } catch {}
  }, []);

  const updateUserXp = useCallback(async (guildId: string, userId: string, action: string, amount?: number) => {
    try {
      await api.put(`/discord/levels/${guildId}/users/${userId}`, { action, amount });
      showMsg('success', 'XP actualizado!');
    } catch { showMsg('error', 'Error al actualizar XP'); }
  }, [showMsg]);

  // Testing
  const testLevelUp = useCallback(async (guildId: string) => {
    try {
      const res = await api.post(`/discord/levels/${guildId}/test/levelup`);
      if (res.data?.success) showMsg('success', 'Test level-up enviado!');
      else showMsg('error', res.data?.error || 'Error');
    } catch (err: any) {
      showMsg('error', err.response?.data?.error || 'Error al enviar test');
    }
  }, [showMsg]);

  return {
    loading, saving, saveMessage, linkedGuilds, channels, stats, activeBoost,
    roles, boosts, users, usersTotal, achievements, storeItems, storePurchases, pendingPurchases, discordRoles,
    loadGuilds, loadGuildData, saveConfiguration, showMsg,
    createDefaultRoles, syncRolesToDiscord, syncUsersRoles, updateRole, deleteRole, deleteAllRoles, cleanupDiscordRoles, addRole,
    toggleAchievement, createAchievement, deleteAchievement, resetAllAchievements, resetUserAchievements,
    fullResetUser, resetSeasonal,
    createStoreItem, updateStoreItem, deleteStoreItem, loadStorePurchases, loadPendingPurchases, deliverPurchase, resetAllPurchases, resetUserPurchases,
    loadBoosts, createBoost, loadUsers, updateUserXp, testLevelUp,
  };
};
