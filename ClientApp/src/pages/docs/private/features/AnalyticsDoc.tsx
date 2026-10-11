import { BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocSection from '../../../../components/docs/DocSection';

export default function AnalyticsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">Analytics</h1>
                        <p className="text-ds-soft">Estadísticas y registros de tu canal</p>
                    </div>
                </div>
                <Link
                    to="/analytics"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ver analytics
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Rango */}
            <DocSection title="Periodo">
                <p>
                    Todas las pestañas muestran el periodo que elijas arriba: los últimos 7, 30 o 90 días, o un rango personalizado
                    con fecha de inicio y de fin. Al abrir la página se muestran los últimos 7 días. El botón <strong>Actualizar</strong> vuelve a cargar los datos.
                </p>
            </DocSection>

            {/* Pestañas */}
            <DocSection title="Pestañas">
                <ul className="space-y-3">
                    <DocItem label="Resumen">Cantidad de eventos del Timer, tiempo agregado, acciones de moderación y cambios de juego en el periodo, además de los tipos de evento más frecuentes y los eventos por día.</DocItem>
                    <DocItem label="Eventos Timer">El historial de eventos que sumaron tiempo al timer: fecha, tipo (follow, sub, Prime, bits, raid, regalo de subs, tip, comando o hype train), usuario, tiempo y detalles.</DocItem>
                    <DocItem label="Moderación">Total de acciones, cuántas fueron severas, palabras únicas y las palabras más detectadas, con el historial de cada acción: fecha, usuario, palabra, severidad, acción y strike.</DocItem>
                    <DocItem label="Historial Stream">Los cambios de categoría y de título del stream, con quién los hizo. Se puede filtrar por categoría o por título.</DocItem>
                    <DocItem label="Chat">Total de mensajes y usuarios únicos, con el historial del chat y una búsqueda por usuario o por mensaje.</DocItem>
                    <DocItem label="Actividad">Nuevos followers y total de tips, con los followers y los tips por día y los principales supporters.</DocItem>
                </ul>
                <p className="text-ds-soft mt-3">Las listas largas se paginan, y puedes elegir cuántos registros ver por página.</p>
            </DocSection>

            {/* Exportar */}
            <DocSection title="Exportar a CSV">
                <p className="mb-4">El botón <strong>Exportar CSV</strong> descarga los datos del periodo elegido. Incluye:</p>
                <ul className="space-y-2">
                    <DocItem label="Eventos del Timer">Follows, subs, bits y el resto de eventos.</DocItem>
                    <DocItem label="Acciones de moderación">Las del periodo.</DocItem>
                    <DocItem label="Historial de juegos y títulos">Los cambios del stream.</DocItem>
                    <DocItem label="Mensajes de chat">Los del periodo.</DocItem>
                </ul>
            </DocSection>
        </div>
    );
}

function DocItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-2 text-ds-soft">
            <span className="text-ds-accent-text">•</span>
            <span><strong className="text-ds-text">{label}:</strong> {children}</span>
        </li>
    );
}
