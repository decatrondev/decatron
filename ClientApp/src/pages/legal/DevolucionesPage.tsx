
export default function DevolucionesPage() {
    return (
        <article className="max-w-3xl 3xl:max-w-4xl">
                {/* Header */}
                <header className="mb-10 pb-8 border-b border-[#dfe3ea] dark:border-pub-border">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#12151c] dark:text-white">
                        Política de Cambios y Devoluciones
                    </h1>
                    <p className="mt-3 text-[#5b6475] dark:text-[#8b93a3]">Decatron — Bot de Twitch</p>
                    <p className="mt-3 font-mono text-xs text-[#5b6475] dark:text-[#8b93a3]">Última actualización: Junio 2026</p>
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
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">2. Naturaleza del Servicio</h2>
                        <p className="mb-3">
                            Decatron es un <strong>bot de Twitch completamente gratuito</strong>. Todas las
                            funcionalidades principales están disponibles sin costo alguno para todos los usuarios.
                        </p>
                        <p>
                            El programa de <strong>"Supporters"</strong> consiste en contribuciones voluntarias
                            que los usuarios pueden realizar para apoyar el desarrollo continuo del proyecto.
                            Estas contribuciones no constituyen una compra de bienes o servicios.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">3. Política de No Reembolso</h2>
                        <p className="mb-3">
                            Dado que las contribuciones de supporters son <strong>aportes voluntarios</strong> y
                            no compras de bienes o servicios, estas <strong>no son reembolsables</strong>.
                        </p>
                        <p className="mb-3">Al realizar una contribución, el usuario reconoce que:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>El servicio principal del bot es gratuito.</li>
                            <li>La contribución es un apoyo voluntario al proyecto.</li>
                            <li>Los beneficios de supporter son extras entregados como agradecimiento.</li>
                            <li>No se está adquiriendo un producto o servicio comercial.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">4. Excepciones</h2>
                        <p className="mb-3">
                            Se procesarán reembolsos únicamente en los siguientes casos:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>
                                <strong>Cobros duplicados:</strong> Si por un error técnico se realizó un cobro
                                duplicado, se reembolsará el monto duplicado.
                            </li>
                            <li>
                                <strong>Transacciones no autorizadas:</strong> Si se demuestra que la transacción
                                fue realizada sin autorización del titular de la cuenta/método de pago.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">5. Procedimiento para Solicitar Reembolso</h2>
                        <p className="mb-3">
                            Si crees que calificas para un reembolso según las excepciones mencionadas:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 ml-4">
                            <li>Envía un correo a <a href="mailto:support@decatron.net" className="text-[#2563eb] dark:text-pub-accent-hi hover:underline">support@decatron.net</a> con el asunto "Solicitud de Reembolso".</li>
                            <li>Incluye tu nombre de usuario de Twitch.</li>
                            <li>Adjunta el comprobante de pago o ID de transacción.</li>
                            <li>Describe el motivo de la solicitud.</li>
                        </ol>
                        <p className="mt-3">
                            Las solicitudes serán evaluadas en un plazo máximo de <strong>5 días hábiles</strong>.
                            De ser aprobado, el reembolso se procesará por el mismo medio de pago utilizado.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">6. Cambios</h2>
                        <p>
                            Al tratarse de un servicio digital y contribuciones voluntarias, no aplican
                            cambios de producto. Si tienes algún problema con los beneficios de supporter,
                            contáctanos y buscaremos una solución.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold tracking-tight text-[#12151c] dark:text-white mb-3">7. Contacto</h2>
                        <p>
                            Para cualquier consulta relacionada con devoluciones, contáctanos en:{' '}
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
