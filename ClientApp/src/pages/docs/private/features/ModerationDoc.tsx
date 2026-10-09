import { Shield, AlertTriangle, Ban, Clock, Settings, ArrowRight, MessageSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function ModerationDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <Shield className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Moderacion
                        </h1>
                        <p className="text-ds-soft">
                            Filtros automaticos y acciones de moderacion
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/moderation/banned-words"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Links:</strong> Bloquear enlaces no autorizados
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Mayusculas:</strong> Limitar mensajes en CAPS
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Emotes:</strong> Limitar cantidad de emotes
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
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
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Usuario afectado
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Mensaje original
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Razon de la accion
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
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
        <div className="flex gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="flex-shrink-0 w-8 h-8 bg-ds-accent text-white rounded-full flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div>
                <h4 className="font-bold text-ds-text mb-1">{title}</h4>
                <div className="text-sm text-ds-soft">{children}</div>
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
        <div className="flex items-center gap-4 bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-20 text-center">
                <span className="text-sm font-bold text-ds-text">{level}</span>
            </div>
            <div className="flex-1">
                <div className="font-bold text-ds-text">{action}</div>
                <div className="text-sm text-ds-soft">{description}</div>
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
    yellow: 'bg-ds-accent/40',
    orange: 'bg-ds-accent/70',
    red: 'bg-ds-accent',
};

function SeverityCard({ level, color, description, example }: SeverityCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className={`w-full h-2 ${severityColors[color]} rounded-full mb-3`} />
            <h4 className="font-bold text-ds-text mb-1">{level}</h4>
            <p className="text-sm text-ds-soft mb-2">{description}</p>
            <span className="text-xs bg-ds-bg text-ds-soft px-2 py-1 rounded">
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
        <div className="flex items-center justify-between bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-ds-soft" />
                <span className="font-medium text-ds-text">{role}</span>
                {configurable && (
                    <span className="text-xs bg-ds-raised text-ds-accent-text px-2 py-0.5 rounded">
                        Configurable
                    </span>
                )}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${immune ? 'bg-ds-ok/10 text-ds-ok' : 'bg-ds-danger/10 text-ds-danger'}`}>
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
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <h4 className="font-bold text-ds-text">{action}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
        </div>
    );
}
