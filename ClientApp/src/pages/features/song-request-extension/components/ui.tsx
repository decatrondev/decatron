import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';

// Las piezas de formulario ahora son compartidas por todos los editores de overlays.
export * from '../../../../components/overlay-editor/ui';

/** "Tu plan permite N. Más con Supporter": link a /supporters cuando se llegó al tope del plan. */
export function PlanLimitNote({ text }: { text: string }) {
    const { t } = useTranslation('overlays');
    return (
        <p className="flex flex-wrap items-center gap-2 text-xs 3xl:text-sm text-amber-700 dark:text-amber-300">
            <Crown className="w-4 h-4 shrink-0" /> {text}
            <a href="/supporters" className="font-bold underline">{t('songRequest.limits.upgrade')}</a>
        </p>
    );
}
