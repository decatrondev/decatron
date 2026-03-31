import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Code2, Plus, ExternalLink, Shield, CheckCircle, XCircle,
    Copy, Eye, EyeOff, Trash2, RefreshCw, Key, AlertTriangle,
    Loader2, BookOpen, ArrowLeft, Users, Zap, Activity
} from 'lucide-react';
import api from '../../services/api';

interface OAuthApp {
    id: string;
    name: string;
    description: string | null;
    client_id: string;
    icon_url: string | null;
    website_url: string | null;
    redirect_uris: string[];
    scopes: string[];
    is_active: boolean;
    is_verified: boolean;
    created_at: string;
    updated_at: string | null;
}

interface AppStats {
    unique_users: number;
    total_tokens: number;
    active_tokens: number;
    last_token_at: string | null;
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export default function DeveloperPortal() {
    const [apps, setApps] = useState<OAuthApp[]>([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [selectedApp, setSelectedApp] = useState<OAuthApp | null>(null);
    const [selectedAppStats, setSelectedAppStats] = useState<AppStats | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [newSecret, setNewSecret] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        loadApps();
    }, []);

    const addToast = (message: string, type: 'success' | 'error' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const loadApps = async () => {
        try {
            setLoading(true);
            const res = await api.get('/developer/apps');
            if (res.data.success) {
                setApps(res.data.apps);
            }
        } catch (err) {
            addToast('Error al cargar aplicaciones', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadAppDetails = async (app: OAuthApp) => {
        try {
            const res = await api.get(`/developer/apps/${app.id}`);
            if (res.data.success) {
                setSelectedApp(res.data.app);
                setSelectedAppStats(res.data.stats);
                setNewSecret(null);
                setShowSecret(false);
            }
        } catch (err) {
            addToast('Error al cargar detalles', 'error');
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast(`${label} copiado`, 'success');
        } catch (err) {
            addToast('Error al copiar', 'error');
        }
    };

    const regenerateSecret = async () => {
        if (!selectedApp) return;
        try {
            setRegenerating(true);
            const res = await api.post(`/developer/apps/${selectedApp.id}/regenerate-secret`);
            if (res.data.success) {
                setNewSecret(res.data.client_secret);
                addToast('Secret regenerado. Tokens existentes revocados.', 'info');
            }
        } catch (err) {
            addToast('Error al regenerar secret', 'error');
        } finally {
            setRegenerating(false);
        }
    };

    const deleteApp = async (appId: string) => {
        try {
            setDeleting(true);
            const res = await api.delete(`/developer/apps/${appId}`);
            if (res.data.success) {
                addToast('Aplicacion eliminada', 'success');
                setApps(prev => prev.filter(a => a.id !== appId));
                setSelectedApp(null);
                setConfirmDelete(null);
            }
        } catch (err) {
            addToast('Error al eliminar aplicacion', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-white text-sm font-medium ${
                            toast.type === 'success' ? 'bg-green-600' :
                            toast.type === 'error' ? 'bg-red-600' :
                            'bg-[#2563eb]'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
                        {toast.type === 'error' && <XCircle className="w-4 h-4" />}
                        {toast.type === 'info' && <AlertTriangle className="w-4 h-4" />}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                            <Code2 className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                                Portal de Desarrolladores
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Gestiona tus aplicaciones OAuth y acceso a la API
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/docs/api"
                            className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] transition-colors text-sm"
                        >
                            <BookOpen className="w-4 h-4" />
                            API Docs
                        </Link>
                        <button
                            onClick={() => navigate('/developer/apps/new')}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva App
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                </div>
            )}

            {/* Empty State */}
            {!loading && apps.length === 0 && (
                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 text-center border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="w-20 h-20 mx-auto mb-6 bg-[#f8fafc] dark:bg-[#374151] rounded-2xl flex items-center justify-center">
                        <Code2 className="w-10 h-10 text-[#64748b]" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Sin aplicaciones</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6 max-w-md mx-auto">
                        Crea tu primera aplicacion OAuth para empezar a usar la API de Decatron.
                    </p>
                    <button
                        onClick={() => navigate('/developer/apps/new')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Crear tu primera app
                    </button>
                </div>
            )}

            {/* Apps List + Details */}
            {!loading && apps.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Apps Column */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tus Aplicaciones</h2>
                        {apps.map(app => (
                            <div
                                key={app.id}
                                onClick={() => loadAppDetails(app)}
                                className={`bg-white dark:bg-[#1B1C1D] rounded-xl p-4 cursor-pointer transition-all border-2 hover:border-[#2563eb] ${
                                    selectedApp?.id === app.id
                                        ? 'border-[#2563eb]'
                                        : 'border-[#e2e8f0] dark:border-[#374151]'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {app.icon_url ? (
                                        <img src={app.icon_url} alt={app.name} className="w-11 h-11 rounded-xl object-cover" />
                                    ) : (
                                        <div className="w-11 h-11 bg-[#f8fafc] dark:bg-[#374151] rounded-xl flex items-center justify-center">
                                            <Code2 className="w-5 h-5 text-[#64748b]" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900 dark:text-white truncate">{app.name}</h3>
                                            {app.is_verified && (
                                                <Shield className="w-4 h-4 text-[#2563eb]" title="Verificada" />
                                            )}
                                            <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${
                                                app.is_active
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                            }`}>
                                                {app.is_active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] truncate mt-1">
                                            {app.description || 'Sin descripcion'}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            <span>{app.scopes.length} scopes</span>
                                            <span>Creada {formatDate(app.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Details Column */}
                    <div>
                        {selectedApp ? (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] sticky top-6">
                                {/* App Header */}
                                <div className="flex items-start gap-4 mb-6">
                                    {selectedApp.icon_url ? (
                                        <img src={selectedApp.icon_url} alt={selectedApp.name} className="w-14 h-14 rounded-2xl object-cover" />
                                    ) : (
                                        <div className="w-14 h-14 bg-[#f8fafc] dark:bg-[#374151] rounded-2xl flex items-center justify-center">
                                            <Code2 className="w-7 h-7 text-[#64748b]" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <h2 className="text-xl font-black text-gray-900 dark:text-white">{selectedApp.name}</h2>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            {selectedApp.description || 'Sin descripcion'}
                                        </p>
                                        {selectedApp.website_url && (
                                            <a
                                                href={selectedApp.website_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[#2563eb] text-sm mt-2 hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Website
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Credentials */}
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-1">Client ID</label>
                                        <div className="flex items-center gap-2 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151]">
                                            <code className="flex-1 text-sm font-mono text-[#2563eb] break-all">
                                                {selectedApp.client_id}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(selectedApp.client_id, 'Client ID')}
                                                className="p-1.5 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                            >
                                                <Copy className="w-4 h-4 text-[#64748b]" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-1">Client Secret</label>
                                        {newSecret ? (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
                                                <p className="text-amber-700 dark:text-amber-400 text-xs mb-2 flex items-center gap-1 font-medium">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Guarda este secret ahora - no se mostrara de nuevo
                                                </p>
                                                <div className="flex items-center gap-2 bg-white dark:bg-[#1B1C1D] rounded-lg p-2 border border-[#e2e8f0] dark:border-[#374151]">
                                                    <code className="flex-1 text-sm font-mono text-amber-700 dark:text-amber-400 break-all">
                                                        {showSecret ? newSecret : '••••••••••••••••••••••••'}
                                                    </code>
                                                    <button
                                                        onClick={() => setShowSecret(!showSecret)}
                                                        className="p-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    >
                                                        {showSecret ? <EyeOff className="w-4 h-4 text-[#64748b]" /> : <Eye className="w-4 h-4 text-[#64748b]" />}
                                                    </button>
                                                    <button
                                                        onClick={() => copyToClipboard(newSecret, 'Client Secret')}
                                                        className="p-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                                    >
                                                        <Copy className="w-4 h-4 text-[#64748b]" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151]">
                                                <code className="flex-1 text-sm font-mono text-[#64748b]">
                                                    ••••••••••••••••••••
                                                </code>
                                                <button
                                                    onClick={regenerateSecret}
                                                    disabled={regenerating}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {regenerating ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="w-3 h-3" />
                                                    )}
                                                    Regenerar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Redirect URIs */}
                                <div className="mb-6">
                                    <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-2">Redirect URIs</label>
                                    <div className="space-y-1">
                                        {selectedApp.redirect_uris.map((uri, i) => (
                                            <div key={i} className="bg-[#f8fafc] dark:bg-[#374151]/50 rounded-lg px-3 py-2 text-sm font-mono text-[#2563eb] break-all border border-[#e2e8f0] dark:border-[#374151]">
                                                {uri}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Scopes */}
                                <div className="mb-6">
                                    <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-2">Scopes autorizados</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedApp.scopes.map(scope => (
                                            <span
                                                key={scope}
                                                className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-mono"
                                            >
                                                {scope}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Stats */}
                                {selectedAppStats && (
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <StatCard icon={<Users className="w-4 h-4" />} value={selectedAppStats.unique_users} label="Usuarios" color="purple" />
                                        <StatCard icon={<Activity className="w-4 h-4" />} value={selectedAppStats.active_tokens} label="Tokens activos" color="blue" />
                                        <StatCard icon={<Zap className="w-4 h-4" />} value={selectedAppStats.total_tokens} label="Total tokens" color="green" />
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    {confirmDelete === selectedApp.id ? (
                                        <div className="flex gap-2 w-full">
                                            <button
                                                onClick={() => deleteApp(selectedApp.id)}
                                                disabled={deleting}
                                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
                                            >
                                                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar eliminar'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] transition-colors text-sm"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setConfirmDelete(selectedApp.id)}
                                                className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-12 text-center border border-[#e2e8f0] dark:border-[#374151]">
                                <Key className="w-12 h-12 mx-auto mb-4 text-[#64748b] opacity-50" />
                                <p className="text-[#64748b] dark:text-[#94a3b8]">Selecciona una aplicacion para ver detalles</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
    const colorMap: Record<string, string> = {
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    };

    return (
        <div className="p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl text-center border border-[#e2e8f0] dark:border-[#374151]">
            <div className={`w-8 h-8 ${colorMap[color]} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                {icon}
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-white">{value}</div>
            <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">{label}</div>
        </div>
    );
}
