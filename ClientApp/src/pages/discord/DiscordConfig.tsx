import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MessageSquare, CheckCircle, XCircle, Unlink,
    Bell, Hash, Loader2, Wifi, WifiOff, Settings, X, Plus, Lock, Trash2,
    Search, Image, ImageOff, Radio, ExternalLink
} from 'lucide-react';
import api from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import MediaGallery from '../../components/timer/MediaGallery';

interface LinkedGuild { id: number; guildId: string; guildName: string; guildIcon: string | null; }
interface DiscordChannel { id: string; name: string; }
interface LiveAlert {
    id: number; channelName: string; discordChannelId: string; discordChannelName: string;
    customMessage: string | null; mentionEveryone: boolean; enabled: boolean; isOwnChannel: boolean;
    thumbnailMode: string; staticThumbnailUrl: string | null;
    embedColor: string; footerText: string | null; showButton: boolean; showStartTime: boolean;
    sendMode: string; delayMinutes: number;
}
interface ChannelStatus {
    channelName: string; displayName: string; profileImage: string;
    isLive: boolean; game: string | null; viewers: number; thumbnail: string | null;
}
interface SearchResult {
    login: string; displayName: string; profileImage: string;
    isLive: boolean; game: string | null; viewers: number; title: string | null; thumbnail: string | null;
}
interface BotStatus { connected: boolean; linkedCount: number; botUser: string; }

