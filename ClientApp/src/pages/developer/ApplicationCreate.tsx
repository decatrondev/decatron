import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    X,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Copy,
    Eye,
    EyeOff,
    ExternalLink,
    Code2
} from 'lucide-react';
import api from '../../services/api';

interface ScopeInfo {
    scope: string;
    name: string;
    description: string;
}

interface ScopeCategory {
    name: string;
    description: string;
    scopes: ScopeInfo[];
}

interface ScopesData {
    read: ScopeCategory;
    write: ScopeCategory;
    action: ScopeCategory;
}

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface CreatedApp {
    id: string;
    name: string;
    client_id: string;
    client_secret: string;
}

export default function ApplicationCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [scopesData, setScopesData] = useState<ScopesData | null>(null);
    const [loadingScopes, setLoadingScopes] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [createdApp, setCreatedApp] = useState<CreatedApp | null>(null);
    const [showSecret, setShowSecret] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [iconUrl, setIconUrl] = useState('');
    const [redirectUris, setRedirectUris] = useState<string[]>(['']);
    const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());

    // Validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        loadScopes();
    }, []);

    const addToast = (message: string, type: 'success' | 'error' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const loadScopes = async () => {
        try {
            setLoadingScopes(true);
            const res = await api.get('/developer/scopes');
            if (res.data.success) {
                setScopesData(res.data.categories);
            }
        } catch (err) {
            addToast('Error loading available scopes', 'error');
        } finally {
            setLoadingScopes(false);
        }
    };

    const addRedirectUri = () => {
        setRedirectUris([...redirectUris, '']);
    };

    const removeRedirectUri = (index: number) => {
        if (redirectUris.length > 1) {
            setRedirectUris(redirectUris.filter((_, i) => i !== index));
        }
    };

    const updateRedirectUri = (index: number, value: string) => {
        const updated = [...redirectUris];
        updated[index] = value;
        setRedirectUris(updated);
    };

    const toggleScope = (scope: string) => {
        const newScopes = new Set(selectedScopes);
        if (newScopes.has(scope)) {
            newScopes.delete(scope);
        } else {
            newScopes.add(scope);
        }
        setSelectedScopes(newScopes);
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Application name is required';
        } else if (name.length > 100) {
            newErrors.name = 'Name must be 100 characters or less';
        }

        const validUris = redirectUris.filter(uri => uri.trim());
        if (validUris.length === 0) {
            newErrors.redirectUris = 'At least one redirect URI is required';
        } else {
            for (const uri of validUris) {
                try {
                    const parsed = new URL(uri);
                    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
                        newErrors.redirectUris = 'Redirect URIs must use HTTPS (except localhost)';
                        break;
                    }
                } catch {
                    newErrors.redirectUris = `Invalid URL: ${uri}`;
                    break;
                }
            }
        }

        if (selectedScopes.size === 0) {
            newErrors.scopes = 'At least one scope is required';
        }

        if (websiteUrl.trim()) {
            try {
                new URL(websiteUrl);
            } catch {
                newErrors.websiteUrl = 'Invalid website URL';
            }
        }

        if (iconUrl.trim()) {
            try {
                new URL(iconUrl);
            } catch {
                newErrors.iconUrl = 'Invalid icon URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            addToast('Please fix the validation errors', 'error');
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/developer/apps', {
                name: name.trim(),
                description: description.trim() || null,
                redirectUris: redirectUris.filter(uri => uri.trim()),
                scopes: Array.from(selectedScopes),
                iconUrl: iconUrl.trim() || null,
                websiteUrl: websiteUrl.trim() || null
            });

            if (res.data.success) {
                setCreatedApp({
                    id: res.data.app.id,
                    name: res.data.app.name,
                    client_id: res.data.app.client_id,
                    client_secret: res.data.app.client_secret
                });
                addToast('Application created successfully!', 'success');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Error creating application';
            addToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast(`${label} copied to clipboard`, 'success');
        } catch {
            addToast('Failed to copy', 'error');
        }
    };

    // Show success screen with credentials
    if (createdApp) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="max-w-2xl mx-auto">
                    {/* Toast Notifications */}
                    <div className="fixed top-4 right-4 z-50 space-y-2">
                        {toasts.map(toast => (
                            <div
                                key={toast.id}
                                className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
                                    toast.type === 'success' ? 'bg-green-600' :
                                    toast.type === 'error' ? 'bg-red-600' :
                                    'bg-blue-600'
                                }`}
                            >
                                {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                                <span>{toast.message}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 rounded-xl p-8 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 bg-green-600 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Application Created!</h1>
                        <p className="text-gray-400 mb-8">
                            Your OAuth application <strong className="text-white">{createdApp.name}</strong> has been created.
                        </p>

                        {/* Credentials */}
                        <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-xl p-6 mb-8 text-left">
                            <div className="flex items-center gap-2 text-yellow-400 mb-4">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-semibold">Important: Save your credentials now!</span>
                            </div>
                            <p className="text-yellow-200/80 text-sm mb-6">
                                The client secret will not be shown again. Make sure to save it securely.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Client ID</label>
                                    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                                        <code className="flex-1 text-sm font-mono text-green-400 break-all">
                                            {createdApp.client_id}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(createdApp.client_id, 'Client ID')}
                                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400 block mb-1">Client Secret</label>
                                    <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                                        <code className="flex-1 text-sm font-mono text-yellow-400 break-all">
                                            {showSecret ? createdApp.client_secret : '••••••••••••••••••••••••••••••••'}
                                        </code>
                                        <button
                                            onClick={() => setShowSecret(!showSecret)}
                                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                        >
                                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(createdApp.client_secret, 'Client Secret')}
                                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => navigate('/developer')}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                            >
                                Go to Developer Portal
                            </button>
                            <a
                                href="/developer/docs"
                                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                View API Docs
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
                            toast.type === 'success' ? 'bg-green-600' :
                            toast.type === 'error' ? 'bg-red-600' :
                            'bg-blue-600'
                        }`}
                    >
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                        {toast.type === 'error' && <XCircle className="w-5 h-5" />}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>

            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/developer')}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">Create Application</h1>
                        <p className="text-gray-400">Register a new OAuth application</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-purple-400" />
                            Application Info
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Application Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full bg-gray-900 border ${errors.name ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500`}
                                    placeholder="My Awesome Bot"
                                />
                                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 resize-none"
                                    placeholder="A brief description of what your application does..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Website URL</label>
                                    <input
                                        type="url"
                                        value={websiteUrl}
                                        onChange={(e) => setWebsiteUrl(e.target.value)}
                                        className={`w-full bg-gray-900 border ${errors.websiteUrl ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500`}
                                        placeholder="https://myapp.com"
                                    />
                                    {errors.websiteUrl && <p className="text-red-400 text-sm mt-1">{errors.websiteUrl}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Icon URL</label>
                                    <input
                                        type="url"
                                        value={iconUrl}
                                        onChange={(e) => setIconUrl(e.target.value)}
                                        className={`w-full bg-gray-900 border ${errors.iconUrl ? 'border-red-500' : 'border-gray-700'} rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500`}
                                        placeholder="https://myapp.com/icon.png"
                                    />
                                    {errors.iconUrl && <p className="text-red-400 text-sm mt-1">{errors.iconUrl}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Redirect URIs */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-6">
                            Redirect URIs <span className="text-red-400">*</span>
                        </h2>
                        <p className="text-gray-400 text-sm mb-4">
                            OAuth will redirect users back to these URIs after authorization.
                            Must use HTTPS (localhost is exempt for development).
                        </p>

                        <div className="space-y-3">
                            {redirectUris.map((uri, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="url"
                                        value={uri}
                                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 font-mono text-sm"
                                        placeholder="https://myapp.com/callback"
                                    />
                                    {redirectUris.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRedirectUri(index)}
                                            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addRedirectUri}
                            className="mt-3 flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add another URI
                        </button>
                        {errors.redirectUris && <p className="text-red-400 text-sm mt-2">{errors.redirectUris}</p>}
                    </div>

                    {/* Scopes */}
                    <div className="bg-gray-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-2">
                            Scopes <span className="text-red-400">*</span>
                        </h2>
                        <p className="text-gray-400 text-sm mb-6">
                            Select the permissions your application needs. Users will be asked to approve these.
                        </p>

                        {loadingScopes ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                            </div>
                        ) : scopesData ? (
                            <div className="space-y-6">
                                {Object.entries(scopesData).map(([category, data]) => (
                                    <div key={category}>
                                        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${
                                                category === 'read' ? 'bg-blue-400' :
                                                category === 'write' ? 'bg-orange-400' :
                                                'bg-red-400'
                                            }`}></span>
                                            {data.name}
                                            <span className="text-xs text-gray-500 font-normal">
                                                - {data.description}
                                            </span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {data.scopes.map((scopeInfo) => (
                                                <label
                                                    key={scopeInfo.scope}
                                                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                                        selectedScopes.has(scopeInfo.scope)
                                                            ? 'bg-purple-600/20 border border-purple-500'
                                                            : 'bg-gray-900 border border-gray-700 hover:border-gray-600'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedScopes.has(scopeInfo.scope)}
                                                        onChange={() => toggleScope(scopeInfo.scope)}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <code className="text-xs text-purple-400 font-mono">
                                                            {scopeInfo.scope}
                                                        </code>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {scopeInfo.description}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-red-400">Failed to load scopes</p>
                        )}
                        {errors.scopes && <p className="text-red-400 text-sm mt-4">{errors.scopes}</p>}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/developer')}
                            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    Create Application
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
