import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Code2,
    Plus,
    ExternalLink,
    Shield,
    CheckCircle,
    XCircle,
    Copy,
    Eye,
    EyeOff,
    Trash2,
    RefreshCw,
    Key,
    AlertTriangle,
    Loader2,
    BookOpen
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
    const [showCreateModal, setShowCreateModal] = useState(false);
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
            addToast('Error loading applications', 'error');
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
            addToast('Error loading app details', 'error');
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast(`${label} copied to clipboard`, 'success');
        } catch (err) {
            addToast('Failed to copy', 'error');
        }
    };

    const regenerateSecret = async () => {
        if (!selectedApp) return;

        try {
            setRegenerating(true);
            const res = await api.post(`/developer/apps/${selectedApp.id}/regenerate-secret`);
            if (res.data.success) {
                setNewSecret(res.data.client_secret);
                addToast('Secret regenerated. All existing tokens have been revoked.', 'info');
            }
        } catch (err) {
            addToast('Error regenerating secret', 'error');
        } finally {
            setRegenerating(false);
        }
    };

    const deleteApp = async (appId: string) => {
        try {
            setDeleting(true);
            const res = await api.delete(`/developer/apps/${appId}`);
            if (res.data.success) {
                addToast('Application deleted', 'success');
                setApps(prev => prev.filter(a => a.id !== appId));
                setSelectedApp(null);
                setConfirmDelete(null);
            }
        } catch (err) {
            addToast('Error deleting application', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in ${
                            toast.type === 'success' ? 'bg-green-600' :
                            toast.type === 'error' ? 'bg-red-600' :
                            'bg-blue-600'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {toast.type === 'error' && <XCircle className="w-5 h-5" />}
                        {toast.type === 'info' && <AlertTriangle className="w-5 h-5" />}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-600 rounded-xl">
                            <Code2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Developer Portal</h1>
                            <p className="text-gray-400">Manage your OAuth applications and API access</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/developer/docs"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            <BookOpen className="w-5 h-5" />
                            API Docs
                        </Link>
                        <button
                            onClick={() => navigate('/developer/apps/new')}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create App
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && apps.length === 0 && (
                    <div className="bg-gray-800 rounded-xl p-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 bg-gray-700 rounded-full flex items-center justify-center">
                            <Code2 className="w-10 h-10 text-gray-500" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2">No Applications Yet</h2>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            Create your first OAuth application to start integrating with the Decatron API.
                        </p>
                        <button
                            onClick={() => navigate('/developer/apps/new')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create Your First App
                        </button>
                    </div>
                )}

                {/* Apps List */}
                {!loading && apps.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Apps Column */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-300 mb-4">Your Applications</h2>
                            {apps.map(app => (
                                <div
                                    key={app.id}
                                    onClick={() => loadAppDetails(app)}
                                    className={`bg-gray-800 rounded-xl p-5 cursor-pointer transition-all hover:bg-gray-750 border-2 ${
                                        selectedApp?.id === app.id ? 'border-purple-500' : 'border-transparent'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {app.icon_url ? (
                                            <img
                                                src={app.icon_url}
                                                alt={app.name}
                                                className="w-12 h-12 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                                                <Code2 className="w-6 h-6 text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold truncate">{app.name}</h3>
                                                {app.is_verified && (
                                                    <Shield className="w-4 h-4 text-blue-400" title="Verified" />
                                                )}
                                                <span className={`ml-auto px-2 py-0.5 text-xs rounded ${
                                                    app.is_active ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                                                }`}>
                                                    {app.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 truncate mt-1">
                                                {app.description || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                                <span>{app.scopes.length} scopes</span>
                                                <span>Created {formatDate(app.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Details Column */}
                        <div>
                            {selectedApp ? (
                                <div className="bg-gray-800 rounded-xl p-6 sticky top-6">
                                    <div className="flex items-start gap-4 mb-6">
                                        {selectedApp.icon_url ? (
                                            <img
                                                src={selectedApp.icon_url}
                                                alt={selectedApp.name}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 bg-gray-700 rounded-xl flex items-center justify-center">
                                                <Code2 className="w-8 h-8 text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h2 className="text-xl font-bold">{selectedApp.name}</h2>
                                            <p className="text-gray-400 text-sm mt-1">
                                                {selectedApp.description || 'No description provided'}
                                            </p>
                                            {selectedApp.website_url && (
                                                <a
                                                    href={selectedApp.website_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-purple-400 text-sm mt-2 hover:underline"
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
                                            <label className="text-xs text-gray-400 block mb-1">Client ID</label>
                                            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                                                <code className="flex-1 text-sm font-mono text-green-400">
                                                    {selectedApp.client_id}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(selectedApp.client_id, 'Client ID')}
                                                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-400 block mb-1">Client Secret</label>
                                            {newSecret ? (
                                                <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-3">
                                                    <p className="text-yellow-400 text-xs mb-2 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Save this secret now - it won't be shown again!
                                                    </p>
                                                    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-2">
                                                        <code className="flex-1 text-sm font-mono text-yellow-400 break-all">
                                                            {showSecret ? newSecret : '••••••••••••••••••••••••'}
                                                        </code>
                                                        <button
                                                            onClick={() => setShowSecret(!showSecret)}
                                                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                                        >
                                                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(newSecret, 'Client Secret')}
                                                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                                                    <code className="flex-1 text-sm font-mono text-gray-500">
                                                        ••••••••••••••••••••
                                                    </code>
                                                    <button
                                                        onClick={regenerateSecret}
                                                        disabled={regenerating}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 hover:bg-orange-500 rounded transition-colors disabled:opacity-50"
                                                    >
                                                        {regenerating ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="w-3 h-3" />
                                                        )}
                                                        Regenerate
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Redirect URIs */}
                                    <div className="mb-6">
                                        <label className="text-xs text-gray-400 block mb-2">Redirect URIs</label>
                                        <div className="space-y-1">
                                            {selectedApp.redirect_uris.map((uri, i) => (
                                                <div key={i} className="bg-gray-900 rounded px-3 py-2 text-sm font-mono text-blue-400 break-all">
                                                    {uri}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scopes */}
                                    <div className="mb-6">
                                        <label className="text-xs text-gray-400 block mb-2">Authorized Scopes</label>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedApp.scopes.map(scope => (
                                                <span
                                                    key={scope}
                                                    className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs font-mono"
                                                >
                                                    {scope}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    {selectedAppStats && (
                                        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-900 rounded-lg">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-purple-400">
                                                    {selectedAppStats.unique_users}
                                                </div>
                                                <div className="text-xs text-gray-400">Users</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-400">
                                                    {selectedAppStats.active_tokens}
                                                </div>
                                                <div className="text-xs text-gray-400">Active Tokens</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-400">
                                                    {selectedAppStats.total_tokens}
                                                </div>
                                                <div className="text-xs text-gray-400">Total Tokens</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => navigate(`/developer/apps/${selectedApp.id}/edit`)}
                                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-center"
                                        >
                                            Edit App
                                        </button>
                                        {confirmDelete === selectedApp.id ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => deleteApp(selectedApp.id)}
                                                    disabled={deleting}
                                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(selectedApp.id)}
                                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-500">
                                    <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Select an application to view details</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
