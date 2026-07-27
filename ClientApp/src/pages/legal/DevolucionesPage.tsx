import { RefreshCw } from 'lucide-react';

export default function DevolucionesPage() {
    return (
        <div className="py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-full bg-[#2563eb] flex items-center justify-center mx-auto mb-4">
                        <RefreshCw className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        Política de Cambios y Devoluciones
                    </h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">Decatron — Bot de Twitch</p>
                    <p className="text-sm text-[#94a3b8] dark:text-[#475569] mt-2">Última actualización: Junio 2026</p>
                </div>

                {/* Content */}
                <div className="bg-[#f8fafc] dark:bg-[#1e293b] rounded-2xl p-6 md:p-8 space-y-6 text-[#475569] dark:text-[#cbd5e1] border border-[#e2e8f0] dark:border-[#374151]">
                    <section>
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">1. Identificación del Proveedor</h2>
                        <ul className="space-y-1">
                            <li><strong>Razón social:</strong> Anthony Adrian Chaparro Salas</li>
                            <li><strong>RUC:</strong> 10705423950</li>
                            <li><strong>Dirección:</strong> Av. El Sol 468, Rímac, Lima, Perú</li>
                            <li><strong>Correo:</strong> support@decatron.net</li>
                            <li><strong>Teléfono:</strong> +51 959 724 105</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">2. Naturaleza del Servicio</h2>
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
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">3. Política de No Reembolso</h2>
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
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">4. Excepciones</h2>
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
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">5. Procedimiento para Solicitar Reembolso</h2>
                        <p className="mb-3">
                            Si crees que calificas para un reembolso según las excepciones mencionadas:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 ml-4">
                            <li>Envía un correo a <a href="mailto:support@decatron.net" className="text-[#2563eb] hover:underline">support@decatron.net</a> con el asunto "Solicitud de Reembolso".</li>
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
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">6. Cambios</h2>
                        <p>
                            Al tratarse de un servicio digital y contribuciones voluntarias, no aplican
                            cambios de producto. Si tienes algún problema con los beneficios de supporter,
                            contáctanos y buscaremos una solución.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-[#1e293b] dark:text-white mb-3">7. Contacto</h2>
                        <p>
                            Para cualquier consulta relacionada con devoluciones, contáctanos en:{' '}
                            <a href="mailto:support@decatron.net" className="text-[#2563eb] hover:underline">
                                support@decatron.net
                            </a>
                            {' '}o al teléfono{' '}
                            <a href="tel:+51959724105" className="text-[#2563eb] hover:underline">
                                +51 959 724 105
                            </a>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
