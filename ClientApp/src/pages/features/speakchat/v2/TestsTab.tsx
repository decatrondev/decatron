// Pruebas: manda un mensaje al overlay para comprobar la voz y la burbuja sin esperar al chat.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TestTube2 } from 'lucide-react';
import { Card, inputClass } from '../../../../components/overlay-editor/ui';
import api from '../../../../services/api';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function TestsTab({ sc, fishFallback }: { sc: SpeakChatState; fishFallback: string }) {
    const { t } = useTranslation('speakchat');
    const [text, setText] = useState(() => t('v2.tests.defaultMessage'));
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const { status, statusLoaded, testing, dirty, config } = sc;
    const [estimate, setEstimate] = useState<{ cleanedText: string; units: number; unit: 'chars' | 'bytes'; credits: number | null } | null>(null);

    // Cuánto costaría leer este texto con la limpieza guardada (no genera audio ni cobra)
    useEffect(() => {
        if (!text.trim()) { setEstimate(null); return; }
        let alive = true;
        const timer = setTimeout(async () => {
            try {
                const res = await api.post('/speakchat/estimate', { message: text, engine: config.voice.engine, pollyEngine: config.voice.pollyEngine });
                if (alive && res.data?.success) setEstimate(res.data);
            } catch { if (alive) setEstimate(null); }
        }, 500);
        return () => { alive = false; clearTimeout(timer); };
    }, [text, config.voice.engine, config.voice.pollyEngine]);

    const send = async () => {
        setResult(null);
        const r = await sc.sendTest(text, fishFallback);
        setResult(r.ok ? { ok: true, message: t('v2.tests.sent') } : { ok: false, message: r.message ?? t('v2.tests.failed') });
    };

    return (
        <div className="space-y-6">
            <Card title={t('v2.tests.title')} description={t('v2.tests.description')}>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={300} className={`${inputClass} resize-none`} aria-label={t('v2.tests.title')} />
                {estimate && (
                    <div className="mt-3 rounded-lg border border-ds-border bg-ds-raised/40 px-4 py-3 text-sm 3xl:text-base space-y-1" aria-live="polite">
                        <p className="text-ds-soft">{estimate.cleanedText
                            ? <>{t('v2.tests.willRead')} <span className="text-ds-text font-bold">«{estimate.cleanedText}»</span></>
                            : t('v2.tests.nothingToRead')}</p>
                        {estimate.cleanedText && (
                            <p className="text-ds-soft">
                                {estimate.credits === null
                                    ? t('v2.tests.costStandard', { count: estimate.units })
                                    : t('v2.tests.costPaid', { count: estimate.units, credits: estimate.credits.toLocaleString(), unit: t(`v2.tests.unit_${estimate.unit}`, { count: estimate.units }) })}
                            </p>
                        )}
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button type="button" className="ds-btn ds-btn--primary" disabled={testing || !text.trim()} onClick={send}>
                        <TestTube2 className="w-4 h-4" /> {testing ? t('v2.tests.sending') : t('v2.tests.send')}
                    </button>
                    {result && <span role="status" className={`text-sm font-bold ${result.ok ? 'text-ds-ok' : 'text-ds-danger'}`}>{result.message}</span>}
                </div>
                <div className="mt-4 space-y-1.5 text-sm 3xl:text-base text-ds-soft">
                    {statusLoaded && status.total === 0 && <p className="text-ds-warn">{t('v2.tests.noOverlay')}</p>}
                    {!config.global.enabled && <p className="text-ds-warn">{t('v2.tests.disabled')}</p>}
                    {dirty && <p>{t('v2.tests.unsaved')} {t('v2.tests.estimateSaved')}</p>}
                </div>
            </Card>
        </div>
    );
}
