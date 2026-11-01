/**
 * Timer Extension - Tarjeta de Decatron
 *
 * Cada cierto tiempo aparece unos segundos sobre el overlay del timer con el logo de Decatron y un mensaje (el mismo catálogo
 * y ritmo que en Song Request y Game Overlays). El plan gratis la muestra siempre; desde Supporter se puede ocultar.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../../../../../services/api';

export const DecatronCardSetting: React.FC<{ value?: boolean; onChange: (enabled: boolean) => void }> = ({ value, onChange }) => {
    const { t } = useTranslation('features');
    // null = todavía no se sabe; mientras tanto se asume lo más restrictivo (no se puede apagar)
    const [canHide, setCanHide] = useState<boolean | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get('/timer/promo-card');
                if (alive) setCanHide(!!data?.canHide);
            } catch { if (alive) { setCanHide(false); setError(true); } }
        })();
        return () => { alive = false; };
    }, []);

    const locked = canHide !== true;
    const on = locked || value !== false;

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-5 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-ds-text">{t('timerPromoCard.title')}</h3>
                    <p className="text-xs text-ds-soft mt-1">{t('timerPromoCard.description')}</p>
                </div>
                <label className={`relative inline-flex items-center ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} title={locked ? t('timerPromoCard.locked') : undefined}>
                    <input type="checkbox" checked={on} disabled={locked} onChange={e => onChange(e.target.checked)} className="sr-only peer" aria-label={t('timerPromoCard.show')} />
                    <div className="w-11 h-6 bg-ds-raised rounded-full peer peer-checked:bg-ds-accent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
            </div>
            {canHide === false && !error && (
                <p className="text-xs text-ds-warn mt-3">
                    {t('timerPromoCard.locked')} <Link to="/supporters" className="underline font-bold">{t('timerPromoCard.seePlans')}</Link>
                </p>
            )}
            {error && <p className="text-xs text-ds-warn mt-3">{t('timerPromoCard.loadFailed')}</p>}
            {canHide === true && <p className="text-xs text-ds-soft mt-3">{t('timerPromoCard.saveNote')}</p>}
        </div>
    );
};

export default DecatronCardSetting;
