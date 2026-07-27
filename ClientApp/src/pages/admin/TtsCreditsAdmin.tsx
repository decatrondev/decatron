/**
 * Gestión de créditos TTS — /admin/tts-credits
 *
 * Buscar un canal, ver sus dos bolsas y su historial, y otorgar o retirar créditos.
 * Las bolsas no se mezclan: la estándar es la voz del servidor (holgada, incluida en
 * el plan) y la premium es Polly, la que se compra.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Infinity as InfinityIcon, Users } from 'lucide-react';
import api from '../../services/api';
import { UserSearchInput, type AdminUser } from '../../components/admin/UserSearchInput';

type UserHit = AdminUser;

interface LedgerEntry {
    id: number;
    createdAt: string;
    type: string;
    credits: number;
    bucket: string;
    feature?: string;
    engine?: string;
    chars?: number;
    voice?: string;
    note?: string;
    grantedBy?: string;
}

interface CreditDetail {
    user: UserHit;
    tier: string;
    tierExpiresAt: string | null;
    isUnlimited: boolean;
    premium: {
        monthlyGranted: number;
        monthlyUsed: number;
        monthlyRemaining: number;
        purchasedBalance: number;
        totalAvailable: number;
    };
    standard: { granted: number; used: number; remaining: number };
    history: LedgerEntry[];
}

const TYPE_LABEL: Record<string, string> = {
    consume: 'Consumo',
    grant_monthly: 'Cuota mensual',
    grant_gift: 'Regalo',
    purchase: 'Compra',
    refund: 'Devolución',
    adjust: 'Ajuste',
    adjust_monthly: 'Recorte de cuota',
};

const BUCKET_LABEL: Record<string, string> = {
    monthly: 'Mensual',
    purchased: 'Comprados',
    standard: 'Estándar',
    none: '—',
};

const FEATURE_LABEL: Record<string, string> = {
    speak_chat: 'Speak Chat',
    event_alerts: 'Alertas',
    tips: 'Propinas',
    timer_alerts: 'Timer',
    admin: 'Admin',
};

const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg';
const inputClass = 'w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm';
const labelClass = 'text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2';

export default function TtsCreditsAdmin() {
    const navigate = useNavigate();

    const [selected, setSelected] = useState<AdminUser | null>(null);
    const [detail, setDetail] = useState<CreditDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [amount, setAmount] = useState('');
    // Dar o quitar se elige con un botón, no escribiendo un menos delante del número:
    // eso último no se le ocurre a nadie mirando el formulario.
    const [direction, setDirection] = useState<'add' | 'remove'>('add');
    const [bucket, setBucket] = useState<'purchased' | 'monthly' | 'standard'>('purchased');
    const [note, setNote] = useState('');
    const [granting, setGranting] = useState(false);
    const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const [batchOpen, setBatchOpen] = useState(false);
    const [batchAmount, setBatchAmount] = useState('');
    const [batchBucket, setBatchBucket] = useState<'purchased' | 'monthly' | 'standard'>('purchased');
    const [batchNote, setBatchNote] = useState('');
    const [batchScope, setBatchScope] = useState<'bot_enabled' | 'all'>('bot_enabled');
    const [batchPreview, setBatchPreview] = useState<{ count: number; logins: string[] } | null>(null);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchResult, setBatchResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

    const loadDetail = async (userId: number) => {
        setLoadingDetail(true);
        setFeedback(null);
        try {
            const res = await api.get(`/admin/tts-credits/${userId}`);
            if (res.data?.success) setDetail(res.data);
        } catch {
            setFeedback({ kind: 'error', text: 'No se pudo cargar el saldo de ese canal' });
        } finally {
            setLoadingDetail(false);
        }
    };

    /** Motivo mínimo, igual que exige el backend. */
    const noteIsValid = note.trim().length >= 3;

    const grant = async () => {
        if (!detail) return;

        if (!noteIsValid) {
            setFeedback({ kind: 'error', text: 'Escribe el motivo del movimiento' });
            return;
        }

        const magnitude = Math.abs(Number(amount));
        if (!Number.isFinite(magnitude) || magnitude === 0) {
            setFeedback({ kind: 'error', text: 'Escribe una cantidad distinta de cero' });
            return;
        }

        const credits = direction === 'remove' ? -magnitude : magnitude;

        setGranting(true);
        setFeedback(null);
        try {
            const res = await api.post(`/admin/tts-credits/${detail.user.id}/grant`, {
                credits, bucket, note,
            });
            setFeedback({ kind: 'ok', text: res.data?.message ?? 'Movimiento registrado' });
            setAmount('');
            setNote('');
            await loadDetail(detail.user.id);
        } catch (e: any) {
            setFeedback({ kind: 'error', text: e?.response?.data?.message ?? 'No se pudo registrar el movimiento' });
        } finally {
            setGranting(false);
        }
    };

    // ── Otorgamiento en lote ────────────────────────────────────────────────
    // Es lo que acredita el regalo de transición. Con más de treinta canales,
    // hacerlo de uno en uno garantiza que se olvide alguno.

    const previewBatch = async () => {
        setBatchPreview(null);
        setBatchResult(null);
        try {
            const res = await api.post('/admin/tts-credits/grant-batch/preview', { scope: batchScope });
            setBatchPreview({ count: res.data?.count ?? 0, logins: (res.data?.users ?? []).map((u: UserHit) => u.login) });
        } catch {
            setBatchResult({ kind: 'error', text: 'No se pudo consultar a cuántos canales alcanzaría' });
        }
    };

    const runBatch = async () => {
        const magnitude = Math.abs(Number(batchAmount));
        if (!Number.isFinite(magnitude) || magnitude === 0) {
            setBatchResult({ kind: 'error', text: 'Escribe una cantidad' });
            return;
        }
        if (batchNote.trim().length < 3) {
            setBatchResult({ kind: 'error', text: 'Escribe el motivo del lote' });
            return;
        }

        setBatchRunning(true);
        setBatchResult(null);
        try {
            const res = await api.post('/admin/tts-credits/grant-batch', {
                credits: magnitude,
                bucket: batchBucket,
                note: batchNote,
                scope: batchScope,
            });
            setBatchResult({ kind: 'ok', text: res.data?.message ?? 'Lote aplicado' });
            setBatchAmount('');
            setBatchNote('');
            if (detail) await loadDetail(detail.user.id);
        } catch (e: any) {
            setBatchResult({ kind: 'error', text: e?.response?.data?.message ?? 'No se pudo aplicar el lote' });
        } finally {
            setBatchRunning(false);
        }
    };

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleString('es-ES', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin')}
                    className="p-3 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors shadow-lg"
                >
                    <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Créditos TTS</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-1 text-sm">
                        Saldo, historial y ajustes manuales por canal
                    </p>
                </div>
            </div>

            {/* Lote. Va plegado porque se usa dos veces al año, pero cuando hace falta
                —el regalo de transición— es la diferencia entre un clic y treinta. */}
            <div className={cardClass}>
                <button
                    onClick={() => setBatchOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                >
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                        <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                            Dar créditos a varios canales a la vez
                        </span>
                    </div>
                    <span className="text-[#64748b] dark:text-[#94a3b8]">{batchOpen ? '▲' : '▼'}</span>
                </button>

                {batchOpen && (
                    <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-4">
                        <div>
                            <label className={labelClass}>A quién</label>
                            <select
                                value={batchScope}
                                onChange={e => { setBatchScope(e.target.value as typeof batchScope); setBatchPreview(null); }}
                                className={inputClass + ' max-w-md'}
                            >
                                <option value="bot_enabled">Canales con el bot activo</option>
                                <option value="all">Todas las cuentas registradas</option>
                            </select>
                            <button
                                onClick={previewBatch}
                                className="mt-2 px-3 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-xs font-bold text-[#64748b] dark:text-[#94a3b8] hover:border-blue-400 hover:text-blue-600 transition-colors"
                            >
                                Ver a cuántos alcanza
                            </button>
                            {batchPreview && (
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                    <strong className="text-[#1e293b] dark:text-[#f8fafc]">{batchPreview.count} canales</strong>
                                    {batchPreview.logins.length > 0 && `: ${batchPreview.logins.slice(0, 12).join(', ')}`}
                                    {batchPreview.logins.length > 12 && ` y ${batchPreview.logins.length - 12} más`}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Bolsa</label>
                                <select
                                    value={batchBucket}
                                    onChange={e => setBatchBucket(e.target.value as typeof batchBucket)}
                                    className={inputClass}
                                >
                                    <option value="purchased">Premium comprados — no caducan</option>
                                    <option value="monthly">Premium del mes — se reinicia el día 1</option>
                                    <option value="standard">Voz estándar — se reinicia el día 1</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Cantidad por canal</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={batchAmount}
                                    onChange={e => setBatchAmount(e.target.value)}
                                    placeholder="Ej: 20000"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Motivo</label>
                                <input
                                    value={batchNote}
                                    onChange={e => setBatchNote(e.target.value)}
                                    placeholder="Regalo de transición"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {Number(batchAmount) > 0 && batchPreview && (
                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc]">
                                Vas a dar <strong>{Math.abs(Number(batchAmount)).toLocaleString()}</strong> créditos{' '}
                                {batchBucket === 'standard' ? 'de voz estándar' : batchBucket === 'monthly' ? 'premium del mes' : 'premium comprados'}{' '}
                                a <strong>{batchPreview.count} canales</strong>. Son{' '}
                                <strong>{(Math.abs(Number(batchAmount)) * batchPreview.count).toLocaleString()}</strong> en total.
                            </p>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={runBatch}
                                disabled={batchRunning || !(Number(batchAmount) > 0) || batchNote.trim().length < 3}
                                className="px-5 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                                {batchRunning ? 'Acreditando…' : 'Aplicar a todos'}
                            </button>
                            {batchResult && (
                                <span className={`text-xs font-bold ${
                                    batchResult.kind === 'ok'
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}>
                                    {batchResult.text}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Buscador */}
            <div className={cardClass}>
                <label className={labelClass}>Canal</label>
                <UserSearchInput
                    value={selected}
                    onSelect={u => { setSelected(u); loadDetail(u.id); }}
                    onClear={() => { setSelected(null); setDetail(null); setFeedback(null); }}
                />
            </div>

            {loadingDetail && (
                <div className={cardClass + ' text-center text-sm text-[#64748b] dark:text-[#94a3b8]'}>
                    Cargando saldo…
                </div>
            )}

            {detail && !loadingDetail && (
                <>
                    {/* Saldos */}
                    <div className={cardClass}>
                        <div className="flex items-center gap-3 mb-4">
                            {detail.user.profileImageUrl && (
                                <img src={detail.user.profileImageUrl} alt="" className="w-10 h-10 rounded-full" />
                            )}
                            <div>
                                <p className="font-black text-[#1e293b] dark:text-[#f8fafc]">
                                    {detail.user.displayName || detail.user.login}
                                </p>
                                <p className="text-xs text-[#94a3b8]">
                                    @{detail.user.login} · plan {detail.tier}
                                    {detail.tierExpiresAt && ` · vence ${fmtDate(detail.tierExpiresAt)}`}
                                </p>
                            </div>
                        </div>

                        {detail.isUnlimited ? (
                            <div className="flex items-center gap-2 text-sm font-bold text-[#2563eb]">
                                <InfinityIcon className="w-5 h-5" />
                                Créditos ilimitados: este canal no consume ninguna bolsa.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900">
                                    <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide">
                                        Voz estándar
                                    </p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {detail.standard.remaining.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-[#94a3b8]">
                                        de {detail.standard.granted.toLocaleString()} este mes
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626]">
                                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Premium del mes
                                    </p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {detail.premium.monthlyRemaining.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-[#94a3b8]">
                                        de {detail.premium.monthlyGranted.toLocaleString()} · se reinicia el día 1
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626]">
                                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                        Comprados
                                    </p>
                                    <p className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {detail.premium.purchasedBalance.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-[#94a3b8]">no caducan</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ajuste manual */}
                    <div className={cardClass}>
                        <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-1 flex items-center gap-2">
                            <Coins className="w-4 h-4" /> Dar o quitar créditos
                        </h2>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                            Nada se edita ni se borra: cada movimiento se apunta en el libro mayor con tu nombre,
                            y una corrección es otro movimiento encima.
                        </p>

                        {/* Paso 1 */}
                        <div className="mb-4">
                            <label className={labelClass}>1 · Qué quieres hacer</label>
                            <div className="grid grid-cols-2 gap-2 max-w-md">
                                <button
                                    onClick={() => setDirection('add')}
                                    className={`px-4 py-3 rounded-lg border-2 text-sm font-bold transition-all ${
                                        direction === 'add'
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                            : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-green-300'
                                    }`}
                                >
                                    ➕ Dar créditos
                                </button>
                                <button
                                    onClick={() => setDirection('remove')}
                                    className={`px-4 py-3 rounded-lg border-2 text-sm font-bold transition-all ${
                                        direction === 'remove'
                                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                            : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-red-300'
                                    }`}
                                >
                                    ➖ Quitar créditos
                                </button>
                            </div>
                        </div>

                        {/* Paso 2 */}
                        <div className="mb-4">
                            <label className={labelClass}>2 · De qué bolsa</label>
                            <select
                                value={bucket}
                                onChange={e => setBucket(e.target.value as typeof bucket)}
                                className={inputClass + ' max-w-md'}
                            >
                                <option value="purchased">Premium comprados — no caducan</option>
                                <option value="monthly">Premium del mes — se reinicia el día 1</option>
                                <option value="standard">Voz estándar — se reinicia el día 1</option>
                            </select>

                            {bucket === 'purchased' ? (
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                    Es la que quieres casi siempre: lo que pongas aquí se queda hasta que se gaste.
                                </p>
                            ) : (
                                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                                    ⚠️ Esta bolsa se reinicia el día 1, así que lo que hagas aquí dura hasta fin de mes
                                    y se pierde si no se gasta. Para algo permanente usa los comprados.
                                </p>
                            )}
                        </div>

                        {/* Paso 3 */}
                        <div className="mb-4">
                            <label className={labelClass}>3 · Cuántos</label>
                            <input
                                type="number"
                                min={0}
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="Ej: 100000"
                                className={inputClass + ' max-w-md'}
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                                {[10_000, 50_000, 100_000, 500_000, 1_000_000].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setAmount(String(n))}
                                        className="px-3 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-xs font-bold text-[#64748b] dark:text-[#94a3b8] hover:border-blue-400 hover:text-blue-600 transition-colors"
                                    >
                                        {n.toLocaleString()}
                                    </button>
                                ))}
                                {/* Dejar a cero es lo que hace falta para probar el respaldo
                                    a voz estándar, y calcular la resta a mano es un incordio */}
                                {direction === 'remove' && (
                                    <button
                                        onClick={() => setAmount(String(
                                            bucket === 'standard' ? detail.standard.remaining
                                                : bucket === 'monthly' ? detail.premium.monthlyRemaining
                                                : detail.premium.purchasedBalance
                                        ))}
                                        className="px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        Dejar a cero
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Paso 4 — obligatorio: un movimiento sin motivo no se puede
                            explicar tres meses después */}
                        <div className="mb-4">
                            <label className={labelClass}>4 · Motivo</label>
                            <input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Compensación por incidencia, sorteo, prueba…"
                                className={inputClass + ' max-w-md'}
                            />
                            {!noteIsValid && (
                                <p className="text-xs text-[#94a3b8] mt-1">
                                    Obligatorio. Queda en el historial junto a tu nombre.
                                </p>
                            )}
                        </div>

                        {/* Resumen antes de confirmar: leer una frase es más difícil de
                            equivocar que releer cuatro campos sueltos */}
                        {Number(amount) > 0 && (
                            <p className="text-sm text-[#1e293b] dark:text-[#f8fafc] mb-3">
                                Vas a <strong>{direction === 'add' ? 'dar' : 'quitar'}</strong>{' '}
                                <strong>{Math.abs(Number(amount)).toLocaleString()}</strong> créditos{' '}
                                {bucket === 'standard' ? 'de voz estándar' : bucket === 'monthly' ? 'premium del mes' : 'premium comprados'}{' '}
                                a <strong>{detail.user.displayName || detail.user.login}</strong>.
                            </p>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                onClick={grant}
                                disabled={granting || !(Number(amount) > 0) || !noteIsValid}
                                className={`px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 ${
                                    direction === 'add'
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                                        : 'bg-gradient-to-r from-red-500 to-rose-600'
                                }`}
                            >
                                {granting
                                    ? 'Registrando…'
                                    : direction === 'add' ? 'Dar créditos' : 'Quitar créditos'}
                            </button>

                            {feedback && (
                                <span className={`text-xs font-bold ${
                                    feedback.kind === 'ok'
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}>
                                    {feedback.text}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Historial */}
                    <div className={cardClass}>
                        <h2 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                            Últimos movimientos
                        </h2>

                        {detail.history.length === 0 ? (
                            <p className="text-xs text-[#94a3b8]">Este canal todavía no tiene movimientos.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-[#64748b] dark:text-[#94a3b8] border-b border-[#e2e8f0] dark:border-[#374151]">
                                            <th className="py-2 pr-3 font-bold">Fecha</th>
                                            <th className="py-2 pr-3 font-bold">Tipo</th>
                                            <th className="py-2 pr-3 font-bold text-right">Créditos</th>
                                            <th className="py-2 pr-3 font-bold">Bolsa</th>
                                            <th className="py-2 pr-3 font-bold">Función</th>
                                            <th className="py-2 font-bold">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.history.map(h => (
                                            <tr key={h.id} className="border-b border-[#f1f5f9] dark:border-[#262626]">
                                                <td className="py-2 pr-3 text-[#94a3b8] whitespace-nowrap">{fmtDate(h.createdAt)}</td>
                                                <td className="py-2 pr-3 text-[#1e293b] dark:text-[#f8fafc]">
                                                    {TYPE_LABEL[h.type] ?? h.type}
                                                </td>
                                                <td className={`py-2 pr-3 text-right font-mono font-bold ${
                                                    h.credits > 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : h.credits < 0
                                                            ? 'text-red-600 dark:text-red-400'
                                                            : 'text-[#94a3b8]'
                                                }`}>
                                                    {h.credits > 0 ? '+' : ''}{h.credits.toLocaleString()}
                                                </td>
                                                <td className="py-2 pr-3 text-[#64748b] dark:text-[#94a3b8]">
                                                    {BUCKET_LABEL[h.bucket] ?? h.bucket}
                                                </td>
                                                <td className="py-2 pr-3 text-[#64748b] dark:text-[#94a3b8]">
                                                    {FEATURE_LABEL[h.feature ?? ''] ?? h.feature ?? '—'}
                                                </td>
                                                <td className="py-2 text-[#94a3b8]">
                                                    {h.note ?? (h.chars ? `${h.chars} caracteres` : '')}
                                                    {h.voice && ` · ${h.voice}`}
                                                    {h.grantedBy && ` · por ${h.grantedBy}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
