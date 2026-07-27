import { useEffect, useState } from 'react';
import { AlertCircle, Coins, Infinity as InfinityIcon } from 'lucide-react';
import api from '../../services/api';

/**
 * Tarjeta de créditos TTS. Se muestra en todas las pantallas que usan voz:
 * Speak Chat, alertas de eventos, tips y timer.
 *
 * Hay dos bolsas y no se mezclan: la estándar (voz del servidor, muy holgada, no se
 * vende) y la premium (AWS Polly, la que se compra).
 */

export interface TtsCredits {
    tier: string;
    isUnlimited: boolean;
    tierExpiresAt: string | null;
    monthlyGranted: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    purchasedBalance: number;
    totalAvailable: number;
    standardGranted: number;
    standardUsed: number;
    standardRemaining: number;
    standardPercentage: number;
    inTransitionWindow: boolean;
    transitionEndsAt: string | null;
    percentage: number;
}

/** Hook compartido: cualquier pantalla puede leer el saldo con una línea. */
export function useTtsCredits(pollMs = 0) {
    const [credits, setCredits] = useState<TtsCredits | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const res = await api.get('/tts-credits/balance');
            if (res.data?.success) setCredits(res.data);
        } catch { /* silencioso */ }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        if (pollMs > 0) {
            const t = setInterval(load, pollMs);
            return () => clearInterval(t);
        }
    }, [pollMs]);

    return { credits, loading, reload: load };
}

const TIER_LABEL: Record<string, string> = {
    free: 'Free',
    supporter: 'Supporter',
    premium: 'Premium',
    fundador: 'Fundador',
    admin: 'Admin',
};

/**
 * Bolsa de voz estándar. Es deliberadamente sobria: la cifra es tan holgada que el
 * streamer normal no la va a rozar nunca, así que aquí no hay nada que alarmar.
 */
function StandardCard({
    compact, tier, isUnlimited, granted, remaining, percentage,
}: {
    compact: boolean;
    tier: string;
    isUnlimited: boolean;
    granted: number;
    remaining: number;
    percentage: number;
}) {
    const exhausted = !isUnlimited && granted > 0 && remaining === 0;

    return (
        <div className={`rounded-2xl border ${
            exhausted
                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                : 'border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10'
        } ${compact ? 'p-4' : 'p-6'} shadow-lg`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    {isUnlimited
                        ? <InfinityIcon className="w-6 h-6 text-green-600" />
                        : <Coins className={`w-6 h-6 ${exhausted ? 'text-red-500' : 'text-green-600'}`} />
                    }
                    <div>
                        <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                            Voz estándar
                        </p>
                        <p className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] leading-tight">
                            {isUnlimited ? 'Ilimitada' : remaining.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                        Plan
                    </p>
                    <p className="text-sm font-black text-[#1e293b] dark:text-[#f8fafc]">
                        {TIER_LABEL[tier] ?? tier}
                    </p>
                </div>
            </div>

            {!isUnlimited && granted > 0 && (
                <>
                    <div className="mt-3 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                percentage > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-emerald-600'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3">
                        {remaining.toLocaleString()} de {granted.toLocaleString()} caracteres este mes.
                        Se reinicia el día 1 y está incluido en tu plan: no gasta créditos premium.
                    </p>
                </>
            )}

            {exhausted && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Has agotado la voz estándar del mes. Puedes usar voz premium mientras tanto.
                </div>
            )}
        </div>
    );
}

export function TtsCreditsCard({
    credits,
    compact = false,
    standard = false,
}: {
    credits: TtsCredits | null;
    compact?: boolean;
    /** La pantalla está configurada con voz estándar: enseñar esa bolsa, no la premium. */
    standard?: boolean;
}) {
    if (!credits) return null;

    const {
        tier, isUnlimited, totalAvailable, monthlyGranted, monthlyUsed,
        monthlyRemaining, purchasedBalance, percentage, inTransitionWindow,
        transitionEndsAt, tierExpiresAt,
        standardGranted, standardRemaining, standardPercentage,
    } = credits;

    // Con voz estándar la tarjeta habla de la otra bolsa: enseñar el saldo premium
    // ahí solo confundiría, porque esta función no lo va a gastar.
    //
    // Los ?? 0 son por los endpoints que todavía no devuelven la bolsa estándar: un
    // campo que falta no puede tumbar la pantalla entera.
    if (standard) {
        return (
            <StandardCard
                compact={compact}
                tier={tier}
                isUnlimited={isUnlimited}
                granted={standardGranted ?? 0}
                remaining={standardRemaining ?? 0}
                percentage={standardPercentage ?? 0}
            />
        );
    }

    const exhausted = !isUnlimited && totalAvailable === 0;
    const low = !isUnlimited && !exhausted && monthlyGranted > 0 && percentage >= 85 && purchasedBalance === 0;

    const fmtDate = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

    const transitionLabel = fmtDate(transitionEndsAt);
    const expiryLabel = fmtDate(tierExpiresAt);

    const borderClass = exhausted
        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
        : low
            ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D]';

    return (
        <div className={`rounded-2xl border ${borderClass} ${compact ? 'p-4' : 'p-6'} shadow-lg`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    {isUnlimited
                        ? <InfinityIcon className="w-6 h-6 text-[#2563eb]" />
                        : <Coins className={`w-6 h-6 ${exhausted ? 'text-red-500' : low ? 'text-yellow-500' : 'text-[#2563eb]'}`} />
                    }
                    <div>
                        <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                            Créditos TTS
                        </p>
                        <p className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] leading-tight">
                            {isUnlimited ? 'Ilimitados' : totalAvailable.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                        Plan
                    </p>
                    <p className="text-sm font-black text-[#1e293b] dark:text-[#f8fafc]">
                        {TIER_LABEL[tier] ?? tier}
                    </p>
                </div>
            </div>

            {!isUnlimited && (
                <>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Cuota del mes</p>
                            <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                {monthlyRemaining.toLocaleString()} / {monthlyGranted.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-[#94a3b8]">se reinicia el día 1</p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Comprados</p>
                            <p className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                {purchasedBalance.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-[#94a3b8]">no caducan</p>
                        </div>
                    </div>

                    {monthlyGranted > 0 && (
                        <div className="mt-3 h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    )}

                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3">
                        1 crédito premium = 1 carácter. Las voces neurales cuestan 4 créditos por carácter.
                        Las frases repetidas salen del caché y no gastan.
                    </p>
                </>
            )}

            {exhausted && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Sin créditos: el TTS de esta función no sonará. Las alertas se siguen viendo, sin voz.
                </div>
            )}

            {low && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-yellow-600 dark:text-yellow-500">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Te queda poco saldo. Al agotarse, el TTS dejará de sonar hasta tu próxima cuota.
                </div>
            )}

            {inTransitionWindow && tier === 'free' && transitionLabel && (
                <div className="mt-3 flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Créditos de bienvenida disponibles hasta el {transitionLabel}. Después necesitarás un plan
                    o un paquete de créditos.
                </div>
            )}

            {expiryLabel && !isUnlimited && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                    ⏳ Tu plan vence el {expiryLabel}. Los créditos comprados no se pierden.
                </p>
            )}
        </div>
    );
}
