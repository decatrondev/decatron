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
    /** Cobrando con llaves de prueba de Culqi: no entra plata. */
    culqiTest: boolean;
    /** Combinacion peligrosa entre modo de cobro y empresa emisora, si la hay. */
    advertencia: string | null;
}

const API_EMPRESAS = 'https://decatronapi.decatron.net/dashboard/facturacion/empresas';

export function EmisorPanel() {
    const [estado, setEstado]     = useState<EstadoEmisor | null>(null);
    const [loading, setLoading]   = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [elegida, setElegida]   = useState<number | ''>('');
    const [aviso, setAviso]       = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
    const [cambiandoModo, setCambiandoModo] = useState(false);

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

    const cambiarModoCobro = async (aTest: boolean) => {
        // Volver a produccion es empezar a cobrar dinero real otra vez; irse a test deja
        // la tienda entregando producto sin cobrar. Las dos direcciones se preguntan.
        const confirmacion = aTest
            ? 'Vas a pasar TODA la plataforma a llaves de PRUEBA.\n\nMientras esté así, cualquiera que compre coins o un tier lo va a recibir SIN que entre plata, y esas compras no generan comprobante. Acordate de volver a producción cuando termines. ¿Seguimos?'
            : 'Vas a volver a cobrar DINERO REAL con las llaves de producción. ¿Seguimos?';

        if (!confirm(confirmacion)) return;

        setCambiandoModo(true);
        setAviso(null);
        try {
            await api.put('/supporters/admin/culqi-mode', { test: aTest });
            setAviso({ tipo: 'ok', texto: aTest ? '⚠️ Modo PRUEBA activado' : '✅ Cobrando en producción' });
            cargar();
        } catch (e) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setAviso({ tipo: 'error', texto: msg ?? 'No se pudo cambiar el modo de cobro' });
        } finally {
            setCambiandoModo(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-ds-border p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    const activa = estado?.active ?? null;
    const beta = activa?.isBeta ?? true;
    const sinEmisor = !estado?.configured || !activa;

    // Tres estados y tres colores: rojo cuando no se puede emitir, ámbar en beta, verde en
    // producción. Que se sepa de un vistazo desde el otro lado de la habitación.
    const tono = sinEmisor
        ? { borde: 'border-ds-danger/40 ', fondo: 'bg-ds-danger/10 ', texto: 'text-ds-danger ' }
        : beta
            ? { borde: 'border-ds-warn/40 ', fondo: 'bg-ds-warn/10 ', texto: 'text-ds-warn ' }
            : { borde: 'border-ds-ok/40 ', fondo: 'bg-ds-ok/10 ', texto: 'text-ds-ok ' };

    const Icono = sinEmisor ? AlertTriangle : beta ? FlaskConical : ShieldCheck;

    const enTest = estado?.culqiTest === true;

    return (
        <>
        {/* El modo de cobro va en su propio bloque y arriba de todo: es lo unico que
            decide si entra plata de verdad. Quedarse en prueba sin darse cuenta es
            regalar coins y tiers a todo el que compre. */}
        <div className={`rounded-lg border-2 p-5 mb-4 ${
            enTest
                ? 'border-ds-warn/40 bg-ds-warn/10 '
                : 'border-ds-border bg-ds-surface '
        }`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                    {enTest
                        ? <FlaskConical className="w-6 h-6 shrink-0 mt-0.5 text-ds-accent-text" />
                        : <ShieldCheck className="w-6 h-6 shrink-0 mt-0.5 text-ds-ok" />}
                    <div>
                        <h3 className={`font-black text-lg ${enTest ? 'text-ds-warn ' : 'text-ds-text '}`}>
                            {enTest ? 'COBRANDO EN PRUEBA — no entra plata' : 'Cobrando dinero real'}
                        </h3>
                        <p className="text-sm mt-1 text-ds-soft">
                            {enTest
                                ? 'Cualquiera que compre recibe coins o tier sin pagar, y esas compras no generan comprobante.'
                                : 'Las compras se cobran con las llaves de producción de Culqi.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => cambiarModoCobro(!enTest)}
                    disabled={cambiandoModo}
                    className={`px-4 py-2 rounded-lg font-bold text-sm text-ds-text disabled:opacity-50 transition-colors ${
                        enTest ? 'bg-ds-accent hover:bg-ds-accent-hover' : 'bg-ds-warn hover:bg-ds-warn'
                    }`}
                >
                    {cambiandoModo ? 'Cambiando…' : enTest ? 'Volver a producción' : 'Pasar a modo prueba'}
                </button>
            </div>

            {estado?.advertencia && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-ds-danger/40 bg-ds-danger/10 px-4 py-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-ds-danger mt-0.5" />
                    <p className="text-sm font-semibold text-ds-danger">{estado.advertencia}</p>
                </div>
            )}
        </div>

        <div className={`rounded-lg border-2 ${tono.borde} ${tono.fondo} p-5 space-y-4`}>
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
                        <p className="text-sm mt-1 text-ds-soft">
                            {estado?.error ?? 'Falta elegir una empresa emisora.'} Mientras tanto los pagos se
                            cobran igual y quedan pendientes de comprobante — no se pierde ninguno.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm mt-1 text-ds-text">
                                <span className="font-bold">{activa!.alias || activa!.razonSocial}</span>
                                {' · '}empresa #{activa!.id}
                            </p>
                            <p className="text-xs mt-0.5 text-ds-soft">
                                {activa!.razonSocial} · RUC {activa!.ruc} · series {activa!.boletaSeries ?? '—'}/{activa!.facturaSeries ?? '—'}
                            </p>
                            {/* Sin alias no hay forma de saber si esta es la empresa del bot o la de
                                otro proyecto: mismo RUC y misma razón social se ven idénticos. */}
                            {!activa!.alias && (
                                <p className="text-xs mt-1 text-ds-warn">
                                    Esta empresa no tiene identificador. Ponele uno en DecatronAPI para no
                                    confundirla con otra del mismo RUC.
                                </p>
                            )}
                            {beta && (
                                <p className="text-sm mt-2 text-ds-soft">
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
            <div className="pt-4 border-t border-ds-border/60">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[260px]">
                        <label className="text-xs font-black text-ds-soft uppercase tracking-wide block mb-1.5">
                            Empresa que emite
                        </label>
                        <select
                            value={elegida}
                            onChange={e => setElegida(e.target.value === '' ? '' : Number(e.target.value))}
                            className="ds-input w-full"
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
                        className="ds-btn ds-btn--primary"
                    >
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                        Cambiar emisor
                    </button>
                </div>

                {aviso && (
                    <p className={`text-sm font-bold mt-3 ${
                        aviso.tipo === 'ok' ? 'text-ds-ok ' : 'text-ds-danger '
                    }`}>{aviso.texto}</p>
                )}

                <p className="text-xs text-ds-soft mt-3 leading-relaxed">
                    El modo beta o producción es de la empresa y <span className="font-bold">no se puede cambiar</span>:
                    una vez que emitió aunque sea un comprobante, su correlativo le pertenece, y cambiarle el entorno
                    dejaría la serie con un salto que SUNAT observa. Para pasar a producción se crea una empresa nueva
                    — con su certificado digital real y su clave SOL — y se elige aquí.
                    {' '}
                    <a
                        href={API_EMPRESAS}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-ds-accent-text font-bold hover:underline"
                    >
                        Crear empresa en DecatronAPI <ExternalLink className="w-3 h-3" />
                    </a>
                </p>
            </div>
        </div>
        </>
    );
}
