import { Shield, AlertTriangle, Ban, Clock, Settings, ArrowRight, MessageSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function ModerationDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
                        <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            Moderacion
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Filtros automaticos y acciones de moderacion
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/moderation/banned-words"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Palabras prohibidas */}
            <DocSection title="Lista de palabras prohibidas">
                <p className="mb-4">
                    Configura una lista de palabras o frases que seran filtradas automaticamente:
                </p>
                <div className="space-y-4">
                    <Step number={1} title="Agregar palabras">
                        <p>Escribe las palabras una por linea o separadas por comas.</p>
                    </Step>
                    <Step number={2} title="Configurar accion">
                        <p>Elige que hacer cuando se detecta: eliminar, timeout, ban.</p>
                    </Step>
                    <Step number={3} title="Establecer severidad">
                        <p>Algunas palabras pueden ser mas graves que otras.</p>
                    </Step>
                </div>
                <DocAlert type="tip" title="Patrones">
                    Usa * como comodin: "bad*" detectara "badword", "badly", etc.
                </DocAlert>
            </DocSection>

            {/* Sistema de strikes */}
            <DocSection title="Sistema de strikes">
                <p className="mb-4">
                    El sistema de strikes permite acumular infracciones antes de una accion severa:
                </p>
                <div className="space-y-3">
                    <StrikeLevel
                        level="1er strike"
                        action="Advertencia"
                        description="Mensaje de aviso en el chat"
                    />
                    <StrikeLevel
                        level="2do strike"
                        action="Timeout 5min"
                        description="El usuario no puede escribir por 5 minutos"
                    />
                    <StrikeLevel
                        level="3er strike"
                        action="Timeout 1h"
                        description="Timeout de una hora"
                    />
                    <StrikeLevel
                        level="4to strike"
                        action="Ban permanente"
                        description="El usuario es baneado del canal"
                    />
                </div>
                <DocAlert type="info" title="Reinicio">
                    Los strikes se reinician despues de un periodo configurable (por defecto 30 dias).
                </DocAlert>
            </DocSection>

            {/* Niveles de severidad */}
            <DocSection title="Niveles de severidad">
                <p className="mb-4">
                    Asigna diferentes severidades a diferentes tipos de contenido:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SeverityCard
                        level="Baja"
                        color="yellow"
                        description="Contenido ligeramente inapropiado"
                        example="Malas palabras leves"
                    />
                    <SeverityCard
                        level="Media"
                        color="orange"
                        description="Contenido claramente inapropiado"
                        example="Insultos, spam"
                    />
                    <SeverityCard
                        level="Alta"
                        color="red"
                        description="Contenido muy grave"
                        example="Odio, acoso, amenazas"
                    />
                </div>
            </DocSection>

            {/* Inmunidad */}
            <DocSection title="Inmunidad">
                <p className="mb-4">
                    Configura que roles son inmunes a la moderacion automatica:
                </p>
                <div className="space-y-3">
                    <ImmunityOption role="Broadcaster" immune={true} />
                    <ImmunityOption role="Moderadores" immune={true} />
                    <ImmunityOption role="VIPs" immune={true} configurable />
                    <ImmunityOption role="Subscribers" immune={false} configurable />
                    <ImmunityOption role="Viewers" immune={false} />
                </div>
            </DocSection>

            {/* Acciones automaticas */}
            <DocSection title="Acciones automaticas">
                <p className="mb-4">
                    El bot puede ejecutar acciones automaticas:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ActionCard
                        action="Eliminar mensaje"
                        description="Borra el mensaje ofensivo"
                    />
                    <ActionCard
                        action="Timeout"
                        description="Silencia al usuario temporalmente"
                    />
                    <ActionCard
                        action="Ban"
                        description="Banea al usuario permanentemente"
                    />
                    <ActionCard
                        action="Advertir"
                        description="Envia un mensaje de advertencia"
                    />
                    <ActionCard
                        action="Notificar mods"
                        description="Alerta a los moderadores"
                    />
                    <ActionCard
                        action="Agregar strike"
                        description="Suma un strike al usuario"
                    />
                </div>
            </DocSection>

            {/* Filtros adicionales */}
            <DocSection title="Filtros adicionales">
                <p className="mb-4">
                    Ademas de palabras, puedes filtrar:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Links:</strong> Bloquear enlaces no autorizados
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Mayusculas:</strong> Limitar mensajes en CAPS
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Emotes:</strong> Limitar cantidad de emotes
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        <strong>Repeticion:</strong> Detectar spam repetitivo
                    </li>
                </ul>
            </DocSection>

            {/* Logs */}
            <DocSection title="Registro de moderacion">
                <p className="mb-4">
                    Todas las acciones de moderacion se registran:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Usuario afectado
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Mensaje original
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Razon de la accion
                    </li>
                    <li className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                        <span className="text-[#2563eb]">•</span>
                        Fecha y hora
                    </li>
                </ul>
                <DocAlert type="tip" title="Analytics">
                    Ve el historial de moderacion en la seccion de Analytics.
                </DocAlert>
            </DocSection>
        </div>
    );
}

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
    return (
        <div className="flex gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex-shrink-0 w-8 h-8 bg-[#2563eb] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{children}</div>
            </div>
        </div>
    );
}

interface StrikeLevelProps {
    level: string;
    action: string;
    description: string;
}

function StrikeLevel({ level, action, description }: StrikeLevelProps) {
    return (
        <div className="flex items-center gap-4 bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-20 text-center">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{level}</span>
            </div>
            <div className="flex-1">
                <div className="font-bold text-gray-900 dark:text-white">{action}</div>
                <div className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</div>
            </div>
        </div>
    );
}

interface SeverityCardProps {
    level: string;
    color: string;
    description: string;
    example: string;
}

const severityColors: Record<string, string> = {
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
};

function SeverityCard({ level, color, description, example }: SeverityCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className={`w-full h-2 ${severityColors[color]} rounded-full mb-3`} />
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{level}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2">{description}</p>
            <span className="text-xs bg-[#f8fafc] dark:bg-[#374151] text-[#64748b] px-2 py-1 rounded">
                {example}
            </span>
        </div>
    );
}

interface ImmunityOptionProps {
    role: string;
    immune: boolean;
    configurable?: boolean;
}

function ImmunityOption({ role, immune, configurable }: ImmunityOptionProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#64748b]" />
                <span className="font-medium text-gray-900 dark:text-white">{role}</span>
                {configurable && (
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-[#2563eb] px-2 py-0.5 rounded">
                        Configurable
                    </span>
                )}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${immune ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {immune ? 'Inmune' : 'No inmune'}
            </div>
        </div>
    );
}

interface ActionCardProps {
    action: string;
    description: string;
}

function ActionCard({ action, description }: ActionCardProps) {
    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl p-4 border border-[#e2e8f0] dark:border-[#374151]">
            <h4 className="font-bold text-gray-900 dark:text-white">{action}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}
