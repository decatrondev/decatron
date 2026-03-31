import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Plus, X, Loader2, CheckCircle, XCircle,
    AlertTriangle, Copy, Eye, EyeOff, ExternalLink, Code2,
    Key, Shield, Globe
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
            addToast('Error al cargar scopes disponibles', 'error');
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
            newErrors.name = 'El nombre es obligatorio';
        } else if (name.length > 100) {
            newErrors.name = 'Maximo 100 caracteres';
        }

        const validUris = redirectUris.filter(uri => uri.trim());
        if (validUris.length === 0) {
            newErrors.redirectUris = 'Se requiere al menos una redirect URI';
        } else {
            for (const uri of validUris) {
                try {
                    const parsed = new URL(uri);
                    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
                        newErrors.redirectUris = 'Las redirect URIs deben usar HTTPS (excepto localhost)';
                        break;
                    }
                } catch {
                    newErrors.redirectUris = `URL invalida: ${uri}`;
                    break;
                }
            }
        }

        if (selectedScopes.size === 0) {
            newErrors.scopes = 'Se requiere al menos un scope';
        }

        if (websiteUrl.trim()) {
            try {
                new URL(websiteUrl);
            } catch {
                newErrors.websiteUrl = 'URL invalida';
            }
        }

        if (iconUrl.trim()) {
            try {
                new URL(iconUrl);
            } catch {
                newErrors.iconUrl = 'URL invalida';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            addToast('Corrige los errores de validacion', 'error');
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
                addToast('Aplicacion creada exitosamente', 'success');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Error al crear aplicacion';
            addToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            addToast(`${label} copiado`, 'success');
        } catch {
            addToast('Error al copiar', 'error');
        }
    };

    // Success screen
    if (createdApp) {
        return (
            <div className="space-y-6">
                <ToastContainer toasts={toasts} />

                <div className="max-w-2xl mx-auto">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 text-center border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Aplicacion creada</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mb-8">
                            Tu aplicacion <strong className="text-gray-900 dark:text-white">{createdApp.name}</strong> esta lista.
                        </p>

                        {/* Credentials */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-6 mb-8 text-left">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-4">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-bold text-sm">Guarda tus credenciales ahora</span>
                            </div>
                            <p className="text-amber-600 dark:text-amber-300/80 text-sm mb-6">
                                El client secret no se mostrara de nuevo. Guardalo en un lugar seguro.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-1">Client ID</label>
                                    <div className="flex items-center gap-2 bg-white dark:bg-[#1B1C1D] rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151]">
                                        <code className="flex-1 text-sm font-mono text-[#2563eb] break-all">
                                            {createdApp.client_id}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(createdApp.client_id, 'Client ID')}
                                            className="p-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                        >
                                            <Copy className="w-4 h-4 text-[#64748b]" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] block mb-1">Client Secret</label>
                                    <div className="flex items-center gap-2 bg-white dark:bg-[#1B1C1D] rounded-xl p-3 border border-[#e2e8f0] dark:border-[#374151]">
                                        <code className="flex-1 text-sm font-mono text-amber-700 dark:text-amber-400 break-all">
                                            {showSecret ? createdApp.client_secret : '••••••••••••••••••••••••••••••••'}
                                        </code>
                                        <button
                                            onClick={() => setShowSecret(!showSecret)}
                                            className="p-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                        >
                                            {showSecret ? <EyeOff className="w-4 h-4 text-[#64748b]" /> : <Eye className="w-4 h-4 text-[#64748b]" />}
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(createdApp.client_secret, 'Client Secret')}
                                            className="p-1.5 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-lg transition-colors"
                                        >
                                            <Copy className="w-4 h-4 text-[#64748b]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => navigate('/developer')}
                                className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
                            >
                                Ir al Portal
                            </button>
                            <Link
                                to="/docs/api"
                                className="px-6 py-3 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] transition-colors flex items-center gap-2 hover:text-[#2563eb]"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Ver API Docs
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ToastContainer toasts={toasts} />

            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/developer')}
                        className="p-2 hover:bg-[#f8fafc] dark:hover:bg-[#374151] rounded-xl transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#64748b]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Nueva Aplicacion</h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Registra una nueva aplicacion OAuth</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-[#2563eb]" />
                            Informacion de la App
                        </h2>

                        <div className="space-y-4">
                            <FormField label="Nombre de la aplicacion" required error={errors.name}>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={`w-full bg-[#f8fafc] dark:bg-[#374151]/50 border ${errors.name ? 'border-red-400' : 'border-[#e2e8f0] dark:border-[#374151]'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder-[#94a3b8]`}
                                    placeholder="Mi Bot"
                                />
                            </FormField>

                            <FormField label="Descripcion">
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent resize-none placeholder-[#94a3b8]"
                                    placeholder="Descripcion breve de tu aplicacion..."
                                />
                            </FormField>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField label="Website URL" error={errors.websiteUrl}>
                                    <input
                                        type="url"
                                        value={websiteUrl}
                                        onChange={(e) => setWebsiteUrl(e.target.value)}
                                        className={`w-full bg-[#f8fafc] dark:bg-[#374151]/50 border ${errors.websiteUrl ? 'border-red-400' : 'border-[#e2e8f0] dark:border-[#374151]'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder-[#94a3b8]`}
                                        placeholder="https://miapp.com"
                                    />
                                </FormField>
                                <FormField label="Icon URL" error={errors.iconUrl}>
                                    <input
                                        type="url"
                                        value={iconUrl}
                                        onChange={(e) => setIconUrl(e.target.value)}
                                        className={`w-full bg-[#f8fafc] dark:bg-[#374151]/50 border ${errors.iconUrl ? 'border-red-400' : 'border-[#e2e8f0] dark:border-[#374151]'} rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent placeholder-[#94a3b8]`}
                                        placeholder="https://miapp.com/icon.png"
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>

                    {/* Redirect URIs */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-[#2563eb]" />
                            Redirect URIs <span className="text-red-400 text-sm">*</span>
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            OAuth redirigira a los usuarios a estas URIs despues de autorizar.
                            Deben usar HTTPS (localhost exento para desarrollo).
                        </p>

                        <div className="space-y-3">
                            {redirectUris.map((uri, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="url"
                                        value={uri}
                                        onChange={(e) => updateRedirectUri(index, e.target.value)}
                                        className="flex-1 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent font-mono text-sm placeholder-[#94a3b8]"
                                        placeholder="https://miapp.com/callback"
                                    />
                                    {redirectUris.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRedirectUri(index)}
                                            className="p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-red-400"
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
                            className="mt-3 flex items-center gap-2 text-sm text-[#2563eb] hover:text-blue-700 font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar otra URI
                        </button>
                        {errors.redirectUris && <p className="text-red-500 text-sm mt-2">{errors.redirectUris}</p>}
                    </div>

                    {/* Scopes */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-[#2563eb]" />
                            Scopes <span className="text-red-400 text-sm">*</span>
                        </h2>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
                            Selecciona los permisos que necesita tu aplicacion. Los usuarios deberan aprobarlos.
                        </p>

                        {loadingScopes ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                            </div>
                        ) : scopesData ? (
                            <div className="space-y-6">
                                {Object.entries(scopesData).map(([category, data]) => {
                                    const dotColor = category === 'read' ? 'bg-blue-500' : category === 'write' ? 'bg-orange-500' : 'bg-red-500';
                                    return (
                                        <div key={category}>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                                {data.name}
                                                <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-normal">
                                                    — {data.description}
                                                </span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {data.scopes.map((scopeInfo) => (
                                                    <label
                                                        key={scopeInfo.scope}
                                                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                                                            selectedScopes.has(scopeInfo.scope)
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-[#2563eb]'
                                                                : 'bg-[#f8fafc] dark:bg-[#374151]/50 border-2 border-transparent hover:border-[#e2e8f0] dark:hover:border-[#374151]'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedScopes.has(scopeInfo.scope)}
                                                            onChange={() => toggleScope(scopeInfo.scope)}
                                                            className="mt-0.5 accent-[#2563eb]"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <code className="text-xs text-[#2563eb] font-mono font-medium">
                                                                {scopeInfo.scope}
                                                            </code>
                                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                                                {scopeInfo.description}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-red-500">Error al cargar scopes</p>
                        )}
                        {errors.scopes && <p className="text-red-500 text-sm mt-4">{errors.scopes}</p>}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/developer')}
                            className="px-6 py-3 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] font-medium rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    Crear Aplicacion
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            {children}
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
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
    );
}
