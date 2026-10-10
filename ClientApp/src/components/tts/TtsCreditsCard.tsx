import { useEffect, useState } from 'react';
import { AlertCircle, Coins, Infinity as InfinityIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
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
        <div className={`rounded-lg border ${
            exhausted
                ? 'border-ds-danger/40 bg-ds-danger/10 '
                : 'border-ds-ok/40 bg-ds-ok/10 '
        } ${compact ? 'p-4' : 'p-6'} `}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    {isUnlimited
                        ? <InfinityIcon className="w-6 h-6 text-ds-accent-text" />
                        : <Coins className={`w-6 h-6 ${exhausted ? 'text-ds-danger' : 'text-ds-ok'}`} />
                    }
                    <div>
                        <p className="text-xs font-bold text-ds-soft uppercase tracking-wide">
                            Voz estándar
                        </p>
                        <p className="text-xl font-black text-ds-text leading-tight">
                            {isUnlimited ? 'Ilimitada' : remaining.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-xs font-bold text-ds-soft uppercase tracking-wide">
                        Plan
                    </p>
                    <p className="text-sm font-black text-ds-text">
                        {TIER_LABEL[tier] ?? tier}
                    </p>
                </div>
            </div>

            {!isUnlimited && granted > 0 && (
                <>
                    <div className="mt-3 h-2 bg-ds-raised rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                percentage > 90 ? 'bg-ds-danger-solid' : 'bg-ds-accent'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-ds-soft mt-3">
                        {remaining.toLocaleString()} de {granted.toLocaleString()} caracteres este mes.
                        Se reinicia el día 1 y está incluido en tu plan: no gasta créditos premium.
                    </p>
                </>
            )}

            {exhausted && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-ds-danger">
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
        ? 'border-ds-danger/40 bg-ds-danger/10 '
        : low
            ? 'border-ds-warn/40 bg-ds-warn/10 '
            : 'border-ds-border bg-ds-surface ';

    return (
        <div className={`rounded-lg border ${borderClass} ${compact ? 'p-4' : 'p-6'} `}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    {isUnlimited
                        ? <InfinityIcon className="w-6 h-6 text-ds-accent-text" />
                        : <Coins className={`w-6 h-6 ${exhausted ? 'text-ds-danger' : low ? 'text-ds-warn' : 'text-ds-accent-text'}`} />
                    }
                    <div>
                        <p className="text-xs font-bold text-ds-soft uppercase tracking-wide">
                            Créditos TTS
                        </p>
                        <p className="text-xl font-black text-ds-text leading-tight">
                            {isUnlimited ? 'Ilimitados' : totalAvailable.toLocaleString()}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-xs font-bold text-ds-soft uppercase tracking-wide">
                        Plan
                    </p>
                    <p className="text-sm font-black text-ds-text">
                        {TIER_LABEL[tier] ?? tier}
                    </p>
                </div>
            </div>

            {!isUnlimited && (
                <>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-3 rounded-lg bg-ds-bg">
                            <p className="text-xs text-ds-soft">Cuota del mes</p>
                            <p className="text-sm font-bold text-ds-text">
                                {monthlyRemaining.toLocaleString()} / {monthlyGranted.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-ds-soft">se reinicia el día 1</p>
                        </div>
                        <div className="p-3 rounded-lg bg-ds-bg">
                            <p className="text-xs text-ds-soft">Comprados</p>
                            <p className="text-sm font-bold text-ds-text">
                                {purchasedBalance.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-ds-soft">no caducan</p>
                        </div>
                    </div>

                    {monthlyGranted > 0 && (
                        <div className="mt-3 h-2 bg-ds-raised rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    percentage > 90 ? 'bg-ds-danger-solid' : percentage > 70 ? 'bg-ds-warn' : 'bg-ds-accent'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    )}

                    <p className="text-xs text-ds-soft mt-3">
                        1 crédito premium = 1 carácter. Las voces neurales cuestan 4 créditos por carácter.
                        Las frases repetidas salen del caché y no gastan.
                    </p>
                </>
            )}

            {exhausted && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-ds-danger">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Sin créditos: el TTS de esta función no sonará. Las alertas se siguen viendo, sin voz.
                </div>
            )}

            {low && (
                <div className="mt-3 flex items-start gap-2 text-xs font-bold text-ds-warn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Te queda poco saldo. Al agotarse, el TTS dejará de sonar hasta tu próxima cuota.
                </div>
            )}

            {inTransitionWindow && tier === 'free' && transitionLabel && (
                <div className="mt-3 flex items-start gap-2 text-xs text-ds-accent-text">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    Créditos de bienvenida disponibles hasta el {transitionLabel}. Después necesitarás un plan
                    o un paquete de créditos.
                </div>
            )}

            {expiryLabel && !isUnlimited && (
                <p className="text-xs text-ds-warn mt-2">
                    ⏳ Tu plan vence el {expiryLabel}. Los créditos comprados no se pierden.
                </p>
            )}

            <Link to="/credits" className="inline-block mt-3 text-xs font-semibold text-[#9146FF] hover:underline">Ver gasto por concepto e historial →</Link>
        </div>
    );
}
