import { Lock, Users, CheckCircle, UserMinus, UserPlus, Ban, RefreshCw, Search, Filter, X, History, ArrowUpDown, ArrowUp, ArrowDown, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation, Trans } from 'react-i18next';
import { Alert, Badge, Segmented } from '../components/ds';

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
    platform: 'twitch' | 'kick';
    history: HistoryEntry[];
}

interface SyncStatus {
    lastAttemptAt: string;
    lastSuccessAt?: string | null;
    source: 'manual' | 'auto';
    result: 'ok' | 'unfollows_skipped' | 'fetch_failed' | 'skipped_large';
    detail?: string | null;
}

type PlatformFilter = 'all' | 'twitch' | 'kick';

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
    const { t, i18n } = useTranslation('followers');
    type SyncWarning = { code: string; missing?: number; received?: number; twitchTotal?: number; detail?: string };
    const [syncWarning, setSyncWarning] = useState<SyncWarning | null>(null);
    const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
    const [available, setAvailable] = useState({ twitch: true, kick: false });
    const [platformCounts, setPlatformCounts] = useState<Record<string, { active: number; total: number }>>({});
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    type LookupResult = {
        found: boolean; userId?: string; resolvedBy?: string; namesSeen?: string[];
        saved?: { userName: string; userLogin: string; followedAt: string; isFollowing: number; unfollowedAt?: string } | null;
        twitch?: { follows: boolean | null; followedAt?: string | null; failure?: string | null };
        chat?: { count: number; first: string; last: string } | null;
    };
    const [lookup, setLookup] = useState<LookupResult | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState(false);
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
    }, [permissionsLoading, currentPage, currentFilter, sortColumn, sortDirection, pageSize, platformFilter]);

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

            params.append('platform', platformFilter);
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
                if (res.data.availablePlatforms) setAvailable(res.data.availablePlatforms);
                setPlatformCounts(res.data.platformCounts ?? {});
                setSyncStatus(res.data.syncStatus ?? null);
                setTotalPages(res.data.pagination.totalPages);
                setTotalCount(res.data.pagination.totalCount);
            }
        } catch (err) {
            console.error('Error loading followers:', err);
            showToast(t('toast.loadError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncFollowers = async (isAutoSync = false) => {
        if (!isAutoSync && !confirm(t('confirm.sync'))) {
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/followers/sync');

            setSyncWarning(res.data.warning ?? null);

            if (res.data.success) {
                const syncStats = res.data.stats;
                setLastSyncTime(new Date());

                if (!isAutoSync) {
                    showToast(
                        t('sync.doneToast', {
                            newFollowers: syncStats.newFollowers,
                            returned: syncStats.returned,
                            renamed: syncStats.renamed ?? 0,
                            unfollowed: syncStats.unfollowed,
                        }),
                        'success'
                    );
                }
                await loadFollowers();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t('toast.syncError');
            if (!isAutoSync) {
                showToast(message, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLookup = async () => {
        setLookupLoading(true);
        setLookupError(false);
        setLookup(null);
        try {
            const res = await api.get('/followers/lookup', { params: { query: searchName } });
            setLookup(res.data);
        } catch {
            setLookupError(true);
        } finally {
            setLookupLoading(false);
        }
    };

    const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '');

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

    const selKey = (f: Follower) => `${f.platform}:${f.userId}`;
    const splitKey = (key: string) => { const i = key.indexOf(':'); return { platform: key.slice(0, i), userId: key.slice(i + 1) }; };

    const handleBlockFollower = async (userId: string, isCurrentlyBlocked: boolean, platform: string) => {
        if (!canModerate) {
            showToast(t('toast.noBlockPermission'), 'error');
            return;
        }

        if (!confirm(t(isCurrentlyBlocked ? 'confirm.unblockOne' : 'confirm.blockOne'))) {
            return;
        }

        try {
            const endpoint = isCurrentlyBlocked ? 'unblock' : 'block';
            const res = await api.post(`/followers/${userId}/${endpoint}`, null, { params: { platform } });

            if (res.data.success) {
                showToast(res.data.message, 'success');
                await loadFollowers();
            }
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message || t(isCurrentlyBlocked ? 'toast.unblockError' : 'toast.blockError');
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
            setSelectedFollowers(followers.map(selKey));
        }
    };

    const handleBulkBlock = async () => {
        if (!canModerate) {
            showToast(t('toast.noBlockPermission'), 'error');
            return;
        }

        if (!confirm(t('confirm.blockMany', { count: selectedFollowers.length }))) {
            return;
        }

        try {
            setLoading(true);
            let successCount = 0;
            let errorCount = 0;

            for (const key of selectedFollowers) {
                const { platform, userId } = splitKey(key);
                try {
                    const res = await api.post(`/followers/${userId}/block`, null, { params: { platform } });
                    if (res.data.success) {
                        successCount++;
                    }
                } catch {
                    errorCount++;
                }
            }

            showToast(
                t('toast.blockedResult', { ok: successCount, errors: errorCount }),
                errorCount > 0 ? 'error' : 'success'
            );

            setSelectedFollowers([]);
            await loadFollowers();
        } catch (err) {
            showToast(t('toast.blockManyError'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUnblock = async () => {
        if (!canModerate) {
            showToast('No tienes permisos para desbloquear usuarios', 'error');
            return;
        }

        if (!confirm(t('confirm.unblockMany', { count: selectedFollowers.length }))) {
            return;
        }

        try {
            setLoading(true);
            let successCount = 0;
            let errorCount = 0;

            for (const key of selectedFollowers) {
                const { platform, userId } = splitKey(key);
                try {
                    const res = await api.post(`/followers/${userId}/unblock`, null, { params: { platform } });
                    if (res.data.success) {
                        successCount++;
                    }
                } catch {
                    errorCount++;
                }
            }

            showToast(
                t('toast.unblockedResult', { ok: successCount, errors: errorCount }),
                errorCount > 0 ? 'error' : 'success'
            );

            setSelectedFollowers([]);
            await loadFollowers();
        } catch (err) {
            showToast(t('toast.unblockManyError'), 'error');
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
            return <ArrowUpDown className="w-4 h-4 text-ds-soft" />;
        }
        return sortDirection === 'asc'
            ? <ArrowUp className="w-4 h-4 text-ds-accent-text" />
            : <ArrowDown className="w-4 h-4 text-ds-accent-text" />;
    };

    // Tiempo relativo en el idioma de la interfaz («hace 25 minutos» / «25 minutes ago»)
    const relativeTime = (iso: string) => {
        const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
        const rtf = new Intl.RelativeTimeFormat(i18n.language === 'en' ? 'en' : 'es', { numeric: 'auto' });
        const abs = Math.abs(diffSec);
        if (abs < 60) return rtf.format(0, 'second');
        if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
        return rtf.format(Math.round(diffSec / 86400), 'day');
    };

    const getLastSyncText = () => {
        if (!lastSyncTime) return 'Nunca';
        const now = new Date();
        const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000); // seconds

        if (diff < 60) return 'Hace unos segundos';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} minutos`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
        return lastSyncTime.toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getActionLabel = (action: number) => {
        switch (action) {
            case 0: return t('action.follow');
            case 1: return t('action.unfollow');
            case 2: return t('action.block');
            case 3: return t('action.unblock');
            default: return t('action.unknown');
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
        return <div className="text-center py-8 text-ds-soft">{t('loading')}</div>;
    }

    if (!hasMinimumLevel('commands')) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-danger mb-2">{t('denied.title')}</h2>
                    <p className="text-ds-soft mb-6">
                        {t('denied.body')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--primary ds-btn--lg"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="panel-scale space-y-6">
            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg ${
                    toast.type === 'success'
                        ? 'bg-ds-accent text-ds-on-accent'
                        : 'bg-ds-danger-solid text-ds-on-accent'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black text-ds-text">{t('header.title')}</h1>
                    <p className="text-ds-soft mt-2">
                        {t(available.twitch && available.kick ? 'header.subtitleBoth' : available.kick ? 'header.subtitleKick' : 'header.subtitleTwitch')}
                    </p>
                </div>
                <div className="flex gap-3 sm:shrink-0">
                    <button
                        onClick={() => handleSyncFollowers(false)}
                        disabled={loading || !available.twitch}
                        title={available.twitch ? undefined : t('sync.noTwitchTitle')}
                        className="ds-btn ds-btn--primary ds-btn--lg w-full sm:w-auto justify-center"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        {available.kick ? t('sync.buttonTwitch') : t('sync.button')}
                    </button>
                </div>
            </div>

            {/* Estado de la sincronización con Twitch y refuerzo del navegador */}
            {available.twitch && platformFilter !== 'kick' ? (
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-ds-text">{t('status.title')}</p>
                        <p className="text-sm text-ds-soft">
                            {!syncStatus
                                ? t('status.never')
                                : syncStatus.result === 'fetch_failed' || syncStatus.result === 'skipped_large'
                                    ? t(syncStatus.result === 'fetch_failed' ? 'status.failed' : 'status.skippedLarge', { when: relativeTime(syncStatus.lastAttemptAt) })
                                    : t('status.line', { when: relativeTime(syncStatus.lastSuccessAt ?? syncStatus.lastAttemptAt), source: t(`status.source.${syncStatus.source}`) })}
                            {syncStatus?.lastSuccessAt && (syncStatus.result === 'fetch_failed' || syncStatus.result === 'skipped_large') && (
                                <> {t('status.lastGood', { when: relativeTime(syncStatus.lastSuccessAt) })}</>
                            )}
                        </p>
                    </div>
                    {syncStatus && (
                        <Badge tone={syncStatus.result === 'ok' ? 'ok' : syncStatus.result === 'unfollows_skipped' ? 'warn' : syncStatus.result === 'fetch_failed' ? 'danger' : undefined}>
                            {t(`status.badge.${syncStatus.result}`)}
                        </Badge>
                    )}
                </div>

                <div className="border-t border-ds-border pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSyncEnabled}
                                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                                className="w-5 h-5 rounded border-ds-border mt-0.5"
                            />
                            <div>
                                <span className="text-sm font-bold text-ds-text">{t('autosync.browserTitle')}</span>
                                <p className="text-xs text-ds-soft max-w-xl">{t('autosync.body')}</p>
                            </div>
                        </label>
                        {autoSyncEnabled && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-ds-soft">{t('autosync.every')}</label>
                                <select
                                    value={autoSyncInterval}
                                    onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
                                    className="ds-input"
                                >
                                    <option value={5}>{t('autosync.minutes', { count: 5 })}</option>
                                    <option value={10}>{t('autosync.minutes', { count: 10 })}</option>
                                    <option value={15}>{t('autosync.minutes', { count: 15 })}</option>
                                    <option value={30}>{t('autosync.minutes', { count: 30 })}</option>
                                    <option value={60}>{t('autosync.hours', { count: 1 })}</option>
                                    <option value={1440}>{t('autosync.hours', { count: 24 })}</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            ) : !available.twitch ? (
                <Alert tone="info" title={t('sync.noTwitchTitle')}>{t('sync.noTwitchBody')}</Alert>
            ) : null}

            {/* Avisos de la última sincronización */}
            {syncWarning?.code === 'fetch_failed' && (
                <Alert tone="danger" title={t('sync.failedTitle')}>{t('sync.failedBody')}</Alert>
            )}
            {syncWarning && syncWarning.code !== 'fetch_failed' && (
                <Alert tone="warn" title={t('sync.skippedTitle')}>
                    <p>{t(`sync.reason.${syncWarning.code}`, { missing: syncWarning.missing, received: syncWarning.received, twitchTotal: syncWarning.twitchTotal })}</p>
                    <p>{t('sync.skippedHint')}</p>
                </Alert>
            )}

            {currentFilter === 'unfollowed' && (
                <Alert tone="info" title={t('note.unfollowDateTitle')}>{t('note.unfollowDateBody')}</Alert>
            )}

            {/* Permission Info */}
            {!canModerate && (
                <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-ds-accent-text" />
                        <p className="text-ds-accent-text font-semibold">
                            {t('limited')}
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-ds-accent/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-ds-accent-text" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-ds-text">{stats.totalFollowers}</div>
                            <div className="text-sm text-ds-soft">{t('stats.total')}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-ds-ok/10 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-ds-ok" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-ds-text">{stats.activeFollowers}</div>
                            <div className="text-sm text-ds-soft">{t('common.active')}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-ds-danger/10 flex items-center justify-center">
                            <UserMinus className="w-6 h-6 text-ds-accent-text" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-ds-text">{stats.unfollowedCount}</div>
                            <div className="text-sm text-ds-soft">{t('common.unfollows')}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-ds-warn/10 flex items-center justify-center">
                            <UserPlus className="w-6 h-6 text-ds-accent-text" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-ds-text">{stats.returnedCount}</div>
                            <div className="text-sm text-ds-soft">{t('common.returned')}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-ds-surface flex items-center justify-center">
                            <Ban className="w-6 h-6 text-ds-soft" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-ds-text">{stats.blockedCount}</div>
                            <div className="text-sm text-ds-soft">{t('common.blocked')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plataforma (solo si la cuenta tiene Twitch y Kick) */}
            {available.twitch && available.kick && (
                <Segmented
                    items={[
                        { id: 'all', label: `${t('filter.all')} (${(platformCounts.twitch?.total ?? 0) + (platformCounts.kick?.total ?? 0)})` },
                        { id: 'twitch', label: `Twitch (${platformCounts.twitch?.total ?? 0})` },
                        { id: 'kick', label: `Kick (${platformCounts.kick?.total ?? 0})` },
                    ]}
                    value={platformFilter}
                    onChange={(v) => { setCurrentPage(1); setSelectedFollowers([]); setPlatformFilter(v as PlatformFilter); }}
                />
            )}
            {available.kick && platformFilter === 'kick' && (
                <Alert tone="info" title={t('kick.title')}>{t('kick.body')}</Alert>
            )}
            {available.kick && platformFilter === 'all' && available.twitch && (
                <p className="text-sm text-ds-soft">{t('kick.short')}</p>
            )}
            {available.kick && !available.twitch && (
                <Alert tone="info" title={t('kick.title')}>{t('kick.body')}</Alert>
            )}

            {/* Search and Filters */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-4">
                <div className="flex gap-3">
                    <div className="flex-1 relative min-w-0">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ds-soft" />
                        <input
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder={t('filters.placeholder')}
                            className="ds-input w-full pl-10 pr-4"
                        />
                    </div>
                    <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className="ds-btn ds-btn--secondary ds-btn--lg shrink-0"
                    >
                        <Filter className="w-5 h-5" />
                        {t('filters.button')}
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setCurrentFilter('all')}
                        className={currentFilter === 'all' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {t('filters.all')}
                    </button>
                    <button
                        onClick={() => setCurrentFilter('active')}
                        className={currentFilter === 'active' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {t('common.active')}
                    </button>
                    <button
                        onClick={() => setCurrentFilter('unfollowed')}
                        className={currentFilter === 'unfollowed' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {t('common.unfollows')}
                    </button>
                    <button
                        onClick={() => setCurrentFilter('returned')}
                        className={currentFilter === 'returned' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {t('common.returned')}
                    </button>
                </div>

                {/* Advanced Search */}
                {showAdvancedSearch && (
                    <div className="pt-4 border-t border-ds-border space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('filters.followFrom')}
                                </label>
                                <input
                                    type="date"
                                    value={followDateFrom}
                                    onChange={(e) => setFollowDateFrom(e.target.value)}
                                    className="ds-input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-ds-text mb-2">
                                    {t('filters.followTo')}
                                </label>
                                <input
                                    type="date"
                                    value={followDateTo}
                                    onChange={(e) => setFollowDateTo(e.target.value)}
                                    className="ds-input w-full"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleApplyAdvancedFilters}
                                className="ds-btn ds-btn--primary ds-btn--lg"
                            >
                                {t('filters.apply')}
                            </button>
                            <button
                                onClick={handleClearFilters}
                                className="ds-btn ds-btn--secondary ds-btn--lg"
                            >
                                {t('filters.clear')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Selection Actions */}
            {canModerate && selectedFollowers.length > 0 && (
                <div className="bg-ds-accent/10 border border-ds-accent rounded-lg p-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedFollowers.length === followers.length}
                                    onChange={handleSelectAll}
                                    className="w-5 h-5 rounded border-ds-border"
                                />
                                <span className="text-sm font-bold text-ds-accent-text">
                                    {t('bulk.selectAll')}
                                </span>
                            </label>
                            <span className="text-ds-accent-text font-semibold">
                                {t('bulk.selected', { count: selectedFollowers.length })}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleBulkBlock}
                                disabled={loading}
                                className="ds-btn ds-btn--danger"
                            >
                                <Ban className="w-4 h-4" />
                                {t('bulk.block')}
                            </button>
                            <button
                                onClick={handleBulkUnblock}
                                disabled={loading}
                                className="ds-btn ds-btn--primary"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t('bulk.unblock')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Followers Table */}
            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                {followers.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="w-16 h-16 text-ds-soft mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-ds-text mb-2">
                            {t('table.emptyTitle')}
                        </h3>
                        <p className="text-ds-soft">
                            {t('table.emptyBody')}
                        </p>
                        {searchName.trim().length >= 2 && available.twitch && platformFilter !== 'kick' && (
                            <div className="mt-6 max-w-xl mx-auto text-left space-y-3">
                                <div className="text-center">
                                    <button onClick={handleLookup} disabled={lookupLoading} className="ds-btn ds-btn--secondary">
                                        <Search className="w-4 h-4" />
                                        {lookupLoading ? t('lookup.searching') : t('lookup.button', { name: searchName.trim() })}
                                    </button>
                                </div>
                                {lookupError && <Alert tone="danger" title={t('lookup.errorTitle')}>{t('lookup.errorBody')}</Alert>}
                                {lookup && !lookup.found && <Alert tone="info" title={t('lookup.notFoundTitle')}>{t('lookup.notFoundBody')}</Alert>}
                                {lookup?.found && (
                                    <Alert
                                        tone={lookup.twitch?.follows ? 'ok' : lookup.twitch?.follows === false ? 'warn' : 'info'}
                                        title={
                                            lookup.twitch?.follows ? t('lookup.followsNow', { date: fmtDate(lookup.twitch.followedAt) })
                                            : lookup.twitch?.follows === false ? t('lookup.notFollowsNow')
                                            : t('lookup.unknown')
                                        }
                                    >
                                        <ul className="list-disc pl-5 space-y-1">
                                            {lookup.twitch?.follows === null && <li>{t('lookup.unknownBody')}</li>}
                                            {lookup.namesSeen && lookup.namesSeen.length > 1 && <li>{t('lookup.names', { names: lookup.namesSeen.join(', ') })}</li>}
                                            {lookup.saved
                                                ? <li>{t('lookup.saved', { date: fmtDate(lookup.saved.followedAt) })}</li>
                                                : <li>{t('lookup.notSaved')}</li>}
                                            {lookup.chat && <li>{t('lookup.chat', { count: lookup.chat.count, first: fmtDate(lookup.chat.first), last: fmtDate(lookup.chat.last) })}</li>}
                                            {lookup.twitch?.follows === false && !lookup.saved && <li>{t('lookup.gapExplain')}</li>}
                                            {lookup.twitch?.follows === true && !lookup.saved && <li>{t('lookup.missingBug')}</li>}
                                        </ul>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-ds-bg border-b border-ds-border">
                                <tr>
                                    {canModerate && (
                                        <th className="px-6 py-4 text-left text-xs font-bold text-ds-soft uppercase tracking-wider w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedFollowers.length === followers.length && followers.length > 0}
                                                onChange={handleSelectAll}
                                                className="w-5 h-5 rounded border-ds-border"
                                            />
                                        </th>
                                    )}
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-ds-soft uppercase tracking-wider cursor-pointer hover:bg-ds-raised transition-colors"
                                        onClick={() => handleSort('userName')}
                                    >
                                        <div className="flex items-center gap-2">
                                            {t('table.user')}
                                            {getSortIcon('userName')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-ds-soft uppercase tracking-wider cursor-pointer hover:bg-ds-raised transition-colors"
                                        onClick={() => handleSort('followedAt')}
                                    >
                                        <div className="flex items-center gap-2">
                                            {t('table.followedSince')}
                                            {getSortIcon('followedAt')}
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-4 text-left text-xs font-bold text-ds-soft uppercase tracking-wider cursor-pointer hover:bg-ds-raised transition-colors"
                                        onClick={() => handleSort('isFollowing')}
                                    >
                                        <div className="flex items-center gap-2">
                                            {t('table.status')}
                                            {getSortIcon('isFollowing')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-ds-soft uppercase tracking-wider">
                                        {t('table.actions')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ds-border">
                                {followers.map((follower) => (
                                    <tr key={follower.id} className="hover:bg-ds-bg transition-colors">
                                        {canModerate && (
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedFollowers.includes(selKey(follower))}
                                                    onChange={() => handleSelectFollower(selKey(follower))}
                                                    className="w-5 h-5 rounded border-ds-border"
                                                />
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-ds-text">{follower.userName}</span>
                                                    {available.twitch && available.kick && <Badge>{t(`platform.${follower.platform}`)}</Badge>}
                                                </div>
                                                <div className="text-sm text-ds-soft">@{follower.userLogin}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-ds-soft">
                                            {follower.followedAt ? new Date(follower.followedAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit'
                                            }) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {follower.isFollowing === 0 ? (
                                                    <span className="px-3 py-1 bg-ds-ok/10 text-ds-ok rounded-full text-xs font-bold">
                                                        {t('badge.active')}
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 bg-ds-danger/10 text-ds-danger rounded-full text-xs font-bold">
                                                        {t('badge.unfollowed')}
                                                    </span>
                                                )}
                                                {isReturnedFollower(follower) && (
                                                    <span className="px-3 py-1 bg-ds-warn/10 text-ds-warn rounded-full text-xs font-bold">
                                                        {t('badge.returned')}
                                                    </span>
                                                )}
                                                {follower.isBlocked === 1 && (
                                                    <span className="px-3 py-1 bg-ds-bg text-ds-soft rounded-full text-xs font-bold">
                                                        {t('badge.blocked')}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewHistory(follower)}
                                                    className="ds-btn ds-btn--ghost ds-icon-btn"
                                                    title={t('actions.history')}
                                                >
                                                    <History className="w-4 h-4 text-ds-accent-text" />
                                                </button>
                                                {canModerate && (
                                                    <button
                                                        onClick={() => handleBlockFollower(follower.userId, follower.isBlocked === 1, follower.platform)}
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            follower.isBlocked === 1
                                                                ? 'hover:bg-ds-accent/10 '
                                                                : 'hover:bg-[#fee2e2] '
                                                        }`}
                                                        title={follower.isBlocked === 1 ? t('actions.unblock') : t('actions.block')}
                                                    >
                                                        <Ban className={`w-4 h-4 ${
                                                            follower.isBlocked === 1
                                                                ? 'text-ds-accent-text '
                                                                : 'text-ds-danger '
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
                <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Item Counter & Page Size Selector */}
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-ds-soft">
                                <Trans i18nKey="pager.showing" ns="followers" values={{ range: `${getItemRange().start}-${getItemRange().end}`, total: totalCount }} components={{ b: <span className="font-bold text-ds-text" /> }} />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-ds-soft">
                                    {t('pager.perPage')}
                                </label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                    className="ds-input"
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
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                                title={t('pager.first')}
                            >
                                <ChevronsLeft className="w-4 h-4" />
                            </button>

                            {/* Previous Page */}
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                                title={t('pager.prev')}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {/* Page Numbers */}
                            {getPageNumbers().map((page, idx) => (
                                typeof page === 'number' ? (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentPage(page)}
                                        className={currentPage === page ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                                    >
                                        {page}
                                    </button>
                                ) : (
                                    <span key={idx} className="px-2 text-ds-soft">
                                        {page}
                                    </span>
                                )
                            ))}

                            {/* Next Page */}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                                title={t('pager.next')}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Last Page */}
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                                title={t('pager.last')}
                            >
                                <ChevronsRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-ds-input/50 flex items-center justify-center z-50">
                    <div className="bg-ds-surface rounded-lg p-6 max-w-md w-full mx-4 border border-ds-border">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-ds-text">
                                {t('history.title', { name: selectedFollowerName })}
                            </h2>
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="ds-btn ds-btn--ghost ds-icon-btn"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {selectedFollowerHistory.length === 0 ? (
                                <p className="text-center text-ds-soft py-4">
                                    {t('history.empty')}
                                </p>
                            ) : (
                                selectedFollowerHistory.map((entry) => (
                                    <div key={`${entry.actionTimestamp}-${entry.action}`} className="flex items-start gap-3 p-3 bg-ds-bg rounded-lg">
                                        <div className="mt-1">
                                            {getActionIcon(entry.action)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-ds-text">
                                                {getActionLabel(entry.action)}
                                            </div>
                                            <div className="text-sm text-ds-soft">
                                                {entry.actionTimestamp ? new Date(entry.actionTimestamp).toLocaleString(i18n.language === 'en' ? 'en-US' : 'es-ES', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : t('history.noDate')}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="ds-btn ds-btn--secondary ds-btn--lg"
                            >
                                {t('history.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
