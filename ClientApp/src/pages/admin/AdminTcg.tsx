import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Clock, Coins, History, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

// Tabla de monitoreo del TCG para el dueño — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md
// seccion 6.
//
// "En gradeo" ya no es una espera de 24h: del 1 al 9 el resultado sale al instante, así
// que lo único que puede aparecer ahí es un NIVEL 10 esperando que subas su ilustración
// en /admin/tcg-art-queue. Es una lista de trabajo pendiente tuyo, no de tiempo.

interface UpgradeRow {
    instanceId: number;
    ownerLogin: string;
    cardName: string | null;
    cardRarity: string | null;
    status: string;
    attemptStartedAt: string | null;
    pendingTargetLevel: number | null;
    paymentAmountDue: number | null;
    paymentDeadlineAt: string | null;
}


interface RecentResult {
    ownerLogin: string;
    cardName: string | null;
    cardRarity: string | null;
    result: string;
    level: number;
    costCharged: number | null;
    resolvedAt: string;
}

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
    fail: { label: 'Falló (destruida)', color: 'text-ds-danger' },
    success_paid: { label: 'Confirmado', color: 'text-ds-ok' },
    success_expired_unpaid: { label: 'No pagó a tiempo (destruida)', color: 'text-ds-danger' },
};

function formatCountdown(iso: string): string {
    const msLeft = new Date(iso).getTime() - Date.now();
    if (msLeft <= 0) return 'vencido';
    const h = Math.floor(msLeft / (1000 * 60 * 60));
    const m = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminTcg() {
    const navigate = useNavigate();
    const [inProgress, setInProgress] = useState<UpgradeRow[]>([]);
    const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get('/tcg/admin/upgrades-in-progress');
            setInProgress(Array.isArray(res.data?.inProgress) ? res.data.inProgress : []);
            setRecentResults(Array.isArray(res.data?.recentResults) ? res.data.recentResults : []);
        } catch (err) {
            console.error('Error loading TCG upgrades:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const grading = inProgress.filter(r => r.status === 'grading_in_progress');
    const pendingPayment = inProgress.filter(r => r.status === 'frozen_pending_payment');

    return (
        <div className="panel-scale space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin')} className="p-2 hover:bg-ds-raised rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-ds-text" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-ds-text">TCG — Upgrades en curso</h1>
                        <p className="text-ds-soft mt-1">Solo lectura — el sistema resuelve todo automático, esto no dispara nada.</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="ds-btn ds-btn--secondary"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Actualizar
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
                </div>
            ) : (
                <>
                    <div>
                        <h2 className="text-lg font-bold text-ds-text mb-3 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-ds-accent-text" /> Nivel 10 esperando tu arte ({grading.length})
                        </h2>
                        {grading.length === 0 ? (
                            <p className="text-sm text-ds-soft">
                                Nadie sacó un 10 pendiente de ilustrar. Todo lo demás se resuelve solo.
                            </p>
                        ) : (
                            <>
                                <p className="text-sm text-ds-warn/80 mb-2">
                                    Estas cartas están frenadas hasta que subas su ilustración en la cola de arte.
                                    No se resuelven solas ni vencen — el jugador espera lo que tardes.
                                </p>
                                <div className="overflow-x-auto rounded-lg border border-ds-border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-ds-bg text-ds-soft">
                                            <tr>
                                                <th className="text-left p-3">ID</th>
                                                <th className="text-left p-3">Jugador</th>
                                                <th className="text-left p-3">Carta</th>
                                                <th className="text-left p-3">Rareza</th>
                                                <th className="text-left p-3">Esperando desde</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grading.map(r => (
                                                <tr key={r.instanceId} className="border-t border-ds-border text-ds-text">
                                                    <td className="p-3 text-ds-soft">#{r.instanceId}</td>
                                                    <td className="p-3">{r.ownerLogin}</td>
                                                    <td className="p-3">{r.cardName || '???'}</td>
                                                    <td className="p-3">{r.cardRarity}</td>
                                                    <td className="p-3 text-ds-warn font-semibold">
                                                        {r.attemptStartedAt ? formatDate(r.attemptStartedAt) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-ds-text mb-3 flex items-center gap-2">
                            <Coins className="w-5 h-5 text-ds-accent-text" /> Esperando pago ({pendingPayment.length})
                        </h2>
                        {pendingPayment.length === 0 ? (
                            <p className="text-sm text-ds-soft">Nadie esperando pagar un upgrade ahora mismo.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-ds-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-ds-bg text-ds-soft">
                                        <tr>
                                            <th className="text-left p-3">ID</th>
                                            <th className="text-left p-3">Jugador</th>
                                            <th className="text-left p-3">Carta</th>
                                            <th className="text-left p-3">Rareza</th>
                                            <th className="text-left p-3">Nivel que salió</th>
                                            <th className="text-left p-3">Costo</th>
                                            <th className="text-left p-3">Vence en</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pendingPayment.map(r => (
                                            <tr key={r.instanceId} className="border-t border-ds-border text-ds-text">
                                                <td className="p-3 text-ds-soft">#{r.instanceId}</td>
                                                <td className="p-3">{r.ownerLogin}</td>
                                                <td className="p-3">{r.cardName || '???'}</td>
                                                <td className="p-3">{r.cardRarity}</td>
                                                <td className="p-3">{r.pendingTargetLevel}</td>
                                                <td className="p-3">{r.paymentAmountDue?.toLocaleString()}</td>
                                                <td className="p-3 text-ds-warn font-semibold">{r.paymentDeadlineAt ? formatCountdown(r.paymentDeadlineAt) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-ds-text mb-3 flex items-center gap-2">
                            <History className="w-5 h-5 text-ds-soft" /> Resultados recientes
                        </h2>
                        {recentResults.length === 0 ? (
                            <p className="text-sm text-ds-soft">Todavía no hay resultados.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-ds-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-ds-bg text-ds-soft">
                                        <tr>
                                            <th className="text-left p-3">Jugador</th>
                                            <th className="text-left p-3">Carta</th>
                                            <th className="text-left p-3">Rareza</th>
                                            <th className="text-left p-3">Resultado</th>
                                            <th className="text-left p-3">Nivel</th>
                                            <th className="text-left p-3">Cuándo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentResults.map((r, idx) => (
                                            <tr key={idx} className="border-t border-ds-border text-ds-text">
                                                <td className="p-3">{r.ownerLogin}</td>
                                                <td className="p-3">{r.cardName || '???'}</td>
                                                <td className="p-3">{r.cardRarity}</td>
                                                <td className={`p-3 font-semibold ${RESULT_LABELS[r.result]?.color || ''}`}>{RESULT_LABELS[r.result]?.label || r.result}</td>
                                                <td className="p-3">{r.result === 'success_paid' ? r.level : '—'}</td>
                                                <td className="p-3 text-ds-soft">{formatDate(r.resolvedAt)}</td>
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
