import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, X, Sparkles, Shield, Swords, Wind, Heart, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import CardSlab, { gradeLabel } from './CardSlab';

const RARITY_STYLES: Record<string, string> = {
    N: 'bg-ds-faint/20 text-ds-soft border-ds-border/40',
    R: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    SR: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    SSR: 'bg-ds-accent/20 text-ds-accent-text border-ds-accent/40',
    UR: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
    LR: 'bg-ds-warn/20 text-ds-warn border-ds-warn/40',
    MR: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
};

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
    fail: { label: 'Falló (destruida)', color: 'text-ds-danger' },
    success_paid: { label: 'Confirmado', color: 'text-ds-ok' },
    success_expired_unpaid: { label: 'No pagó a tiempo (destruida)', color: 'text-ds-danger' },
};

interface HistoryRow {
    fromLevel: number;
    toLevel: number;
    result: string;
    costCharged: number | null;
    rolledAt: string;
    resolvedAt: string | null;
}

interface CardDetail {
    instanceId: number;
    cardId: string;
    level: number;
    origin: string;
    catalogValue: number;
    status: string;
    acquiredAt: string;
    upgradeUsed: boolean;
    attemptStartedAt: string | null;
    pendingTargetLevel: number | null;
    paymentAmountDue: number | null;
    paymentDeadlineAt: string | null;
    name: string | null;
    rarity: string | null;
    element: string | null;
    cardClass: string | null;
    gender: string | null;
    animated: boolean;
    story: string | null;
    personality: string | null;
    hp: number | null;
    atk: number | null;
    def: number | null;
    spd: number | null;
    imageUrl: string | null;
    history: HistoryRow[];
}

