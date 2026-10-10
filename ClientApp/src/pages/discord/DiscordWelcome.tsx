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
          <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text mx-auto mb-3" />
          <p className="text-sm text-ds-soft">Cargando configuracion...</p>
        </div>
      </div>
    );
  }

  // Permisos
  if (!hasMinimumLevel('control_total')) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
          <h2 className="text-2xl font-black text-ds-danger mb-2">Acceso denegado</h2>
          <button onClick={() => navigate('/dashboard')} className="ds-btn ds-btn--primary ds-btn--lg">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-scale min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="bg-ds-surface rounded-lg p-6 border border-ds-border mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-ds-ok/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">👋</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-ds-text">Bienvenida y Despedida</h1>
              <p className="text-sm text-ds-soft">Configura mensajes automaticos cuando alguien entra o sale del servidor</p>
            </div>

            {/* Guild selector + Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {linkedGuilds.length > 1 && selectedGuild && (
                <select
                  value={selectedGuild.guildId}
                  onChange={(e) => handleGuildChange(e.target.value)}
                  className="ds-input"
                >
                  {linkedGuilds.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
                </select>
              )}
              <button
                onClick={handleReset}
                className="ds-btn ds-btn--secondary"
                title="Restaurar valores por defecto"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedGuild}
                className="ds-btn ds-btn--primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
              saveMessage.type === 'success'
                ? 'bg-ds-ok/10 text-ds-ok '
                : 'bg-ds-danger/10 text-ds-danger '
            }`}>
              {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {saveMessage.text}
            </div>
          )}
        </div>

        {!selectedGuild ? (
          <div className="bg-ds-surface rounded-lg p-12 text-center border border-ds-border">
            <p className="text-ds-soft">Vincula un servidor desde la pagina de Discord</p>
          </div>
        ) : (
          <>
            {/* Main grid: 2/3 editor + 1/3 preview */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left: Editor (2/3) */}
              <div className="xl:col-span-2 space-y-6">
                {/* Tab navigation */}
                <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                  <div className="flex flex-wrap gap-2">
                    {WELCOME_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={activeTab === tab.id ? 'ds-btn ds-btn--primary whitespace-nowrap' : 'ds-btn ds-btn--secondary whitespace-nowrap'}
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
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6 sticky top-6">
                  <h3 className="text-lg font-black text-ds-text mb-1">
                    Preview — {WELCOME_TABS.find(t => t.id === activeTab)?.label || 'Bienvenida'}
                  </h3>
                  <p className="text-xs text-ds-soft mb-4">
                    Asi se vera el mensaje en Discord
                  </p>

                  {activeTab === 'testing' ? (
                    <div className="dark bg-[#313338] rounded-lg p-6 text-center">
                      <span className="text-3xl mb-2 block">🧪</span>
                      <p className="text-sm text-[#949ba4]">Selecciona Bienvenida o Despedida para ver el preview</p>
                    </div>
                  ) : activeTab === 'editor' ? (
                    <div className="dark bg-[#313338] rounded-lg p-6 text-center">
                      <span className="text-3xl mb-2 block">🎨</span>
                      <p className="text-sm text-[#949ba4]">El editor tiene su propio canvas</p>
                    </div>
                  ) : (() => {
                    const genImage = activeTab === 'goodbye' ? goodbyeGeneratedImage : welcomeGeneratedImage;
                    if (genImage) {
                      return (
                        <div className="space-y-2">
                          {/* Simula como Discord muestra un attachment */}
                          <div className="dark bg-[#313338] rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-ds-accent flex items-center justify-center flex-shrink-0">
                                <span className="text-ds-text text-[9px] font-bold">D</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#f2f3f5] font-medium text-xs">Decatron</span>
                                  <span className="bg-[#5865f2] text-ds-text text-[8px] font-bold px-1 py-0.5 rounded">BOT</span>
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
                          <p className="text-[10px] text-ds-soft text-center">
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
                    <div className="p-3 bg-ds-bg rounded-lg text-center">
                      <p className="text-[10px] font-bold text-ds-soft mb-1">BIENVENIDA</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        welcomeConfig.enabled
                          ? 'bg-ds-ok/10 text-ds-ok '
                          : 'bg-ds-bg text-ds-soft'
                      }`}>
                        {welcomeConfig.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="p-3 bg-ds-bg rounded-lg text-center">
                      <p className="text-[10px] font-bold text-ds-soft mb-1">DESPEDIDA</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        goodbyeConfig.enabled
                          ? 'bg-ds-ok/10 text-ds-ok '
                          : 'bg-ds-bg text-ds-soft'
                      }`}>
                        {goodbyeConfig.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  {/* Features summary */}
                  <div className="mt-3 space-y-1.5">
                    {welcomeConfig.enabled && welcomeConfig.dmEnabled && (
                      <div className="flex items-center gap-2 text-xs text-ds-soft">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-accent" />
                        DM privado activado
                      </div>
                    )}
                    {welcomeConfig.enabled && welcomeConfig.autoRoleId && (
                      <div className="flex items-center gap-2 text-xs text-ds-soft">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-accent" />
                        Rol automatico configurado
                      </div>
                    )}
                    {welcomeConfig.enabled && welcomeConfig.mentionUser && (
                      <div className="flex items-center gap-2 text-xs text-ds-soft">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-accent" />
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
