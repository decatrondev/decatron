import { useTranslation } from 'react-i18next';
import { useTileCaptions } from './translation';

/** Subtítulos traducidos debajo del video de una casilla (nada puede tapar el player). Una frase a la vez; desaparece al terminar de leerse. */
export default function TileCaptions({ login, lang }: { login: string; lang: string }) {
    const { t } = useTranslation('multiview');
    const { caption, active, denied } = useTileCaptions(login, lang);
    return (
        <>
            {caption && (
                <div className="flex justify-center bg-black px-3 py-1" aria-live="polite">
                    <p className="max-w-full rounded bg-black/75 px-3 py-1.5 text-center font-semibold leading-snug text-white [font-size:clamp(12px,1.35vw,24px)]">{caption.text}</p>
                </div>
            )}
            {denied && (
                <p className="mx-auto my-1 w-fit max-w-[90%] rounded bg-black/75 px-2.5 py-1 text-center text-[12px] text-ds-warn" role="status">{t(`tr.denied.${denied.reason}`, { defaultValue: t('tr.denied.paused'), days: denied.minFollowDays ?? 0, tier: denied.minSubTier ?? 1 })}</p>
            )}
            {!denied && active === false && !caption && (
                <p className="mx-auto my-1 w-fit max-w-[90%] rounded bg-black/60 px-2.5 py-1 text-center text-[11px] text-[#d4d4d8]">{t('tr.notLive')}</p>
            )}
        </>
    );
}
