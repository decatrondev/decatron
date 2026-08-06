import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, FlaskConical, AlertTriangle, Loader2, ExternalLink, Building2 } from 'lucide-react';
import api from '../../../../services/api';

/**
 * Con qué empresa se está facturando, y si eso es real o es beta.
 *
 * Va arriba de todo porque es el dato que cambia el significado de la pantalla entera: en
 * beta los comprobantes se emiten, se aceptan y se ven idénticos, pero no existen para
 * SUNAT. Sin este cartel, la única forma de saberlo era abrir appsettings en el servidor.
 *
 * El modo NO se cambia desde acá y no es un descuido: pertenece a la empresa, del lado de
 * DecatronAPI, y una empresa que ya emitió no puede cambiarlo — su correlativo es suyo, y
 * saltearlo deja la serie con un hueco que SUNAT observa. Pasar a producción es crear una
 * empresa nueva allá y elegirla acá.
 */

interface Empresa {
    id: number;
    ruc: string;
    razonSocial: string;
    /** Etiqueta interna de DecatronAPI. Con RUC 10 es lo único que distingue una empresa de otra. */
    alias: string | null;
    isBeta: boolean;
    boletaSeries: string | null;
    facturaSeries: string | null;
    hasCert: boolean;
    hasSolCredentials: boolean;
    ready: boolean;
}

interface EstadoEmisor {
    configured: boolean;
    companyId: number | null;
    error: string | null;
    active: Empresa | null;
    companies: Empresa[];
}

const API_EMPRESAS = 'https://decatronapi.decatron.net/dashboard/facturacion/empresas';