export default function DiscordConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
    const [linkedGuilds, setLinkedGuilds] = useState<LinkedGuild[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGuild, setSelectedGuild] = useState<LinkedGuild | null>(null);
    const [channels, setChannels] = useState<DiscordChannel[]>([]);
    const [loadingChannels, setLoadingChannels] = useState(false);
    const [alerts, setAlerts] = useState<LiveAlert[]>([]);
    const [loadingAlerts, setLoadingAlerts] = useState(false);
    const [channelStatuses, setChannelStatuses] = useState<ChannelStatus[]>([]);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Add alert
    const [showAddAlert, setShowAddAlert] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
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
    const [addingAlert, setAddingAlert] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // Edit alert
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
    const [savingEdit, setSavingEdit] = useState(false);

    // Auto-refresh
    const refreshInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadData();
        const params = new URLSearchParams(window.location.search);
        const dp = params.get('discord');
        if (dp === 'linked') { showMsg('success', 'Servidor vinculado exitosamente'); window.history.replaceState({}, '', '/discord'); }
        else if (dp === 'error') { showMsg('error', 'Error al vincular con Discord'); window.history.replaceState({}, '', '/discord'); }
        else if (dp === 'select') { window.history.replaceState({}, '', '/discord'); }
        return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
    }, []);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setSaveMessage({ type, text }); setTimeout(() => setSaveMessage(null), 4000);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [statusRes, guildsRes] = await Promise.all([api.get('/discord/status'), api.get('/discord/linked')]);
            if (statusRes.data.success) setBotStatus(statusRes.data);
            if (guildsRes.data.success) {
                setLinkedGuilds(guildsRes.data.guilds);
                if (guildsRes.data.guilds.length > 0) selectGuild(guildsRes.data.guilds[0]);
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const selectGuild = async (guild: LinkedGuild) => {
        setSelectedGuild(guild);
        setLoadingChannels(true); setLoadingAlerts(true);
        try {
            const [chRes, alRes] = await Promise.all([
                api.get(`/discord/channels/${guild.guildId}`),
                api.get(`/discord/alerts/${guild.guildId}`)
            ]);
            if (chRes.data.success) setChannels(chRes.data.channels);
            if (alRes.data.success) setAlerts(alRes.data.alerts);
            loadStatuses(guild.guildId);
            // Auto-refresh every 2 min
            if (refreshInterval.current) clearInterval(refreshInterval.current);
            refreshInterval.current = setInterval(() => loadStatuses(guild.guildId), 120000);
        } catch (err) { console.error(err); } finally { setLoadingChannels(false); setLoadingAlerts(false); }
    };

    const loadStatuses = async (guildId: string) => {
        try {
            const res = await api.get(`/discord/alerts/${guildId}/status`);
            if (res.data.success) setChannelStatuses(res.data.statuses);
        } catch (err) { console.error(err); }
    };

    const startDiscordAuth = async () => {
        try { const res = await api.get('/discord/auth'); if (res.data.success) window.location.href = res.data.url; } catch (err) { console.error(err); }
    };

    const unlinkGuild = async (guildId: string) => {
        try {
            await api.delete(`/discord/unlink/${guildId}`);
            setLinkedGuilds(prev => prev.filter(g => g.guildId !== guildId));
            if (selectedGuild?.guildId === guildId) { setSelectedGuild(null); setAlerts([]); setChannelStatuses([]); }
        } catch (err) { console.error(err); }
    };

    const searchChannel = (query: string) => {
        setSearchQuery(query); setSearchResult(null); setSearchError('');
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (query.length < 2) return;
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/discord/alerts/search/${query.toLowerCase().trim()}`);
                if (res.data.success) setSearchResult(res.data.channel);
                else setSearchError(res.data.error || 'Canal no encontrado');
            } catch { setSearchError('Error al buscar'); } finally { setSearching(false); }
        }, 600);
    };

    const addAlert = async () => {
        if (!selectedGuild || !searchResult || !newAlertDiscordChannel) return;
        const ch = channels.find(c => c.id === newAlertDiscordChannel);
        try {
            setAddingAlert(true);
            const res = await api.post(`/discord/alerts/${selectedGuild.guildId}`, {
                channelName: searchResult.login,
                discordChannelId: newAlertDiscordChannel,
                discordChannelName: ch?.name || '',
                customMessage: newAlertMessage || null,
                mentionEveryone: newAlertMention,
                thumbnailMode: newAlertThumbnail,
                staticThumbnailUrl: newAlertThumbnail === 'static' ? newAlertStaticUrl || null : null,
                embedColor: newAlertColor,
                footerText: newAlertFooter || null,
                showButton: newAlertButton,
                showStartTime: newAlertStartTime,
                sendMode: newAlertSendMode,
                delayMinutes: newAlertDelay
            });
            if (res.data.success) {
                setAlerts(prev => [...prev, res.data.alert]);
                resetAddForm(); showMsg('success', 'Alerta agregada');
                if (selectedGuild) loadStatuses(selectedGuild.guildId);
            }
        } catch (err: any) { showMsg('error', err.response?.data?.error || 'Error al agregar'); } finally { setAddingAlert(false); }
    };

    const resetAddForm = () => {
        setShowAddAlert(false); setSearchQuery(''); setSearchResult(null); setSearchError('');
        setNewAlertDiscordChannel(''); setNewAlertMessage(''); setNewAlertMention(true);
        setNewAlertThumbnail('live'); setNewAlertStaticUrl('');
        setNewAlertColor('#ff0000'); setNewAlertFooter(''); setNewAlertButton(true); setNewAlertStartTime(true);
        setNewAlertSendMode('wait'); setNewAlertDelay(2);
    };

    const toggleAlert = async (alert: LiveAlert) => {
        try {
            await api.put(`/discord/alerts/${alert.id}`, { enabled: !alert.enabled });
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a));
        } catch (err) { console.error(err); }
    };

    const updateAlertChannel = async (alert: LiveAlert, discordChannelId: string) => {
        const ch = channels.find(c => c.id === discordChannelId);
        try {
            await api.put(`/discord/alerts/${alert.id}`, { discordChannelId, discordChannelName: ch?.name || '' });
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, discordChannelId, discordChannelName: ch?.name || '' } : a));
        } catch (err) { console.error(err); }
    };

    const updateAlertMention = async (alert: LiveAlert) => {
        try {
            await api.put(`/discord/alerts/${alert.id}`, { mentionEveryone: !alert.mentionEveryone });
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, mentionEveryone: !a.mentionEveryone } : a));
        } catch (err) { console.error(err); }
    };

    const deleteAlert = async (alertId: number) => {
        try {
            await api.delete(`/discord/alerts/${alertId}`);
            setAlerts(prev => prev.filter(a => a.id !== alertId)); showMsg('success', 'Alerta eliminada');
        } catch (err) { console.error(err); }
    };

    const openEditAlert = (alert: LiveAlert) => {
        setEditingAlert(alert);
        setEditMessage(alert.customMessage || '');
        setEditThumbnail(alert.thumbnailMode);
        setEditStaticUrl(alert.staticThumbnailUrl || '');
        setEditMention(alert.mentionEveryone);
        setEditDiscordChannel(alert.discordChannelId);
        setEditColor(alert.embedColor || '#ff0000');
        setEditFooter(alert.footerText || '');
        setEditButton(alert.showButton);
        setEditStartTime(alert.showStartTime);
        setEditSendMode(alert.sendMode || 'wait');
        setEditDelay(alert.delayMinutes ?? 2);
    };

    const saveEditAlert = async () => {
        if (!editingAlert) return;
        try {
            setSavingEdit(true);
            const ch = channels.find(c => c.id === editDiscordChannel);
            await api.put(`/discord/alerts/${editingAlert.id}`, {
                discordChannelId: editDiscordChannel,
                discordChannelName: ch?.name || '',
                customMessage: editMessage || '',
                thumbnailMode: editThumbnail,
                staticThumbnailUrl: editThumbnail === 'static' ? editStaticUrl || null : null,
                mentionEveryone: editMention,
                embedColor: editColor,
                footerText: editFooter || '',
                showButton: editButton,
                showStartTime: editStartTime,
                sendMode: editSendMode,
                delayMinutes: editDelay,
            });
            setAlerts(prev => prev.map(a => a.id === editingAlert.id ? {
                ...a,
                discordChannelId: editDiscordChannel,
                discordChannelName: ch?.name || a.discordChannelName,
                customMessage: editMessage || null,
                thumbnailMode: editThumbnail,
                staticThumbnailUrl: editThumbnail === 'static' ? editStaticUrl : null,
                mentionEveryone: editMention,
                embedColor: editColor,
                footerText: editFooter || null,
                showButton: editButton,
                showStartTime: editStartTime,
                sendMode: editSendMode,
                delayMinutes: editDelay,
            } : a));
            setEditingAlert(null);
            showMsg('success', 'Alerta actualizada');
        } catch (err) { showMsg('error', 'Error al actualizar'); } finally { setSavingEdit(false); }
    };

    const getStatus = (channelName: string) => channelStatuses.find(s => s.channelName === channelName);

    if (permissionsLoading || loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" /></div>;

    if (!hasMinimumLevel('control_total')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso denegado</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">Necesitas permisos de control total.</p>
                    <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">Volver</button>
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
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Configura la integracion de Discord con tu canal</p>
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
                {/* Servers */}
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

                {/* Config */}
                <div className="lg:col-span-2">
                    {selectedGuild ? (
                        <div className="space-y-6">
                            {/* Live Alerts */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center"><Bell className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 dark:text-white">Alertas de Live</h3>
                                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Notifica cuando un streamer inicia stream</p>
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
                                                        {/* Avatar + Live indicator */}
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
                                                            {status?.isLive && (
                                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                                                    {status.game} • {status.viewers.toLocaleString()} viewers
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                                <Hash className="w-3 h-3" />
                                                                <select value={alert.discordChannelId} onChange={(e) => updateAlertChannel(alert, e.target.value)}
                                                                    className="bg-white dark:bg-[#1B1C1D] border-none p-0 text-sm text-[#64748b] dark:text-[#94a3b8] focus:outline-none cursor-pointer [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D] [&>option]:text-gray-900 [&>option]:dark:text-white">
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

                                                        {/* Thumbnail preview */}
                                                        {status?.isLive && status.thumbnail && (
                                                            <img src={status.thumbnail} alt="" className="w-28 h-16 rounded-lg object-cover flex-shrink-0 hidden sm:block" />
                                                        )}

                                                        <button onClick={() => openEditAlert(alert)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-[#2563eb] transition-colors flex-shrink-0" title="Editar"><Settings className="w-4 h-4" /></button>
                                                        <button onClick={() => toggleAlert(alert)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${alert.enabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alert.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </button>
                                                        <button onClick={() => deleteAlert(alert.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors flex-shrink-0" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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

            {/* Add Alert Modal */}
            {showAddAlert && (
                <AlertFormModal
                    title="Agregar alerta de live"
                    onClose={resetAddForm}
                    onSave={addAlert}
                    saving={addingAlert}
                    saveLabel="Agregar"
                    saveDisabled={!searchResult || !newAlertDiscordChannel}
                    channels={channels}
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
                >
                    {/* Channel search - only in add mode */}
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
                    title={`Editar alerta — ${editingAlert.channelName}`}
                    onClose={() => setEditingAlert(null)}
                    onSave={saveEditAlert}
                    saving={savingEdit}
                    saveLabel="Guardar"
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
                />
            )}
        </div>
    );
}

interface AlertFormModalProps {
    title: string; onClose: () => void; onSave: () => void; saving: boolean; saveLabel: string;
    saveDisabled?: boolean; channels: DiscordChannel[]; children?: React.ReactNode;
    discordChannel: string; setDiscordChannel: (v: string) => void;
    thumbnailMode: string; setThumbnailMode: (v: string) => void;
    staticUrl: string; setStaticUrl: (v: string) => void;
    message: string; setMessage: (v: string) => void;
    mention: boolean; setMention: (v: boolean) => void;
    embedColor: string; setEmbedColor: (v: string) => void;
    footer: string; setFooter: (v: string) => void;
    showButton: boolean; setShowButton: (v: boolean) => void;
    showStartTime: boolean; setShowStartTime: (v: boolean) => void;
    sendMode: string; setSendMode: (v: string) => void;
    delayMinutes: number; setDelayMinutes: (v: number) => void;
}

function AlertFormModal(props: AlertFormModalProps) {
    const { title, onClose, onSave, saving, saveLabel, saveDisabled, channels, children,
        discordChannel, setDiscordChannel, thumbnailMode, setThumbnailMode, staticUrl, setStaticUrl,
        message, setMessage, mention, setMention, embedColor, setEmbedColor, footer, setFooter,
        showButton, setShowButton, showStartTime, setShowStartTime,
        sendMode, setSendMode, delayMinutes, setDelayMinutes } = props;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-3xl w-full border border-[#e2e8f0] dark:border-[#374151] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-[#64748b] hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column: Config */}
                    <div className="space-y-4">
                        {/* Custom children (search field for add mode) */}
                        {children}

                        {/* Discord channel */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Canal de Discord</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                                <select value={discordChannel} onChange={(e) => setDiscordChannel(e.target.value)}
                                    className="w-full pl-9 pr-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] appearance-none [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D] [&>option]:text-gray-900 [&>option]:dark:text-white">
                                    <option value="">Seleccionar canal...</option>
                                    {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Thumbnail mode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Miniatura</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'live', label: 'En vivo', icon: <Radio className="w-4 h-4" />, desc: 'Preview del stream' },
                                    { value: 'static', label: 'Estatica', icon: <Image className="w-4 h-4" />, desc: 'Imagen fija' },
                                    { value: 'none', label: 'Ninguna', icon: <ImageOff className="w-4 h-4" />, desc: 'Solo texto' },
                                ].map(opt => (
                                    <button key={opt.value} onClick={() => setThumbnailMode(opt.value)}
                                        className={`p-3 rounded-xl text-center transition-all border-2 ${thumbnailMode === opt.value ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'}`}>
                                        <div className={`mx-auto mb-1 ${thumbnailMode === opt.value ? 'text-[#2563eb]' : 'text-[#64748b]'}`}>{opt.icon}</div>
                                        <span className="text-xs font-medium text-gray-900 dark:text-white">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                            {thumbnailMode === 'static' && <StaticThumbnailPicker value={staticUrl} onChange={setStaticUrl} />}
                        </div>

                        {/* Message */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Mensaje <span className="text-[#94a3b8] font-normal">(opcional)</span></label>
                            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej: Mi streamer favorito esta en vivo!"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-[#94a3b8]" />
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Color del embed</label>
                            <div className="flex items-center gap-3">
                                <input type="color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)}
                                    className="w-10 h-10 rounded-lg border border-[#e2e8f0] dark:border-[#374151] cursor-pointer" />
                                <input type="text" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)}
                                    className="w-24 px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-gray-900 dark:text-white font-mono" />
                                <div className="flex gap-1 flex-wrap">
                                    {['#ff0000', '#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                                        <button key={c} onClick={() => setEmbedColor(c)} className={`w-6 h-6 rounded-full border-2 shadow-sm ${embedColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-white dark:border-[#374151]'}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Footer <span className="text-[#94a3b8] font-normal">(opcional)</span></label>
                            <input type="text" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Decatron Bot • twitch.decatron.net"
                                className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-[#94a3b8] text-sm" />
                        </div>

                        {/* Send mode */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Modo de envio</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'instant', label: 'Instantaneo', desc: 'Envia al instante con avatar como imagen' },
                                    { value: 'wait', label: 'Esperar thumbnail', desc: `Espera ${delayMinutes} min para enviar con preview del stream` },
                                    { value: 'instant_update', label: 'Instantaneo + actualizar', desc: `Envia al instante, se actualiza en ${delayMinutes} min con preview` },
                                ].map(opt => (
                                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${sendMode === opt.value ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20' : 'border-[#e2e8f0] dark:border-[#374151]'}`}>
                                        <input type="radio" name="sendMode" value={opt.value} checked={sendMode === opt.value} onChange={() => setSendMode(opt.value)} className="mt-0.5 accent-[#2563eb]" />
                                        <div>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                                            <p className="text-xs text-[#64748b]">{opt.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {sendMode !== 'instant' && (
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-[#64748b] mb-1">Tiempo de espera</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 5].map(min => (
                                            <button key={min} onClick={() => setDelayMinutes(min)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${delayMinutes === min ? 'bg-[#2563eb] text-white' : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'}`}>
                                                {min} min
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Toggles */}
                        <div className="space-y-2">
                            <ToggleOption checked={mention} onChange={setMention} label="Mencionar @everyone" desc="Notifica a todos en el servidor" />
                            <ToggleOption checked={showButton} onChange={setShowButton} label='Boton "Ver Stream"' desc="Agrega un boton clickeable al embed" />
                            <ToggleOption checked={showStartTime} onChange={setShowStartTime} label="Mostrar hora de inicio" desc="Muestra hace cuanto empezo el stream" />
                        </div>
                    </div>

                    {/* Right column: Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">Preview del embed</label>
                        <div className="bg-[#313338] rounded-xl p-4 text-white text-sm sticky top-0">
                            <div className="flex gap-3">
                                <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: embedColor }} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-7 h-7 bg-gray-600 rounded-full" />
                                        <span className="text-sm text-[#00a8fc] font-medium hover:underline cursor-pointer">Streamer</span>
                                    </div>
                                    <p className="font-semibold text-[#00a8fc] hover:underline cursor-pointer mb-2">🔴 EN VIVO — Titulo del stream aqui</p>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        <div><p className="text-[10px] text-gray-400 font-bold">Juego</p><p className="text-xs">Just Chatting</p></div>
                                        <div><p className="text-[10px] text-gray-400 font-bold">Viewers</p><p className="text-xs">123</p></div>
                                        {showStartTime && <div><p className="text-[10px] text-gray-400 font-bold">Inicio</p><p className="text-xs">Hace 5 min</p></div>}
                                    </div>
                                    {thumbnailMode !== 'none' && (
                                        <div className="bg-gray-700 rounded-lg h-32 mb-3 flex items-center justify-center">
                                            <span className="text-gray-500 text-xs">{thumbnailMode === 'live' ? 'Preview del stream en vivo' : 'Imagen estatica'}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-gray-500">{footer || 'Decatron Bot • twitch.decatron.net'}</p>
                                        <span className="text-[10px] text-gray-600">•</span>
                                        <p className="text-[10px] text-gray-500">Hoy a las 20:30</p>
                                    </div>
                                </div>
                            </div>
                            {showButton && (
                                <div className="mt-3 ml-4">
                                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4f545c] hover:bg-[#5d6269] rounded text-sm cursor-pointer transition-colors">📺 Ver Stream</span>
                                </div>
                            )}
                            {mention && <p className="text-xs text-gray-400 mt-3 ml-4 italic">@everyone {message || 'Streamer esta en vivo!'}</p>}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 mt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                    <button onClick={onClose} className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151]">Cancelar</button>
                    <button onClick={onSave} disabled={saving || saveDisabled}
                        className="flex-1 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ToggleOption({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
    return (
        <label className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#2563eb]" />
            <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                <p className="text-xs text-[#64748b]">{desc}</p>
            </div>
        </label>
    );
}

function StaticThumbnailPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
    const isExternal = value ? value.startsWith('http') : false;
    const [mode, setMode] = useState<'gallery' | 'url'>(isExternal ? 'url' : 'gallery');
    const [showGallery, setShowGallery] = useState(false);

    return (
        <div className="mt-2 space-y-2">
            {/* Mode toggle */}
            <div className="flex gap-2">
                <button onClick={() => setMode('gallery')}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'gallery' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>
                    <Image className="w-3 h-3 inline mr-1" /> Galeria
                </button>
                <button onClick={() => setMode('url')}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all border ${mode === 'url' ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>
                    <ExternalLink className="w-3 h-3 inline mr-1" /> URL externa
                </button>
            </div>

            {mode === 'url' ? (
                <input type="url" value={value} onChange={(e) => onChange(e.target.value)}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] placeholder-[#94a3b8] text-sm" />
            ) : (
                <div>
                    {value ? (
                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                            <img src={value} alt="" className="w-20 h-12 rounded-lg object-cover" />
                            <span className="flex-1 text-sm text-[#64748b] truncate">{value.split('/').pop()}</span>
                            <button onClick={() => setShowGallery(true)} className="px-3 py-1.5 text-xs font-medium bg-[#f8fafc] dark:bg-[#374151] text-[#2563eb] rounded-lg border border-[#e2e8f0] dark:border-[#374151]">Cambiar</button>
                        </div>
                    ) : (
                        <button onClick={() => setShowGallery(true)}
                            className="w-full px-4 py-3 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">
                            Seleccionar imagen de la galeria
                        </button>
                    )}
                </div>
            )}

            {/* Preview */}
            {value && (
                <div className="flex items-center gap-2">
                    <img src={value} alt="" className="w-16 h-9 rounded object-cover" />
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Imagen seleccionada</span>
                </div>
            )}

            {/* Gallery modal */}
            {showGallery && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white">Seleccionar imagen</h3>
                            <button onClick={() => setShowGallery(false)} className="text-[#64748b] hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <MediaGallery
                            selectedFileType="image"
                            onFileSelect={(file) => {
                                onChange(file.fileUrl);
                                setShowGallery(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
