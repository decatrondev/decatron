import { Lock, Plus, Pencil, Trash2, X, Save, Clock, MessageSquare, Radio, AlertCircle, Zap, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import GameAutocomplete, { type GameOption } from '../../components/GameAutocomplete';

interface Timer {
    id: number;
    channelName: string;
    name: string;
    message: string;
    intervalMinutes: number;
    intervalMessages: number;
    streamStatus: 'online' | 'offline' | 'both';
    priority: number;
    isActive: boolean;
    categoryName?: string;
    createdAt: string;
    updatedAt: string;
    lastExecutedAt?: string;
    executionCount: number;
    messagesSinceLastExecution: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error';
}

export default function Timers() {
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const { t } = useTranslation('features');
    const [timers, setTimers] = useState<Timer[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
    const [newTimer, setNewTimer] = useState({
        name: '',
        message: '',
        intervalMinutes: 5,
        intervalMessages: 5,
        streamStatus: 'online' as 'online' | 'offline' | 'both',
        priority: 1,
        isActive: true
    });
    const [selectedGame, setSelectedGame] = useState<GameOption | null>(null);
    const [selectedEditGame, setSelectedEditGame] = useState<GameOption | null>(null);
    const [toast, setToast] = useState<Toast | null>(null);

    const canManageTimers = hasMinimumLevel('moderation');

    useEffect(() => {
        if (!permissionsLoading && canManageTimers) {
            loadTimers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadTimers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/timers');
            setTimers(res.data.timers || []);
        } catch (err) {
            console.error('Error loading timers:', err);
            showToast(t('timers.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTimer = async () => {
        if (!newTimer.name || !newTimer.message) {
            showToast(t('timers.nameMessageRequired'), 'error');
            return;
        }

        // ANTI-SPAM: Validar mínimos obligatorios
        if (newTimer.intervalMinutes < 5) {
            showToast(t('timers.minIntervalMinutes'), 'error');
            return;
        }

        if (newTimer.intervalMessages < 5) {
            showToast(t('timers.minIntervalMessages'), 'error');
            return;
        }

        if (newTimer.message.length > 500) {
            showToast(t('timers.maxMessageLength'), 'error');
            return;
        }

        try {
            await api.post('/timers', {
                ...newTimer,
                categoryName: selectedGame?.name || null
            });
            showToast(t('timers.createSuccess'), 'success');
            setShowCreateModal(false);
            setNewTimer({
                name: '',
                message: '',
                intervalMinutes: 5,
                intervalMessages: 5,
                streamStatus: 'online',
                priority: 1,
                isActive: true
            });
            setSelectedGame(null);
            await loadTimers();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('timers.createError');
            showToast(message, 'error');
        }
    };

    const handleEditTimer = async () => {
        if (!editingTimer) return;

        if (!editingTimer.name || !editingTimer.message) {
            showToast(t('timers.nameMessageRequired'), 'error');
            return;
        }

        // ANTI-SPAM: Validar mínimos obligatorios
        if (editingTimer.intervalMinutes < 5) {
            showToast(t('timers.minIntervalMinutes'), 'error');
            return;
        }

        if (editingTimer.intervalMessages < 5) {
            showToast(t('timers.minIntervalMessages'), 'error');
            return;
        }

        if (editingTimer.message.length > 500) {
            showToast(t('timers.maxMessageLength'), 'error');
            return;
        }

        try {
            await api.put(`/timers/${editingTimer.id}`, {
                name: editingTimer.name,
                message: editingTimer.message,
                intervalMinutes: editingTimer.intervalMinutes,
                intervalMessages: editingTimer.intervalMessages,
                streamStatus: editingTimer.streamStatus,
                priority: editingTimer.priority,
                isActive: editingTimer.isActive,
                categoryName: selectedEditGame?.name || editingTimer.categoryName || null
            });
            showToast(t('timers.updateSuccess'), 'success');
            setShowEditModal(false);
            setEditingTimer(null);
            setSelectedEditGame(null);
            await loadTimers();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('timers.updateError');
            showToast(message, 'error');
        }
    };

    const handleDeleteTimer = async (id: number, name: string) => {
        if (!canManageTimers) {
            showToast(t('timers.noDeletePermission'), 'error');
            return;
        }

        if (!confirm(t('timers.deleteConfirm', { name }))) {
            return;
        }

        try {
            await api.delete(`/timers/${id}`);
            showToast(t('timers.deleteSuccess'), 'success');
            await loadTimers();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('timers.deleteError');
            showToast(message, 'error');
        }
    };

    const handleTestTimer = async (id: number, name: string) => {
        if (!canManageTimers) {
            showToast(t('timers.noTestPermission'), 'error');
            return;
        }

        try {
            const res = await api.post(`/timers/${id}/test`);
            showToast(t('timers.testSuccess', { name }), 'success');
            console.log('Test result:', res.data.data);
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('timers.testError');
            showToast(message, 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openEditModal = (timer: Timer) => {
        setEditingTimer({ ...timer });
        setShowEditModal(true);
    };

    const getStreamStatusLabel = (status: string) => {
        switch (status) {
            case 'online': return t('timers.streamOnline');
            case 'offline': return t('timers.streamOffline');
            case 'both': return t('timers.streamBoth');
            default: return status;
        }
    };

    const getStreamStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'text-ds-ok ';
            case 'offline': return 'text-ds-soft ';
            case 'both': return 'text-ds-accent-text ';
            default: return '';
        }
    };

    if (permissionsLoading) {
        return <div className="text-center py-8 text-ds-soft">{t('timers.checkingPermissions')}</div>;
    }

    if (!canManageTimers) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-danger mb-2">{t('timers.accessDenied')}</h2>
                    <p className="text-ds-soft mb-6">
                        {t('timers.accessDeniedDesc')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        {t('timers.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="panel-scale space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-ds-text">{t('timers.title')}</h1>
                    <p className="text-ds-soft mt-1">
                        {t('timers.subtitle')}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="ds-btn ds-btn--primary"
                >
                    <Plus className="w-5 h-5" />
                    {t('timers.createTimer')}
                </button>
            </div>

            {/* Alert de límite */}
            {timers.length >= 20 && (
                <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-ds-warn flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-ds-warn">{t('timers.limitReached')}</p>
                        <p className="text-sm text-ds-warn">
                            {t('timers.limitReachedDesc')}
                        </p>
                    </div>
                </div>
            )}

            {/* Timers List */}
            {loading ? (
                <div className="text-center py-8 text-ds-soft">{t('timers.loading')}</div>
            ) : timers.length === 0 ? (
                <div className="bg-ds-surface rounded-lg p-12 border border-ds-border text-center">
                    <Clock className="w-16 h-16 text-ds-soft mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-ds-text mb-2">
                        {t('timers.noTimers')}
                    </h3>
                    <p className="text-ds-soft mb-6">
                        {t('timers.noTimersDesc')}
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        <Plus className="w-5 h-5" />
                        {t('timers.createFirstTimer')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {timers.map((timer) => (
                        <div
                            key={timer.id}
                            className="bg-ds-surface rounded-lg p-5 border border-ds-border flex flex-col h-full"
                        >
                            {/* Header con nombre y badges */}
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="text-base font-black text-ds-text line-clamp-1 flex-1">
                                    {timer.name}
                                </h3>
                                <div className="flex gap-1 ml-2">
                                    <button
                                        onClick={() => handleTestTimer(timer.id, timer.name)}
                                        className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                        title="Probar timer (envía el mensaje al chat)"
                                    >
                                        <Zap className="w-4 h-4 text-ds-accent-text" />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(timer)}
                                        className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                        title="Editar"
                                    >
                                        <Pencil className="w-4 h-4 text-ds-accent-text" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTimer(timer.id, timer.name)}
                                        className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 text-ds-danger" />
                                    </button>
                                </div>
                            </div>

                            {/* Badges de estado */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {timer.isActive ? (
                                    <span className="text-xs px-2 py-1 rounded bg-ds-ok/10 text-ds-ok font-medium">
                                        {t('timers.active')}
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-1 rounded bg-ds-bg text-ds-soft font-medium">
                                        {t('timers.paused')}
                                    </span>
                                )}
                                <span className={`text-xs px-2 py-1 rounded ${getStreamStatusColor(timer.streamStatus)} bg-opacity-10 font-medium`}>
                                    {getStreamStatusLabel(timer.streamStatus)}
                                </span>
                                <span className="text-xs px-2 py-1 rounded bg-ds-accent/10 text-ds-accent-text font-medium">
                                    P: {timer.priority}
                                </span>
                            </div>

                            {/* Mensaje */}
                            <p className="text-sm text-ds-soft mb-3 line-clamp-3 flex-1">
                                {timer.message}
                            </p>

                            {/* Información de intervalos */}
                            <div className="space-y-2 pt-3 border-t border-ds-border">
                                {timer.intervalMinutes > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-ds-soft">
                                        <Clock className="w-4 h-4 flex-shrink-0" />
                                        <span>{t('timers.everyMinutes', { count: timer.intervalMinutes })}</span>
                                    </div>
                                )}
                                {timer.intervalMessages > 0 && (
                                    <div className="flex items-center gap-2 text-xs text-ds-soft">
                                        <MessageSquare className="w-4 h-4 flex-shrink-0" />
                                        <span>{t('timers.everyMessages', { count: timer.intervalMessages })}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-ds-soft">
                                    <Radio className="w-4 h-4 flex-shrink-0" />
                                    <span>{t('timers.executedCount', { count: timer.executionCount })}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-ds-border">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-ds-text">{t('timers.createTimer')}</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.timerName')}
                                </label>
                                <input
                                    type="text"
                                    value={newTimer.name}
                                    onChange={(e) => setNewTimer({ ...newTimer, name: e.target.value })}
                                    className="ds-input w-full"
                                    placeholder="Ej: Info del Stream"
                                    maxLength={100}
                                />
                            </div>

                            {/* Mensaje */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.message')} ({newTimer.message.length}/500)
                                </label>
                                <textarea
                                    value={newTimer.message}
                                    onChange={(e) => setNewTimer({ ...newTimer, message: e.target.value })}
                                    className="ds-input w-full font-mono"
                                    rows={4}
                                    placeholder="🎮 Jugando $(game) | ⏰ Uptime: $(uptime)"
                                    maxLength={500}
                                />
                                <p className="text-xs text-ds-soft mt-1">
                                    {t('timers.messageHelp')}
                                </p>
                            </div>

                            {/* Categoría (opcional) */}
                            <div>
                                <GameAutocomplete
                                    value={selectedGame}
                                    onChange={setSelectedGame}
                                    placeholder={t('timers.searchCategory')}
                                />
                                <p className="text-xs text-ds-soft mt-1">
                                    {t('timers.categoryHelp')}
                                </p>
                            </div>

                            {/* Intervalos */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ds-text mb-2">
                                        {t('timers.intervalMinutes')}
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        value={newTimer.intervalMinutes}
                                        onChange={(e) => setNewTimer({ ...newTimer, intervalMinutes: parseInt(e.target.value) || 5 })}
                                        className="ds-input w-full"
                                    />
                                    <p className="text-xs text-ds-soft mt-1">{t('timers.minMinutes')}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ds-text mb-2">
                                        {t('timers.intervalMessages')}
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        value={newTimer.intervalMessages}
                                        onChange={(e) => setNewTimer({ ...newTimer, intervalMessages: parseInt(e.target.value) || 5 })}
                                        className="ds-input w-full"
                                    />
                                    <p className="text-xs text-ds-soft mt-1">{t('timers.minMessages')}</p>
                                </div>
                            </div>

                            {/* Stream Status */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.whenToSend')}
                                </label>
                                <select
                                    value={newTimer.streamStatus}
                                    onChange={(e) => setNewTimer({ ...newTimer, streamStatus: e.target.value as 'online' | 'offline' | 'both' })}
                                    className="ds-input w-full"
                                >
                                    <option value="online">{t('timers.onlineOnly')}</option>
                                    <option value="offline">{t('timers.offlineOnly')}</option>
                                    <option value="both">{t('timers.always')}</option>
                                </select>
                            </div>

                            {/* Prioridad */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.priority')}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={newTimer.priority}
                                    onChange={(e) => setNewTimer({ ...newTimer, priority: parseInt(e.target.value) || 1 })}
                                    className="ds-input w-full"
                                />
                                <p className="text-xs text-ds-soft mt-1">
                                    {t('timers.priorityHelp')}
                                </p>
                            </div>

                            {/* Estado */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="createActive"
                                    checked={newTimer.isActive}
                                    onChange={(e) => setNewTimer({ ...newTimer, isActive: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="createActive" className="text-sm font-medium text-ds-text">
                                    {t('timers.timerActive')}
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateTimer}
                                className="ds-btn ds-btn--primary flex-1"
                            >
                                <Save className="w-4 h-4" />
                                {t('timers.createTimer')}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="ds-btn ds-btn--secondary"
                            >
                                {t('timers.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingTimer && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-ds-surface rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-ds-border">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-ds-text">{t('timers.editTimer')}</h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Nombre */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.timerName')}
                                </label>
                                <input
                                    type="text"
                                    value={editingTimer.name}
                                    onChange={(e) => setEditingTimer({ ...editingTimer, name: e.target.value })}
                                    className="ds-input w-full"
                                    maxLength={100}
                                />
                            </div>

                            {/* Mensaje */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.message')} ({editingTimer.message.length}/500)
                                </label>
                                <textarea
                                    value={editingTimer.message}
                                    onChange={(e) => setEditingTimer({ ...editingTimer, message: e.target.value })}
                                    className="ds-input w-full font-mono"
                                    rows={4}
                                    maxLength={500}
                                />
                            </div>

                            {/* Categoría (opcional) */}
                            <div>
                                <GameAutocomplete
                                    value={selectedEditGame}
                                    onChange={setSelectedEditGame}
                                    placeholder={editingTimer.categoryName || t('timers.searchCategory')}
                                />
                                <p className="text-xs text-ds-soft mt-1">
                                    {editingTimer.categoryName ? (
                                        <span dangerouslySetInnerHTML={{ __html: t('timers.categoryEditHelp', { name: editingTimer.categoryName }) }} />
                                    ) : (
                                        <>{t('timers.categoryEditHelpEmpty')}</>
                                    )}
                                </p>
                            </div>

                            {/* Intervalos */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-ds-text mb-2">
                                        {t('timers.intervalMinutes')}
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        value={editingTimer.intervalMinutes}
                                        onChange={(e) => setEditingTimer({ ...editingTimer, intervalMinutes: parseInt(e.target.value) || 5 })}
                                        className="ds-input w-full"
                                    />
                                    <p className="text-xs text-ds-soft mt-1">{t('timers.minMinutes')}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-ds-text mb-2">
                                        {t('timers.intervalMessages')}
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        value={editingTimer.intervalMessages}
                                        onChange={(e) => setEditingTimer({ ...editingTimer, intervalMessages: parseInt(e.target.value) || 5 })}
                                        className="ds-input w-full"
                                    />
                                    <p className="text-xs text-ds-soft mt-1">{t('timers.minMessages')}</p>
                                </div>
                            </div>

                            {/* Stream Status */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.whenToSend')}
                                </label>
                                <select
                                    value={editingTimer.streamStatus}
                                    onChange={(e) => setEditingTimer({ ...editingTimer, streamStatus: e.target.value as 'online' | 'offline' | 'both' })}
                                    className="ds-input w-full"
                                >
                                    <option value="online">{t('timers.onlineOnly')}</option>
                                    <option value="offline">{t('timers.offlineOnly')}</option>
                                    <option value="both">{t('timers.always')}</option>
                                </select>
                            </div>

                            {/* Prioridad */}
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('timers.priority')}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editingTimer.priority}
                                    onChange={(e) => setEditingTimer({ ...editingTimer, priority: parseInt(e.target.value) || 1 })}
                                    className="ds-input w-full"
                                />
                            </div>

                            {/* Estado */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="editActive"
                                    checked={editingTimer.isActive}
                                    onChange={(e) => setEditingTimer({ ...editingTimer, isActive: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="editActive" className="text-sm font-medium text-ds-text">
                                    {t('timers.timerActive')}
                                </label>
                            </div>

                            {/* Stats */}
                            <div className="bg-ds-bg rounded-lg p-4 border border-ds-border">
                                <p className="text-xs text-ds-soft">
                                    Este timer se ha ejecutado <strong>{editingTimer.executionCount}</strong> {editingTimer.executionCount === 1 ? 'vez' : 'veces'}
                                    {editingTimer.lastExecutedAt && (
                                        <> · Última ejecución: {new Date(editingTimer.lastExecutedAt).toLocaleString()}</>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleEditTimer}
                                className="ds-btn ds-btn--primary flex-1"
                            >
                                <Save className="w-4 h-4" />
                                {t('timers.saveChanges')}
                            </button>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="ds-btn ds-btn--secondary"
                            >
                                {t('timers.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className={`px-6 py-3 rounded-lg ${toast.type === 'success' ? 'bg-ds-accent' : 'bg-ds-danger-solid'} text-ds-on-accent font-medium`}>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
