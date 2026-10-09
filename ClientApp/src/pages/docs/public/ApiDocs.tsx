import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Code2, Key, Shield, Lock, RefreshCw, ExternalLink,
    CheckCircle, ChevronDown, ChevronRight,
    Eye, Edit3, Zap, Terminal, BookOpen
} from 'lucide-react';
import DocSection from '../../../components/docs/DocSection';
import DocAlert from '../../../components/docs/DocAlert';
import CodeBlock from '../../../components/docs/CodeBlock';

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-ds-border rounded-lg overflow-hidden my-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-ds-bg hover:bg-ds-raised transition-colors text-left"
            >
                {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-ds-soft" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-ds-soft" />
                )}
                <span className="font-bold text-ds-text">{title}</span>
            </button>
            {isOpen && (
                <div className="p-4 border-t border-ds-border">
                    {children}
                </div>
            )}
        </div>
    );
}

function EndpointCard({ method, path, description, scope }: { method: string; path: string; description: string; scope?: string }) {
    const methodColors: Record<string, string> = {
        GET: 'bg-ds-raised text-ds-accent-text ',
        POST: 'bg-ds-raised text-ds-accent-text ',
        PUT: 'bg-ds-raised text-ds-accent-text ',
        DELETE: 'bg-ds-raised text-ds-accent-text ',
    };

    return (
        <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[method] || ''}`}>{method}</span>
                <code className="text-sm font-mono text-ds-text">{path}</code>
            </div>
            <p className="text-sm text-ds-soft">{description}</p>
            {scope && (
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-ds-bg text-ds-accent-text rounded font-mono">
                    {scope}
                </span>
            )}
        </div>
    );
}

function ScopeTable({ title, icon, color, scopes }: { title: string; icon: React.ReactNode; color: string; scopes: { scope: string; description: string }[] }) {
    const colorMap: Record<string, string> = {
        blue: 'text-ds-accent-text ',
        orange: 'text-ds-accent-text ',
        red: 'bg-ds-raised text-ds-accent-text',
    };

    return (
        <div className="mb-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-ds-text mb-4">
                {icon}
                {title}
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-ds-bg border-b border-ds-border">
                            <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Scope</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Descripcion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-ds-border">
                        {scopes.map((s) => (
                            <tr key={s.scope}>
                                <td className="px-4 py-3 text-sm">
                                    <code className={`${colorMap[color]} font-mono`}>{s.scope}</code>
                                </td>
                                <td className="px-4 py-3 text-sm text-ds-soft">{s.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function ApiDocs() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <Code2 className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Decatron API
                        </h1>
                        <p className="text-ds-soft">
                            Documentacion para desarrolladores
                        </p>
                    </div>
                </div>
                <p className="text-ds-soft max-w-2xl">
                    Integra Decatron en tus aplicaciones usando nuestra API REST con autenticacion OAuth2.
                    Controla timers, alertas, comandos y mas.
                </p>
            </div>

            {/* Quick Start */}
            <DocSection title="Inicio Rapido">
                <div className="space-y-4">
                    <StepCard number={1} title="Registra tu aplicacion">
                        <p className="text-sm text-ds-soft">
                            Ve al <Link to="/developer" className="text-ds-accent-text hover:underline font-medium">Developer Portal</Link> y
                            crea una nueva aplicacion. Obtendras un <code className="px-2 py-0.5 bg-ds-bg rounded text-sm">client_id</code> y
                            un <code className="px-2 py-0.5 bg-ds-bg rounded text-sm">client_secret</code>.
                        </p>
                    </StepCard>

                    <StepCard number={2} title="Obtener autorizacion del usuario">
                        <p className="text-sm text-ds-soft mb-3">
                            Redirige al usuario a la pagina de autorizacion:
                        </p>
                        <CodeBlock language="url" code={`https://twitch.decatron.net/oauth/authorize?
  client_id=TU_CLIENT_ID
  &redirect_uri=https://tuapp.com/callback
  &response_type=code
  &scope=read:timer action:timer
  &state=random_state_string`} />
                    </StepCard>

                    <StepCard number={3} title="Intercambiar codigo por tokens">
                        <p className="text-sm text-ds-soft mb-3">
                            Cuando el usuario autorice, sera redirigido a tu redirect_uri con un codigo:
                        </p>
                        <CodeBlock language="bash" code={`curl -X POST https://twitch.decatron.net/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code" \\
  -d "code=CODIGO_RECIBIDO" \\
  -d "redirect_uri=https://tuapp.com/callback" \\
  -d "client_id=TU_CLIENT_ID" \\
  -d "client_secret=TU_CLIENT_SECRET"`} />
                        <p className="text-sm text-ds-soft mt-3 mb-2">Respuesta:</p>
                        <CodeBlock language="json" code={`{
  "access_token": "deca_abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "deca_refresh_xyz789...",
  "scope": "read:timer action:timer"
}`} />
                    </StepCard>

                    <StepCard number={4} title="Usar la API">
                        <p className="text-sm text-ds-soft mb-3">
                            Incluye el token en el header Authorization:
                        </p>
                        <CodeBlock language="bash" code={`curl https://twitch.decatron.net/api/v1/timer \\
  -H "Authorization: Bearer TU_ACCESS_TOKEN"`} />
                    </StepCard>
                </div>
            </DocSection>

            {/* Authentication */}
            <DocSection title="Autenticacion">
                <p className="text-ds-soft mb-4">
                    Decatron usa OAuth 2.0 con el flujo Authorization Code. Este es el flujo mas seguro
                    para aplicaciones que pueden mantener un secreto.
                </p>

                <div className="p-4 bg-ds-surface rounded-lg border border-ds-border mb-4">
                    <h4 className="font-bold text-ds-text mb-4">Flujo de Autorizacion</h4>
                    <div className="space-y-3">
                        {[
                            'Tu app redirige al usuario a /oauth/authorize',
                            'El usuario ve los permisos solicitados y aprueba o deniega',
                            'Decatron redirige al usuario de vuelta con un codigo temporal',
                            'Tu servidor intercambia el codigo por tokens en /oauth/token',
                            'Usa el access_token para llamar a la API',
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {i + 1}
                                </span>
                                <p className="text-sm text-ds-soft">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <CollapsibleSection title="PKCE (Proof Key for Code Exchange)">
                    <p className="text-sm text-ds-soft mb-3">
                        Para aplicaciones publicas (mobile, SPA), usa PKCE para mayor seguridad:
                    </p>
                    <CodeBlock language="javascript" code={`// Generar code_verifier (random string)
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
// en lugar de client_secret`} />
                </CollapsibleSection>

                <CollapsibleSection title="Refrescar Tokens">
                    <p className="text-sm text-ds-soft mb-3">
                        Los access tokens expiran en 1 hora. Usa el refresh token para obtener uno nuevo:
                    </p>
                    <CodeBlock language="bash" code={`curl -X POST https://twitch.decatron.net/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=TU_REFRESH_TOKEN" \\
  -d "client_id=TU_CLIENT_ID" \\
  -d "client_secret=TU_CLIENT_SECRET"`} />
                </CollapsibleSection>

                <CollapsibleSection title="Revocar Tokens">
                    <p className="text-sm text-ds-soft mb-3">
                        Para invalidar un token (ej: cuando el usuario cierra sesion):
                    </p>
                    <CodeBlock language="bash" code={`curl -X POST https://twitch.decatron.net/oauth/revoke \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "token=TOKEN_A_REVOCAR"`} />
                </CollapsibleSection>
            </DocSection>

            {/* Scopes */}
            <DocSection title="Scopes (Permisos)">
                <p className="text-ds-soft mb-6">
                    Los scopes definen que puede hacer tu aplicacion. Solicita solo los que necesitas.
                </p>

                <ScopeTable
                    title="Lectura (read:*)"
                    icon={<Eye className="w-5 h-5 text-ds-accent-text" />}
                    color="blue"
                    scopes={[
                        { scope: 'read:profile', description: 'Informacion basica del usuario' },
                        { scope: 'read:timer', description: 'Estado y configuracion del timer' },
                        { scope: 'read:commands', description: 'Lista de comandos del canal' },
                        { scope: 'read:alerts', description: 'Configuracion de alertas' },
                        { scope: 'read:giveaways', description: 'Sorteos activos e historial' },
                        { scope: 'read:goals', description: 'Metas y progreso' },
                        { scope: 'read:analytics', description: 'Estadisticas del canal' },
                    ]}
                />

                <ScopeTable
                    title="Escritura (write:*)"
                    icon={<Edit3 className="w-5 h-5 text-ds-accent-text" />}
                    color="orange"
                    scopes={[
                        { scope: 'write:timer', description: 'Modificar configuracion del timer' },
                        { scope: 'write:commands', description: 'Crear/editar/eliminar comandos' },
                        { scope: 'write:alerts', description: 'Modificar configuracion de alertas' },
                        { scope: 'write:giveaways', description: 'Crear y gestionar sorteos' },
                        { scope: 'write:goals', description: 'Crear y modificar metas' },
                    ]}
                />

                <ScopeTable
                    title="Acciones (action:*)"
                    icon={<Zap className="w-5 h-5 text-ds-accent-text" />}
                    color="red"
                    scopes={[
                        { scope: 'action:timer', description: 'Iniciar/pausar/detener timer' },
                        { scope: 'action:alerts', description: 'Disparar alertas manualmente' },
                        { scope: 'action:chat', description: 'Enviar mensajes al chat' },
                        { scope: 'action:giveaway', description: 'Iniciar/finalizar sorteos' },
                        { scope: 'action:commands', description: 'Ejecutar comandos' },
                    ]}
                />
            </DocSection>

            {/* Endpoints */}
            <DocSection title="Endpoints">
                <CollapsibleSection title="OAuth Endpoints" defaultOpen>
                    <div className="space-y-3">
                        <EndpointCard method="GET" path="/oauth/authorize" description="Inicia el flujo de autorizacion" />
                        <EndpointCard method="POST" path="/oauth/token" description="Intercambia codigo por tokens o refresca tokens" />
                        <EndpointCard method="POST" path="/oauth/revoke" description="Revoca un token" />
                        <EndpointCard method="GET" path="/oauth/userinfo" description="Informacion del usuario autenticado" scope="read:profile" />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Timer API">
                    <div className="space-y-3">
                        <EndpointCard method="GET" path="/api/v1/timer" description="Obtiene el estado actual del timer" scope="read:timer" />
                        <EndpointCard method="POST" path="/api/v1/timer/start" description="Inicia el timer" scope="action:timer" />
                        <EndpointCard method="POST" path="/api/v1/timer/pause" description="Pausa el timer" scope="action:timer" />
                        <EndpointCard method="POST" path="/api/v1/timer/stop" description="Detiene el timer" scope="action:timer" />
                        <EndpointCard method="POST" path="/api/v1/timer/add" description="Agrega tiempo al timer" scope="action:timer" />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Alerts API">
                    <div className="space-y-3">
                        <EndpointCard method="POST" path="/api/v1/alerts/trigger" description="Dispara una alerta personalizada" scope="action:alerts" />
                    </div>
                </CollapsibleSection>

                <CollapsibleSection title="Chat API">
                    <div className="space-y-3">
                        <EndpointCard method="POST" path="/api/v1/chat/send" description="Envia un mensaje al chat de Twitch" scope="action:chat" />
                    </div>
                </CollapsibleSection>
            </DocSection>

            {/* Errors */}
            <DocSection title="Errores">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Codigo</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Error</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Descripcion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <ErrorRow code="400" color="yellow" error="invalid_request" description="Parametros faltantes o invalidos" />
                            <ErrorRow code="401" color="yellow" error="invalid_token" description="Token invalido o expirado" />
                            <ErrorRow code="403" color="yellow" error="insufficient_scope" description="El token no tiene los scopes necesarios" />
                            <ErrorRow code="404" color="yellow" error="not_found" description="Recurso no encontrado" />
                            <ErrorRow code="429" color="red" error="rate_limited" description="Demasiadas solicitudes" />
                            <ErrorRow code="500" color="red" error="server_error" description="Error interno del servidor" />
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Rate Limits */}
            <DocSection title="Rate Limits">
                <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-ds-ok" />
                            <span className="text-sm text-ds-soft"><strong className="text-ds-text">100 requests/minuto</strong> por token</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-ds-ok" />
                            <span className="text-sm text-ds-soft"><strong className="text-ds-text">10 requests/segundo</strong> burst maximo</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-ds-ok" />
                            <span className="text-sm text-ds-soft">Headers de respuesta incluyen <code className="px-2 py-0.5 bg-ds-bg rounded text-xs">X-RateLimit-*</code></span>
                        </div>
                    </div>
                </div>
            </DocSection>

            {/* Support */}
            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text text-center">
                <h2 className="text-2xl font-black mb-4">Necesitas ayuda?</h2>
                <p className="text-ds-soft mb-6">
                    Si tienes preguntas o problemas con la API, consulta las preguntas frecuentes.
                </p>
                <Link
                    to="/docs/faq"
                    className="ds-btn ds-btn--primary ds-btn--lg"
                >
                    Ver FAQ
                </Link>
            </div>
        </div>
    );
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="p-5 bg-ds-surface rounded-lg border border-ds-border">
            <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 bg-ds-accent text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {number}
                </span>
                <h4 className="font-bold text-ds-text">{title}</h4>
            </div>
            {children}
        </div>
    );
}

function ErrorRow({ code, color, error, description }: { code: string; color: string; error: string; description: string }) {
    const colorClass = color === 'red' ? 'text-ds-accent-text ' : 'text-ds-accent-text ';
    return (
        <tr>
            <td className={`px-4 py-3 text-sm font-bold ${colorClass}`}>{code}</td>
            <td className="px-4 py-3 text-sm">
                <code className="text-sm font-mono text-ds-text">{error}</code>
            </td>
            <td className="px-4 py-3 text-sm text-ds-soft">{description}</td>
        </tr>
    );
}
