import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Copy,
    CheckCircle,
    ExternalLink,
    Eye,
    Edit3,
    Zap,
    Terminal
} from 'lucide-react';

export default function ApiReference() {
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedItem(id);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    const baseUrl = 'https://twitch.decatron.net';

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to="/developer"
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">API Reference</h1>
                        <p className="text-gray-400">Referencia rapida de endpoints</p>
                    </div>
                    <Link
                        to="/docs/api"
                        className="ml-auto flex items-center gap-2 text-purple-400 hover:text-purple-300"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Documentacion completa
                    </Link>
                </div>

                {/* Base URL */}
                <div className="bg-gray-800 rounded-xl p-4 mb-8">
                    <label className="text-xs text-gray-400 mb-2 block">Base URL</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-green-400 font-mono">{baseUrl}</code>
                        <button
                            onClick={() => copyToClipboard(baseUrl, 'base')}
                            className="p-2 hover:bg-gray-700 rounded transition-colors"
                        >
                            {copiedItem === 'base' ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* OAuth Endpoints */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-purple-400" />
                        OAuth
                    </h2>
                    <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
                        <EndpointRow
                            method="GET"
                            path="/oauth/authorize"
                            description="Iniciar autorizacion"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/oauth/token"
                            description="Obtener/refrescar tokens"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/oauth/revoke"
                            description="Revocar token"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="GET"
                            path="/oauth/userinfo"
                            description="Info del usuario"
                            scope="read:profile"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                    </div>
                </section>

                {/* Timer */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Timer</h2>
                    <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
                        <EndpointRow
                            method="GET"
                            path="/api/v1/timer"
                            description="Estado del timer"
                            scope="read:timer"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/api/v1/timer/start"
                            description="Iniciar"
                            scope="action:timer"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/api/v1/timer/pause"
                            description="Pausar"
                            scope="action:timer"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/api/v1/timer/stop"
                            description="Detener"
                            scope="action:timer"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                        <EndpointRow
                            method="POST"
                            path="/api/v1/timer/add"
                            description="Agregar tiempo"
                            scope="action:timer"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                    </div>
                </section>

                {/* Alerts */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Alertas</h2>
                    <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
                        <EndpointRow
                            method="POST"
                            path="/api/v1/alerts/trigger"
                            description="Disparar alerta"
                            scope="action:alerts"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                    </div>
                </section>

                {/* Chat */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">Chat</h2>
                    <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
                        <EndpointRow
                            method="POST"
                            path="/api/v1/chat/send"
                            description="Enviar mensaje"
                            scope="action:chat"
                            copiedItem={copiedItem}
                            onCopy={copyToClipboard}
                        />
                    </div>
                </section>

                {/* Scopes Reference */}
                <section>
                    <h2 className="text-lg font-semibold mb-4">Scopes</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Eye className="w-4 h-4 text-blue-400" />
                                Lectura
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-blue-400">read:profile</code>
                                <code className="block text-blue-400">read:timer</code>
                                <code className="block text-blue-400">read:commands</code>
                                <code className="block text-blue-400">read:alerts</code>
                                <code className="block text-blue-400">read:giveaways</code>
                                <code className="block text-blue-400">read:goals</code>
                                <code className="block text-blue-400">read:analytics</code>
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Edit3 className="w-4 h-4 text-orange-400" />
                                Escritura
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-orange-400">write:timer</code>
                                <code className="block text-orange-400">write:commands</code>
                                <code className="block text-orange-400">write:alerts</code>
                                <code className="block text-orange-400">write:giveaways</code>
                                <code className="block text-orange-400">write:goals</code>
                            </div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Zap className="w-4 h-4 text-red-400" />
                                Acciones
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-red-400">action:timer</code>
                                <code className="block text-red-400">action:alerts</code>
                                <code className="block text-red-400">action:chat</code>
                                <code className="block text-red-400">action:giveaway</code>
                                <code className="block text-red-400">action:commands</code>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

interface EndpointRowProps {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    scope?: string;
    copiedItem: string | null;
    onCopy: (text: string, id: string) => void;
}

function EndpointRow({ method, path, description, scope, copiedItem, onCopy }: EndpointRowProps) {
    const methodColors = {
        GET: 'bg-green-600',
        POST: 'bg-blue-600',
        PUT: 'bg-yellow-600',
        DELETE: 'bg-red-600'
    };

    const id = `${method}-${path}`;

    return (
        <div className="flex items-center gap-4 px-4 py-3">
            <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[method]}`}>
                {method}
            </span>
            <code className="flex-1 text-sm text-gray-300">{path}</code>
            <span className="text-sm text-gray-500">{description}</span>
            {scope && (
                <span className={`text-xs px-2 py-1 rounded ${
                    scope.startsWith('read') ? 'bg-blue-600/20 text-blue-400' :
                    scope.startsWith('write') ? 'bg-orange-600/20 text-orange-400' :
                    'bg-red-600/20 text-red-400'
                }`}>
                    {scope}
                </span>
            )}
            <button
                onClick={() => onCopy(path, id)}
                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            >
                {copiedItem === id ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                )}
            </button>
        </div>
    );
}
