import { useEffect, useState, useCallback } from 'react';
import { FileText, Loader2, Check, AlertCircle, Globe, BadgeCheck } from 'lucide-react';
import api from '../../services/api';
import { COUNTRIES } from '../../data/countries';

/**
 * Datos con los que se emite el comprobante de una compra.
 *
 * Se completan una sola vez, acá, y no en medio del pago. Un comprobante se emite sobre un
 * cobro ya hecho: si el documento está mal o falta, después ya no hay a quién preguntarle
 * y la única salida es anular con una nota de crédito.
 */

interface BillingProfile {
    country: string;
    docType: string;
    docNumber: string;
    legalName: string;
    address: string | null;
    email: string | null;
    nameFromSunat: boolean;
    canChooseFactura: boolean;
    isForeign: boolean;
}

/** Documentos que puede presentar alguien domiciliado en el Perú. */
const DOCS_PERU = [
    { value: 'DNI', label: 'DNI' },
    { value: 'RUC', label: 'RUC (permite pedir factura)' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
];

/** Un no domiciliado no tiene por qué tener un documento peruano. */
const DOCS_EXTRANJERO = [
    { value: 'DOC_PAIS_RESIDENCIA', label: 'Documento de mi país (RUT, DNI, CUIT…)' },
    { value: 'PASAPORTE', label: 'Pasaporte' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'TIN', label: 'TIN (persona natural no domiciliada)' },
    { value: 'IN', label: 'IN (empresa no domiciliada)' },
    { value: 'CEDULA_DIPLOMATICA', label: 'Cédula diplomática' },
];

export default function MeBilling() {
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [error, setError]       = useState<string | null>(null);
    const [saved, setSaved]       = useState(false);

    const [foreign, setForeign]     = useState(false);
    const [country, setCountry]     = useState('PE');
    const [docType, setDocType]     = useState('DNI');
    const [docNumber, setDocNumber] = useState('');
    const [legalName, setLegalName] = useState('');
    const [address, setAddress]     = useState('');
    const [email, setEmail]         = useState('');

    // Razón social traída de SUNAT. Cuando está, el nombre no se escribe a mano.
    const [rucLoading, setRucLoading] = useState(false);
    const [rucName, setRucName]       = useState<string | null>(null);
    const [rucError, setRucError]     = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/supporters/billing-profile');
                if (data.complete && data.profile) {
                    const p: BillingProfile = data.profile;
                    setForeign(p.isForeign);
                    setCountry(p.country);
                    setDocType(p.docType);
                    setDocNumber(p.docNumber);
                    setLegalName(p.legalName);
                    setAddress(p.address ?? '');
                    setEmail(p.email ?? '');
                    if (p.nameFromSunat) setRucName(p.legalName);
                }
            } catch {
                // Sin perfil todavía: se muestra el formulario vacío, no es un error.
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    /** Al cambiar de domicilio cambian los documentos posibles, así que se resetea. */
    const cambiarDomicilio = (esExtranjero: boolean) => {
        setForeign(esExtranjero);
        setCountry(esExtranjero ? '' : 'PE');
        setDocType(esExtranjero ? 'DOC_PAIS_RESIDENCIA' : 'DNI');
        setDocNumber('');
        setRucName(null);
        setRucError(null);
        setError(null);
    };

    /**
     * Trae la razón social desde SUNAT.
     *
     * Es lo que evita que una factura salga a nombre de un nombre comercial o de lo que el
     * usuario recuerde: en la factura tiene que ir la razón social registrada.
     */
    const consultarRuc = useCallback(async (ruc: string) => {
        if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) { setRucName(null); setRucError(null); return; }

        setRucLoading(true);
        setRucError(null);
        try {
            const { data } = await api.get(`/supporters/billing-profile/ruc/${ruc}`);
            if (data.found) {
                setRucName(data.razonSocial);
                setLegalName(data.razonSocial);
                if (data.direccion && !address) setAddress(data.direccion);
            }
        } catch (err: any) {
            setRucName(null);
            setRucError(err.response?.data?.error || 'No se pudo consultar el RUC en SUNAT.');
        } finally {
            setRucLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (docType !== 'RUC') { setRucName(null); setRucError(null); return; }
        const id = setTimeout(() => consultarRuc(docNumber), 500);
        return () => clearTimeout(id);
    }, [docType, docNumber, consultarRuc]);

    const guardar = async () => {
        setError(null);
        setSaved(false);
        setSaving(true);
        try {
            const { data } = await api.put('/supporters/billing-profile', {
                country: foreign ? country.toUpperCase() : 'PE',
                docType,
                docNumber: docNumber.trim(),
                legalName: legalName.trim(),
                address: address.trim() || undefined,
                email: email.trim() || undefined,
            });
            if (data.profile?.legalName) setLegalName(data.profile.legalName);
            setSaved(true);
        } catch (err: any) {
            setError(err.response?.data?.error || 'No se pudo guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const docs = foreign ? DOCS_EXTRANJERO : DOCS_PERU;
    const nombreBloqueado = docType === 'RUC' && !!rucName;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-3">
                    <FileText className="w-7 h-7 text-[#2563eb]" />
                    Datos de facturación
                </h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">
                    Con estos datos se emite tu boleta o factura cuando compras algo. Se completan una
                    sola vez. Si solo usas Decatron gratis, no hace falta llenarlos.
                </p>
            </div>

            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] space-y-5">

                {/* Domicilio — decide el tipo de comprobante */}
                <div>
                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        ¿Dónde está tu domicilio?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => cambiarDomicilio(false)}
                            className={`py-2.5 px-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                                !foreign
                                    ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5'
                                    : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'
                            }`}
                        >
                            En el Perú
                        </button>
                        <button
                            onClick={() => cambiarDomicilio(true)}
                            className={`py-2.5 px-4 rounded-xl text-sm font-bold border-2 transition-colors flex items-center justify-center gap-2 ${
                                foreign
                                    ? 'border-[#2563eb] text-[#2563eb] bg-[#2563eb]/5'
                                    : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8]'
                            }`}
                        >
                            <Globe className="w-4 h-4" /> Fuera del Perú
                        </button>
                    </div>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                        {foreign
                            ? 'Tus compras salen como factura de exportación de servicios, sin IGV.'
                            : 'Tus compras salen como boleta, o factura si tienes RUC.'}
                    </p>
                </div>

                {foreign && (
                    <div>
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">País</label>
                        {/*
                            Selector y no texto libre: el código de 2 letras termina en el XML
                            del comprobante, y escribirlo a mano es una fuente de errores que
                            no se descubren hasta que SUNAT rechaza el documento.
                        */}
                        <select
                            value={country}
                            onChange={e => { setCountry(e.target.value); setError(null); }}
                            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                        >
                            <option value="">Elige tu país…</option>
                            {COUNTRIES.filter(c => c.code !== 'PE').map(c => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Documento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Tipo de documento</label>
                        <select
                            value={docType}
                            onChange={e => { setDocType(e.target.value); setDocNumber(''); setError(null); }}
                            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                        >
                            {docs.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">Número</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={docNumber}
                                onChange={e => { setDocNumber(e.target.value.trim()); setError(null); }}
                                placeholder={docType === 'RUC' ? '20123456789' : docType === 'DNI' ? '12345678' : 'Número de documento'}
                                className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                            />
                            {rucLoading && (
                                <Loader2 className="w-4 h-4 animate-spin text-[#2563eb] absolute right-3 top-1/2 -translate-y-1/2" />
                            )}
                        </div>
                    </div>
                </div>

                {rucError && (
                    <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{rucError} Puedes escribir la razón social a mano, pero revísala bien.</span>
                    </div>
                )}

                {/* Nombre o razón social */}
                <div>
                    <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        {docType === 'RUC' ? 'Razón social' : 'Nombre completo'}
                    </label>
                    <input
                        type="text"
                        value={legalName}
                        onChange={e => { setLegalName(e.target.value); setError(null); }}
                        readOnly={nombreBloqueado}
                        placeholder={docType === 'RUC' ? 'Se completa con el RUC' : 'Como figura en tu documento'}
                        className={`w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] ${
                            nombreBloqueado
                                ? 'bg-[#f8fafc] dark:bg-[#0f1011] text-[#64748b] dark:text-[#94a3b8]'
                                : 'bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc]'
                        }`}
                    />
                    {nombreBloqueado && (
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1.5 flex items-center gap-1.5">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            Razón social según SUNAT. No se puede editar: en la factura tiene que ir esta.
                        </p>
                    )}
                </div>

                {/* Opcionales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            Dirección <span className="font-normal text-[#94a3b8]">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            Correo para el comprobante <span className="font-normal text-[#94a3b8]">(opcional)</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#111213] text-[#1e293b] dark:text-[#f8fafc] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
                        />
                    </div>
                </div>

                {error && (
                    <div className="flex items-start gap-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {saved && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5">
                        <Check className="w-4 h-4 shrink-0" />
                        Datos guardados. Ya puedes comprar.
                    </div>
                )}

                <button
                    onClick={guardar}
                    disabled={saving}
                    className="w-full py-3 rounded-xl bg-[#2563eb] text-white font-black text-sm hover:bg-[#1d4ed8] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar datos'}
                </button>
            </div>

            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Estos datos se usan solo para emitir comprobantes electrónicos ante SUNAT. Cada compra
                guarda una copia de cómo estaban ese día, así que cambiarlos no altera un comprobante
                ya emitido.
            </p>
        </div>
    );
}
