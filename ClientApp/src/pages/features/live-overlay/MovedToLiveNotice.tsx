/**
 * Aviso de migración: los bloques del Desktop (selección, coach, predicción) dejaron la
 * tarjeta de Game Overlays y ahora viven en Partida en vivo. Se puede cerrar y queda
 * cerrado en este navegador.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const KEY = 'go-moved-to-live-dismissed';

export function MovedToLiveNotice() {
    const { t } = useTranslation('games', { keyPrefix: 'gameOverlays.movedToLive' });
    const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
    if (hidden) return null;
    const dismiss = () => { try { localStorage.setItem(KEY, '1'); } catch { /* sin storage */ } setHidden(true); };
    return (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-ds-border bg-ds-surface text-sm">
            <Radio className="w-5 h-5 text-ds-accent-text shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-ds-text">{t('title')}</div>
                <p className="text-ds-soft mt-0.5">{t('body')}</p>
                <Link to="/overlays/live" className="inline-block mt-2 font-semibold text-ds-accent-text hover:underline">{t('cta')} →</Link>
            </div>
            <button onClick={dismiss} className="p-1 rounded-lg text-ds-soft hover:bg-ds-raised" aria-label="close"><X className="w-4 h-4" /></button>
        </div>
    );
}
