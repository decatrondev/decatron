import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, XCircle, RotateCcw, Zap } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useLevelsConfig } from './levels-extension/hooks/useLevelsConfig';
import { useLevelsPersistence } from './levels-extension/hooks/useLevelsPersistence';
import { LEVELS_TABS } from './levels-extension/constants/defaults';
import type { LevelsTabType, LinkedGuild } from './levels-extension/types';
import GeneralTab from './levels-extension/components/tabs/GeneralTab';
import RolesTab from './levels-extension/components/tabs/RolesTab';
import ModerationTab from './levels-extension/components/tabs/ModerationTab';
import TestingTab from './levels-extension/components/tabs/TestingTab';
import AchievementsTab from './levels-extension/components/tabs/AchievementsTab';
import SeasonalTab from './levels-extension/components/tabs/SeasonalTab';
import LevelsTab from './levels-extension/components/tabs/LevelsTab';
import StoreTab from './levels-extension/components/tabs/StoreTab';
import PlaceholderTab from './levels-extension/components/tabs/PlaceholderTab';

export default function DiscordLevels() {
  const navigate = useNavigate();
  const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<LevelsTabType>('general');
  const [selectedGuild, setSelectedGuild] = useState<LinkedGuild | null>(null);

  const { config, updateConfig, loadConfig, toApiFormat, resetToDefaults } = useLevelsConfig();

  const {
    loading, saving, saveMessage, linkedGuilds, channels, stats, activeBoost,
    roles, boosts, users, usersTotal, achievements, storeItems, storePurchases, pendingPurchases, discordRoles,
    loadGuilds, loadGuildData, saveConfiguration, showMsg,
    createDefaultRoles, syncRolesToDiscord, syncUsersRoles, updateRole, deleteRole, deleteAllRoles, cleanupDiscordRoles, addRole,
    toggleAchievement, createAchievement, deleteAchievement, resetAllAchievements, resetUserAchievements,
    fullResetUser, resetSeasonal,
    createStoreItem, updateStoreItem, deleteStoreItem, loadStorePurchases, loadPendingPurchases, deliverPurchase, resetAllPurchases, resetUserPurchases,
    loadBoosts, createBoost, loadUsers, updateUserXp, testLevelUp,
  } = useLevelsPersistence({ onConfigLoaded: loadConfig });

  useEffect(() => {
    loadGuilds().then(guilds => {
      if (guilds.length > 0) {
        setSelectedGuild(guilds[0]);
        loadGuildData(guilds[0].guildId);
      }
    });
  }, []);

  const handleGuildChange = (guildId: string) => {
    const guild = linkedGuilds.find(g => g.guildId === guildId);
    if (guild) {
      setSelectedGuild(guild);
      loadGuildData(guild.guildId);
    }
  };

  const handleSave = async () => {
    if (!selectedGuild) return;
    await saveConfiguration(selectedGuild.guildId, toApiFormat());
  };

  const handleReset = () => {
    if (window.confirm('Restaurar toda la configuracion a los valores por defecto?')) {
      resetToDefaults();
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2563eb] mx-auto mb-3" />
          <p className="text-sm text-[#64748b]">Cargando configuracion...</p>
        </div>
      </div>
    );
  }

  if (!hasMinimumLevel('control_total')) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso denegado</h2>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Sidebar content based on active tab
  const renderSidebar = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Estadisticas</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
                <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">USUARIOS CON XP</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
              <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
                <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">NIVEL PROMEDIO</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.avgLevel}</p>
              </div>
              <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
                <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">TOTAL MENSAJES</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalMessages.toLocaleString()}</p>
              </div>
            </div>
            {activeBoost && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">BOOST ACTIVO</p>
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-300">{activeBoost.multiplier}x XP</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                  Por {activeBoost.activatedByUsername}
                </p>
              </div>
            )}
          </div>
        );

      case 'levels':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Config Actual</h3>
            <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Dificultad</span>
                <span className="font-bold text-gray-900 dark:text-white">{config.difficultyPreset}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">XP por mensaje</span>
                <span className="font-bold text-gray-900 dark:text-white">{config.xpMin}-{config.xpMax}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Cooldown</span>
                <span className="font-bold text-gray-900 dark:text-white">{config.cooldownSeconds}s</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748b]">Max XP/hora</span>
                <span className="font-bold text-gray-900 dark:text-white">{config.maxXpPerHour}</span>
              </div>
            </div>
            <p className="text-xs text-[#64748b]">Cambia la dificultad en tab General para ver como afecta la tabla de niveles</p>
          </div>
        );

      case 'roles':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Preview de Roles</h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">Asi se ven los roles en Discord</p>
            <div className="space-y-1.5">
              {roles.map(role => (
                <div key={role.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${role.roleColor}15` }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.roleColor }} />
                  <span className="text-sm font-medium" style={{ color: role.roleColor }}>
                    {role.roleName}
                  </span>
                  <span className="text-[10px] text-[#64748b] ml-auto">Lvl {role.levelRequired}</span>
                </div>
              ))}
              {roles.length === 0 && (
                <p className="text-sm text-[#64748b] text-center py-4">Sin roles</p>
              )}
            </div>
          </div>
        );

      case 'moderation':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Info</h3>
            {activeBoost ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{activeBoost.multiplier}x Boost Activo</p>
                <p className="text-xs text-amber-600/70 mt-1">Expira: {new Date(activeBoost.expiresAt).toLocaleString()}</p>
              </div>
            ) : (
              <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
                <p className="text-sm text-[#64748b]">Sin boost activo</p>
              </div>
            )}
            <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
              <p className="text-[10px] font-bold text-[#64748b] mb-1">USUARIOS REGISTRADOS</p>
              <p className="text-xl font-black text-gray-900 dark:text-white">{usersTotal}</p>
            </div>
          </div>
        );

      case 'testing':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Resultado</h3>
            <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
              <p className="text-sm text-[#64748b]">Envia un test para ver el resultado aqui</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Info</h3>
            <div className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
              <p className="text-sm text-[#64748b]">Selecciona un tab para ver mas informacion</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#111214] p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Sistema de XP & Niveles</h1>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Configura el sistema de gamificacion de tu servidor</p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {linkedGuilds.length > 1 && selectedGuild && (
                <select
                  value={selectedGuild.guildId}
                  onChange={(e) => handleGuildChange(e.target.value)}
                  className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                >
                  {linkedGuilds.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
                </select>
              )}
              <button onClick={handleReset} className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/80 transition-colors" title="Restaurar valores por defecto">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={handleSave} disabled={saving || !selectedGuild} className="px-6 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>

          {saveMessage && (
            <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              saveMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {saveMessage.text}
            </div>
          )}
        </div>

        {!selectedGuild ? (
          <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 text-center border border-[#e2e8f0] dark:border-[#374151]">
            <p className="text-[#64748b]">Vincula un servidor desde la pagina de Discord</p>
          </div>
        ) : (
          <>
            {/* Main grid: 2/3 editor + 1/3 sidebar */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Editor (2/3) */}
              <div className="xl:col-span-2 space-y-6">
                {/* Tab navigation */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                  <div className="flex flex-wrap gap-2">
                    {LEVELS_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg shadow-blue-500/20'
                            : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div>
                  {activeTab === 'general' && (
                    <GeneralTab config={config} onConfigChange={updateConfig} channels={channels} />
                  )}
                  {activeTab === 'roles' && (
                    <RolesTab
                      roles={roles}
                      guildId={selectedGuild.guildId}
                      onCreateDefaults={() => createDefaultRoles(selectedGuild.guildId)}
                      onSyncDiscord={() => syncRolesToDiscord(selectedGuild.guildId)}
                      onUpdateRole={(roleId, data) => updateRole(selectedGuild.guildId, roleId, data)}
                      onDeleteRole={(roleId) => deleteRole(selectedGuild.guildId, roleId)}
                      onDeleteAll={() => { if (window.confirm('Eliminar TODOS los roles? Tambien se eliminaran de Discord.')) deleteAllRoles(selectedGuild.guildId); }}
                      onCleanupDiscord={() => cleanupDiscordRoles(selectedGuild.guildId)}
                      onSyncUsersRoles={() => syncUsersRoles(selectedGuild.guildId)}
                      onAddRole={(data) => addRole(selectedGuild.guildId, data)}
                    />
                  )}
                  {activeTab === 'moderation' && (
                    <ModerationTab
                      guildId={selectedGuild.guildId}
                      users={users}
                      usersTotal={usersTotal}
                      boosts={boosts}
                      activeBoost={activeBoost}
                      onLoadUsers={(s, p) => loadUsers(selectedGuild.guildId, s, p)}
                      onUpdateUserXp={async (uid, action, amt) => { await updateUserXp(selectedGuild.guildId, uid, action, amt); await loadUsers(selectedGuild.guildId); }}
                      onResetUserAchievements={(uid) => resetUserAchievements(selectedGuild.guildId, uid)}
                      onFullResetUser={async (uid) => { await fullResetUser(selectedGuild.guildId, uid); await loadUsers(selectedGuild.guildId); }}
                      onLoadBoosts={() => loadBoosts(selectedGuild.guildId)}
                      onCreateBoost={(m, h) => createBoost(selectedGuild.guildId, m, h)}
                    />
                  )}
                  {activeTab === 'testing' && (
                    <TestingTab
                      guildId={selectedGuild.guildId}
                      config={config}
                      channels={channels}
                      onTestLevelUp={() => testLevelUp(selectedGuild.guildId)}
                    />
                  )}
                  {activeTab === 'levels' && (
                    <LevelsTab config={config} />
                  )}
                  {activeTab === 'achievements' && (
                    <AchievementsTab
                      guildId={selectedGuild.guildId}
                      achievements={achievements}
                      onToggle={(id, enabled) => toggleAchievement(selectedGuild.guildId, id, enabled)}
                      onCreate={(data) => createAchievement(selectedGuild.guildId, data)}
                      onDelete={(id) => deleteAchievement(selectedGuild.guildId, id)}
                      onResetAll={() => resetAllAchievements(selectedGuild.guildId)}
                    />
                  )}
                  {activeTab === 'store' && (
                    <StoreTab
                      guildId={selectedGuild.guildId}
                      storeItems={storeItems}
                      purchases={storePurchases}
                      channels={channels}
                      roles={discordRoles}
                      onCreateItem={(data) => createStoreItem(selectedGuild.guildId, data)}
                      onUpdateItem={(id, data) => updateStoreItem(selectedGuild.guildId, id, data)}
                      onDeleteItem={(id) => deleteStoreItem(selectedGuild.guildId, id)}
                      onLoadPurchases={() => loadStorePurchases(selectedGuild.guildId)}
                      onResetAllPurchases={() => { if (window.confirm('Resetear TODO el historial de compras?')) resetAllPurchases(selectedGuild.guildId); }}
                      onResetUserPurchases={(uid) => resetUserPurchases(selectedGuild.guildId, uid)}
                      pendingPurchases={pendingPurchases}
                      onLoadPending={() => loadPendingPurchases(selectedGuild.guildId)}
                      onDeliverPurchase={(pid) => deliverPurchase(selectedGuild.guildId, pid)}
                    />
                  )}
                  {activeTab === 'seasonal' && (
                    <SeasonalTab guildId={selectedGuild.guildId} />
                  )}
                  {activeTab === 'rankcard' && (
                    <PlaceholderTab icon="🎨" title="Rank Card" description="Personaliza la tarjeta de nivel con fondo custom, colores y elementos visuales" />
                  )}
                </div>
              </div>

              {/* Right: Sidebar (1/3) */}
              <div className="xl:col-span-1">
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg sticky top-6">
                  {renderSidebar()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