function formatDeadline(iso: string): string {
    const msLeft = new Date(iso).getTime() - Date.now();
    if (msLeft <= 0) return 'vencido';
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m restantes`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function TcgCardDetail() {
    const { instanceId } = useParams<{ instanceId: string }>();
    const navigate = useNavigate();
    const [card, setCard] = useState<CardDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [acting, setActing] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const load = () => {
        setLoading(true);
        api.get(`/tcg/collection/${instanceId}`)
            .then((res) => setCard(res.data))
            .catch((err) => {
                if (err?.response?.status === 404) setNotFound(true);
                else console.error('Error loading card:', err);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [instanceId]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    const handleAttemptUpgrade = async () => {
        setActing(true);
        try {
            await api.post(`/tcg/cards/${instanceId}/upgrade/attempt`);
            setToast({ type: 'success', text: 'Gradeo resuelto — mirá el resultado abajo.' });
            load();
        } catch (err: any) {
            setToast({ type: 'error', text: err?.response?.data?.error || 'Error al intentar el upgrade.' });
        } finally {
            setActing(false);
        }
    };

    const handlePayUpgrade = async () => {
        setActing(true);
        try {
            const res = await api.post(`/tcg/cards/${instanceId}/upgrade/pay`);
            setToast({
                type: 'success',
                text: `¡Grado ${res.data.level} confirmado! La carta ahora vale ${res.data.catalogValue?.toLocaleString()}.`,
            });
            load();
        } catch (err: any) {
            setToast({ type: 'error', text: err?.response?.data?.error || 'Error al pagar el upgrade.' });
        } finally {
            setActing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-ds-accent-text" />
            </div>
        );
    }

    if (notFound || !card) {
        return (
            <div className="space-y-6">
                <TcgPageHeader title="Carta no encontrada" backTo="/me/tcg/collection" />
                <p className="text-ds-soft">
                    Esta carta no existe, no es tuya, o ya fue destruida.
                </p>
            </div>
        );
    }

    const rarityStyle = RARITY_STYLES[card.rarity || 'N'];
    // Todo lo que no se compró vale 1 para siempre, misma regla que aplica el backend.
    const isFreeCard = card.origin !== 'pulled';

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 px-4 py-3 rounded-lg border font-semibold ${toast.type === 'success' ? 'bg-ds-accent/20 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger-solid/20 border-ds-danger/40 text-ds-danger'}`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <X className="w-5 h-5 shrink-0" />}
                    <p>{toast.text}</p>
                </div>
            )}

            <TcgPageHeader title={card.name || '???'} subtitle={`#${card.instanceId} · Nivel ${card.level}`} backTo="/me/tcg/collection" />

            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
                <div className={`rounded-lg border p-4 ${rarityStyle}`}>
                    <CardSlab level={card.level} name={card.name} rarity={card.rarity} imageUrl={card.imageUrl} />
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-bold uppercase tracking-wide">{card.rarity}</span>
                        {card.animated && (
                            <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Animada</span>
                        )}
                    </div>
                    <div className="text-xs text-ds-soft mt-1">{card.element} · {card.cardClass}</div>
                    <div className="text-xs text-ds-soft">Valor de catálogo: {card.catalogValue}</div>
                    {card.level > 0 && (
                        <div className="text-xs text-ds-soft">Gradeada {card.level} · {gradeLabel(card.level)}</div>
                    )}
                    {card.origin === 'claimed' && <div className="text-[10px] text-ds-soft mt-1">Obtenida por claim gratis</div>}
                    {card.origin === 'free_pack' && <div className="text-[10px] text-ds-soft mt-1">Obtenida en un sobre gratis</div>}
                </div>

                <div className="space-y-6">
                    {(card.hp != null || card.atk != null || card.def != null || card.spd != null) && (
                        <div className="grid grid-cols-4 gap-3">
                            <Stat icon={<Heart className="w-4 h-4 text-ds-accent-text" />} label="HP" value={card.hp} />
                            <Stat icon={<Swords className="w-4 h-4 text-ds-accent-text" />} label="ATK" value={card.atk} />
                            <Stat icon={<Shield className="w-4 h-4 text-ds-accent-text" />} label="DEF" value={card.def} />
                            <Stat icon={<Wind className="w-4 h-4 text-ds-accent-text" />} label="SPD" value={card.spd} />
                        </div>
                    )}

                    {(card.story || card.personality) && (
                        <div className="bg-ds-bg border border-ds-border rounded-lg p-5 space-y-3">
                            {card.story && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-ds-soft mb-1">Historia</div>
                                    <p className="text-sm text-ds-text">{card.story}</p>
                                </div>
                            )}
                            {card.personality && (
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-ds-soft mb-1">Personalidad</div>
                                    <p className="text-sm text-ds-text">{card.personality}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upgrade — una sola oportunidad en toda la vida de la carta */}
                    <div className="bg-ds-bg border border-ds-border rounded-lg p-5">
                        <h2 className="text-lg font-bold text-ds-text mb-3">Upgrade</h2>

                        {/* El valor recién se revela después de pagar, así que en una carta
                            gratuita —que vale 1 para siempre— hay que avisarlo ANTES: si no,
                            se paga a ciegas por algo que no va a mover el valor. */}
                        {isFreeCard && (
                            <div className="mb-3 flex items-start gap-2 bg-ds-warn/10 border border-ds-warn/40 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-4 h-4 text-ds-warn shrink-0 mt-0.5" />
                                <p className="text-xs text-ds-warn">
                                    Carta gratuita: su valor de catálogo queda en 1 aunque la gradees.
                                    Gradearla sirve para jugarla, no para que valga más.
                                </p>
                            </div>
                        )}

                        {card.status === 'active' && !card.upgradeUsed && (
                            <div className="space-y-3">
                                <p className="text-sm text-ds-soft">
                                    Esta carta todavía no usó su único intento de gradeo. El resultado sale al instante:
                                    o se destruye, o sale con un grado del 1 al 10. Si sale con grado, tenés 24 horas
                                    para confirmarlo pagando; si no pagás, se destruye igual.
                                </p>
                                <button
                                    onClick={handleAttemptUpgrade}
                                    disabled={acting}
                                    className="bg-ds-accent hover:bg-ds-accent-hover disabled:opacity-50 text-ds-on-accent font-bold px-5 py-2 rounded-lg flex items-center gap-2"
                                >
                                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Mandar a gradear
                                </button>
                            </div>
                        )}

                        {card.status === 'active' && card.upgradeUsed && (
                            <p className="text-sm text-ds-soft">Esta carta ya usó su único gradeo.</p>
                        )}

                        {/* Solo el 10 espera, y espera a la ilustración, no al reloj. */}
                        {card.status === 'grading_in_progress' && (
                            <div className="bg-ds-input/20 rounded-lg p-4 space-y-1">
                                <div className="font-bold text-ds-warn">¡Sacaste un 10!</div>
                                <p className="text-sm text-ds-soft">
                                    El grado más alto lleva una ilustración exclusiva que se está preparando a mano.
                                    Suele estar lista en unas 24 horas. Cuando esté, vas a poder confirmarla acá.
                                </p>
                                {card.attemptStartedAt && (
                                    <div className="text-xs text-ds-soft pt-1">
                                        Enviada {formatDate(card.attemptStartedAt)}
                                    </div>
                                )}
                            </div>
                        )}

                        {card.status === 'frozen_pending_payment' && (
                            <div className="bg-ds-input/20 rounded-lg p-4 space-y-2">
                                <div className="font-bold text-ds-warn">
                                    Salió grado {card.pendingTargetLevel} · {gradeLabel(card.pendingTargetLevel ?? 0)}
                                </div>
                                <div className="text-sm text-ds-soft">
                                    {card.paymentAmountDue?.toLocaleString()} DecaCoins · {card.paymentDeadlineAt ? formatDeadline(card.paymentDeadlineAt) : ''}
                                </div>
                                <div className="text-xs text-ds-soft">
                                    Vas a saber en cuánto queda su valor recién cuando lo confirmes.
                                </div>
                                <button
                                    onClick={handlePayUpgrade}
                                    disabled={acting}
                                    className="bg-ds-warn hover:bg-ds-warn disabled:opacity-50 text-ds-on-accent font-bold px-5 py-2 rounded-lg flex items-center gap-2"
                                >
                                    {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    Pagar y confirmar
                                </button>
                            </div>
                        )}
                    </div>

                    {card.history.length > 0 && (
                        <div className="bg-ds-bg border border-ds-border rounded-lg p-5">
                            <h2 className="text-lg font-bold text-ds-text mb-3">Historial</h2>
                            <div className="space-y-2">
                                {card.history.map((h, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm border-t border-ds-border pt-2 first:border-0 first:pt-0">
                                        <span className={`font-semibold ${RESULT_LABELS[h.result]?.color || 'text-ds-text'}`}>
                                            {RESULT_LABELS[h.result]?.label || h.result}
                                            {h.result === 'success_paid' && ` · nivel ${h.toLevel}`}
                                        </span>
                                        <span className="text-ds-soft">{h.resolvedAt ? formatDate(h.resolvedAt) : formatDate(h.rolledAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | null }) {
    if (value == null) return null;
    return (
        <div className="bg-ds-bg border border-ds-border rounded-lg p-3 flex items-center gap-2">
            {icon}
            <div>
                <div className="text-[10px] uppercase tracking-wide text-ds-soft">{label}</div>
                <div className="font-bold text-ds-text">{value}</div>
            </div>
        </div>
    );
}
