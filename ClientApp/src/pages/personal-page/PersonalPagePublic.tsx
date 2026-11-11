import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import TemplateRenderer from './TemplateRenderer';
import { EntryGate, useAgeOk } from './AgeGate';
import { MuteButton, usePageSound } from './PageSound';
import ReportBar from './ReportBar';
import { hasSound, usePageFonts, type PersonalPageContent } from './shared';

// Página pública decatron.net/@nombre (subfases 5.1 y 5.2: puerta +18 y «Denunciar»). React Router no admite «@:param» dentro de un segmento,
// así que la ruta es «/:atHandle» (las rutas fijas tienen prioridad) y acá se exige que empiece con @.

interface PublicResponse {
    handle: string;
    content: PersonalPageContent;
    /** Toda la página es +18 (la marcó el dueño o admin) */
    adult: boolean;
    channelPhotoUrl: string;
    preview: boolean;
    hidden: boolean;
    canManage: boolean;
    isOwner: boolean;
    reportReasons: string[];
}

type State =
    | { kind: 'loading' }
    | { kind: 'ok'; data: PublicResponse }
    | { kind: 'error'; code: 'not_found' | 'not_open' | 'hidden' | 'not_published' | 'failed' };

export default function PersonalPagePublic() {
    const { atHandle = '' } = useParams();
    const { t } = useTranslation('personal-page');
    const navigate = useNavigate();
    const isHandle = atHandle.startsWith('@');
    const handle = isHandle ? atHandle.slice(1).toLowerCase() : '';
    const [state, setState] = useState<State>({ kind: 'loading' });
    const [ageOk, confirmAge] = useAgeOk();
    // La puerta por sonido se pasa en cada visita (el navegador exige un toque para reproducir audio)
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        if (!isHandle) { setState({ kind: 'error', code: 'not_found' }); return; }
        let alive = true;
        setState({ kind: 'loading' });
        api.get(`/public/personal-pages/${encodeURIComponent(handle)}`)
            .then(res => {
                if (!alive) return;
                if (res.data?.redirect) { navigate(`/@${res.data.redirect}`, { replace: true }); return; }
                setState({ kind: 'ok', data: res.data });
            })
            .catch(err => {
                if (!alive) return;
                const code = err?.response?.data?.code;
                setState({ kind: 'error', code: ['not_found', 'not_open', 'hidden', 'not_published'].includes(code) ? code : err?.response?.status === 404 ? 'not_found' : 'failed' });
            });
        return () => { alive = false; };
    }, [handle, isHandle, navigate]);

    const content = state.kind === 'ok' ? state.data.content : null;
    const sound = usePageSound(content?.sound);
    usePageFonts(content ? [content.font] : []);

    const adultPage = state.kind === 'ok' && state.data.adult;
    useEffect(() => {
        if (!content) return;
        // Página +18: título neutro y fuera de los buscadores (el servidor también manda X-Robots-Tag)
        document.title = adultPage ? `@${handle}` : `${content.displayName || handle} (@${handle})`;
        if (!adultPage) return;
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
        return () => { meta.remove(); };
    }, [content, handle, adultPage]);


    if (state.kind === 'loading') {
        return <div className="min-h-screen bg-pub-bg flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pub-accent" /></div>;
    }

    if (state.kind === 'error') {
        return (
            <div className="min-h-screen bg-pub-bg text-[#d4d4d8] flex items-center justify-center px-4">
                <div className="max-w-md 3xl:max-w-xl text-center">
                    <p className="text-sm 3xl:text-base text-[#a1a1aa]">{isHandle ? `@${handle}` : ''}</p>
                    <h1 className="mt-2 text-2xl 3xl:text-4xl font-black text-white">{t(`public.states.${state.code}.title`)}</h1>
                    <p className="mt-3 text-base 3xl:text-xl text-[#a1a1aa]">{t(`public.states.${state.code}.text`)}</p>
                    {state.code === 'not_published' && (
                        <Link to="/mi-pagina" className="inline-block mt-6 px-5 py-3 rounded-lg bg-pub-accent hover:bg-pub-accent-hover text-white font-bold">{t('public.goToPanel')}</Link>
                    )}
                    {state.code !== 'not_published' && (
                        <Link to="/" className="inline-block mt-6 text-pub-accent-hi hover:underline">{t('public.goHome')}</Link>
                    )}
                </div>
            </div>
        );
    }

    const { data } = state;
    // Quien la administra la ve sin la puerta (es su propia página o la revisa admin)
    const withSound = hasSound(data.content);
    const adultGate = data.adult && !ageOk && !data.canManage;
    if ((adultGate || withSound) && !entered) {
        return <EntryGate content={data.content} handle={data.handle} adult={adultGate} sound={withSound}
            onEnter={on => { if (adultGate) confirmAge(); sound.start(on); setEntered(true); }} />;
    }
    return (
        <>
            {(data.preview || data.hidden) && data.canManage && (
                <div className="sticky top-0 z-50 bg-pub-bg text-ds-warn border-b border-ds-warn/40 px-4 py-2 text-sm 3xl:text-base flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
                    <span>{data.hidden ? t('public.hiddenBanner') : t('public.previewBanner')}</span>
                    <Link to="/mi-pagina" className="underline font-semibold">{t('public.goToPanel')}</Link>
                </div>
            )}
            <TemplateRenderer content={data.content} channelPhotoUrl={data.channelPhotoUrl} handle={data.handle}
                ageOk={ageOk || data.adult || data.canManage} onAgeConfirm={confirmAge} onLinkClick={sound.playClick} />
            {withSound && <MuteButton content={data.content} muted={sound.muted} onToggle={sound.toggleMute} />}
            {!data.isOwner && <ReportBar handle={data.handle} content={data.content} reasons={data.reportReasons ?? []} />}
        </>
    );
}
