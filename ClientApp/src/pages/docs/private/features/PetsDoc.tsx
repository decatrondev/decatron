import { Cat, ArrowRight, Footprints, MessageSquare, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import DocAlert from '../../../../components/docs/DocAlert';
import DocSection from '../../../../components/docs/DocSection';

export default function PetsDoc() {
    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-8 border border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <Cat className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Mascota</h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">Un gato 3D que vive en tu stream</p>
                    </div>
                </div>
                <Link to="/overlays/pets" className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
                    Ir a configuración <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <DocSection title="¿Qué es?">
                <p>
                    Una mascota en 3D (por ahora un gato) que pasea por tu overlay, se sienta y se echa a dormir cuando el canal está tranquilo.
                    Es un modelo 3D real que se dibuja en tu navegador de OBS, no un gif: puedes cambiarle el tamaño, ponerle nombre y decidir
                    cuánto se mueve. Es gratis para todos los canales.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FeatureCard icon={<Footprints className="w-5 h-5" />} title="Vive sola" description="Pasea, se sienta y duerme con los tiempos que tú le pongas" />
                    <FeatureCard icon={<MessageSquare className="w-5 h-5" />} title="Habla" description="Nombre encima y burbujas de texto con tu estilo" />
                    <FeatureCard icon={<Monitor className="w-5 h-5" />} title="Una URL" description="Fuente de navegador transparente, sin nada más que instalar" />
                </div>
            </DocSection>

            <DocSection title="Paso a paso">
                <ol className="list-decimal pl-5 space-y-2">
                    <li><b>Mascota</b>: elige el modelo, ponle nombre y decide si se muestra encima. Ahí mismo eliges la fuente y el color del nombre y de las burbujas.</li>
                    <li><b>Comportamiento</b>: cada cuánto hace algo, qué tan rápido camina, por qué zona del overlay se mueve, cuánto se queda sentada y tras cuánto tiempo sin actividad se duerme.</li>
                    <li><b>Overlay</b>: tamaño de la fuente de OBS, alto real de la mascota en píxeles, a qué altura del borde inferior apoya las patas, inclinación de cámara y sombra. Copia la URL.</li>
                    <li><b>Probar</b>: elige qué hace y qué dice, y mándalo a la vista previa o directo al overlay que ya tienes en OBS.</li>
                </ol>
                <DocAlert type="tip" title="La vista previa es el overlay">
                    Lo que ves en el panel es exactamente la misma escena que se dibuja en OBS, escalada para que entre en la pantalla. Guarda para aplicar los cambios.
                </DocAlert>
            </DocSection>

            <DocSection title="En OBS">
                <p>
                    Agrega una <b>fuente de navegador</b> con la URL del panel y el mismo ancho y alto que pusiste en la pestaña Overlay (por defecto 1920×320).
                    El fondo es transparente. Colócala donde quieras que camine: lo normal es a lo ancho del borde inferior, encima de tu cámara o de la barra del chat.
                </p>
                <DocAlert type="info" title="Rendimiento">
                    El modelo pesa poco (unos 7 600 triángulos) y está pensado para correr a 30–60 fps en la fuente de navegador de OBS sin afectar el juego.
                    Si notas bajones, apaga la sombra en la pestaña Overlay.
                </DocAlert>
            </DocSection>

            <DocSection title="Próximamente">
                <p>
                    La mascota reaccionará a todas tus alertas (follow, bits, subs, raids…), tendrá comandos que tú mismo defines (<code>!acariciar</code>, por ejemplo)
                    y saludará a quien escribe por primera vez en tu chat. Todo configurable desde el mismo panel.
                </p>
            </DocSection>

            <DocSection title="Créditos">
                <p className="text-sm">
                    El gato es <a className="underline" href="https://sketchfab.com/3d-models/somali-cat-animated-ver-12-e185c3fd92b64c32b4515a32b29252fc" target="_blank" rel="noreferrer">"Somali Cat Animated ver 1.2"</a> de{' '}
                    <a className="underline" href="https://sketchfab.com/DreamNoms" target="_blank" rel="noreferrer">DreamNoms</a>, con licencia{' '}
                    <a className="underline" href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC-BY-4.0</a>.
                </p>
            </DocSection>
        </div>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-4 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">{icon}</div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-1">{title}</h4>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
        </div>
    );
}