export function EmisorPanel() {
    const [estado, setEstado]     = useState<EstadoEmisor | null>(null);
    const [loading, setLoading]   = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [elegida, setElegida]   = useState<number | ''>('');
    const [aviso, setAviso]       = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get<EstadoEmisor>('/supporters/admin/invoicing-status');
            setEstado(data);
            setElegida(data.companyId ?? '');
        } catch {
            setAviso({ tipo: 'error', texto: 'No se pudo consultar el emisor' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const cambiar = async () => {
        if (elegida === '' || !estado) return;

        const destino = estado.companies.find(e => e.id === elegida);
        if (!destino) return;

        // Pasar a una empresa de producción es empezar a emitir documentos fiscales reales.
        // Eso se pregunta, no se hace de un click en un desplegable.
        const nombre = destino.alias || destino.razonSocial;
        const confirmacion = destino.isBeta
            ? `Vas a emitir con ${nombre} (#${destino.id}) en modo BETA. Nada de lo que salga va a existir para SUNAT. ¿Seguimos?`
            : `Vas a emitir con ${nombre} (#${destino.id}, RUC ${destino.ruc}) en PRODUCCIÓN.\n\nDesde este momento cada compra genera un comprobante fiscal real, con correlativo real, que solo se anula con una nota de crédito. ¿Seguimos?`;

        if (!confirm(confirmacion)) return;

        setGuardando(true);
        setAviso(null);
        try {
            await api.put('/supporters/admin/invoicing-company', { companyId: elegida });
            setAviso({ tipo: 'ok', texto: '✅ Empresa emisora actualizada' });
            cargar();
        } catch (e) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setAviso({ tipo: 'error', texto: msg ?? 'No se pudo cambiar la empresa' });
        } finally {
            setGuardando(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    const activa = estado?.active ?? null;
    const beta = activa?.isBeta ?? true;
    const sinEmisor = !estado?.configured || !activa;

    // Tres estados y tres colores: rojo cuando no se puede emitir, ámbar en beta, verde en
    // producción. Que se sepa de un vistazo desde el otro lado de la habitación.
    const tono = sinEmisor
        ? { borde: 'border-red-300 dark:border-red-800',   fondo: 'bg-red-50 dark:bg-red-900/20',     texto: 'text-red-700 dark:text-red-400' }
        : beta
            ? { borde: 'border-amber-300 dark:border-amber-800', fondo: 'bg-amber-50 dark:bg-amber-900/20', texto: 'text-amber-700 dark:text-amber-400' }
            : { borde: 'border-green-300 dark:border-green-800', fondo: 'bg-green-50 dark:bg-green-900/20', texto: 'text-green-700 dark:text-green-400' };

    const Icono = sinEmisor ? AlertTriangle : beta ? FlaskConical : ShieldCheck;

    return (
        <div className={`rounded-2xl border-2 ${tono.borde} ${tono.fondo} p-5 space-y-4`}>
            <div className="flex items-start gap-3">
                <Icono className={`w-6 h-6 shrink-0 mt-0.5 ${tono.texto}`} />
                <div className="min-w-0 flex-1">
                    <h3 className={`font-black text-lg ${tono.texto}`}>
                        {sinEmisor
                            ? 'No se está emitiendo nada'
                            : beta
                                ? 'MODO BETA — nada de esto es fiscalmente real'
                                : 'PRODUCCIÓN — los comprobantes son reales'}
                    </h3>

                    {sinEmisor ? (
                        <p className="text-sm mt-1 text-[#64748b] dark:text-[#94a3b8]">
                            {estado?.error ?? 'Falta elegir una empresa emisora.'} Mientras tanto los pagos se
                            cobran igual y quedan pendientes de comprobante — no se pierde ninguno.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm mt-1 text-[#1e293b] dark:text-[#f8fafc]">
                                <span className="font-bold">{activa!.alias || activa!.razonSocial}</span>
                                {' · '}empresa #{activa!.id}
                            </p>
                            <p className="text-xs mt-0.5 text-[#64748b] dark:text-[#94a3b8]">
                                {activa!.razonSocial} · RUC {activa!.ruc} · series {activa!.boletaSeries ?? '—'}/{activa!.facturaSeries ?? '—'}
                            </p>
                            {/* Sin alias no hay forma de saber si esta es la empresa del bot o la de
                                otro proyecto: mismo RUC y misma razón social se ven idénticos. */}
                            {!activa!.alias && (
                                <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                                    Esta empresa no tiene identificador. Ponele uno en DecatronAPI para no
                                    confundirla con otra del mismo RUC.
                                </p>
                            )}
                            {beta && (
                                <p className="text-sm mt-2 text-[#64748b] dark:text-[#94a3b8]">
                                    Se emite contra el entorno de pruebas de SUNAT. Los comprobantes salen, se
                                    aceptan y se ven iguales, pero <span className="font-bold">no existen</span>:
                                    no declaran, no valen ante nadie y su correlativo no cuenta.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Selector de empresa */}
            <div className="pt-4 border-t border-[#e2e8f0]/60 dark:border-[#374151]">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[260px]">
                        <label className="text-xs font-black text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide block mb-1.5">
                            Empresa que emite
                        </label>
                        <select
                            value={elegida}
                            onChange={e => setElegida(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-4 py-2.5 border border-[#e2e8f0] dark:border-[#374151] rounded-xl bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm"
                        >
                            <option value="">— elegir empresa —</option>
                            {estado?.companies.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.isBeta ? '🧪 BETA' : '🔴 PRODUCCIÓN'}
                                    {' · '}{e.alias || `${e.razonSocial} (sin identificador)`}
                                    {' · #'}{e.id}{' · '}{e.boletaSeries ?? '—'}/{e.facturaSeries ?? '—'}
                                    {e.ready ? '' : ' · ⚠ sin certificado o clave SOL'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={cambiar}
                        disabled={guardando || elegida === '' || elegida === estado?.companyId}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2563eb] text-white text-sm font-black rounded-xl hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                        Cambiar emisor
                    </button>
                </div>

                {aviso && (
                    <p className={`text-sm font-bold mt-3 ${
                        aviso.tipo === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>{aviso.texto}</p>
                )}

                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3 leading-relaxed">
                    El modo beta o producción es de la empresa y <span className="font-bold">no se puede cambiar</span>:
                    una vez que emitió aunque sea un comprobante, su correlativo le pertenece, y cambiarle el entorno
                    dejaría la serie con un salto que SUNAT observa. Para pasar a producción se crea una empresa nueva
                    — con su certificado digital real y su clave SOL — y se elige acá.
                    {' '}
                    <a
                        href={API_EMPRESAS}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#2563eb] font-bold hover:underline"
                    >
                        Crear empresa en DecatronAPI <ExternalLink className="w-3 h-3" />
                    </a>
                </p>
            </div>
        </div>
    );
}
