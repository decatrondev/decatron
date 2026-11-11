import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import SceneTemplate from './SceneTemplate';
import BadgeTemplate from './BadgeTemplate';
import ChannelTemplate from './ChannelTemplate';
import InventoryTemplate from './InventoryTemplate';
import PosterTemplate from './PosterTemplate';
import { AdultLinkDialog } from './AgeGate';
import { CursorTrail, FX_CSS, FX_SURFACES, ParticleLayer, REPLAY_EVENT, effectsOf, useReducedMotion } from './PageEffects';
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
        liveOn: (platform: string) => t('public.liveOn', { platform }),
        watchLive: t('public.watchLive'),
        onAir: t('public.onAir'),
    }), [t]);
}

const isAdultLink = (l: { adult?: boolean; kind: string }) => l.adult === true || ADULT_KINDS.includes(l.kind);

type Props = Omit<TemplateProps, 'labels'> & {
    labels?: PageLabels;
    /** El visitante ya confirmó que tiene 18 o más (en el panel siempre: el dueño ve todo). Sin confirmar, se le pregunta. */
    ageOk?: boolean;
    onAgeConfirm?: () => void;
    /** Al tocar una red, un enlace o un video: el destino para las estadísticas (5.5) y el sonido de los botones (5.4) */
    onLinkClick?: (target?: string) => void;
    /** Sin efectos (miniaturas del selector de plantillas) */
    noEffects?: boolean;
    /** El visitante pausó partículas y estela (5.10) */
    effectsPaused?: boolean;
    /** Fuerza «reducir movimiento» (la vista previa del panel lo simula); sin esto manda el sistema del visitante */
    reducedMotion?: boolean;
};

export default function TemplateRenderer({ ageOk = true, onAgeConfirm, onLinkClick, noEffects, effectsPaused = false, reducedMotion, ...props }: Props) {
    const fallback = usePageLabels();
    const labels = props.labels ?? fallback;
    const Component = BY_KEY[props.content.template as keyof typeof BY_KEY] ?? SceneTemplate;
    const [pending, setPending] = useState<string | null>(null);

    // Destino para las estadísticas: el id del enlace, o «bot:clave» para los enlaces del bot
    const targetOf = useCallback((href: string) => {
        const link = (props.content.links ?? []).find(l => l.url === href);
        if (!link) return undefined;
        return link.id.startsWith('bot-') ? `bot:${link.id.slice(4)}` : link.id;
    }, [props.content.links]);
    const adultUrls = useMemo(() => new Set((props.content.links ?? []).filter(isAdultLink).map(l => l.url)), [props.content.links]);
    // Sin confirmar: el título propio de un enlace +18 no se muestra (las redes conservan su nombre, que no es contenido)
    const content: PersonalPageContent = useMemo(() => ageOk ? props.content : {
        ...props.content,
        links: (props.content.links ?? []).map(l => isAdultLink(l) && l.kind === 'custom' ? { ...l, title: labels.adultCovered } : l),
    }, [ageOk, props.content, labels.adultCovered]);

    const onClickCapture = useCallback((e: MouseEvent<HTMLDivElement>) => {
        // Videos (y otros botones con destino propio): se cuentan sin abrir nada
        const tagged = (e.target as HTMLElement).closest<HTMLElement>('[data-pp-target]');
        if (tagged) { onLinkClick?.(tagged.dataset.ppTarget); return; }
        const anchor = (e.target as HTMLElement).closest('a');
        const href = anchor?.getAttribute('href');
        if (!href) return;
        if (ageOk || !adultUrls.has(href)) { onLinkClick?.(targetOf(href)); return; }
        e.preventDefault();
        e.stopPropagation();
        setPending(href);
    }, [ageOk, adultUrls, onLinkClick, targetOf]);

    // Efectos (5.10): con «reducir movimiento» no hay partículas, estela ni brillo y la entrada es un aparecer muy corto
    const fx = effectsOf(props.content);
    const reduced = useReducedMotion(reducedMotion);
    const particles = !noEffects && !reduced && fx.particles !== 'none';
    const trail = !noEffects && !reduced && fx.cursor !== 'none';
    const entrance = noEffects || fx.entrance === 'none' ? '' : reduced ? 'short' : fx.entrance;
    const [replay, setReplay] = useState(0);
    useEffect(() => {
        if (!props.embedded) return;
        const on = () => setReplay(r => r + 1);
        window.addEventListener(REPLAY_EVENT, on);
        return () => window.removeEventListener(REPLAY_EVENT, on);
    }, [props.embedded]);
    // En cascada: cada red o enlace aparece un poco después del anterior (hasta 14 pasos)
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (entrance !== 'cascade' || !host.current) return;
        host.current.querySelectorAll<HTMLElement>(FX_SURFACES.join(',')).forEach((el, i) => el.style.setProperty('--ppfx-i', String(Math.min(i, 14))));
    }, [entrance, replay, content]);
    const accent = /^#[0-9a-f]{6}$/i.test(props.content.accent) ? props.content.accent : '#5B8CFF';
    const backdrop = particles || trail ? <>
        {particles && <ParticleLayer fx={fx} accent={accent} theme={props.content.theme} embedded={props.embedded} paused={effectsPaused} />}
        {trail && <CursorTrail fx={fx} accent={accent} theme={props.content.theme} embedded={props.embedded} paused={effectsPaused} />}
    </> : undefined;
    const fxClass = [
        particles || trail ? 'ppfx-bg' : '',
        !noEffects && !reduced && fx.shine ? 'ppfx-shine' : '',
        entrance ? `ppfx-in-${entrance}` : '',
    ].filter(Boolean).join(' ');

    const confirm = () => {
        const url = pending;
        setPending(null);
        onAgeConfirm?.();
        if (url) { onLinkClick?.(targetOf(url)); window.open(url, '_blank', 'noopener,noreferrer'); }
    };

    return (
        <div key={replay} ref={host} className={fxClass || undefined} style={{ display: 'contents', ['--ppfx-shine' as string]: `color-mix(in srgb, ${accent} 40%, transparent)` }} onClickCapture={onClickCapture}>
            {fxClass && <style>{FX_CSS}</style>}
            <Component {...props} content={content} labels={labels} backdrop={backdrop} />
            {pending && <AdultLinkDialog content={props.content} host={hostOf(pending)} onConfirm={confirm} onCancel={() => setPending(null)} />}
        </div>
    );
}
