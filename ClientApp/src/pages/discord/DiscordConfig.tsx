import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MessageSquare, CheckCircle, XCircle, Unlink, Bell, Loader2, Wifi, WifiOff,
  Settings, Plus, Lock, Users, Sparkles, ArrowRight
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useDiscordGuild } from './alerts/hooks/useDiscordGuild';
import api from '../../services/api';

export default function DiscordConfig() {
  const navigate = useNavigate();
  const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
  const {
    loading, botStatus, linkedGuilds, selectedGuild, saveMessage, showMsg,
    loadData, selectGuild, startDiscordAuth, unlinkGuild,
  } = useDiscordGuild();

  const [alertCount, setAlertCount] = useState(0);
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);

  useEffect(() => {
    loadData().then(guilds => {
      if (guilds.length > 0) selectGuild(guilds[0]);
    });
    const params = new URLSearchParams(window.location.search);
    const dp = params.get('discord');
    if (dp === 'linked') { showMsg('success', 'Servidor vinculado exitosamente'); window.history.replaceState({}, '', '/discord'); }
    else if (dp === 'error') { showMsg('error', 'Error al vincular con Discord'); window.history.replaceState({}, '', '/discord'); }
    else if (dp === 'select') { window.history.replaceState({}, '', '/discord'); }
  }, []);

  // Load quick stats when guild changes
  useEffect(() => {
    if (!selectedGuild) return;
    api.get(`/discord/alerts/${selectedGuild.guildId}`).then(res => {
      if (res.data.success) setAlertCount(res.data.alerts?.length || 0);
    }).catch(() => {});
    api.get(`/discord/welcome/${selectedGuild.guildId}`).then(res => {
      if (res.data.success && res.data.config) setWelcomeEnabled(res.data.config.welcomeEnabled);
    }).catch(() => {});
  }, [selectedGuild]);

  if (permissionsLoading || loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" /></div>;

  if (!hasMinimumLevel('control_total')) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso denegado</h2>
          <p className="text-[#64748b] mb-6">Necesitas permisos de control total.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Discord</h1>
              <p className="text-sm text-[#64748b]">Configura la integracion de Discord con tu canal</p>
            </div>
          </div>
          {botStatus && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${botStatus.connected ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              {botStatus.connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {botStatus.connected ? `Bot conectado${botStatus.linkedCount > 0 ? ` (${botStatus.linkedCount} vinculado${botStatus.linkedCount > 1 ? 's' : ''})` : ''}` : 'Bot desconectado'}
            </div>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${saveMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Servers (left) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Servidores</h2>
            <button onClick={startDiscordAuth} className="flex items-center gap-2 px-3 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"><Plus className="w-4 h-4" /> Vincular</button>
          </div>
          {linkedGuilds.length === 0 ? (
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 text-center border border-[#e2e8f0] dark:border-[#374151]">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-[#64748b] opacity-50" />
              <p className="text-[#64748b] mb-4">No hay servidores vinculados</p>
              <button onClick={startDiscordAuth} className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl text-sm">Vincular servidor</button>
            </div>
          ) : linkedGuilds.map(guild => (
            <div key={guild.guildId} onClick={() => selectGuild(guild)} className={`bg-white dark:bg-[#1B1C1D] rounded-xl p-4 cursor-pointer transition-all border-2 ${selectedGuild?.guildId === guild.guildId ? 'border-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'}`}>
              <div className="flex items-center gap-3">
                {guild.guildIcon ? <img src={guild.guildIcon} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">{guild.guildName.charAt(0)}</div>}
                <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 dark:text-white truncate">{guild.guildName}</h3></div>
                <button onClick={(e) => { e.stopPropagation(); unlinkGuild(guild.guildId); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors"><Unlink className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Content (right) */}
        <div className="lg:col-span-2">
          {selectedGuild ? (
            <div className="space-y-6">
              {/* Quick nav cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Live Alerts card */}
                <Link to="/discord/alerts" className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                      <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">Live Alerts</h3>
                      <p className="text-xs text-[#64748b]">{alertCount} alerta{alertCount !== 1 ? 's' : ''} configurada{alertCount !== 1 ? 's' : ''}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#64748b] group-hover:text-[#2563eb] transition-colors" />
                  </div>
                  <p className="text-sm text-[#64748b]">Notifica cuando un streamer inicia stream</p>
                </Link>

                {/* Welcome card */}
                <Link to="/discord/welcome" className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">Bienvenida</h3>
                      <p className="text-xs text-[#64748b]">{welcomeEnabled ? 'Activo' : 'Inactivo'}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#64748b] group-hover:text-[#2563eb] transition-colors" />
                  </div>
                  <p className="text-sm text-[#64748b]">Mensajes de bienvenida y despedida con editor visual</p>
                </Link>

                {/* XP & Levels card */}
                <Link to="/discord/levels" className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-5 border border-[#e2e8f0] dark:border-[#374151] hover:border-[#f59e0b] transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                      <span className="text-lg">⚡</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">XP & Niveles</h3>
                      <p className="text-xs text-[#64748b]">Sistema de gamificacion</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#64748b] group-hover:text-[#f59e0b] transition-colors" />
                  </div>
                  <p className="text-sm text-[#64748b]">Niveles, roles automaticos, leaderboard, boosts y mas</p>
                </Link>
              </div>

              {/* Slash Commands */}
              <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center"><Settings className="w-5 h-5 text-[#2563eb]" /></div>
                  <div><h3 className="font-bold text-gray-900 dark:text-white">Slash Commands</h3><p className="text-sm text-[#64748b]">Comandos disponibles en Discord</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[{ cmd: '/live', desc: 'Estado del stream' }, { cmd: '/timer', desc: 'Timer actual' }, { cmd: '/stats', desc: 'Estadisticas' }, { cmd: '/followage', desc: 'Info y followage' }, { cmd: '/song', desc: 'Cancion sonando' }].map(c => (
                    <div key={c.cmd} className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl">
                      <code className="text-sm font-mono text-[#2563eb] font-bold">{c.cmd}</code>
                      <span className="text-sm text-[#64748b]">{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 text-center border border-[#e2e8f0] dark:border-[#374151]">
              <Settings className="w-12 h-12 mx-auto mb-4 text-[#64748b] opacity-50" />
              <p className="text-[#64748b]">{linkedGuilds.length > 0 ? 'Selecciona un servidor para configurar' : 'Vincula un servidor para empezar'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
