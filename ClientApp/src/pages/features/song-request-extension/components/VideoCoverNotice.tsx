import { useTranslation } from 'react-i18next';
import { videoCoversOverlap } from '../utils';
import type { OverlayLayout } from '../types';

/** Aviso de video + portada: cuando se apagó la portada sola, o cuando las dos están encimadas. */
export default function VideoCoverNotice({ layout, coverHidden, onDismiss }: { layout: OverlayLayout; coverHidden?: boolean; onDismiss?: () => void }) {
    const { t } = useTranslation('overlays');
    const overlap = videoCoversOverlap(layout);
    if (!coverHidden && !overlap) return null;
    return (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm 3xl:text-base">
            <span className="text-lg leading-none">⚠️</span>
            <p className="flex-1">{overlap ? t('songRequest.videoCover.overlap') : t('songRequest.videoCover.hidden')}</p>
            {coverHidden && !overlap && onDismiss && (
                <button onClick={onDismiss} className="font-bold underline shrink-0">{t('songRequest.videoCover.ok')}</button>
            )}
        </div>
    );
}
