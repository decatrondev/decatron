import { Monitor, Copy, Check, Clock, Bell, Gift, Target, Volume2, DollarSign, MessageSquare, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function OverlaysGuide() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Configurar Overlays en OBS
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Guia paso a paso para agregar overlays de Decatron a tu stream
                        </p>
                    </div>
                </div>
            </div>

            {/* Que es un overlay */}
            <DocSection title="Que es un overlay?">
                <p>
                    Un overlay es un elemento visual que se muestra sobre tu stream. Decatron proporciona
                    overlays para mostrar informacion en tiempo real como timers, alertas, metas y mas.
                </p>
                <p>
                    Los overlays funcionan como paginas web que puedes agregar a OBS usando una fuente de
                    navegador. Son transparentes y se actualizan automaticamente.
                </p>
            </DocSection>

            {/* Como agregar a OBS */}
            <DocSection title="Como agregar un overlay a OBS">
                <div className="space-y-4">
                    <StepCard
                        number={1}
                        title="Abre OBS Studio"
                        description="Inicia OBS y selecciona la escena donde quieres agregar el overlay."
                    />
                    <StepCard
                        number={2}
                        title="Agregar fuente de navegador"
                        description="En el panel 'Fuentes', haz clic en '+' y selecciona 'Navegador'."
                    />
                    <StepCard
                        number={3}
                        title="Nombrar la fuente"
                        description="Dale un nombre descriptivo como 'Decatron Timer' y haz clic en OK."
                    />
                    <StepCard
                        number={4}
                        title="Configurar la URL"
                        description="Copia la URL del overlay desde tu dashboard y pegala en el campo 'URL'."
                    />
                    <StepCard
                        number={5}
                        title="Ajustar dimensiones"
                        description="Configura el ancho y alto. Recomendamos 1920x1080 para pantalla completa."
                    />
                    <StepCard
                        number={6}
                        title="Opciones adicionales"
                        description="Activa 'Actualizar navegador cuando la escena se active' para refrescar automaticamente."
                    />
                </div>

                <DocAlert type="tip" title="Consejo">
                    Los overlays tienen fondo transparente por defecto. Si ves un fondo blanco o negro,
                    asegurate de que la opcion "CSS personalizado" no tenga estilos de fondo.
                </DocAlert>
            </DocSection>

            {/* Dimensiones recomendadas */}
            <DocSection title="Dimensiones recomendadas">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#f8fafc] dark:bg-[#374151] border-b border-[#e2e8f0] dark:border-[#374151]">
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Overlay</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Ancho</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Alto</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">Notas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#374151]">
                            <tr>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Timer</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1920</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1080</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Pantalla completa</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Alertas</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1920</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1080</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Pantalla completa</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Metas</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">800</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">200</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Barra horizontal</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Shoutout</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1920</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">1080</td>
                                <td className="px-4 py-3 text-sm text-[#64748b] dark:text-[#94a3b8]">Pantalla completa</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* URLs de overlays */}
            <DocSection title="URLs de Overlays">
                <p className="mb-4">
                    Cada overlay tiene una URL unica que incluye tu token de autenticacion.
                    Puedes encontrar las URLs en la seccion correspondiente del dashboard.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <OverlayCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Timer"
                        description="Temporizador con barras de progreso"
                        configPath="/overlays/timer"
                    />
                    <OverlayCard
                        icon={<Bell className="w-5 h-5" />}
                        title="Alertas de Eventos"
                        description="Follows, subs, bits, raids"
                        configPath="/overlays/event-alerts"
                    />
                    <OverlayCard
                        icon={<Gift className="w-5 h-5" />}
                        title="Sorteos"
                        description="Overlay de giveaways"
                        configPath="/features/giveaways"
                    />
                    <OverlayCard
                        icon={<Target className="w-5 h-5" />}
                        title="Metas"
                        description="Barra de progreso de goals"
                        configPath="/overlays/goals"
                    />
                    <OverlayCard
                        icon={<Volume2 className="w-5 h-5" />}
                        title="Sound Alerts"
                        description="Alertas de sonido"
                        configPath="/features/sound-alerts"
                    />
                    <OverlayCard
                        icon={<DollarSign className="w-5 h-5" />}
                        title="Donaciones"
                        description="Alertas de tips"
                        configPath="/features/tips"
                    />
                    <OverlayCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        title="Shoutout"
                        description="Promocion de canales"
                        configPath="/overlays/shoutout"
                    />
                </div>
            </DocSection>

            {/* Troubleshooting */}
            <DocSection title="Solucion de problemas">
                <div className="space-y-4">
                    <TroubleshootItem
                        problem="El overlay no se muestra"
                        solutions={[
                            "Verifica que la URL sea correcta y este completa",
                            "Asegurate de que el navegador de OBS tenga internet",
                            "Revisa que no haya errores en la consola de OBS (Ver → Docks → Browser)"
                        ]}
                    />
                    <TroubleshootItem
                        problem="El overlay tiene fondo blanco/negro"
                        solutions={[
                            "Borra cualquier CSS personalizado en las propiedades de la fuente",
                            "Asegurate de que 'Custom CSS' este vacio o solo tenga: body { background: transparent; }"
                        ]}
                    />
                    <TroubleshootItem
                        problem="El overlay no se actualiza"
                        solutions={[
                            "Haz clic derecho en la fuente y selecciona 'Actualizar'",
                            "Activa 'Actualizar navegador cuando la escena se active' en propiedades",
                            "Verifica tu conexion a internet"
                        ]}
                    />
                    <TroubleshootItem
                        problem="El overlay se ve borroso"
                        solutions={[
                            "Asegurate de usar las dimensiones correctas (1920x1080 recomendado)",
                            "No escales la fuente del navegador, ajusta las dimensiones en propiedades"
                        ]}
                    />
                </div>
            </DocSection>

            {/* Consejos avanzados */}
            <DocSection title="Consejos avanzados">
                <div className="space-y-4">
                    <DocAlert type="tip" title="Multiples escenas">
                        Puedes agregar el mismo overlay a multiples escenas. OBS reutilizara la fuente
                        si usas "Agregar existente" en lugar de crear una nueva.
                    </DocAlert>
                    <DocAlert type="info" title="Interaccion desactivada">
                        Los overlays de Decatron no requieren interaccion. Puedes desactivar
                        "Control de audio via OBS" y "Shutdown source when not visible" para mejor rendimiento.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

interface StepCardProps {
    number: number;
    title: string;
    description: string;
}

function StepCard({ number, title, description }: StepCardProps) {
    return (
        <div className="flex gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex-shrink-0 w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
        </div>
    );
}

interface OverlayCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    configPath: string;
}

function OverlayCard({ icon, title, description, configPath }: OverlayCardProps) {
    return (
        <Link
            to={configPath}
            className="flex items-start gap-3 p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] transition-colors group"
        >
            <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#374151] rounded-lg flex items-center justify-center text-[#2563eb] flex-shrink-0">
                {icon}
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                    {title}
                </h4>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-[#64748b] group-hover:text-[#2563eb] transition-colors" />
        </Link>
    );
}

interface TroubleshootItemProps {
    problem: string;
    solutions: string[];
}

function TroubleshootItem({ problem, solutions }: TroubleshootItemProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">{problem}</h4>
            <ul className="space-y-1">
                {solutions.map((solution, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb] mt-1">•</span>
                        {solution}
                    </li>
                ))}
            </ul>
        </div>
    );
}
