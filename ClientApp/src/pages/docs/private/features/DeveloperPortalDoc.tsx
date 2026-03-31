import { Code2, Key, Shield, ArrowRight, Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function DeveloperPortalDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900/20 rounded-2xl flex items-center justify-center">
                        <Code2 className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Portal de Desarrolladores
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Crea aplicaciones OAuth que se integren con la API de Decatron
                        </p>
                    </div>
                </div>
                <Link
                    to="/developer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
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
                            <tr className="bg-[#f8fafc] dark:bg-[#374151] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Categoria</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Scope</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Descripcion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#2563eb] font-bold rounded-lg hover:bg-blue-50 dark:hover:bg-[#374151]/80 transition-colors border border-[#e2e8f0] dark:border-[#374151]"
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
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900/20 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}

function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-xs">
                {number}
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{text}</p>
        </div>
    );
}

function ActionItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900/20 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 flex-shrink-0">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}

function ScopeRow({ category, scope, description }: { category: string; scope: string; description: string }) {
    return (
        <tr>
            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{category}</td>
            <td className="px-4 py-3 text-sm">
                <code className="px-2 py-0.5 bg-[#f8fafc] dark:bg-[#374151] text-[#2563eb] rounded text-xs font-mono">
                    {scope}
                </code>
            </td>
            <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</td>
        </tr>
    );
}
