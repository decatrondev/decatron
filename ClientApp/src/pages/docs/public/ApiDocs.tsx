import { useState } from 'react';
import {
    Code2,
    Key,
    Shield,
    Lock,
    RefreshCw,
    ExternalLink,
    Copy,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Eye,
    Edit3,
    Zap,
    Terminal,
    BookOpen
} from 'lucide-react';

interface CodeBlockProps {
    language: string;
    code: string;
    title?: string;
}

function CodeBlock({ language, code, title }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const copyCode = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden my-4">
            {title && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <span className="text-sm text-gray-400">{title}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{language}</span>
                        <button
                            onClick={copyCode}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                        >
                            {copied ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                            )}
                        </button>
                    </div>
                </div>
            )}
            <pre className="p-4 overflow-x-auto text-sm">
                <code className="text-gray-300">{code}</code>
            </pre>
        </div>
    );
}

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden my-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors text-left"
            >
                {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium">{title}</span>
            </button>
            {isOpen && (
                <div className="p-4 bg-gray-800/50">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function ApiDocs() {
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-900 to-blue-900 py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-white/10 rounded-xl">
                            <Code2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold">Decatron API</h1>
                            <p className="text-purple-200">Documentacion para desarrolladores</p>
                        </div>
                    </div>
                    <p className="text-lg text-gray-300 mt-4 max-w-2xl">
                        Integra Decatron en tus aplicaciones usando nuestra API REST con autenticacion OAuth2.
                        Controla timers, alertas, comandos y mas.
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Quick Start */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Terminal className="w-6 h-6 text-purple-400" />
                        Inicio Rapido
                    </h2>

                    <div className="bg-gray-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold mb-4">1. Registra tu aplicacion</h3>
                        <p className="text-gray-400 mb-4">
                            Ve al <a href="/developer" className="text-purple-400 hover:underline">Developer Portal</a> y
                            crea una nueva aplicacion. Obtendras un <code className="bg-gray-700 px-2 py-0.5 rounded">client_id</code> y
                            <code className="bg-gray-700 px-2 py-0.5 rounded ml-1">client_secret</code>.
                        </p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold mb-4">2. Obtener autorizacion del usuario</h3>
                        <p className="text-gray-400 mb-4">
                            Redirige al usuario a la pagina de autorizacion:
                        </p>
                        <CodeBlock
                            language="url"
                            title="URL de Autorizacion"
                            code={`https://twitch.decatron.net/oauth/authorize?
  client_id=TU_CLIENT_ID
  &redirect_uri=https://tuapp.com/callback
  &response_type=code
  &scope=read:timer action:timer
  &state=random_state_string`}
                        />
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold mb-4">3. Intercambiar codigo por tokens</h3>
                        <p className="text-gray-400 mb-4">
                            Cuando el usuario autorice, sera redirigido a tu <code className="bg-gray-700 px-2 py-0.5 rounded">redirect_uri</code> con
                            un codigo. Intercambialo por tokens:
                        </p>
                        <CodeBlock
                            language="bash"
                            title="Solicitar Tokens"
                            code={`curl -X POST https://twitch.decatron.net/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=CODIGO_RECIBIDO" \\
  -d "redirect_uri=https://tuapp.com/callback" \\
  -d "client_id=TU_CLIENT_ID" \\
  -d "client_secret=TU_CLIENT_SECRET"`}
                        />
                        <p className="text-gray-400 mt-4">Respuesta:</p>
                        <CodeBlock
                            language="json"
                            code={`{
  "access_token": "deca_abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "deca_refresh_xyz789...",
  "scope": "read:timer action:timer"
}`}
                        />
                    </div>

                    <div className="bg-gray-800 rounded-xl p-6">
                        <h3 className="font-semibold mb-4">4. Usar la API</h3>
                        <p className="text-gray-400 mb-4">
                            Incluye el token en el header <code className="bg-gray-700 px-2 py-0.5 rounded">Authorization</code>:
                        </p>
                        <CodeBlock
                            language="bash"
                            title="Ejemplo: Obtener estado del timer"
                            code={`curl https://twitch.decatron.net/api/v1/timer \\
  -H "Authorization: Bearer TU_ACCESS_TOKEN"`}
                        />
                    </div>
                </section>

                {/* Authentication */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Key className="w-6 h-6 text-purple-400" />
                        Autenticacion
                    </h2>

                    <p className="text-gray-400 mb-6">
                        Decatron usa OAuth 2.0 con el flujo Authorization Code. Este es el flujo mas seguro
                        para aplicaciones que pueden mantener un secreto.
                    </p>

                    <div className="bg-gray-800 rounded-xl p-6 mb-6">
                        <h3 className="font-semibold mb-4">Flujo de Autorizacion</h3>
                        <div className="space-y-4 text-gray-400">
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                                <p>Tu app redirige al usuario a <code className="bg-gray-700 px-2 py-0.5 rounded">/oauth/authorize</code></p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                                <p>El usuario ve los permisos solicitados y aprueba o deniega</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                                <p>Decatron redirige al usuario de vuelta con un codigo temporal</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                                <p>Tu servidor intercambia el codigo por tokens en <code className="bg-gray-700 px-2 py-0.5 rounded">/oauth/token</code></p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">5</span>
                                <p>Usa el access_token para llamar a la API</p>
                            </div>
                        </div>
                    </div>

                    <CollapsibleSection title="PKCE (Proof Key for Code Exchange)">
                        <p className="text-gray-400 mb-4">
                            Para aplicaciones publicas (mobile, SPA), usa PKCE para mayor seguridad:
                        </p>
                        <CodeBlock
                            language="javascript"
                            title="Generar code_verifier y code_challenge"
                            code={`// Generar code_verifier (random string)
const codeVerifier = generateRandomString(64);

// Crear code_challenge (SHA256 + base64url)
const encoder = new TextEncoder();
const data = encoder.encode(codeVerifier);
const hash = await crypto.subtle.digest('SHA-256', data);
const codeChallenge = base64UrlEncode(hash);

// Incluir en la URL de autorizacion
const authUrl = \`https://twitch.decatron.net/oauth/authorize?
  client_id=\${clientId}
  &code_challenge=\${codeChallenge}
  &code_challenge_method=S256
  ...\`;

// Al intercambiar el codigo, incluir code_verifier
// en lugar de client_secret`}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title="Refrescar Tokens">
                        <p className="text-gray-400 mb-4">
                            Los access tokens expiran en 1 hora. Usa el refresh token para obtener uno nuevo:
                        </p>
                        <CodeBlock
                            language="bash"
                            code={`curl -X POST https://twitch.decatron.net/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=TU_REFRESH_TOKEN" \\
  -d "client_id=TU_CLIENT_ID" \\
  -d "client_secret=TU_CLIENT_SECRET"`}
                        />
                    </CollapsibleSection>

                    <CollapsibleSection title="Revocar Tokens">
                        <p className="text-gray-400 mb-4">
                            Para invalidar un token (ej: cuando el usuario cierra sesion):
                        </p>
                        <CodeBlock
                            language="bash"
                            code={`curl -X POST https://twitch.decatron.net/oauth/revoke \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "token=TOKEN_A_REVOCAR"`}
                        />
                    </CollapsibleSection>
                </section>

                {/* Scopes */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-purple-400" />
                        Scopes (Permisos)
                    </h2>

                    <p className="text-gray-400 mb-6">
                        Los scopes definen que puede hacer tu aplicacion. Solicita solo los que necesitas.
                    </p>

                    {/* Read Scopes */}
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                            <Eye className="w-5 h-5 text-blue-400" />
                            Lectura (read:*)
                        </h3>
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-750">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Scope</th>
                                        <th className="px-4 py-3 text-left">Descripcion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:profile</code></td>
                                        <td className="px-4 py-3 text-gray-400">Informacion basica del usuario</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:timer</code></td>
                                        <td className="px-4 py-3 text-gray-400">Estado y configuracion del timer</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:commands</code></td>
                                        <td className="px-4 py-3 text-gray-400">Lista de comandos del canal</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:alerts</code></td>
                                        <td className="px-4 py-3 text-gray-400">Configuracion de alertas</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:giveaways</code></td>
                                        <td className="px-4 py-3 text-gray-400">Sorteos activos e historial</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:goals</code></td>
                                        <td className="px-4 py-3 text-gray-400">Metas y progreso</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-blue-400">read:analytics</code></td>
                                        <td className="px-4 py-3 text-gray-400">Estadisticas del canal</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Write Scopes */}
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                            <Edit3 className="w-5 h-5 text-orange-400" />
                            Escritura (write:*)
                        </h3>
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-750">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Scope</th>
                                        <th className="px-4 py-3 text-left">Descripcion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-orange-400">write:timer</code></td>
                                        <td className="px-4 py-3 text-gray-400">Modificar configuracion del timer</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-orange-400">write:commands</code></td>
                                        <td className="px-4 py-3 text-gray-400">Crear/editar/eliminar comandos</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-orange-400">write:alerts</code></td>
                                        <td className="px-4 py-3 text-gray-400">Modificar configuracion de alertas</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-orange-400">write:giveaways</code></td>
                                        <td className="px-4 py-3 text-gray-400">Crear y gestionar sorteos</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-orange-400">write:goals</code></td>
                                        <td className="px-4 py-3 text-gray-400">Crear y modificar metas</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action Scopes */}
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                            <Zap className="w-5 h-5 text-red-400" />
                            Acciones (action:*)
                        </h3>
                        <div className="bg-gray-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-750">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Scope</th>
                                        <th className="px-4 py-3 text-left">Descripcion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-red-400">action:timer</code></td>
                                        <td className="px-4 py-3 text-gray-400">Iniciar/pausar/detener timer</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-red-400">action:alerts</code></td>
                                        <td className="px-4 py-3 text-gray-400">Disparar alertas manualmente</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-red-400">action:chat</code></td>
                                        <td className="px-4 py-3 text-gray-400">Enviar mensajes al chat</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-red-400">action:giveaway</code></td>
                                        <td className="px-4 py-3 text-gray-400">Iniciar/finalizar sorteos</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3"><code className="text-red-400">action:commands</code></td>
                                        <td className="px-4 py-3 text-gray-400">Ejecutar comandos</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Endpoints */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-purple-400" />
                        Endpoints
                    </h2>

                    <CollapsibleSection title="OAuth Endpoints" defaultOpen>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-600 text-xs font-bold rounded">GET</span>
                                    <code>/oauth/authorize</code>
                                </div>
                                <p className="text-gray-400 text-sm">Inicia el flujo de autorizacion</p>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/oauth/token</code>
                                </div>
                                <p className="text-gray-400 text-sm">Intercambia codigo por tokens o refresca tokens</p>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/oauth/revoke</code>
                                </div>
                                <p className="text-gray-400 text-sm">Revoca un token</p>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-600 text-xs font-bold rounded">GET</span>
                                    <code>/oauth/userinfo</code>
                                </div>
                                <p className="text-gray-400 text-sm">Informacion del usuario autenticado (requiere read:profile)</p>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Timer API">
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-600 text-xs font-bold rounded">GET</span>
                                    <code>/api/v1/timer</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Obtiene el estado actual del timer</p>
                                <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded">read:timer</span>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/timer/start</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Inicia el timer</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:timer</span>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/timer/pause</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Pausa el timer</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:timer</span>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/timer/stop</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Detiene el timer</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:timer</span>
                            </div>
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/timer/add</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Agrega tiempo al timer</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:timer</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Alerts API">
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/alerts/trigger</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Dispara una alerta personalizada</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:alerts</span>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="Chat API">
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-900 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-blue-600 text-xs font-bold rounded">POST</span>
                                    <code>/api/v1/chat/send</code>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">Envia un mensaje al chat de Twitch</p>
                                <span className="text-xs bg-red-600/20 text-red-400 px-2 py-1 rounded">action:chat</span>
                            </div>
                        </div>
                    </CollapsibleSection>
                </section>

                {/* Errors */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Lock className="w-6 h-6 text-purple-400" />
                        Errores
                    </h2>

                    <div className="bg-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-750">
                                <tr>
                                    <th className="px-4 py-3 text-left">Codigo</th>
                                    <th className="px-4 py-3 text-left">Error</th>
                                    <th className="px-4 py-3 text-left">Descripcion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                <tr>
                                    <td className="px-4 py-3 text-yellow-400">400</td>
                                    <td className="px-4 py-3"><code>invalid_request</code></td>
                                    <td className="px-4 py-3 text-gray-400">Parametros faltantes o invalidos</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-yellow-400">401</td>
                                    <td className="px-4 py-3"><code>invalid_token</code></td>
                                    <td className="px-4 py-3 text-gray-400">Token invalido o expirado</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-yellow-400">403</td>
                                    <td className="px-4 py-3"><code>insufficient_scope</code></td>
                                    <td className="px-4 py-3 text-gray-400">El token no tiene los scopes necesarios</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-yellow-400">404</td>
                                    <td className="px-4 py-3"><code>not_found</code></td>
                                    <td className="px-4 py-3 text-gray-400">Recurso no encontrado</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-red-400">429</td>
                                    <td className="px-4 py-3"><code>rate_limited</code></td>
                                    <td className="px-4 py-3 text-gray-400">Demasiadas solicitudes</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-red-400">500</td>
                                    <td className="px-4 py-3"><code>server_error</code></td>
                                    <td className="px-4 py-3 text-gray-400">Error interno del servidor</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Rate Limits */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <RefreshCw className="w-6 h-6 text-purple-400" />
                        Rate Limits
                    </h2>

                    <div className="bg-gray-800 rounded-xl p-6">
                        <ul className="space-y-3 text-gray-400">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <span><strong>100 requests/minuto</strong> por token</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <span><strong>10 requests/segundo</strong> burst maximo</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                <span>Headers de respuesta incluyen <code className="bg-gray-700 px-2 py-0.5 rounded">X-RateLimit-*</code></span>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Support */}
                <section>
                    <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-xl p-8 text-center">
                        <h2 className="text-2xl font-bold mb-4">¿Necesitas ayuda?</h2>
                        <p className="text-gray-400 mb-6">
                            Si tienes preguntas o problemas, contactanos.
                        </p>
                        <a
                            href="https://discord.gg/decatron"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
                        >
                            <ExternalLink className="w-5 h-5" />
                            Discord de Soporte
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
