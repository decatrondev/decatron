import { BarChart3, TrendingUp, Clock, Shield, Users, ArrowRight, Calendar, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function AnalyticsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Analiticas
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Estadisticas y metricas de tu canal
                        </p>
                    </div>
                </div>
                <Link
                    to="/analytics"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ver analiticas
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Dashboard */}
            <DocSection title="Dashboard de estadisticas">
                <p className="mb-4">
                    El dashboard de analiticas te muestra un resumen de la actividad de tu canal:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Users className="w-5 h-5" />}
                        title="Seguidores"
                        value="1,234"
                        change="+12"
                    />
                    <StatCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Tiempo de stream"
                        value="24h 30m"
                        change="Esta semana"
                    />
                    <StatCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        title="Comandos usados"
                        value="5,678"
                        change="+234"
                    />
                    <StatCard
                        icon={<Shield className="w-5 h-5" />}
                        title="Acciones de mod"
                        value="45"
                        change="Este mes"
                    />
                </div>
            </DocSection>

            {/* Eventos del timer */}
            <DocSection title="Eventos del Timer">
                <p className="mb-4">
                    Registra todos los eventos relacionados con el timer:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Inicio y fin de sesiones
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Pausas y reanudaciones
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Extensiones de tiempo (y quien las provoco)
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Metas alcanzadas
                    </li>
                </ul>
                <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-3">Ejemplo de evento</h4>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-[#64748b] dark:text-[#94a3b8]">14:32</span>
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs">+5 min</span>
                        <span className="text-gray-900 dark:text-white">StreamerPro regalo 5 subs</span>
                    </div>
                </div>
            </DocSection>

            {/* Moderacion */}
            <DocSection title="Historial de moderacion">
                <p className="mb-4">
                    Ve todas las acciones de moderacion ejecutadas:
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#f8fafc] dark:bg-[#374151] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Fecha</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Usuario</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Accion</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Razon</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            <tr>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Hoy 14:30</td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">user123</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 text-xs rounded">Timeout 5m</span></td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Spam</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Historial de streams */}
            <DocSection title="Historial de streams">
                <p className="mb-4">
                    Informacion de tus sesiones de streaming:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Fecha y duracion de cada stream
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Pico de viewers
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Nuevos seguidores
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Suscripciones recibidas
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Bits y donaciones
                    </li>
                </ul>
            </DocSection>

            {/* Exportar datos */}
            <DocSection title="Exportar datos">
                <p className="mb-4">
                    Exporta tus datos de analiticas en diferentes formatos:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ExportOption format="CSV" description="Para hojas de calculo" />
                    <ExportOption format="JSON" description="Para desarrollo" />
                    <ExportOption format="PDF" description="Para reportes" />
                </div>
                <DocAlert type="info" title="Rango de fechas">
                    Puedes seleccionar el rango de fechas antes de exportar.
                </DocAlert>
            </DocSection>

            {/* Filtros */}
            <DocSection title="Filtros disponibles">
                <p className="mb-4">
                    Filtra los datos por diferentes criterios:
                </p>
                <div className="flex flex-wrap gap-3">
                    <FilterChip label="Hoy" />
                    <FilterChip label="Esta semana" />
                    <FilterChip label="Este mes" />
                    <FilterChip label="Ultimos 3 meses" />
                    <FilterChip label="Este año" />
                    <FilterChip label="Personalizado" />
                </div>
            </DocSection>
        </div>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string;
    change: string;
}

function StatCard({ icon, title, value, change }: StatCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8] mb-2">
                {icon}
                <span className="text-sm">{title}</span>
            </div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
            <div className="text-sm text-green-600 dark:text-green-400">{change}</div>
        </div>
    );
}

interface ExportOptionProps {
    format: string;
    description: string;
}

function ExportOption({ format, description }: ExportOptionProps) {
    return (
        <div className="flex items-center gap-3 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151] cursor-pointer hover:border-[#2563eb] transition-colors">
            <Download className="w-5 h-5 text-[#2563eb]" />
            <div>
                <div className="font-bold text-gray-900 dark:text-white">{format}</div>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</div>
            </div>
        </div>
    );
}

interface FilterChipProps {
    label: string;
}

function FilterChip({ label }: FilterChipProps) {
    return (
        <button className="px-4 py-2 bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] rounded-lg hover:bg-[#2563eb] hover:text-white transition-colors text-sm font-medium">
            {label}
        </button>
    );
}
