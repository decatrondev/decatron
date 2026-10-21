// Créditos: el saldo de voz y, si hubo, cuántas lecturas cayeron a la voz estándar en los últimos 7 días.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import api from '../../../../services/api';
import CreditsPanel from './CreditsPanel';
import type { SpeakChatState } from './useSpeakChatConfig';

interface Fallbacks { days: number; count: number; lastAt: string | null; topReason: string | null }

export default function CreditsTab({ sc }: { sc: SpeakChatState }) {
    const { t, i18n } = useTranslation('speakchat');
    const [fb, setFb] = useState<Fallbacks | null>(null);

    useEffect(() => {
        api.get('/speakchat/fallbacks').then(r => { if (r.data?.success) setFb(r.data); }).catch(() => {});
    }, []);

    return (
        <div className="space-y-6">
            {fb && fb.count > 0 && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-4 py-3 text-sm 3xl:text-base text-ds-warn">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p>{t('v2.fallbacks.summary', { count: fb.count, days: fb.days })}</p>
                        {fb.topReason && <p>{t(`v2.fallbacks.reason_${fb.topReason}`)}</p>}
                        {fb.lastAt && <p>{t('v2.fallbacks.last', { date: new Date(fb.lastAt).toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
                    </div>
                </div>
            )}
            <CreditsPanel usage={sc.usage} />
        </div>
    );
}
