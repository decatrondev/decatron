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
        <div className="panel-scale min-h-screen bg-ds-bg text-ds-text p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        to="/developer"
                        className="p-2 hover:bg-ds-raised rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">API Reference</h1>
                        <p className="text-ds-soft">Referencia rapida de endpoints</p>
                    </div>
                    <Link
                        to="/docs/api"
                        className="ml-auto flex items-center gap-2 text-ds-accent-text hover:text-ds-accent-text"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Documentacion completa
                    </Link>
                </div>

                {/* Base URL */}
                <div className="bg-ds-raised rounded-lg p-4 mb-8">
                    <label className="text-xs text-ds-soft mb-2 block">Base URL</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 text-ds-ok font-mono">{baseUrl}</code>
                        <button
                            onClick={() => copyToClipboard(baseUrl, 'base')}
                            className="ds-btn ds-btn--ghost ds-icon-btn"
                        >
                            {copiedItem === 'base' ? (
                                <CheckCircle className="w-4 h-4 text-ds-ok" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* OAuth Endpoints */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-ds-accent-text" />
                        OAuth
                    </h2>
                    <div className="bg-ds-raised rounded-lg divide-y divide-ds-border">
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
                    <div className="bg-ds-raised rounded-lg divide-y divide-ds-border">
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
                    <div className="bg-ds-raised rounded-lg divide-y divide-ds-border">
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
                    <div className="bg-ds-raised rounded-lg divide-y divide-ds-border">
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
                        <div className="bg-ds-raised rounded-lg p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Eye className="w-4 h-4 text-ds-accent-text" />
                                Lectura
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-ds-accent-text">read:profile</code>
                                <code className="block text-ds-accent-text">read:timer</code>
                                <code className="block text-ds-accent-text">read:commands</code>
                                <code className="block text-ds-accent-text">read:alerts</code>
                                <code className="block text-ds-accent-text">read:giveaways</code>
                                <code className="block text-ds-accent-text">read:goals</code>
                                <code className="block text-ds-accent-text">read:analytics</code>
                            </div>
                        </div>
                        <div className="bg-ds-raised rounded-lg p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Edit3 className="w-4 h-4 text-ds-accent-text" />
                                Escritura
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-ds-warn">write:timer</code>
                                <code className="block text-ds-warn">write:commands</code>
                                <code className="block text-ds-warn">write:alerts</code>
                                <code className="block text-ds-warn">write:giveaways</code>
                                <code className="block text-ds-warn">write:goals</code>
                            </div>
                        </div>
                        <div className="bg-ds-raised rounded-lg p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                                <Zap className="w-4 h-4 text-ds-accent-text" />
                                Acciones
                            </h3>
                            <div className="space-y-1 text-xs">
                                <code className="block text-ds-danger">action:timer</code>
                                <code className="block text-ds-danger">action:alerts</code>
                                <code className="block text-ds-danger">action:chat</code>
                                <code className="block text-ds-danger">action:giveaway</code>
                                <code className="block text-ds-danger">action:commands</code>
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
        GET: 'bg-ds-accent',
        POST: 'bg-ds-accent',
        PUT: 'bg-ds-warn',
        DELETE: 'bg-ds-danger-solid'
    };

    const id = `${method}-${path}`;

    return (
        <div className="flex items-center gap-4 px-4 py-3">
            <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[method]}`}>
                {method}
            </span>
            <code className="flex-1 text-sm text-ds-soft">{path}</code>
            <span className="text-sm text-ds-soft">{description}</span>
            {scope && (
                <span className={`text-xs px-2 py-1 rounded ${
                    scope.startsWith('read') ? 'bg-ds-accent/20 text-ds-accent-text' :
                    scope.startsWith('write') ? 'bg-ds-warn/20 text-ds-warn' :
                    'bg-ds-danger-solid/20 text-ds-danger'
                }`}>
                    {scope}
                </span>
            )}
            <button
                onClick={() => onCopy(path, id)}
                className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"
            >
                {copiedItem === id ? (
                    <CheckCircle className="w-4 h-4 text-ds-ok" />
                ) : (
                    <Copy className="w-4 h-4 text-ds-soft" />
                )}
            </button>
        </div>
    );
}
