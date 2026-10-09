
export default function TerminosPage() {
    return (
        <article className="max-w-3xl 3xl:max-w-4xl">
                {/* Header */}
                <header className="mb-10 pb-8 border-b border-[#dfe3ea] dark:border-pub-border">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#12151c] dark:text-white">
                        Términos y Condiciones
                    </h1>
                    <p className="mt-3 text-[#5b6475] dark:text-[#8b93a3]">Decatron — Bot para Twitch y Kick</p>
                    <p className="mt-3 font-mono text-xs text-[#5b6475] dark:text-[#8b93a3]">Última actualización: Octubre 2026</p>
                </header>

                {/* Content */}
                <div className="space-y-10 text-[15px] 3xl:text-base leading-relaxed text-[#475569] dark:text-[#b4bccb]">
                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">1. Identificación del Proveedor</h2>
                        <ul className="space-y-1">
                            <li><strong>Razón social:</strong> Anthony Adrian Chaparro Salas</li>
                            <li><strong>RUC:</strong> 10705423950</li>
                            <li><strong>Dirección:</strong> Av. El Sol 468, Rímac, Lima, Perú</li>
                            <li><strong>Correo:</strong> support@decatron.net</li>
                            <li><strong>Teléfono:</strong> +51 959 724 105</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">2. Aceptación de Términos</h2>
                        <p>
                            Al utilizar el bot Decatron en Twitch o Kick, aceptas estos Términos y Condiciones.
                            Si no estás de acuerdo, no utilices el servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">3. Descripción del Servicio</h2>
                        <p className="mb-3">
                            Decatron es un <strong>bot gratuito para Twitch y Kick</strong> que ofrece funcionalidades
                            de moderación, comandos personalizados, overlays, alertas, song request, traducción en vivo,
                            sistema de economía virtual, inteligencia artificial y más para streamers.
                        </p>
                        <p className="mb-3">
                            Todas las funcionalidades están disponibles para todos los usuarios y no requieren ningún
                            pago. No existen suscripciones obligatorias.
                        </p>
                        <p>
                            Las funciones que le cuestan dinero a la plataforma (inteligencia artificial, voz premium y
                            traducción en vivo) consumen <strong>créditos</strong>. Cada canal recibe un saldo base y puede
                            adquirir créditos adicionales. Los créditos adquiridos se acreditan de forma automática al
                            confirmarse el pago y no son reembolsables.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">4. Programa de Supporters</h2>
                        <p className="mb-3">
                            Decatron ofrece un programa voluntario de <strong>"Supporters"</strong> donde los usuarios
                            pueden realizar contribuciones voluntarias para apoyar el desarrollo del proyecto.
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Las contribuciones son <strong>completamente voluntarias</strong> y no son suscripciones.</li>
                            <li>Los supporters reciben beneficios adicionales como agradecimiento, pero el servicio
                                principal es y seguirá siendo gratuito.</li>
                            <li>Los beneficios de supporter son extras y no constituyen la prestación principal del servicio.</li>
                            <li>El proveedor se reserva el derecho de modificar los beneficios de supporter en cualquier momento.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">5. Métodos de Pago</h2>
                        <p className="mb-3">Las contribuciones voluntarias se procesan a través de:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li><strong>PayPal:</strong> Pagos en dólares americanos (USD).</li>
                            <li><strong>Culqi:</strong> Pagos en soles peruanos (PEN) mediante tarjeta de crédito/débito o Yape.</li>
                        </ul>
                        <p className="mt-3">
                            Al realizar un pago, aceptas también los términos de servicio del procesador de pagos correspondiente.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">6. Política de No Reembolso</h2>
                        <p className="mb-3">
                            <strong>Las contribuciones voluntarias no son reembolsables.</strong> Al ser aportes
                            voluntarios para apoyar el desarrollo del proyecto, no constituyen una compra de
                            bienes o servicios.
                        </p>
                        <p>
                            Excepción: Se procesarán reembolsos en caso de cobros duplicados por error técnico.
                            Para estos casos, contactar a support@decatron.net.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">7. Cuenta y Autenticación</h2>
                        <p className="mb-3">
                            El acceso al bot se realiza mediante autenticación OAuth con tu cuenta de Twitch, Kick o Discord.
                            Eres responsable de mantener la seguridad de tus cuentas de Twitch, Kick y Discord.
                        </p>
                        <p>
                            El proveedor no almacena contraseñas de Twitch. Solo se almacenan los tokens
                            de acceso necesarios para el funcionamiento del bot.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">8. Uso Aceptable</h2>
                        <p className="mb-3">Al utilizar Decatron, te comprometes a NO:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>Usar el bot para actividades ilegales o que violen los términos de Twitch o Kick.</li>
                            <li>Intentar explotar vulnerabilidades técnicas del servicio.</li>
                            <li>Usar el bot para spam, acoso o contenido inapropiado.</li>
                            <li>Revender o comercializar el acceso al bot.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">9. Disponibilidad del Servicio</h2>
                        <p>
                            El servicio se proporciona "tal cual" sin garantías de disponibilidad ininterrumpida.
                            El proveedor no será responsable por interrupciones temporales del servicio
                            por mantenimiento, actualizaciones o causas de fuerza mayor.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">10. Propiedad Intelectual</h2>
                        <p>
                            El software Decatron, su código, diseño, marca y contenido son propiedad exclusiva
                            del proveedor. El usuario no adquiere ningún derecho de propiedad intelectual
                            sobre el software al utilizarlo.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">11. Limitación de Responsabilidad</h2>
                        <p>
                            El proveedor no será responsable por daños indirectos, incidentales o consecuenciales
                            derivados del uso del servicio. La responsabilidad máxima se limita al monto
                            de las contribuciones realizadas en los últimos 12 meses.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">12. Modificaciones</h2>
                        <p>
                            El proveedor se reserva el derecho de modificar estos términos en cualquier momento.
                            Los cambios se publicarán en esta página. El uso continuado del servicio
                            constituye la aceptación de los términos modificados.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">13. Legislación Aplicable</h2>
                        <p>
                            Estos términos se rigen por las leyes de la República del Perú.
                            Cualquier controversia será sometida a los tribunales competentes de Lima, Perú.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">14. Contacto</h2>
                        <p>
                            Para consultas sobre estos términos, contáctanos en:{' '}
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
