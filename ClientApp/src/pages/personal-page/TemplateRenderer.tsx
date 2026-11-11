import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SceneTemplate from './SceneTemplate';
import BadgeTemplate from './BadgeTemplate';
import ChannelTemplate from './ChannelTemplate';
import InventoryTemplate from './InventoryTemplate';
import PosterTemplate from './PosterTemplate';
import type { PageLabels, TemplateProps } from './shared';

// Dibuja la página con la plantilla elegida. El contenido es el mismo para todas: cambiar de plantilla no pierde nada.
const BY_KEY = { scene: SceneTemplate, badge: BadgeTemplate, channel: ChannelTemplate, inventory: InventoryTemplate, poster: PosterTemplate };

export function usePageLabels(): PageLabels {
    const { t } = useTranslation('personal-page');
    return useMemo(() => ({
        madeWith: t('public.madeWith'),
        adult: t('public.adultBadge'),
        opensIn: (host: string) => t('public.opensIn', { host }),
        noLinks: t('public.noLinks'),
        flip: t('public.flip'),
        flipBack: t('public.flipBack'),
        whereToFind: t('public.whereToFind'),
        nowWatching: t('public.nowWatching'),
        guide: t('public.guide'),
        open: t('public.open'),
        findMeAt: t('public.findMeAt'),
        qrAlt: t('public.qrAlt'),
    }), [t]);
}

export default function TemplateRenderer(props: Omit<TemplateProps, 'labels'> & { labels?: PageLabels }) {
    const fallback = usePageLabels();
    const Component = BY_KEY[props.content.template as keyof typeof BY_KEY] ?? SceneTemplate;
    return <Component {...props} labels={props.labels ?? fallback} />;
}
