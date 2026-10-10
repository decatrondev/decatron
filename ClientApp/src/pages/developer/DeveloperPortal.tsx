import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Code2, Plus, ExternalLink, Shield, CheckCircle, XCircle,
    Copy, Eye, EyeOff, Trash2, RefreshCw, Key, AlertTriangle,
    Loader2, BookOpen, ArrowLeft, Users, Zap, Activity, Pencil
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
        <div className="panel-scale space-y-6">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-lg flex items-center gap-2 text-ds-text text-sm font-medium ${
                            toast.type === 'success' ? 'bg-ds-accent' :
                            toast.type === 'error' ? 'bg-ds-danger-solid' :
                            'bg-ds-accent'
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
            <div className="bg-ds-surface rounded-lg p-6 border border-ds-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-ds-accent/10 rounded-lg flex items-center justify-center">
                            <Code2 className="w-7 h-7 text-ds-accent-text" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-ds-text">
                                Portal de Desarrolladores
                            </h1>
                            <p className="text-sm text-ds-soft">
                                Gestiona tus aplicaciones OAuth y acceso a la API
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/docs/api"
                            className="flex items-center gap-2 px-4 py-2 bg-ds-bg text-ds-soft hover:text-ds-accent-text font-medium rounded-lg border border-ds-border transition-colors text-sm"
                        >
                            <BookOpen className="w-4 h-4" />
                            API Docs
                        </Link>
                        <button
                            onClick={() => navigate('/developer/apps/new')}
                            className="ds-btn ds-btn--primary"
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
                    <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
                </div>
            )}

            {/* Empty State */}
            {!loading && apps.length === 0 && (
                <div className="bg-ds-surface rounded-lg p-12 text-center border border-ds-border">
                    <div className="w-20 h-20 mx-auto mb-6 bg-ds-bg rounded-lg flex items-center justify-center">
                        <Code2 className="w-10 h-10 text-ds-soft" />
                    </div>
                    <h2 className="text-xl font-black text-ds-text mb-2">Sin aplicaciones</h2>
                    <p className="text-ds-soft mb-6 max-w-md mx-auto">
                        Crea tu primera aplicacion OAuth para empezar a usar la API de Decatron.
                    </p>
                    <button
                        onClick={() => navigate('/developer/apps/new')}
                        className="ds-btn ds-btn--primary ds-btn--lg"
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
                        <h2 className="text-lg font-bold text-ds-text">Tus Aplicaciones</h2>
                        {apps.map(app => (
                            <div
                                key={app.id}
                                onClick={() => loadAppDetails(app)}
                                className={`bg-ds-surface rounded-lg p-4 cursor-pointer transition-all border-2 hover:border-ds-accent ${
                                    selectedApp?.id === app.id
                                        ? 'border-ds-accent'
                                        : 'border-ds-border '
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    {app.icon_url ? (
                                        <img src={app.icon_url} alt={app.name} className="w-11 h-11 rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-11 h-11 bg-ds-bg rounded-lg flex items-center justify-center">
                                            <Code2 className="w-5 h-5 text-ds-soft" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-ds-text truncate">{app.name}</h3>
                                            {app.is_verified && (
                                                <Shield className="w-4 h-4 text-ds-accent-text" title="Verificada" />
                                            )}
                                            <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${
                                                app.is_active
                                                    ? 'bg-ds-ok/10 text-ds-ok '
                                                    : 'bg-ds-danger/10 text-ds-danger '
                                            }`}>
                                                {app.is_active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-ds-soft truncate mt-1">
                                            {app.description || 'Sin descripcion'}
                                        </p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-ds-soft">
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
                            <div className="bg-ds-surface rounded-lg p-6 border border-ds-border sticky top-6">
                                {/* App Header */}
                                <div className="flex items-start gap-4 mb-6">
                                    {selectedApp.icon_url ? (
                                        <img src={selectedApp.icon_url} alt={selectedApp.name} className="w-14 h-14 rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-14 h-14 bg-ds-bg rounded-lg flex items-center justify-center">
                                            <Code2 className="w-7 h-7 text-ds-soft" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <h2 className="text-xl font-black text-ds-text">{selectedApp.name}</h2>
                                        <p className="text-sm text-ds-soft mt-1">
                                            {selectedApp.description || 'Sin descripcion'}
                                        </p>
                                        {selectedApp.website_url && (
                                            <a
                                                href={selectedApp.website_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-ds-accent-text text-sm mt-2 hover:underline"
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
                                        <label className="text-xs font-medium text-ds-soft block mb-1">Client ID</label>
                                        <div className="flex items-center gap-2 bg-ds-bg rounded-lg p-3 border border-ds-border">
                                            <code className="flex-1 text-sm font-mono text-ds-accent-text break-all">
                                                {selectedApp.client_id}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(selectedApp.client_id, 'Client ID')}
                                                className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                            >
                                                <Copy className="w-4 h-4 text-ds-soft" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-ds-soft block mb-1">Client Secret</label>
                                        {newSecret ? (
                                            <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-3">
                                                <p className="text-ds-warn text-xs mb-2 flex items-center gap-1 font-medium">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Guarda este secret ahora - no se mostrara de nuevo
                                                </p>
                                                <div className="flex items-center gap-2 bg-ds-surface rounded-lg p-2 border border-ds-border">
                                                    <code className="flex-1 text-sm font-mono text-ds-warn break-all">
                                                        {showSecret ? newSecret : '••••••••••••••••••••••••'}
                                                    </code>
                                                    <button
                                                        onClick={() => setShowSecret(!showSecret)}
                                                        className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                                    >
                                                        {showSecret ? <EyeOff className="w-4 h-4 text-ds-soft" /> : <Eye className="w-4 h-4 text-ds-soft" />}
                                                    </button>
                                                    <button
                                                        onClick={() => copyToClipboard(newSecret, 'Client Secret')}
                                                        className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
                                                    >
                                                        <Copy className="w-4 h-4 text-ds-soft" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 bg-ds-bg rounded-lg p-3 border border-ds-border">
                                                <code className="flex-1 text-sm font-mono text-ds-soft">
                                                    ••••••••••••••••••••
                                                </code>
                                                <button
                                                    onClick={regenerateSecret}
                                                    disabled={regenerating}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-ds-warn/10 text-ds-warn hover:bg-ds-warn/10 rounded-lg transition-colors disabled:opacity-50"
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
                                    <label className="text-xs font-medium text-ds-soft block mb-2">Redirect URIs</label>
                                    <div className="space-y-1">
                                        {selectedApp.redirect_uris.map((uri, i) => (
                                            <div key={i} className="bg-ds-bg rounded-lg px-3 py-2 text-sm font-mono text-ds-accent-text break-all border border-ds-border">
                                                {uri}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Scopes */}
                                <div className="mb-6">
                                    <label className="text-xs font-medium text-ds-soft block mb-2">Scopes autorizados</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedApp.scopes.map(scope => (
                                            <span
                                                key={scope}
                                                className="px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg text-xs font-mono"
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
                                                className="ds-btn ds-btn--danger flex-1"
                                            >
                                                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar eliminar'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                className="ds-btn ds-btn--secondary"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => navigate(`/developer/apps/${selectedApp.id}/edit`)}
                                                className="ds-btn ds-btn--secondary flex-1"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(selectedApp.id)}
                                                className="px-4 py-2.5 bg-ds-danger/10 hover:bg-ds-danger/10 text-ds-danger rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-ds-surface rounded-lg p-12 text-center border border-ds-border">
                                <Key className="w-12 h-12 mx-auto mb-4 text-ds-soft opacity-50" />
                                <p className="text-ds-soft">Selecciona una aplicacion para ver detalles</p>
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
        purple: 'bg-ds-accent/10 text-ds-accent-text ',
        blue: 'bg-ds-accent/10 text-ds-accent-text ',
        green: 'bg-ds-ok/10 text-ds-ok ',
    };

    return (
        <div className="p-3 bg-ds-bg rounded-lg text-center border border-ds-border">
            <div className={`w-8 h-8 ${colorMap[color]} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                {icon}
            </div>
            <div className="text-xl font-black text-ds-text">{value}</div>
            <div className="text-xs text-ds-soft">{label}</div>
        </div>
    );
}
