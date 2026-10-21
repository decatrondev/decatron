import { AlertCircle, TestTube2 } from 'lucide-react';
import { cardClass, inputClass, sectionTitle, sectionDesc, usageDateLabels } from './shared';
import type { CreditUsage } from './types';

interface TestingTabProps {
    usage: CreditUsage | null;
    testMessage: string;
    setTestMessage: (v: string) => void;
    testing: boolean;
    sendTest: () => void;
}

export default function TestingTab({ usage, testMessage, setTestMessage, testing, sendTest }: TestingTabProps) {
    const { transitionEndsLabel, tierExpiryLabel } = usageDateLabels(usage);

    return (
        <div className="space-y-6">
            {/* Stats */}
            {usage && (
                <div className={cardClass}>
                    <p className={sectionTitle}>📊 Créditos TTS</p>
                    <div className="flex items-center justify-between text-sm mb-3">
                        <span className="text-ds-soft">
                            Plan: <span className="font-bold text-ds-text capitalize">{usage.tier}</span>
                        </span>
                        <span className="font-bold text-ds-text">
                            {usage.isUnlimited ? '∞' : `${usage.totalAvailable.toLocaleString()} disponibles`}
                        </span>
                    </div>
                    {!usage.isUnlimited && (
                        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                            <div className="p-3 rounded-lg bg-ds-bg">
                                <p className="text-ds-soft">Cuota del mes</p>
                                <p className="font-bold text-ds-text">
                                    {usage.monthlyRemaining.toLocaleString()} / {usage.monthlyGranted.toLocaleString()}
                                </p>
                                <p className="text-ds-soft">se reinicia el día 1</p>
                            </div>
                            <div className="p-3 rounded-lg bg-ds-bg">
                                <p className="text-ds-soft">Comprados</p>
                                <p className="font-bold text-ds-text">
                                    {usage.purchasedBalance.toLocaleString()}
                                </p>
                                <p className="text-ds-soft">no caducan</p>
                            </div>
                        </div>
                    )}
                    {tierExpiryLabel && (
                        <p className="text-xs text-ds-soft mb-3">
                            Vence el {tierExpiryLabel}
                        </p>
                    )}
                    {!usage.isUnlimited && usage.monthlyGranted > 0 && (
                        <div className="h-3 bg-ds-raised rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${
                                    usage.percentage > 90 ? 'bg-ds-danger-solid' : usage.percentage > 70 ? 'bg-ds-warn' : 'bg-ds-accent'
                                }`}
                                style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                            />
                        </div>
                    )}
                    {!usage.isUnlimited && usage.totalAvailable === 0 && (
                        <div className="mt-4 flex items-start gap-2 text-xs text-ds-soft">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-ds-warn mt-0.5" />
                            Sin créditos solo puedes usar voces del navegador, que no suenan en OBS. Para usar
                            Polly necesitas un plan o un paquete de créditos.
                        </div>
                    )}
                    {usage.inTransitionWindow && usage.tier === 'free' && transitionEndsLabel && (
                        <div className="mt-4 flex items-start gap-2 text-xs text-ds-accent-text">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            Estás usando créditos de bienvenida, disponibles hasta el {transitionEndsLabel}.
                        </div>
                    )}
                </div>
            )}

            {/* Test */}
            <div className={cardClass}>
                <p className={sectionTitle}>🧪 Enviar mensaje de prueba</p>
                <p className={sectionDesc}>
                    Envía un mensaje de prueba al overlay para verificar la voz y el display. El overlay debe estar abierto en OBS o en una pestaña del navegador.
                </p>
                <textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none mb-4`}
                />
                <button
                    onClick={sendTest}
                    disabled={testing || !testMessage.trim()}
                    className="ds-btn ds-btn--primary ds-btn--lg"
                >
                    <TestTube2 className="w-5 h-5" />
                    {testing ? 'Enviando...' : 'Enviar al overlay'}
                </button>
            </div>
        </div>
    );
}
