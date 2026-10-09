import { Code2, Key, Shield, ArrowRight, Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function DeveloperPortalDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-bg rounded-lg flex items-center justify-center">
                        <Code2 className="w-8 h-8 text-ds-soft" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Portal de Desarrolladores
                        </h1>
                        <p className="text-ds-soft">
                            Crea aplicaciones OAuth que se integren con la API de Decatron
                        </p>
                    </div>
                </div>
                <Link
                    to="/developer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir al portal
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Que es */}
            <DocSection title="Que es el Portal de Desarrolladores?">
                <p>
                    El Portal de Desarrolladores te permite crear aplicaciones OAuth que se conectan
                    con la API de Decatron. Puedes crear bots, integraciones o herramientas externas
                    que interactuen con tu configuracion de Decatron.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard
                        icon={<Key className="w-5 h-5" />}
                        title="OAuth 2.0"
                        description="Autenticacion segura con PKCE"
                    />
                    <FeatureCard
                        icon={<Shield className="w-5 h-5" />}
                        title="Scopes"
                        description="Control granular de permisos"
                    />
                    <FeatureCard
                        icon={<Code2 className="w-5 h-5" />}
                        title="REST API"
                        description="Endpoints para todas las features"
                    />
                </div>
            </DocSection>

            {/* Crear app */}
            <DocSection title="Crear una aplicacion">
                <div className="space-y-3">
                    <StepItem number={1} text="Ve al Portal de Desarrolladores desde el dashboard" />
                    <StepItem number={2} text="Haz clic en 'Nueva Aplicacion'" />
                    <StepItem number={3} text="Completa el nombre, descripcion y URL de redireccion" />
                    <StepItem number={4} text="Selecciona los scopes (permisos) que necesita tu app" />
                    <StepItem number={5} text="Copia tu Client ID y Client Secret" />
                </div>
                <DocAlert type="warning" title="Importante">
                    El Client Secret solo se muestra una vez al crear la aplicacion.
                    Guardalo en un lugar seguro. Si lo pierdes, tendras que regenerarlo.
                </DocAlert>
            </DocSection>

            {/* Gestionar apps */}
            <DocSection title="Gestionar aplicaciones">
                <div className="space-y-4">
                    <ActionItem
                        icon={<Eye className="w-5 h-5" />}
                        title="Ver detalles"
                        description="Consulta el Client ID, estadisticas de uso (usuarios unicos, tokens activos) y estado de verificacion."
                    />
                    <ActionItem
                        icon={<RefreshCw className="w-5 h-5" />}
                        title="Regenerar secret"
                        description="Si pierdes tu Client Secret, puedes regenerarlo. Los tokens existentes seguiran funcionando."
                    />
                    <ActionItem
                        icon={<Trash2 className="w-5 h-5" />}
                        title="Eliminar aplicacion"
                        description="Elimina una aplicacion y revoca todos sus tokens. Esta accion no se puede deshacer."
                    />
                </div>
            </DocSection>

            {/* Scopes */}
            <DocSection title="Scopes disponibles">
                <p className="mb-4">
                    Los scopes definen que permisos tiene tu aplicacion:
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Categoria</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Scope</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Descripcion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <ScopeRow category="Lectura" scope="read:timer" description="Leer estado del timer" />
                            <ScopeRow category="" scope="read:commands" description="Leer lista de comandos" />
                            <ScopeRow category="" scope="read:alerts" description="Leer configuracion de alertas" />
                            <ScopeRow category="Escritura" scope="write:timer" description="Controlar el timer" />
                            <ScopeRow category="" scope="write:commands" description="Crear/editar comandos" />
                            <ScopeRow category="Acciones" scope="action:chat" description="Enviar mensajes al chat" />
                            <ScopeRow category="" scope="action:alerts" description="Disparar alertas" />
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* API Reference link */}
            <DocSection title="Documentacion de la API">
                <p className="mb-4">
                    Para detalles completos sobre endpoints, autenticacion y ejemplos de codigo,
                    consulta la referencia de la API:
                </p>
                <Link
                    to="/docs/api"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-bg text-ds-accent-text font-bold rounded-lg hover:bg-ds-raised transition-colors border border-ds-border"
                >
                    <Code2 className="w-4 h-4" />
                    Ver API Reference
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </DocSection>

            {/* Tips */}
            <DocSection title="Consejos">
                <DocAlert type="tip" title="PKCE">
                    Para aplicaciones frontend (SPA) usa el flujo PKCE en lugar de Client Secret.
                    Es mas seguro para apps que no pueden guardar secretos.
                </DocAlert>
                <DocAlert type="info" title="Rate limits">
                    La API tiene un limite de 100 requests por minuto y 10 por segundo en burst.
                    Los headers de respuesta incluyen informacion sobre el rate limit.
                </DocAlert>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-ds-surface rounded-lg border border-ds-border">
            <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-soft mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}

function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-xs">
                {number}
            </div>
            <p className="text-sm text-ds-soft">{text}</p>
        </div>
    );
}

function ActionItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-4 bg-ds-surface rounded-lg border border-ds-border">
            <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-soft flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-ds-text">{title}</h4>
                <p className="text-sm text-ds-soft">{description}</p>
            </div>
        </div>
    );
}

function ScopeRow({ category, scope, description }: { category: string; scope: string; description: string }) {
    return (
        <tr>
            <td className="px-4 py-3 text-sm font-medium text-ds-text">{category}</td>
            <td className="px-4 py-3 text-sm">
                <code className="px-2 py-0.5 bg-ds-bg text-ds-accent-text rounded text-xs font-mono">
                    {scope}
                </code>
            </td>
            <td className="px-4 py-3 text-sm text-ds-soft">{description}</td>
        </tr>
    );
}
