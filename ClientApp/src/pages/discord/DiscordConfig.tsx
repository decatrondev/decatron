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

  if (permissionsLoading || loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" /></div>;

  if (!hasMinimumLevel('control_total')) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
          <h2 className="text-2xl font-black text-ds-danger mb-2">Acceso denegado</h2>
          <p className="text-ds-soft mb-6">Necesitas permisos de control total.</p>
          <button onClick={() => navigate('/dashboard')} className="ds-btn ds-btn--primary ds-btn--lg">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-scale space-y-6">
      {/* Header */}
      <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-ds-accent/10 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-ds-accent-text" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-ds-text">Discord</h1>
              <p className="text-sm text-ds-soft">Configura la integracion de Discord con tu canal</p>
            </div>
          </div>
          {botStatus && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${botStatus.connected ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
              {botStatus.connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {botStatus.connected ? `Bot conectado${botStatus.linkedCount > 0 ? ` (${botStatus.linkedCount} vinculado${botStatus.linkedCount > 1 ? 's' : ''})` : ''}` : 'Bot desconectado'}
            </div>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${saveMessage.type === 'success' ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-danger/10 text-ds-danger '}`}>
          {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {saveMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Servers (left) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ds-text">Servidores</h2>
            <button onClick={startDiscordAuth} className="ds-btn ds-btn--primary ds-btn--sm"><Plus className="w-4 h-4" /> Vincular</button>
          </div>
          {linkedGuilds.length === 0 ? (
            <div className="bg-ds-surface rounded-lg p-8 text-center border border-ds-border">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-ds-soft opacity-50" />
              <p className="text-ds-soft mb-4">No hay servidores vinculados</p>
              <button onClick={startDiscordAuth} className="ds-btn ds-btn--primary">Vincular servidor</button>
            </div>
          ) : linkedGuilds.map(guild => (
            <div key={guild.guildId} onClick={() => selectGuild(guild)} className={`bg-ds-surface rounded-lg p-4 cursor-pointer transition-all border-2 ${selectedGuild?.guildId === guild.guildId ? 'border-ds-accent' : 'border-ds-border hover:border-ds-accent'}`}>
              <div className="flex items-center gap-3">
                {guild.guildIcon ? <img src={guild.guildIcon} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 bg-ds-accent/10 rounded-full flex items-center justify-center text-ds-accent-text font-bold">{guild.guildName.charAt(0)}</div>}
                <div className="flex-1 min-w-0"><h3 className="font-bold text-ds-text truncate">{guild.guildName}</h3></div>
                <button onClick={(e) => { e.stopPropagation(); unlinkGuild(guild.guildId); }} className="p-1.5 hover:bg-ds-danger/10 rounded-lg text-ds-danger transition-colors"><Unlink className="w-4 h-4" /></button>
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
                <Link to="/discord/alerts" className="bg-ds-surface rounded-lg p-5 border border-ds-border hover:border-ds-accent transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-ds-danger/10 rounded-lg flex items-center justify-center">
                      <Bell className="w-5 h-5 text-ds-accent-text" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-ds-text">Live Alerts</h3>
                      <p className="text-xs text-ds-soft">{alertCount} alerta{alertCount !== 1 ? 's' : ''} configurada{alertCount !== 1 ? 's' : ''}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ds-soft group-hover:text-ds-accent-text transition-colors" />
                  </div>
                  <p className="text-sm text-ds-soft">Notifica cuando un streamer inicia stream</p>
                </Link>

                {/* Welcome card */}
                <Link to="/discord/welcome" className="bg-ds-surface rounded-lg p-5 border border-ds-border hover:border-ds-accent transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-ds-ok/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-ds-accent-text" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-ds-text">Bienvenida</h3>
                      <p className="text-xs text-ds-soft">{welcomeEnabled ? 'Activo' : 'Inactivo'}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ds-soft group-hover:text-ds-accent-text transition-colors" />
                  </div>
                  <p className="text-sm text-ds-soft">Mensajes de bienvenida y despedida con editor visual</p>
                </Link>

                {/* XP & Levels card */}
                <Link to="/discord/levels" className="bg-ds-surface rounded-lg p-5 border border-ds-border hover:border-ds-warn/40 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-ds-warn/10 rounded-lg flex items-center justify-center">
                      <span className="text-lg">⚡</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-ds-text">XP & Niveles</h3>
                      <p className="text-xs text-ds-soft">Sistema de gamificacion</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ds-soft group-hover:text-ds-warn transition-colors" />
                  </div>
                  <p className="text-sm text-ds-soft">Niveles, roles automaticos, leaderboard, boosts y mas</p>
                </Link>
              </div>

              {/* Slash Commands */}
              <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-ds-accent/10 rounded-lg flex items-center justify-center"><Settings className="w-5 h-5 text-ds-accent-text" /></div>
                  <div><h3 className="font-bold text-ds-text">Slash Commands</h3><p className="text-sm text-ds-soft">Comandos disponibles en Discord</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[{ cmd: '/live', desc: 'Estado del stream' }, { cmd: '/timer', desc: 'Timer actual' }, { cmd: '/stats', desc: 'Estadisticas' }, { cmd: '/followage', desc: 'Info y followage' }, { cmd: '/song', desc: 'Cancion sonando' }].map(c => (
                    <div key={c.cmd} className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg">
                      <code className="text-sm font-mono text-ds-accent-text font-bold">{c.cmd}</code>
                      <span className="text-sm text-ds-soft">{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-ds-surface rounded-lg p-12 text-center border border-ds-border">
              <Settings className="w-12 h-12 mx-auto mb-4 text-ds-soft opacity-50" />
              <p className="text-ds-soft">{linkedGuilds.length > 0 ? 'Selecciona un servidor para configurar' : 'Vincula un servidor para empezar'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
