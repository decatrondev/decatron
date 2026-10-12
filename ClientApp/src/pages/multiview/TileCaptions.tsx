import { useTranslation } from 'react-i18next';
import { useTileCaptions } from './translation';

/** Subtítulos traducidos sobre el video de una casilla. Una frase a la vez; desaparece al terminar de leerse. */
export default function TileCaptions({ login, lang }: { login: string; lang: string }) {
    const { t } = useTranslation('multiview');
    const { caption, active, denied } = useTileCaptions(login, lang);
    return (
        <>
            {caption && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3" aria-live="polite">
                    <p className="max-w-full rounded bg-black/75 px-3 py-1.5 text-center font-semibold leading-snug text-white [font-size:clamp(12px,1.35vw,24px)]">{caption.text}</p>
                </div>
            )}
            {denied && (
                <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit max-w-[90%] rounded bg-black/75 px-2.5 py-1 text-center text-[12px] text-ds-warn" role="status">{t(`tr.denied.${denied}`, { defaultValue: t('tr.denied.paused') })}</p>
            )}
            {!denied && active === false && !caption && (
                <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 mx-auto w-fit max-w-[90%] rounded bg-black/60 px-2.5 py-1 text-center text-[11px] text-[#d4d4d8]">{t('tr.notLive')}</p>
            )}
        </>
    );
}
