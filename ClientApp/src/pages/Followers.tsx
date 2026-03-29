import { Lock, Users, CheckCircle, UserMinus, UserPlus, Ban, RefreshCw, Search, Filter, X, History, ArrowUpDown, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface Follower {
    id: number;
    userId: string;
    userName: string;
    userLogin: string;
    followedAt: string;
    accountCreatedAt?: string;
    isFollowing: number;
    unfollowedAt?: string;
    isBlocked: number;
    wasBlocked: number;
    history: HistoryEntry[];
}

interface HistoryEntry {
    action: number; // 0=Follow, 1=Unfollow, 2=Block, 3=Unblock
    actionTimestamp: string;
}

interface Stats {
    totalFollowers: number;
    activeFollowers: number;
    unfollowedCount: number;
    blockedCount: number;
    returnedCount: number;
}

interface Toast {
    message: string;
    type: 'success' | 'error';
}

export default function Followers() {
    const { hasMinimumLevel, loading: permissionsLoading, channelOwnerId } = usePermissions();
    const navigate = useNavigate();
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [stats, setStats] = useState<Stats>({
        totalFollowers: 0,
        activeFollowers: 0,
        unfollowedCount: 0,
        blockedCount: 0,
        returnedCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [currentFilter, setCurrentFilter] = useState('all');
    const [searchName, setSearchName] = useState('');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [followDateFrom, setFollowDateFrom] = useState('');
    const [followDateTo, setFollowDateTo] = useState('');
    const [createDateFrom, setCreateDateFrom] = useState('');
    const [createDateTo, setCreateDateTo] = useState('');
    const [toast, setToast] = useState<Toast | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedFollowerHistory, setSelectedFollowerHistory] = useState<HistoryEntry[]>([]);
    const [selectedFollowerName, setSelectedFollowerName] = useState('');
    const [selectedFollowers, setSelectedFollowers] = useState<string[]>([]);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Estados de auto-sync específicos por canal
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [autoSyncInterval, setAutoSyncInterval] = useState(5);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false); // Bandera para saber si ya se cargó la config

    const canModerate = hasMinimumLevel('moderation');

    // Cargar configuración de auto-sync cuando cambia el canal
    useEffect(() => {
        if (channelOwnerId) {
            console.log(`📥 Cargando config de auto-sync para canal ${channelOwnerId}`);
            const savedEnabled = localStorage.getItem(`followers-auto-sync-enabled-${channelOwnerId}`);
            const savedInterval = localStorage.getItem(`followers-auto-sync-interval-${channelOwnerId}`);

            console.log(`📥 Valores encontrados: enabled=${savedEnabled}, interval=${savedInterval}`);

            if (savedEnabled !== null) {
                setAutoSyncEnabled(savedEnabled === 'true');
            } else {
                setAutoSyncEnabled(false); // Default si no existe
            }

            if (savedInterval !== null) {
                setAutoSyncInterval(parseInt(savedInterval));
            } else {
                setAutoSyncInterval(5); // Default si no existe
            }

            setConfigLoaded(true); // Marcar que ya se cargó
        }
    }, [channelOwnerId]);

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            loadFollowers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading, currentPage, currentFilter, sortColumn, sortDirection, pageSize]);

    // Búsqueda en tiempo real con debounce
    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('commands')) {
            const timeoutId = setTimeout(() => {
                setCurrentPage(1); // Reset a página 1 cuando cambia la búsqueda
                loadFollowers();
            }, 500); // Espera 500ms después de que el usuario deja de escribir

            return () => clearTimeout(timeoutId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchName]);

    // Auto-sync
    useEffect(() => {
        if (!autoSyncEnabled || !hasMinimumLevel('commands')) {
            return;
        }

        const intervalMs = autoSyncInterval * 60 * 1000; // Convert minutes to milliseconds
        const intervalId = setInterval(() => {
            handleSyncFollowers(true); // true = auto sync (no confirmation)
        }, intervalMs);

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSyncEnabled, autoSyncInterval]);

    // Persist auto-sync settings (específico por canal) - SOLO después de cargar
    useEffect(() => {
        if (channelOwnerId && configLoaded) {
            localStorage.setItem(`followers-auto-sync-enabled-${channelOwnerId}`, autoSyncEnabled.toString());
        }
    }, [autoSyncEnabled, channelOwnerId, configLoaded]);

    useEffect(() => {
        if (channelOwnerId && configLoaded) {
            localStorage.setItem(`followers-auto-sync-interval-${channelOwnerId}`, autoSyncInterval.toString());
        }
    }, [autoSyncInterval, channelOwnerId, configLoaded]);

    const loadFollowers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                pageSize: pageSize.toString()
            });

            if (currentFilter === 'active') params.append('isFollowing', '0');
            if (currentFilter === 'unfollowed') params.append('isFollowing', '1');
            if (searchName) params.append('searchName', searchName);
            if (followDateFrom) params.append('followDateFrom', followDateFrom);
            if (followDateTo) params.append('followDateTo', followDateTo);
            if (createDateFrom) params.append('createDateFrom', createDateFrom);
            if (createDateTo) params.append('createDateTo', createDateTo);
            if (sortColumn) {
                params.append('orderBy', sortColumn);
                params.append('orderDirection', sortDirection);
            }

            const res = await api.get(`/followers?${params.toString()}`);
            if (res.data.success) {
                setFollowers(res.data.followers);
                setStats(res.data.stats);
                setTotalPages(res.data.pagination.totalPages);
                setTotalCount(res.data.pagination.totalCount);
            }
        } catch (err) {
            console.error('Error loading followers:', err);
            showToast('Error al cargar seguidores', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncFollowers = async (isAutoSync = false) => {
        if (!isAutoSync && !confirm('¿Deseas sincronizar los seguidores con Twitch? Esto puede tardar unos momentos.')) {
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/followers/sync');

            if (res.data.success) {
                const syncStats = res.data.stats;
                setLastSyncTime(new Date());

                if (!isAutoSync) {
                    showToast(
                        `Sincronización completada: ${syncStats.newFollowers} nuevos, ${syncStats.returned} retornados, ${syncStats.unfollowed} unfollowed`,
                        'success'
                    );
                }
                await loadFollowers();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al sincronizar seguidores';
            if (!isAutoSync) {
                showToast(message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApplyAdvancedFilters = () => {
        setCurrentPage(1);
        loadFollowers();
    };

    const handleClearFilters = () => {
        setSearchName('');
        setFollowDateFrom('');
        setFollowDateTo('');
        setCreateDateFrom('');
        setCreateDateTo('');
        setCurrentFilter('all');
        setCurrentPage(1);
        setSortColumn(null);
        setSortDirection('asc');
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to ascending
            setSortColumn(column);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page when sorting
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1); // Reset to first page when changing page size
    };

    const getItemRange = () => {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, totalCount);
        return { start, end };
    };

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            // Calculate range around current page
            let startPage = Math.max(2, currentPage - 1);
            let endPage = Math.min(totalPages - 1, currentPage + 1);

            // Add ellipsis if needed
            if (startPage > 2) {
                pages.push('...');
            }

            // Add pages around current
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }

            // Add ellipsis if needed
            if (endPage < totalPages - 1) {
                pages.push('...');
            }

            // Always show last page
            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const handleBlockFollower = async (userId: string, isCurrentlyBlocked: boolean) => {
        if (!canModerate) {
            showToast('No tienes permisos para bloquear usuarios', 'error');
            return;
        }

        const action = isCurrentlyBlocked ? 'desbloquear' : 'bloquear';
        if (!confirm(`¿Estás seguro de ${action} este usuario?`)) {
            return;
        }

        try {
            const endpoint = isCurrentlyBlocked ? 'unblock' : 'block';
            const res = await api.post(`/followers/${userId}/${endpoint}`);

            if (res.data.success) {
                showToast(res.data.message, 'success');
                await loadFollowers();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || `Error al ${action} usuario`;
            showToast(message, 'error');
        }
    };

    const handleViewHistory = (follower: Follower) => {
        setSelectedFollowerHistory(follower.history);
        setSelectedFollowerName(follower.userName);
        setShowHistoryModal(true);
    };

    const handleSelectFollower = (userId: string) => {
        setSelectedFollowers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectAll = () => {
        if (selectedFollowers.length === followers.length) {
            setSelectedFollowers([]);
        } else {
            setSelectedFollowers(followers.map(f => f.userId));
        }
    };

    const handleBulkBlock = async () => {
        if (!canModerate) {
            showToast('No tienes permisos para bloquear usuarios', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de bloquear ${selectedFollowers.length} usuarios seleccionados?`)) {
            return;
        }

        try {
            setLoading(true);
            let successCount = 0;
            let errorCount = 0;

            for (const userId of selectedFollowers) {
                try {
                    const res = await api.post(`/followers/${userId}/block`);
                    if (res.data.success) {
                        successCount++;
                    }
                } catch {
                    errorCount++;
                }
            }

            showToast(
                `Bloqueados: ${successCount}, Errores: ${errorCount}`,
                errorCount > 0 ? 'error' : 'success'
            );

            setSelectedFollowers([]);
            await loadFollowers();
        } catch (err) {
            showToast('Error al bloquear usuarios', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUnblock = async () => {
        if (!canModerate) {
            showToast('No tienes permisos para desbloquear usuarios', 'error');
            return;
        }

        if (!confirm(`¿Estás seguro de desbloquear ${selectedFollowers.length} usuarios seleccionados?`)) {
            return;
        }

        try {
            setLoading(true);
            let successCount = 0;
            let errorCount = 0;

            for (const userId of selectedFollowers) {
                try {
                    const res = await api.post(`/followers/${userId}/unblock`);
                    if (res.data.success) {
                        successCount++;
                    }
                } catch {
                    errorCount++;
                }
            }

            showToast(
                `Desbloqueados: ${successCount}, Errores: ${errorCount}`,
                errorCount > 0 ? 'error' : 'success'
            );

            setSelectedFollowers([]);
            await loadFollowers();
        } catch (err) {
            showToast('Error al desbloquear usuarios', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getSortIcon = (column: string) => {
        if (sortColumn !== column) {
            return <ArrowUpDown className="w-4 h-4 text-[#94a3b8]" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="w-4 h-4 text-[#2563eb]" />
            : <ArrowDown className="w-4 h-4 text-[#2563eb]" />;
    };

    const getLastSyncText = () => {
        if (!lastSyncTime) return 'Nunca';
        const now = new Date();
        const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000); // seconds

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
        return lastSyncTime.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionLabel = (action: number) => {
        switch (action) {
            case 0: return 'Follow';
            case 1: return 'Unfollow';
            case 2: return 'Bloqueo';
            case 3: return 'Desbloqueo';
            default: return 'Desconocido';
        }
    };

    const getActionIcon = (action: number) => {
        switch (action) {
            case 0: return <UserPlus className="w-4 h-4" />;
            case 1: return <UserMinus className="w-4 h-4" />;
            case 2: return <Ban className="w-4 h-4" />;
            case 3: return <CheckCircle className="w-4 h-4" />;
            default: return null;
        }
    };

    const isReturnedFollower = (follower: Follower) => {
        return follower.isFollowing === 0 &&
            follower.history &&
            follower.history.some(h => h.action === 1);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">Cargando seguidores...</div>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso Denegado</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        No tienes permisos suficientes para acceder a la gestión de seguidores. Se requiere nivel de acceso "Comandos" o superior.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg ${
                    toast.type === 'success'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Gestión de Seguidores</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                        Administra y analiza tu comunidad de seguidores de Twitch
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSyncFollowers(false)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-3 bg-[#2563eb] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </button>
                </div>
            </div>

            {/* Auto-Sync Settings */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSyncEnabled}
                                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                                className="w-5 h-5 rounded border-[#e2e8f0] dark:border-[#374151]"
                            />
                            <div>
                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Sincronización automática
                                </span>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Última sincronización: {getLastSyncText()}
                                </p>
                            </div>
                        </label>
                        {autoSyncEnabled && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    Cada:
                                </label>
                                <select
                                    value={autoSyncInterval}
                                    onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                                    className="px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] text-sm font-bold"
                                >
                                    <option value={5}>5 minutos</option>
                                    <option value={10}>10 minutos</option>
                                    <option value={15}>15 minutos</option>
                                    <option value={30}>30 minutos</option>
                                    <option value={60}>1 hora</option>
                                    <option value={1440}>24 horas</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {autoSyncEnabled && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                Auto-sync activo
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Permission Info */}
            {!canModerate && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-700 dark:text-blue-300 font-semibold">
                            Modo limitado - Se requiere nivel "Moderación" o superior para bloquear o silenciar usuarios
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <Users className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.totalFollowers}</div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">Total</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.activeFollowers}</div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">Activos</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                            <UserMinus className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.unfollowedCount}</div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">Unfollows</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                            <UserPlus className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.returnedCount}</div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">Retornados</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center">
                            <Ban className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">{stats.blockedCount}</div>
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">Bloqueados</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 space-y-4">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder="Buscar por nombre o username (búsqueda automática)..."
                            className="w-full pl-10 pr-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                        />
                    </div>
                    <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className="px-6 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all flex items-center gap-2"
                    >
                        <Filter className="w-5 h-5" />
                        Filtros
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentFilter('all')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            currentFilter === 'all'
                                ? 'bg-[#2563eb] text-white'
                                : 'bg-[#f1f5f9] dark:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563]'
                        }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setCurrentFilter('active')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            currentFilter === 'active'
                                ? 'bg-[#2563eb] text-white'
                                : 'bg-[#f1f5f9] dark:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563]'
                        }`}
                    >
                        Activos
                    </button>
                    <button
                        onClick={() => setCurrentFilter('unfollowed')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            currentFilter === 'unfollowed'
                                ? 'bg-[#2563eb] text-white'
                                : 'bg-[#f1f5f9] dark:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563]'
                        }`}
                    >
                        Unfollows
                    </button>
                    <button
                        onClick={() => setCurrentFilter('returned')}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                            currentFilter === 'returned'
                                ? 'bg-[#2563eb] text-white'
                                : 'bg-[#f1f5f9] dark:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563]'
                        }`}
                    >
                        Retornados
                    </button>
                </div>

                {/* Advanced Search */}
                {showAdvancedSearch && (
                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Fecha de follow desde:
                                </label>
                                <input
                                    type="date"
                                    value={followDateFrom}
                                    onChange={(e) => setFollowDateFrom(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                                    Fecha de follow hasta:
                                </label>
                                <input
                                    type="date"
                                    value={followDateTo}
                                    onChange={(e) => setFollowDateTo(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleApplyAdvancedFilters}
                                className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                            >
                                Aplicar Filtros
                            </button>
                            <button
                                onClick={handleClearFilters}
                                className="px-6 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Selection Actions */}
            {canModerate && selectedFollowers.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedFollowers.length === followers.length}
                                    onChange={handleSelectAll}
                                    className="w-5 h-5 rounded border-[#e2e8f0] dark:border-[#374151]"
                                />
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                    Seleccionar todos
                                </span>
                            </label>
                            <span className="text-blue-700 dark:text-blue-300 font-semibold">
                                {selectedFollowers.length} seleccionados
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleBulkBlock}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                            >
                                <Ban className="w-4 h-4" />
                                Bloquear seleccionados
                            </button>
                            <button
                                onClick={handleBulkUnblock}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Desbloquear seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Followers Table */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
                {followers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-[#64748b] dark:text-[#94a3b8] mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            No hay seguidores
                        </h3>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            No se encontraron seguidores con los filtros aplicados
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#f8fafc] dark:bg-[#262626] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <tr>
                                    {canModerate && (
                                        <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedFollowers.length === followers.length && followers.length > 0}
                                                onChange={handleSelectAll}
                                                className="w-5 h-5 rounded border-[#e2e8f0] dark:border-[#374151]"
                                            />
                                        </th>
                                    )}
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                                        onClick={() => handleSort('userName')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Usuario
                                            {getSortIcon('userName')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                                        onClick={() => handleSort('followedAt')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Seguido desde
                                            {getSortIcon('followedAt')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                                        onClick={() => handleSort('isFollowing')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Estado
                                            {getSortIcon('isFollowing')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                                {followers.map((follower) => (
                                    <tr key={follower.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors">
                                        {canModerate && (
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFollowers.includes(follower.userId)}
                                                    onChange={() => handleSelectFollower(follower.userId)}
                                                    className="w-5 h-5 rounded border-[#e2e8f0] dark:border-[#374151]"
                                                />
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{follower.userName}</div>
                                                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">@{follower.userLogin}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[#64748b] dark:text-[#94a3b8]">
                                            {follower.followedAt ? new Date(follower.followedAt).toLocaleDateString('es-ES', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit'
                                            }) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {follower.isFollowing === 0 ? (
                                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold">
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full text-xs font-bold">
                                                        Unfollowed
                                                    </span>
                                                )}
                                                {isReturnedFollower(follower) && (
                                                    <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold">
                                                        Retornado
                                                    </span>
                                                )}
                                                {follower.isBlocked === 1 && (
                                                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 rounded-full text-xs font-bold">
                                                        Bloqueado
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewHistory(follower)}
                                                    className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    title="Ver historial"
                                                >
                                                    <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </button>
                                                {canModerate && (
                                                    <button
                                                        onClick={() => handleBlockFollower(follower.userId, follower.isBlocked === 1)}
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            follower.isBlocked === 1
                                                                ? 'hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                                : 'hover:bg-[#fee2e2] dark:hover:bg-red-900/30'
                                                        }`}
                                                        title={follower.isBlocked === 1 ? 'Desbloquear' : 'Bloquear'}
                                                    >
                                                        <Ban className={`w-4 h-4 ${
                                                            follower.isBlocked === 1
                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                        }`} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Item Counter & Page Size Selector */}
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Mostrando <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{getItemRange().start}-{getItemRange().end}</span> de <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{totalCount}</span> seguidores
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                    Por página:
                                </label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                    className="px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] text-sm font-bold"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {/* Page Navigation */}
                        <div className="flex items-center gap-2">
                            {/* First Page */}
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-2 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] disabled:opacity-50 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc] rounded-lg transition-all"
                                title="Primera página"
                            >
                                <ChevronsLeft className="w-4 h-4" />
                            </button>

                            {/* Previous Page */}
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] disabled:opacity-50 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc] rounded-lg transition-all"
                                title="Página anterior"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {/* Page Numbers */}
                            {getPageNumbers().map((page, idx) => (
                                typeof page === 'number' ? (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                            currentPage === page
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc]'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span key={idx} className="px-2 text-[#64748b] dark:text-[#94a3b8]">
                                        {page}
                                    </span>
                                )
                            ))}

                            {/* Next Page */}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] disabled:opacity-50 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc] rounded-lg transition-all"
                                title="Página siguiente"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Last Page */}
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="p-2 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] disabled:opacity-50 disabled:cursor-not-allowed text-[#1e293b] dark:text-[#f8fafc] rounded-lg transition-all"
                                title="Última página"
                            >
                                <ChevronsRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-md w-full mx-4 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                Historial de {selectedFollowerName}
                            </h2>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {selectedFollowerHistory.length === 0 ? (
                                <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-4">
                                    No hay historial disponible
                                </p>
                            ) : (
                                selectedFollowerHistory.map((entry) => (
                                    <div key={`${entry.actionTimestamp}-${entry.action}`} className="flex items-start gap-3 p-3 bg-[#f8fafc] dark:bg-[#262626] rounded-lg">
                                        <div className="mt-1">
                                            {getActionIcon(entry.action)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                {getActionLabel(entry.action)}
                                            </div>
                                            <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                                {entry.actionTimestamp ? new Date(entry.actionTimestamp).toLocaleString('es-ES', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : 'Fecha no disponible'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="px-6 py-3 bg-[#f1f5f9] dark:bg-[#374151] hover:bg-[#e2e8f0] dark:hover:bg-[#4b5563] text-[#1e293b] dark:text-[#f8fafc] font-bold rounded-lg transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
