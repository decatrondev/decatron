import { HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../components/docs/DocAlert';

export default function FAQ() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-[#2563eb]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white">
                            Preguntas Frecuentes
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">
                            Respuestas a las dudas mas comunes sobre Decatron
                        </p>
                    </div>
                </div>
            </div>

            {/* FAQ Sections */}
            <FAQSection title="General">
                <FAQItem
                    question="Que es Decatron?"
                    answer="Decatron es un bot de Twitch todo-en-uno que te permite gestionar comandos, overlays, alertas, sorteos, metas y mucho mas. Esta diseñado para ser facil de usar pero con opciones avanzadas para streamers experimentados."
                />
                <FAQItem
                    question="Es gratis?"
                    answer="Si, Decatron es completamente gratuito. Todas las features principales estan disponibles sin costo. En el futuro podrian agregarse features premium opcionales, pero el core del bot siempre sera gratis."
                />
                <FAQItem
                    question="Que navegadores son compatibles?"
                    answer="Decatron funciona en todos los navegadores modernos: Chrome, Firefox, Edge, Safari y Opera. Recomendamos usar la ultima version de tu navegador para la mejor experiencia."
                />
            </FAQSection>

            <FAQSection title="Conexion y configuracion">
                <FAQItem
                    question="Como conecto el bot a mi canal?"
                >
                    <p className="mb-3">
                        Conectar Decatron a tu canal es muy sencillo:
                    </p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>Haz clic en "Iniciar Sesion" en la pagina principal</li>
                        <li>Autoriza a Decatron con tu cuenta de Twitch</li>
                        <li>El bot se conectara automaticamente a tu canal</li>
                    </ol>
                    <div className="mt-4">
                        <Link
                            to="/docs/getting-started"
                            className="inline-flex items-center gap-2 text-[#2563eb] font-medium hover:underline"
                        >
                            Ver guia completa
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                </FAQItem>
                <FAQItem
                    question="Puedo usar el bot en multiples canales?"
                    answer="Actualmente Decatron esta diseñado para un canal por cuenta. Si necesitas gestionar multiples canales, tendras que iniciar sesion con cada cuenta por separado."
                />
                <FAQItem
                    question="Como cambio el prefijo de comandos?"
                    answer="Ve a Configuracion en el dashboard y busca la opcion 'Prefijo de comandos'. Por defecto es '!' pero puedes cambiarlo a cualquier caracter como '$', '?', etc."
                />
            </FAQSection>

            <FAQSection title="Comandos">
                <FAQItem
                    question="El bot no responde a comandos, que hago?"
                >
                    <p className="mb-3">Si el bot no responde, verifica lo siguiente:</p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>Asegurate de que has iniciado sesion y el bot esta conectado (indicador verde en el dashboard)</li>
                        <li>Verifica que el comando existe y esta habilitado</li>
                        <li>Comprueba que tienes los permisos necesarios para usar ese comando</li>
                        <li>Revisa que no haya un cooldown activo</li>
                    </ol>
                    <DocAlert type="tip" title="Consejo">
                        Prueba el comando !hola en el chat. Si no funciona, hay un problema de conexion.
                    </DocAlert>
                </FAQItem>
                <FAQItem
                    question="Como creo un comando personalizado?"
                >
                    <p className="mb-3">
                        Para crear un comando personalizado:
                    </p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>Ve a Comandos → Personalizados en el dashboard</li>
                        <li>Haz clic en "Nuevo Comando"</li>
                        <li>Escribe el nombre del comando (sin el !)</li>
                        <li>Escribe la respuesta usando variables si lo deseas</li>
                        <li>Configura permisos y cooldown</li>
                        <li>Guarda el comando</li>
                    </ol>
                    <div className="mt-4">
                        <Link
                            to="/docs/commands/custom"
                            className="inline-flex items-center gap-2 text-[#2563eb] font-medium hover:underline"
                        >
                            Ver documentacion de comandos
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                </FAQItem>
                <FAQItem
                    question="Que variables puedo usar en los comandos?"
                    answer="Decatron tiene muchas variables disponibles como {user}, {game}, {title}, {uptime}, {followage} y mas. Cada variable se reemplaza automaticamente por su valor en tiempo real."
                >
                    <div className="mt-4">
                        <Link
                            to="/docs/variables"
                            className="inline-flex items-center gap-2 text-[#2563eb] font-medium hover:underline"
                        >
                            Ver todas las variables
                            <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>
                </FAQItem>
            </FAQSection>

            <FAQSection title="Overlays">
                <FAQItem
                    question="Como agrego overlays a OBS?"
                >
                    <p className="mb-3">
                        Para agregar un overlay a OBS:
                    </p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>Abre OBS Studio</li>
                        <li>En la escena donde quieres el overlay, haz clic en "+" en Fuentes</li>
                        <li>Selecciona "Navegador"</li>
                        <li>Dale un nombre y haz clic en OK</li>
                        <li>Copia la URL del overlay desde tu dashboard</li>
                        <li>Pega la URL en el campo "URL"</li>
                        <li>Ajusta el ancho y alto (1920x1080 recomendado para pantalla completa)</li>
                        <li>Haz clic en OK</li>
                    </ol>
                    <DocAlert type="info">
                        Los overlays tienen fondo transparente, asi que puedes colocarlos sobre tu escena.
                    </DocAlert>
                </FAQItem>
                <FAQItem
                    question="Los overlays no se actualizan, que hago?"
                >
                    <p className="mb-3">Si los overlays no se actualizan:</p>
                    <ol className="list-decimal ml-4 space-y-2">
                        <li>Haz clic derecho en la fuente del navegador en OBS</li>
                        <li>Selecciona "Actualizar"</li>
                        <li>Si el problema persiste, selecciona "Propiedades" y activa "Actualizar navegador cuando la escena se active"</li>
                    </ol>
                </FAQItem>
            </FAQSection>

            <FAQSection title="Soporte">
                <FAQItem
                    question="Como reporto un bug?"
                    answer="Puedes reportar bugs a traves de nuestro Discord o creando un issue en GitHub. Incluye todos los detalles posibles: que estabas haciendo, que esperabas que pasara, y que paso realmente."
                />
                <FAQItem
                    question="Donde puedo pedir nuevas features?"
                    answer="Las sugerencias de features son bienvenidas en nuestro Discord o GitHub. Revisamos todas las sugerencias y priorizamos las mas pedidas por la comunidad."
                />
                <FAQItem
                    question="Hay un servidor de Discord?"
                    answer="Si, tenemos un servidor de Discord donde puedes obtener ayuda, reportar bugs, sugerir features y conectar con otros streamers que usan Decatron."
                />
            </FAQSection>

            {/* Contact CTA */}
            <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151] text-center">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">
                    No encontraste lo que buscabas?
                </h2>
                <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                    Revisa la documentacion completa o contactanos directamente.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <Link
                        to="/docs"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Ver documentacion
                    </Link>
                </div>
            </div>
        </div>
    );
}

interface FAQSectionProps {
    title: string;
    children: React.ReactNode;
}

function FAQSection({ title, children }: FAQSectionProps) {
    return (
        <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">{title}</h2>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}

interface FAQItemProps {
    question: string;
    answer?: string;
    children?: React.ReactNode;
}

function FAQItem({ question, answer, children }: FAQItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f8fafc] dark:hover:bg-[#374151]/50 transition-colors"
            >
                <span className="font-bold text-gray-900 dark:text-white pr-4">{question}</span>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#64748b] flex-shrink-0" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-[#64748b] flex-shrink-0" />
                )}
            </button>
            {isOpen && (
                <div className="px-4 pb-4 text-[#64748b] dark:text-[#94a3b8]">
                    {answer && <p>{answer}</p>}
                    {children}
                </div>
            )}
        </div>
    );
}
