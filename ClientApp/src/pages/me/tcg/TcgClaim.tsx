import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, X, Gift } from 'lucide-react';
import api from '../../../services/api';
import TcgPageHeader from './TcgPageHeader';
import ClaimOverlay from './ClaimOverlay';
import { CardBack, type PulledCard } from './cardVisuals';

// Claim gratis diario — ver .dev/plans/TCG_CARTAS_COLECCIONABLES_PLAN.md seccion 4.2.
// El cooldown es server-side por cuenta; acá solo se muestra la cuenta regresiva.

function formatCountdown(target: Date): string {
    const msLeft = target.getTime() - Date.now();
    if (msLeft <= 0) return 'ya disponible';
    const hours = Math.floor(msLeft / (1000 * 60 * 60));
    const mins = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((msLeft % (1000 * 60)) / 1000);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;
}

export default function TcgClaim() {
    const navigate = useNavigate();
    const [available, setAvailable] = useState(false);
    const [availableAt, setAvailableAt] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [, forceTick] = useState(0);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const load = () =>
        api.get('/tcg/claim')
            .then((res) => {
                setAvailable(!!res.data.available);
                setAvailableAt(res.data.availableAt ? new Date(res.data.availableAt) : null);
            })
            .catch((err) => console.error('Error loading claim status:', err));

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    // Refresca la cuenta regresiva cada segundo, y cuando llega a cero vuelve a
    // preguntarle al servidor en vez de habilitar el boton por su cuenta — el
    // cooldown real siempre lo decide el backend.
    useEffect(() => {
        if (available || !availableAt) return;
        const id = setInterval(() => {
            if (availableAt.getTime() <= Date.now()) {
                load();
            } else {
                forceTick((n) => n + 1);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [available, availableAt]);

    const handleClaim = async (): Promise<PulledCard> => {
        const res = await api.post('/tcg/claim');
        await load();
        return res.data.card;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2 px-4 py-3 rounded-xl shadow-xl border font-semibold ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
                    {toast.type === 'success' ? <Check className="w-5 h-5 shrink-0" /> : <X className="w-5 h-5 shrink-0" />}
                    <p>{toast.text}</p>
                </div>
            )}

            <TcgPageHeader title="Carta gratis" subtitle="Una carta por día, sin gastar DecaCoins." />

            <div className="bg-[#1a1b1e] border border-[#374151] rounded-2xl p-8 flex flex-col items-center gap-6 max-w-md mx-auto">
                <div className={`w-44 ${available ? 'tcg-pack-float' : 'opacity-40 grayscale'}`}>
                    <CardBack />
                </div>

                {available ? (
                    <>
                        <p className="text-[#94a3b8] text-center text-sm">
                            Tu carta del día está lista.
                        </p>
                        <button
                            onClick={() => setClaiming(true)}
                            className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold px-8 py-3 rounded-xl transition-colors"
                        >
                            <Gift className="w-5 h-5" />
                            Reclamar
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-[#94a3b8] text-center text-sm">Ya reclamaste la de hoy.</p>
                        <div className="text-center">
                            <div className="text-3xl font-black text-white tabular-nums">
                                {availableAt ? formatCountdown(availableAt) : '—'}
                            </div>
                            <div className="text-xs text-[#64748b] mt-1">para la próxima</div>
                        </div>
                    </>
                )}

                <p className="text-xs text-[#64748b] text-center border-t border-[#374151] pt-4">
                    Las cartas gratis valen 1 de catálogo para siempre. Sirven para jugar y para
                    pelear, pero las buenas salen de los sobres.
                </p>
            </div>

            {claiming && (
                <ClaimOverlay
                    onClaim={handleClaim}
                    onClose={() => setClaiming(false)}
                    onError={(msg) => setToast({ type: 'error', text: msg })}
                    onViewCollection={() => navigate('/me/tcg/collection')}
                />
            )}
        </div>
    );
}
