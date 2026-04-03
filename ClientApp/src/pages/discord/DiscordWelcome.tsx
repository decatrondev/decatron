import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useWelcomeConfig } from './welcome-extension/hooks/useWelcomeConfig';
import { useWelcomePersistence } from './welcome-extension/hooks/useWelcomePersistence';
import { WELCOME_TABS } from './welcome-extension/constants/defaults';
import type { WelcomeTabType, LinkedGuild } from './welcome-extension/types';
import EmbedPreview from '../../components/discord/EmbedPreview';
import WelcomeTab from './welcome-extension/components/tabs/WelcomeTab';
import GoodbyeTab from './welcome-extension/components/tabs/GoodbyeTab';
import EmbedEditorTab from './welcome-extension/components/tabs/EmbedEditorTab';
import TestingTab from './welcome-extension/components/tabs/TestingTab';

export default function DiscordWelcome() {
  const navigate = useNavigate();
  const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<WelcomeTabType>('welcome');
  const [selectedGuild, setSelectedGuild] = useState<LinkedGuild | null>(null);
  const editorExportRef = useRef<(() => Promise<{ type: string; url: string } | null>) | null>(null);

  const {
    welcomeConfig, goodbyeConfig, editorLayout,
    welcomeGeneratedImage, goodbyeGeneratedImage,
    updateWelcomeConfig, updateGoodbyeConfig, updateEditorLayout,
    setWelcomeGeneratedImage, setGoodbyeGeneratedImage,
    toApiFormat, loadConfig, resetToDefaults,
  } = useWelcomeConfig();

  const {
    loading, saving, saveMessage,
    linkedGuilds, channels, roles,
    loadGuilds, loadGuildData, saveConfiguration,
  } = useWelcomePersistence({ onConfigLoaded: loadConfig });

  // Cargar servidores al montar
  useEffect(() => {
    loadGuilds().then(guilds => {
      if (guilds.length > 0) {
        setSelectedGuild(guilds[0]);
        loadGuildData(guilds[0].guildId);
      }
    });
  }, []);

  // Cambiar de servidor
  const handleGuildChange = (guildId: string) => {
    const guild = linkedGuilds.find(g => g.guildId === guildId);
    if (guild) {
      setSelectedGuild(guild);
      loadGuildData(guild.guildId);
    }
  };

  // Guardar (auto-exporta imagen si estamos en el editor)
  const handleSave = async () => {
    if (!selectedGuild) return;

    // Si hay editor activo, exportar imagen primero y obtener la URL nueva
    let exportResult: { type: string; url: string } | null = null;
    if (editorExportRef.current) {
      exportResult = await editorExportRef.current();
    }

    // Obtener datos para guardar
    const data = toApiFormat();

    // Inyectar la URL de la imagen exportada directamente (evita race condition con refs)
    if (exportResult) {
      if (exportResult.type === 'welcome') {
        data.welcomeGeneratedImage = exportResult.url;
      } else {
        data.goodbyeGeneratedImage = exportResult.url;
      }
    }

    await saveConfiguration(selectedGuild.guildId, data);
  };

  // Reset
  const handleReset = () => {
    if (window.confirm('Restaurar toda la configuracion a los valores por defecto?')) {
      resetToDefaults();
    }
  };

  // Preview config segun tab activo
  const previewConfig = activeTab === 'goodbye'
    ? { message: goodbyeConfig.message, embedColor: goodbyeConfig.embedColor, imageMode: goodbyeConfig.imageMode, imageUrl: goodbyeConfig.imageUrl, showAvatar: goodbyeConfig.showAvatar, mentionUser: false, type: 'goodbye' as const }
    : { message: welcomeConfig.message, embedColor: welcomeConfig.embedColor, imageMode: welcomeConfig.imageMode, imageUrl: welcomeConfig.imageUrl, showAvatar: welcomeConfig.showAvatar, mentionUser: welcomeConfig.mentionUser, type: 'welcome' as const };

  // Loading
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

  // Permisos
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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#111214] p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">👋</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Bienvenida y Despedida</h1>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Configura mensajes automaticos cuando alguien entra o sale del servidor</p>
            </div>

            {/* Guild selector + Actions */}
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
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/80 transition-colors"
                title="Restaurar valores por defecto"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedGuild}
                className="px-6 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>

          {/* Save message */}
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
            {/* Main grid: 2/3 editor + 1/3 preview */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Editor (2/3) */}
              <div className="xl:col-span-2 space-y-6">
                {/* Tab navigation */}
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                  <div className="flex flex-wrap gap-2">
                    {WELCOME_TABS.map(tab => (
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
                  {activeTab === 'welcome' && (
                    <WelcomeTab
                      config={welcomeConfig}
                      onConfigChange={updateWelcomeConfig}
                      channels={channels}
                      roles={roles}
                      guildName={selectedGuild.guildName}
                    />
                  )}
                  {activeTab === 'goodbye' && (
                    <GoodbyeTab
                      config={goodbyeConfig}
                      onConfigChange={updateGoodbyeConfig}
                      channels={channels}
                      guildName={selectedGuild.guildName}
                    />
                  )}
                  {activeTab === 'editor' && (
                    <EmbedEditorTab
                      welcomeConfig={welcomeConfig}
                      goodbyeConfig={goodbyeConfig}
                      onWelcomeChange={updateWelcomeConfig}
                      onGoodbyeChange={updateGoodbyeConfig}
                      editorLayout={editorLayout}
                      onEditorLayoutChange={updateEditorLayout}
                      channels={channels}
                      roles={roles}
                      guildName={selectedGuild.guildName}
                      guildId={selectedGuild.guildId}
                      onGeneratedImageChange={(type, url) => {
                        if (type === 'welcome') setWelcomeGeneratedImage(url);
                        else setGoodbyeGeneratedImage(url);
                      }}
                      exportRef={editorExportRef}
                    />
                  )}
                  {activeTab === 'testing' && (
                    <TestingTab
                      welcomeEnabled={welcomeConfig.enabled}
                      goodbyeEnabled={goodbyeConfig.enabled}
                      welcomeChannelId={welcomeConfig.channelId}
                      goodbyeChannelId={goodbyeConfig.channelId}
                      guildId={selectedGuild.guildId}
                      guildName={selectedGuild.guildName}
                    />
                  )}
                </div>
              </div>

              {/* Right: Preview (1/3) */}
              <div className="xl:col-span-1">
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg sticky top-6">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                    Preview — {WELCOME_TABS.find(t => t.id === activeTab)?.label || 'Bienvenida'}
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                    Asi se vera el mensaje en Discord
                  </p>

                  {activeTab === 'testing' ? (
                    <div className="bg-[#313338] rounded-xl p-6 text-center">
                      <span className="text-3xl mb-2 block">🧪</span>
                      <p className="text-sm text-[#949ba4]">Selecciona Bienvenida o Despedida para ver el preview</p>
                    </div>
                  ) : activeTab === 'editor' ? (
                    <div className="bg-[#313338] rounded-xl p-6 text-center">
                      <span className="text-3xl mb-2 block">🎨</span>
                      <p className="text-sm text-[#949ba4]">El editor tiene su propio canvas</p>
                    </div>
                  ) : (() => {
                    const genImage = activeTab === 'goodbye' ? goodbyeGeneratedImage : welcomeGeneratedImage;
                    if (genImage) {
                      return (
                        <div className="space-y-2">
                          {/* Simula como Discord muestra un attachment */}
                          <div className="bg-[#313338] rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[9px] font-bold">D</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#f2f3f5] font-medium text-xs">Decatron</span>
                                  <span className="bg-[#5865f2] text-white text-[8px] font-bold px-1 py-0.5 rounded">BOT</span>
                                </div>
                                {previewConfig.mentionUser && (
                                  <p className="text-[11px] text-[#dee0fc] mt-0.5">
                                    <span className="bg-[#414675]/60 rounded px-0.5">@{activeTab === 'goodbye' ? 'ExUser' : 'NuevoUser'}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <img src={genImage} alt="Preview" className="w-full rounded-lg" />
                          </div>
                          <p className="text-[10px] text-[#94a3b8] text-center">
                            Si cambias el mensaje o configuracion, ve al <strong>Editor Visual</strong> y guarda para actualizar la imagen.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <EmbedPreview
                        guildName={selectedGuild.guildName}
                        {...previewConfig}
                      />
                    );
                  })()}

                  {/* Quick stats */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="p-3 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">BIENVENIDA</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        welcomeConfig.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-[#64748b]'
                      }`}>
                        {welcomeConfig.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="p-3 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">DESPEDIDA</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        goodbyeConfig.enabled
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-[#64748b]'
                      }`}>
                        {goodbyeConfig.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  {/* Features summary */}
                  <div className="mt-3 space-y-1.5">
                    {welcomeConfig.enabled && welcomeConfig.dmEnabled && (
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        DM privado activado
                      </div>
                    )}
                    {welcomeConfig.enabled && welcomeConfig.autoRoleId && (
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Rol automatico configurado
                      </div>
                    )}
                    {welcomeConfig.enabled && welcomeConfig.mentionUser && (
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Mencion de usuario activada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
