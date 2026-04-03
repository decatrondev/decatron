import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Hash, Loader2, Settings, Plus, Lock, Trash2,
  Search, Image, ImageOff, Radio, CheckCircle, XCircle
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useDiscordGuild } from './alerts/hooks/useDiscordGuild';
import { useAlerts } from './alerts/hooks/useAlerts';
import AlertFormModal from './alerts/components/AlertFormModal';
import type { LiveAlert } from './alerts/types';

export default function DiscordAlerts() {
  const navigate = useNavigate();
  const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
  const {
    loading, linkedGuilds, selectedGuild, channels, saveMessage, showMsg,
    loadData, selectGuild,
  } = useDiscordGuild();
  const {
    alerts, loadingAlerts, searchQuery, searchResult, searching, searchError,
    loadAlerts, loadStatuses, startAutoRefresh, stopAutoRefresh,
    searchChannel, resetSearch, addAlert, toggleAlert, updateAlertChannel, updateAlertMention,
    deleteAlert, saveEditAlert, getStatus,
  } = useAlerts();

  // Add modal state
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [newAlertDiscordChannel, setNewAlertDiscordChannel] = useState('');
  const [newAlertMention, setNewAlertMention] = useState(true);
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertThumbnail, setNewAlertThumbnail] = useState('live');
  const [newAlertStaticUrl, setNewAlertStaticUrl] = useState('');
  const [newAlertColor, setNewAlertColor] = useState('#ff0000');
  const [newAlertFooter, setNewAlertFooter] = useState('');
  const [newAlertButton, setNewAlertButton] = useState(true);
  const [newAlertStartTime, setNewAlertStartTime] = useState(true);
  const [newAlertSendMode, setNewAlertSendMode] = useState('wait');
  const [newAlertDelay, setNewAlertDelay] = useState(2);
  const [newAlertUpdateInterval, setNewAlertUpdateInterval] = useState(10);
  const [newAlertOfflineAction, setNewAlertOfflineAction] = useState('summary');
  const [addingAlert, setAddingAlert] = useState(false);

  // Edit modal state
  const [editingAlert, setEditingAlert] = useState<LiveAlert | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editThumbnail, setEditThumbnail] = useState('live');
  const [editStaticUrl, setEditStaticUrl] = useState('');
  const [editMention, setEditMention] = useState(true);
  const [editDiscordChannel, setEditDiscordChannel] = useState('');
  const [editColor, setEditColor] = useState('#ff0000');
  const [editFooter, setEditFooter] = useState('');
  const [editButton, setEditButton] = useState(true);
  const [editStartTime, setEditStartTime] = useState(true);
  const [editSendMode, setEditSendMode] = useState('wait');
  const [editDelay, setEditDelay] = useState(2);
  const [editUpdateInterval, setEditUpdateInterval] = useState(10);
  const [editOfflineAction, setEditOfflineAction] = useState('summary');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadData().then(guilds => {
      if (guilds.length > 0) {
        selectGuild(guilds[0]).then(() => {
          loadAlerts(guilds[0].guildId);
          loadStatuses(guilds[0].guildId);
          startAutoRefresh(guilds[0].guildId);
        });
      }
    });
    return () => stopAutoRefresh();
  }, []);

  const handleSelectGuild = async (guildId: string) => {
    const guild = linkedGuilds.find(g => g.guildId === guildId);
    if (!guild) return;
    await selectGuild(guild);
    loadAlerts(guild.guildId);
    loadStatuses(guild.guildId);
    startAutoRefresh(guild.guildId);
  };

  const resetAddForm = () => {
    setShowAddAlert(false); resetSearch();
    setNewAlertDiscordChannel(''); setNewAlertMessage(''); setNewAlertMention(true);
    setNewAlertThumbnail('live'); setNewAlertStaticUrl('');
    setNewAlertColor('#ff0000'); setNewAlertFooter(''); setNewAlertButton(true); setNewAlertStartTime(true);
    setNewAlertSendMode('wait'); setNewAlertDelay(2); setNewAlertUpdateInterval(10); setNewAlertOfflineAction('summary');
  };

  const handleAddAlert = async () => {
    if (!selectedGuild || !searchResult || !newAlertDiscordChannel) return;
    const ch = channels.find(c => c.id === newAlertDiscordChannel);
    try {
      setAddingAlert(true);
      const success = await addAlert(selectedGuild.guildId, {
        channelName: searchResult.login,
        discordChannelId: newAlertDiscordChannel, discordChannelName: ch?.name || '',
        customMessage: newAlertMessage || null, mentionEveryone: newAlertMention,
        thumbnailMode: newAlertThumbnail, staticThumbnailUrl: newAlertThumbnail === 'static' ? newAlertStaticUrl || null : null,
        embedColor: newAlertColor, footerText: newAlertFooter || null,
        showButton: newAlertButton, showStartTime: newAlertStartTime,
        sendMode: newAlertSendMode, delayMinutes: newAlertDelay,
        updateIntervalMinutes: newAlertUpdateInterval, onOfflineAction: newAlertOfflineAction,
      });
      if (success) { resetAddForm(); showMsg('success', 'Alerta agregada'); if (selectedGuild) loadStatuses(selectedGuild.guildId); }
    } catch (err: any) { showMsg('error', err.message); } finally { setAddingAlert(false); }
  };

  const openEditAlert = (alert: LiveAlert) => {
    setEditingAlert(alert); setEditMessage(alert.customMessage || ''); setEditThumbnail(alert.thumbnailMode);
    setEditStaticUrl(alert.staticThumbnailUrl || ''); setEditMention(alert.mentionEveryone);
    setEditDiscordChannel(alert.discordChannelId); setEditColor(alert.embedColor || '#ff0000');
    setEditFooter(alert.footerText || ''); setEditButton(alert.showButton); setEditStartTime(alert.showStartTime);
    setEditSendMode(alert.sendMode || 'wait'); setEditDelay(alert.delayMinutes ?? 2);
    setEditUpdateInterval(alert.updateIntervalMinutes ?? 10); setEditOfflineAction(alert.onOfflineAction || 'summary');
  };

  const handleSaveEdit = async () => {
    if (!editingAlert) return;
    setSavingEdit(true);
    const success = await saveEditAlert(editingAlert.id, {
      discordChannelId: editDiscordChannel, discordChannelName: channels.find(c => c.id === editDiscordChannel)?.name || '',
      customMessage: editMessage || '', thumbnailMode: editThumbnail,
      staticThumbnailUrl: editThumbnail === 'static' ? editStaticUrl || null : null,
      mentionEveryone: editMention, embedColor: editColor, footerText: editFooter || '',
      showButton: editButton, showStartTime: editStartTime, sendMode: editSendMode,
      delayMinutes: editDelay, updateIntervalMinutes: editUpdateInterval, onOfflineAction: editOfflineAction,
    }, channels);
    if (success) { setEditingAlert(null); showMsg('success', 'Alerta actualizada'); }
    else showMsg('error', 'Error al actualizar');
    setSavingEdit(false);
  };

  const handleDeleteAlert = async (alertId: number) => {
    if (await deleteAlert(alertId)) showMsg('success', 'Alerta eliminada');
  };

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
            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
              <Bell className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Live Alerts</h1>
              <p className="text-sm text-[#64748b]">Notificaciones cuando un streamer inicia stream</p>
            </div>
          </div>
          {linkedGuilds.length > 1 && (
            <select value={selectedGuild?.guildId || ''} onChange={(e) => handleSelectGuild(e.target.value)}
              className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm font-medium text-gray-900 dark:text-white [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]">
              {linkedGuilds.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
            </select>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${saveMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {saveMessage.text}
        </div>
      )}

      {!selectedGuild ? (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 text-center border border-[#e2e8f0] dark:border-[#374151]">
          <Bell className="w-12 h-12 mx-auto mb-4 text-[#64748b] opacity-50" />
          <p className="text-[#64748b]">Vincula un servidor en la pagina General para empezar</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center"><Bell className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Alertas de Live — {selectedGuild.guildName}</h3>
                <p className="text-sm text-[#64748b]">{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} configurada{alerts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setShowAddAlert(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#2563eb] hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"><Plus className="w-4 h-4" /> Agregar</button>
          </div>

          {loadingAlerts ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div> : alerts.length === 0 ? (
            <div className="text-center py-8 text-[#64748b]">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No hay alertas configuradas</p>
              <p className="text-xs mt-1">Agrega canales para recibir notificaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const status = getStatus(alert.channelName);
                return (
                  <div key={alert.id} className="p-4 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        {status?.profileImage ? (
                          <img src={status.profileImage} alt="" className={`w-11 h-11 rounded-full ${status.isLive ? 'ring-2 ring-red-500' : ''}`} />
                        ) : (
                          <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-full" />
                        )}
                        {status?.isLive && <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-[#374151]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">{status?.displayName || alert.channelName}</span>
                          {alert.isOwnChannel && <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">Tu canal</span>}
                          {status?.isLive && <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">EN VIVO</span>}
                        </div>
                        {status?.isLive && <p className="text-xs text-[#64748b] mt-0.5">{status.game} • {status.viewers.toLocaleString()} viewers</p>}
                        <div className="flex items-center gap-2 mt-2 text-sm text-[#64748b]">
                          <Hash className="w-3 h-3" />
                          <select value={alert.discordChannelId} onChange={(e) => updateAlertChannel(alert, e.target.value, channels)}
                            className="bg-white dark:bg-[#1B1C1D] border-none p-0 text-sm text-[#64748b] focus:outline-none cursor-pointer [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]">
                            {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                          </select>
                          <span className="text-xs">•</span>
                          <button onClick={() => updateAlertMention(alert)} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${alert.mentionEveryone ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {alert.mentionEveryone ? '@everyone' : 'sin mencion'}
                          </button>
                          <span className="text-xs">•</span>
                          <span className="text-xs flex items-center gap-1">
                            {alert.thumbnailMode === 'live' ? <><Radio className="w-3 h-3" /> En vivo</> : alert.thumbnailMode === 'static' ? <><Image className="w-3 h-3" /> Estatica</> : <><ImageOff className="w-3 h-3" /> Sin imagen</>}
                          </span>
                        </div>
                      </div>
                      {status?.isLive && status.thumbnail && <img src={status.thumbnail} alt="" className="w-28 h-16 rounded-lg object-cover flex-shrink-0 hidden sm:block" />}
                      <button onClick={() => openEditAlert(alert)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-[#2563eb] flex-shrink-0"><Settings className="w-4 h-4" /></button>
                      <button onClick={() => toggleAlert(alert)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${alert.enabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alert.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <button onClick={() => handleDeleteAlert(alert.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddAlert && (
        <AlertFormModal
          title="Agregar alerta de live" onClose={resetAddForm} onSave={handleAddAlert} saving={addingAlert} saveLabel="Agregar"
          saveDisabled={!searchResult || !newAlertDiscordChannel} channels={channels}
          discordChannel={newAlertDiscordChannel} setDiscordChannel={setNewAlertDiscordChannel}
          thumbnailMode={newAlertThumbnail} setThumbnailMode={setNewAlertThumbnail}
          staticUrl={newAlertStaticUrl} setStaticUrl={setNewAlertStaticUrl}
          message={newAlertMessage} setMessage={setNewAlertMessage}
          mention={newAlertMention} setMention={setNewAlertMention}
          embedColor={newAlertColor} setEmbedColor={setNewAlertColor}
          footer={newAlertFooter} setFooter={setNewAlertFooter}
          showButton={newAlertButton} setShowButton={setNewAlertButton}
          showStartTime={newAlertStartTime} setShowStartTime={setNewAlertStartTime}
          sendMode={newAlertSendMode} setSendMode={setNewAlertSendMode}
          delayMinutes={newAlertDelay} setDelayMinutes={setNewAlertDelay}
          updateInterval={newAlertUpdateInterval} setUpdateInterval={setNewAlertUpdateInterval}
          offlineAction={newAlertOfflineAction} setOfflineAction={setNewAlertOfflineAction}
        >
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Canal de Twitch</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <input type="text" value={searchQuery} onChange={(e) => searchChannel(e.target.value)} placeholder="Buscar canal..."
                className="w-full pl-9 pr-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-[#94a3b8]" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#2563eb]" />}
            </div>
            {searchResult && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <img src={searchResult.profileImage} alt="" className={`w-12 h-12 rounded-full ${searchResult.isLive ? 'ring-2 ring-red-500' : ''}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">{searchResult.displayName}</span>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {searchResult.isLive && <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">EN VIVO</span>}
                    </div>
                    {searchResult.isLive && <p className="text-xs text-[#64748b] mt-0.5">{searchResult.game} • {searchResult.viewers.toLocaleString()} viewers</p>}
                  </div>
                  {searchResult.isLive && searchResult.thumbnail && <img src={searchResult.thumbnail} alt="" className="w-24 h-14 rounded-lg object-cover hidden sm:block" />}
                </div>
              </div>
            )}
            {searchError && <p className="mt-2 text-sm text-red-500">{searchError}</p>}
          </div>
        </AlertFormModal>
      )}

      {/* Edit Alert Modal */}
      {editingAlert && (
        <AlertFormModal
          title={`Editar alerta — ${editingAlert.channelName}`} onClose={() => setEditingAlert(null)} onSave={handleSaveEdit} saving={savingEdit} saveLabel="Guardar"
          channels={channels}
          discordChannel={editDiscordChannel} setDiscordChannel={setEditDiscordChannel}
          thumbnailMode={editThumbnail} setThumbnailMode={setEditThumbnail}
          staticUrl={editStaticUrl} setStaticUrl={setEditStaticUrl}
          message={editMessage} setMessage={setEditMessage}
          mention={editMention} setMention={setEditMention}
          embedColor={editColor} setEmbedColor={setEditColor}
          footer={editFooter} setFooter={setEditFooter}
          showButton={editButton} setShowButton={setEditButton}
          showStartTime={editStartTime} setShowStartTime={setEditStartTime}
          sendMode={editSendMode} setSendMode={setEditSendMode}
          delayMinutes={editDelay} setDelayMinutes={setEditDelay}
          updateInterval={editUpdateInterval} setUpdateInterval={setEditUpdateInterval}
          offlineAction={editOfflineAction} setOfflineAction={setEditOfflineAction}
        />
      )}
    </div>
  );
}
