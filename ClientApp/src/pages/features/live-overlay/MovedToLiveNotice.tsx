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
        <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/15 text-sm">
            <Radio className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">{t('title')}</div>
                <p className="text-[#475569] dark:text-[#94a3b8] mt-0.5">{t('body')}</p>
                <Link to="/overlays/live" className="inline-block mt-2 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">{t('cta')} →</Link>
            </div>
            <button onClick={dismiss} className="p-1 rounded-lg text-[#94a3b8] hover:bg-black/5 dark:hover:bg-white/10" aria-label="close"><X className="w-4 h-4" /></button>
        </div>
    );
}
