import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';

export default function LibroReclamacionesPage() {
    const [form, setForm] = useState({
        nombre: '',
        dni: '',
        email: '',
        telefono: '',
        direccion: '',
        tipo: 'reclamo' as 'reclamo' | 'queja',
        descripcion: '',
        pedido: '',
    });
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const tipoLabel = form.tipo === 'reclamo' ? 'RECLAMO' : 'QUEJA';
        const subject = encodeURIComponent(`Libro de Reclamaciones — ${tipoLabel}`);
        const body = encodeURIComponent(
            `LIBRO DE RECLAMACIONES — ${tipoLabel}\n` +
            `================================\n\n` +
            `DATOS DEL CONSUMIDOR\n` +
            `Nombre: ${form.nombre}\n` +
            `DNI: ${form.dni}\n` +
            `Email: ${form.email}\n` +
            `Teléfono: ${form.telefono}\n` +
            `Dirección: ${form.direccion}\n\n` +
            `DETALLE DE LA ${tipoLabel}\n` +
            `Tipo: ${tipoLabel}\n` +
            `Descripción: ${form.descripcion}\n\n` +
            `PEDIDO DEL CONSUMIDOR\n` +
            `${form.pedido}\n\n` +
            `---\n` +
            `Enviado desde el Libro de Reclamaciones Virtual de Decatron\n` +
            `Fecha: ${new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}`
        );

        window.location.href = `mailto:support@decatron.net?subject=${subject}&body=${body}`;
        setSubmitted(true);
    };

    const inputClasses = "w-full px-4 py-3 rounded-lg bg-white dark:bg-pub-bg border border-[#dfe3ea] dark:border-pub-border text-[#1e293b] dark:text-[#f8fafc] placeholder-[#94a3b8] dark:placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent transition-colors";
    const labelClasses = "block text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1.5";

    return (
        <article className="max-w-3xl 3xl:max-w-4xl">
                {/* Header */}
                <header className="mb-10 pb-8 border-b border-[#dfe3ea] dark:border-pub-border">
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#12151c] dark:text-white">
                        Libro de Reclamaciones
                    </h1>
                    <p className="mt-3 text-[#5b6475] dark:text-[#8b93a3]">Conforme a la Ley N° 29571 — Código de Protección y Defensa del Consumidor</p>
                </header>

                {/* Provider Info Card */}
                <div className="bg-[#2563eb]/10 dark:bg-[#2563eb]/5 border border-[#2563eb]/30 rounded-xl p-5 mb-8">
                    <h2 className="text-lg font-bold text-[#2563eb] dark:text-pub-accent-hi mb-3">Datos del Proveedor</h2>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm text-[#475569] dark:text-[#cbd5e1]">
                        <p><strong>Razón social:</strong> Anthony Adrian Chaparro Salas</p>
                        <p><strong>RUC:</strong> 10705423950</p>
                        <p><strong>Dirección:</strong> Av. El Sol 468, Rímac, Lima, Perú</p>
                        <p><strong>Teléfono:</strong> +51 959 724 105</p>
                        <p><strong>Email:</strong> support@decatron.net</p>
                        <p><strong>Rubro:</strong> Servicios digitales — Bot para Twitch y Kick</p>
                    </div>
                </div>

                {submitted ? (
                    <div className="bg-white dark:bg-pub-surface rounded-lg p-8 border border-[#dfe3ea] dark:border-pub-border text-center space-y-4">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-[#1e293b] dark:text-white">
                            Reclamo Enviado
                        </h2>
                        <p className="text-[#64748b] dark:text-[#94a3b8] max-w-md mx-auto">
                            Se ha abierto tu cliente de correo con los datos del reclamo.
                            Asegúrate de enviar el correo a <strong>support@decatron.net</strong>.
                            Responderemos en un plazo máximo de 30 días calendario conforme a ley.
                        </p>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="mt-4 px-6 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-colors"
                        >
                            Enviar otro reclamo
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-pub-surface rounded-lg p-6 md:p-8 space-y-6 border border-[#dfe3ea] dark:border-pub-border">
                        {/* Consumer Data */}
                        <div>
                            <h2 className="text-lg font-bold text-[#1e293b] dark:text-white mb-4 pb-2 border-b border-[#dfe3ea] dark:border-pub-border">
                                Datos del Consumidor
                            </h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClasses}>Nombre Completo *</label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={form.nombre}
                                        onChange={handleChange}
                                        required
                                        placeholder="Juan Pérez García"
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>DNI / Documento de Identidad *</label>
                                    <input
                                        type="text"
                                        name="dni"
                                        value={form.dni}
                                        onChange={handleChange}
                                        required
                                        placeholder="12345678"
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Correo Electrónico *</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        placeholder="correo@ejemplo.com"
                                        className={inputClasses}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Teléfono *</label>
                                    <input
                                        type="tel"
                                        name="telefono"
                                        value={form.telefono}
                                        onChange={handleChange}
                                        required
                                        placeholder="+51 999 999 999"
                                        className={inputClasses}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelClasses}>Dirección</label>
                                    <input
                                        type="text"
                                        name="direccion"
                                        value={form.direccion}
                                        onChange={handleChange}
                                        placeholder="Av. Ejemplo 123, Lima"
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Complaint Type */}
                        <div>
                            <h2 className="text-lg font-bold text-[#1e293b] dark:text-white mb-4 pb-2 border-b border-[#dfe3ea] dark:border-pub-border">
                                Tipo de Solicitud
                            </h2>
                            <div className="flex gap-4">
                                <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-colors text-center ${form.tipo === 'reclamo' ? 'border-[#2563eb] bg-[#2563eb]/10 dark:bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'}`}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="reclamo"
                                        checked={form.tipo === 'reclamo'}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <p className="font-bold text-[#1e293b] dark:text-white">Reclamo</p>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Disconformidad con el servicio recibido
                                    </p>
                                </label>
                                <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-colors text-center ${form.tipo === 'queja' ? 'border-[#2563eb] bg-[#2563eb]/10 dark:bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'}`}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="queja"
                                        checked={form.tipo === 'queja'}
                                        onChange={handleChange}
                                        className="sr-only"
                                    />
                                    <p className="font-bold text-[#1e293b] dark:text-white">Queja</p>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        Malestar respecto a la atención recibida
                                    </p>
                                </label>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <h2 className="text-lg font-bold text-[#1e293b] dark:text-white mb-4 pb-2 border-b border-[#dfe3ea] dark:border-pub-border">
                                Detalle
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelClasses}>Descripción de los Hechos *</label>
                                    <textarea
                                        name="descripcion"
                                        value={form.descripcion}
                                        onChange={handleChange}
                                        required
                                        rows={4}
                                        placeholder="Describe detalladamente lo sucedido..."
                                        className={inputClasses + " resize-none"}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Pedido del Consumidor *</label>
                                    <textarea
                                        name="pedido"
                                        value={form.pedido}
                                        onChange={handleChange}
                                        required
                                        rows={3}
                                        placeholder="Indica qué acción o solución esperas..."
                                        className={inputClasses + " resize-none"}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Legal Notice */}
                        <div className="text-xs text-[#94a3b8] dark:text-[#475569] bg-[#f1f5f9] dark:bg-pub-bg rounded-lg p-4">
                            <p>
                                De acuerdo con el artículo 150° de la Ley N° 29571, el proveedor deberá dar
                                respuesta al reclamo en un plazo máximo de treinta (30) días calendario.
                                La formulación del reclamo no impide acudir a otras vías de solución de
                                controversias ni es requisito previo para interponer una denuncia ante INDECOPI.
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-colors"
                        >
                            <Send className="w-5 h-5" />
                            Enviar Reclamo
                        </button>
                    </form>
                )}
        </article>
    );
}
