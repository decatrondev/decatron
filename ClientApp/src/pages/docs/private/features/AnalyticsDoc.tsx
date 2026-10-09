import { BarChart3, TrendingUp, Clock, Shield, Users, ArrowRight, Calendar, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function AnalyticsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Analiticas
                        </h1>
                        <p className="text-ds-soft">
                            Estadisticas y metricas de tu canal
                        </p>
                    </div>
                </div>
                <Link
                    to="/analytics"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Inicio y fin de sesiones
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Pausas y reanudaciones
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Extensiones de tiempo (y quien las provoco)
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Metas alcanzadas
                    </li>
                </ul>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <h4 className="font-bold text-ds-text mb-3">Ejemplo de evento</h4>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-ds-soft">14:32</span>
                        <span className="px-2 py-0.5 bg-ds-ok/10 text-ds-ok rounded text-xs">+5 min</span>
                        <span className="text-ds-text">StreamerPro regalo 5 subs</span>
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
                            <tr className="bg-ds-bg border-b border-ds-border">
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Fecha</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Usuario</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Accion</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-ds-text">Razon</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ds-border">
                            <tr>
                                <td className="px-4 py-3 text-sm text-ds-soft">Hoy 14:30</td>
                                <td className="px-4 py-3 text-sm text-ds-text">user123</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-ds-raised text-ds-accent-text text-xs rounded">Timeout 5m</span></td>
                                <td className="px-4 py-3 text-sm text-ds-soft">Spam</td>
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Fecha y duracion de cada stream
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Pico de viewers
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Nuevos seguidores
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Suscripciones recibidas
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
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
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="flex items-center gap-2 text-ds-soft mb-2">
                {icon}
                <span className="text-sm">{title}</span>
            </div>
            <div className="text-2xl font-black text-ds-text">{value}</div>
            <div className="text-sm text-ds-ok">{change}</div>
        </div>
    );
}

interface ExportOptionProps {
    format: string;
    description: string;
}

function ExportOption({ format, description }: ExportOptionProps) {
    return (
        <div className="flex items-center gap-3 bg-ds-surface rounded-lg p-4 border border-ds-border cursor-pointer hover:border-ds-accent transition-colors">
            <Download className="w-5 h-5 text-ds-accent-text" />
            <div>
                <div className="font-bold text-ds-text">{format}</div>
                <div className="text-sm text-ds-soft">{description}</div>
            </div>
        </div>
    );
}

interface FilterChipProps {
    label: string;
}

function FilterChip({ label }: FilterChipProps) {
    return (
        <button className="px-4 py-2 bg-ds-bg text-ds-soft rounded-lg hover:bg-ds-accent-hover hover:text-white transition-colors text-sm font-medium">
            {label}
        </button>
    );
}
