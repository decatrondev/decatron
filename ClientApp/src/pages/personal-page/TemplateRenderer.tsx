import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import SceneTemplate from './SceneTemplate';
import BadgeTemplate from './BadgeTemplate';
import ChannelTemplate from './ChannelTemplate';
import InventoryTemplate from './InventoryTemplate';
import PosterTemplate from './PosterTemplate';
import { AdultLinkDialog } from './AgeGate';
import { ADULT_KINDS, hostOf, type PageLabels, type PersonalPageContent, type TemplateProps } from './shared';

// Dibuja la página con la plantilla elegida. El contenido es el mismo para todas: cambiar de plantilla no pierde nada.
// Enlaces +18 (subfase 5.2): mientras el visitante no confirme su edad, el título propio de esos enlaces se tapa y al
// tocarlos se pide la confirmación antes de abrirlos. Se hace acá, una sola vez, para las cinco plantillas.
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
        adultCovered: t('public.adultCovered'),
        play: t('public.play'),
        videoOf: (platform: string) => t('public.videoOf', { platform }),
        loadsFrom: (platform: string) => t('public.loadsFrom', { platform }),
        photos: t('public.photos'),
        close: t('public.close'),
        previous: t('public.previous'),
        next: t('public.next'),
    }), [t]);
}

const isAdultLink = (l: { adult?: boolean; kind: string }) => l.adult === true || ADULT_KINDS.includes(l.kind);

type Props = Omit<TemplateProps, 'labels'> & {
    labels?: PageLabels;
    /** El visitante ya confirmó que tiene 18 o más (en el panel siempre: el dueño ve todo). Sin confirmar, se le pregunta. */
    ageOk?: boolean;
    onAgeConfirm?: () => void;
    /** Al tocar una red o un enlace (para el sonido de los botones, 5.4) */
    onLinkClick?: () => void;
};

export default function TemplateRenderer({ ageOk = true, onAgeConfirm, onLinkClick, ...props }: Props) {
    const fallback = usePageLabels();
    const labels = props.labels ?? fallback;
    const Component = BY_KEY[props.content.template as keyof typeof BY_KEY] ?? SceneTemplate;
    const [pending, setPending] = useState<string | null>(null);

    const adultUrls = useMemo(() => new Set((props.content.links ?? []).filter(isAdultLink).map(l => l.url)), [props.content.links]);
    // Sin confirmar: el título propio de un enlace +18 no se muestra (las redes conservan su nombre, que no es contenido)
    const content: PersonalPageContent = useMemo(() => ageOk ? props.content : {
        ...props.content,
        links: (props.content.links ?? []).map(l => isAdultLink(l) && l.kind === 'custom' ? { ...l, title: labels.adultCovered } : l),
    }, [ageOk, props.content, labels.adultCovered]);

    const onClickCapture = useCallback((e: MouseEvent<HTMLDivElement>) => {
        const anchor = (e.target as HTMLElement).closest('a');
        const href = anchor?.getAttribute('href');
        if (!href) return;
        if (ageOk || !adultUrls.has(href)) { onLinkClick?.(); return; }
        e.preventDefault();
        e.stopPropagation();
        setPending(href);
    }, [ageOk, adultUrls, onLinkClick]);

    const confirm = () => {
        const url = pending;
        setPending(null);
        onAgeConfirm?.();
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div style={{ display: 'contents' }} onClickCapture={onClickCapture}>
            <Component {...props} content={content} labels={labels} />
            {pending && <AdultLinkDialog content={props.content} host={hostOf(pending)} onConfirm={confirm} onCancel={() => setPending(null)} />}
        </div>
    );
}
