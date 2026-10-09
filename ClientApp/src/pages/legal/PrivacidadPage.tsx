
export default function PrivacidadPage() {
    return (
        <article className="max-w-3xl 3xl:max-w-4xl">
                {/* Header */}
                <header className="mb-10 pb-8 border-b border-[#dfe3ea] dark:border-pub-border">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#12151c] dark:text-white">
                        Política de Privacidad
                    </h1>
                    <p className="mt-3 text-[#5b6475] dark:text-[#8b93a3]">Decatron — Bot de Twitch</p>
                    <p className="mt-3 font-mono text-xs text-[#5b6475] dark:text-[#8b93a3]">Última actualización: Junio 2026</p>
                </header>

                {/* Content */}
                <div className="space-y-10 text-[15px] 3xl:text-base leading-relaxed text-[#475569] dark:text-[#b4bccb]">
                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">1. Responsable del Tratamiento</h2>
                        <ul className="space-y-1">
                            <li><strong>Responsable:</strong> Anthony Adrian Chaparro Salas</li>
                            <li><strong>RUC:</strong> 10705423950</li>
                            <li><strong>Dirección:</strong> Av. El Sol 468, Rímac, Lima, Perú</li>
                            <li><strong>Correo:</strong> support@decatron.net</li>
                            <li><strong>Teléfono:</strong> +51 959 724 105</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">2. Datos que Recopilamos</h2>
                        <p className="mb-3">Recopilamos los siguientes datos personales:</p>

                        <h3 className="font-semibold text-[#1e293b] dark:text-white mt-4 mb-2">2.1 Datos de cuenta de Twitch (vía OAuth)</h3>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Nombre de usuario de Twitch</li>
                            <li>ID de usuario de Twitch</li>
                            <li>Correo electrónico asociado a la cuenta</li>
                            <li>Imagen de perfil</li>
                            <li>Token de acceso OAuth (para operación del bot)</li>
                        </ul>

                        <h3 className="font-semibold text-[#1e293b] dark:text-white mt-4 mb-2">2.2 Datos de uso del servicio</h3>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Configuraciones del bot realizadas por el usuario</li>
                            <li>Comandos personalizados creados</li>
                            <li>Estadísticas de uso del canal</li>
                            <li>Historial de interacciones con el bot</li>
                        </ul>

                        <h3 className="font-semibold text-[#1e293b] dark:text-white mt-4 mb-2">2.3 Datos de pago (solo Supporters)</h3>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>Correo electrónico de PayPal o datos proporcionados a Culqi</li>
                            <li>Monto y fecha de la contribución</li>
                            <li>ID de transacción del procesador de pagos</li>
                        </ul>
                        <p className="mt-2 text-sm italic">
                            Nota: No almacenamos números de tarjeta de crédito/débito. Los datos de pago
                            son procesados directamente por PayPal y Culqi.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">3. Finalidad del Tratamiento</h2>
                        <p className="mb-3">Utilizamos los datos recopilados para:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Operar el bot de Twitch y sus funcionalidades.</li>
                            <li>Gestionar las cuentas de usuario y sus configuraciones.</li>
                            <li>Procesar las contribuciones voluntarias de supporters.</li>
                            <li>Gestionar los beneficios del programa de supporters.</li>
                            <li>Enviar comunicaciones relacionadas con el servicio.</li>
                            <li>Mejorar y optimizar el funcionamiento del bot.</li>
                            <li>Cumplir con obligaciones legales.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">4. Terceros con Acceso a Datos</h2>
                        <p className="mb-3">Compartimos datos con los siguientes servicios de terceros:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Twitch API:</strong> Autenticación y operación del bot en la plataforma.</li>
                            <li><strong>PayPal:</strong> Procesamiento de pagos en USD para supporters.</li>
                            <li><strong>Culqi:</strong> Procesamiento de pagos en PEN (tarjeta y Yape) para supporters.</li>
                            <li><strong>Amazon Web Services (AWS Polly):</strong> Generación de texto a voz (TTS) para funcionalidades del bot.</li>
                        </ul>
                        <p className="mt-3">
                            Cada tercero tiene su propia política de privacidad. No vendemos ni compartimos
                            datos personales con fines publicitarios.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">5. Almacenamiento y Seguridad</h2>
                        <p className="mb-3">
                            Los datos se almacenan en servidores seguros. Implementamos medidas técnicas
                            y organizativas para proteger los datos personales, incluyendo:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Cifrado de datos en tránsito (HTTPS/TLS).</li>
                            <li>Acceso restringido a bases de datos.</li>
                            <li>Tokens de acceso almacenados de forma segura.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">6. Derechos del Titular (Ley 29733)</h2>
                        <p className="mb-3">
                            De acuerdo con la Ley N° 29733 — Ley de Protección de Datos Personales del Perú,
                            tienes derecho a:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>Acceso:</strong> Conocer qué datos personales tenemos sobre ti.</li>
                            <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos.</li>
                            <li><strong>Cancelación:</strong> Solicitar la eliminación de tus datos personales.</li>
                            <li><strong>Oposición:</strong> Oponerte al tratamiento de tus datos para fines específicos.</li>
                        </ul>
                        <p className="mt-3">
                            Para ejercer estos derechos, envía un correo a{' '}
                            <a href="mailto:support@decatron.net" className="text-[#2563eb] dark:text-pub-accent-hi hover:underline">
                                support@decatron.net
                            </a>
                            {' '}indicando tu nombre de usuario de Twitch y el derecho que deseas ejercer.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">7. Cookies y Tecnologías Similares</h2>
                        <p>
                            Utilizamos cookies y almacenamiento local del navegador para mantener tu sesión activa
                            y guardar preferencias de configuración. Estas cookies son estrictamente necesarias
                            para el funcionamiento del servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">8. Retención de Datos</h2>
                        <p>
                            Los datos personales se conservan mientras la cuenta del usuario esté activa.
                            Si solicitas la eliminación de tu cuenta, tus datos serán eliminados en un plazo
                            máximo de 30 días, excepto aquellos que debamos conservar por obligaciones legales.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">9. Menores de Edad</h2>
                        <p>
                            El servicio está dirigido a usuarios mayores de 13 años, conforme a los términos
                            de servicio de Twitch. No recopilamos intencionalmente datos de menores de 13 años.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">10. Modificaciones</h2>
                        <p>
                            Nos reservamos el derecho de actualizar esta Política de Privacidad.
                            Los cambios se publicarán en esta página con la fecha de última actualización.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">11. Contacto</h2>
                        <p>
                            Para consultas sobre privacidad o protección de datos, contáctanos en:{' '}
                            <a href="mailto:support@decatron.net" className="text-[#2563eb] dark:text-pub-accent-hi hover:underline">
                                support@decatron.net
                            </a>
                            {' '}o al teléfono{' '}
                            <a href="tel:+51959724105" className="text-[#2563eb] dark:text-pub-accent-hi hover:underline">
                                +51 959 724 105
                            </a>.
                        </p>
                    </section>
                </div>
        </article>
    );
}
