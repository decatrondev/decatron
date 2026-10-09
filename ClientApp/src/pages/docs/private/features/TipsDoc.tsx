import { DollarSign, CreditCard, Bell, Settings, ArrowRight, Shield, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function TipsDoc() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-ds-surface rounded-lg p-8 border border-ds-border">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center">
                        <DollarSign className="w-8 h-8 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">
                            Donaciones / Tips
                        </h1>
                        <p className="text-ds-soft">
                            Recibe donaciones con PayPal y alertas personalizadas
                        </p>
                    </div>
                </div>
                <Link
                    to="/features/tips"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ds-accent text-white font-bold rounded-lg hover:bg-ds-accent-hover transition-colors"
                >
                    Ir a configuracion
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            {/* Como funciona */}
            <DocSection title="Como funciona">
                <p className="mb-4">
                    El sistema de donaciones de Decatron te permite recibir tips de tu audiencia
                    directamente a tu cuenta de PayPal, con alertas en tu stream.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FeatureCard
                        icon={<CreditCard className="w-5 h-5" />}
                        title="PayPal"
                        description="Recibe pagos directamente en tu cuenta"
                    />
                    <FeatureCard
                        icon={<Bell className="w-5 h-5" />}
                        title="Alertas"
                        description="Notificaciones en tiempo real"
                    />
                    <FeatureCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Timer"
                        description="Integracion con el timer"
                    />
                </div>
            </DocSection>

            {/* Configurar PayPal */}
            <DocSection title="Configurar PayPal">
                <div className="space-y-4">
                    <Step number={1} title="Conecta tu cuenta de PayPal">
                        <p>Ve a la configuracion de Tips y conecta tu cuenta de PayPal Business o Personal.</p>
                    </Step>
                    <Step number={2} title="Configura el monto minimo">
                        <p>Establece el monto minimo de donacion (recomendamos $1 USD).</p>
                    </Step>
                    <Step number={3} title="Personaliza la pagina de donacion">
                        <p>Agrega tu logo, colores y mensaje personalizado.</p>
                    </Step>
                    <Step number={4} title="Comparte tu enlace">
                        <p>Comparte el enlace de donacion con tu audiencia.</p>
                    </Step>
                </div>
                <DocAlert type="info" title="Comisiones">
                    Decatron no cobra comision por donaciones. Solo aplican las comisiones estandar de PayPal.
                </DocAlert>
            </DocSection>

            {/* Pagina de donacion */}
            <DocSection title="Pagina de donacion">
                <p className="mb-4">
                    La pagina de donacion es personalizable:
                </p>
                <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Logo:</strong> Tu imagen de perfil o logo personalizado
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Colores:</strong> Personaliza el tema de la pagina
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Mensaje:</strong> Texto de bienvenida personalizado
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        <strong>Montos sugeridos:</strong> Botones con montos predefinidos
                    </li>
                </ul>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <p className="text-sm text-ds-soft mb-2">Tu enlace de donacion:</p>
                    <code className="text-ds-accent-text font-mono">https://twitch.decatron.net/tip/tu-canal</code>
                </div>
            </DocSection>

            {/* Alertas */}
            <DocSection title="Alertas de donacion">
                <p className="mb-4">
                    Configura como se muestran las alertas cuando alguien dona:
                </p>
                <div className="space-y-3">
                    <AlertOption
                        title="Mensaje"
                        description="Texto que se muestra con el nombre y monto"
                        example="{user} dono ${amount}!"
                    />
                    <AlertOption
                        title="Sonido"
                        description="Audio que se reproduce con la alerta"
                        example="notification.mp3"
                    />
                    <AlertOption
                        title="Duracion"
                        description="Tiempo que se muestra la alerta"
                        example="5 segundos"
                    />
                    <AlertOption
                        title="TTS"
                        description="Lee el mensaje en voz alta"
                        example="Activado/Desactivado"
                    />
                </div>
            </DocSection>

            {/* Integracion con timer */}
            <DocSection title="Integracion con Timer">
                <p className="mb-4">
                    Las donaciones pueden extender automaticamente el timer:
                </p>
                <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
                    <h4 className="font-bold text-ds-text mb-3">Ejemplo de configuracion</h4>
                    <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-ds-soft">
                            <span className="text-ds-accent-text">•</span>
                            $1 = 1 minuto extra
                        </li>
                        <li className="flex items-center gap-2 text-ds-soft">
                            <span className="text-ds-accent-text">•</span>
                            $5 = 10 minutos extra
                        </li>
                        <li className="flex items-center gap-2 text-ds-soft">
                            <span className="text-ds-accent-text">•</span>
                            $10 = 30 minutos extra
                        </li>
                    </ul>
                </div>
                <DocAlert type="tip" title="Subathon">
                    Perfecto para subathons donde quieres que las donaciones extiendan el stream.
                </DocAlert>
            </DocSection>

            {/* Historial */}
            <DocSection title="Historial de donaciones">
                <p className="mb-4">
                    Accede al historial completo de donaciones:
                </p>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Fecha y hora
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Nombre del donante
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Monto
                    </li>
                    <li className="flex items-center gap-2 text-ds-soft">
                        <span className="text-ds-accent-text">•</span>
                        Mensaje (si incluyo uno)
                    </li>
                </ul>
            </DocSection>

            {/* Seguridad */}
            <DocSection title="Seguridad">
                <div className="space-y-4">
                    <DocAlert type="info" title="Proteccion de datos">
                        Decatron no almacena informacion de pago. Todos los pagos se procesan
                        directamente a traves de PayPal.
                    </DocAlert>
                    <DocAlert type="warning" title="Reembolsos">
                        Los reembolsos deben gestionarse directamente en PayPal.
                        Recomendamos tener politicas claras de donaciones.
                    </DocAlert>
                </div>
            </DocSection>
        </div>
    );
}

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div className="w-10 h-10 bg-ds-raised border border-ds-border rounded-lg flex items-center justify-center text-ds-accent-text mb-3">
                {icon}
            </div>
            <h4 className="font-bold text-ds-text mb-1">{title}</h4>
            <p className="text-sm text-ds-soft">{description}</p>
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

interface AlertOptionProps {
    title: string;
    description: string;
    example: string;
}

function AlertOption({ title, description, example }: AlertOptionProps) {
    return (
        <div className="flex items-center justify-between bg-ds-surface rounded-lg p-4 border border-ds-border">
            <div>
                <h4 className="font-bold text-ds-text">{title}</h4>
                <p className="text-sm text-ds-soft">{description}</p>
            </div>
            <code className="text-xs bg-ds-bg text-ds-soft px-2 py-1 rounded">
                {example}
            </code>
        </div>
    );
}
