import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import type { TrInfo } from './translation';

interface Props { info: TrInfo; lang: string | null; onLang: (lang: string | null) => void; btn: string }

/** Botón de la casilla para elegir el idioma de los subtítulos traducidos (solo si el canal ofrece traducción). */
export default function TranslationMenu({ info, lang, onLang, btn }: Props) {
    const { t, i18n } = useTranslation('multiview');
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const names = (() => { try { return new Intl.DisplayNames([i18n.language], { type: 'language' }); } catch { return null; } })();
    const name = (code: string) => { try { return names?.of(code) ?? code.toUpperCase(); } catch { return code.toUpperCase(); } };

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <div className="relative" ref={box}>
            <button type="button" className={btn} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={t('tr.title')} title={t('tr.title')}>
                <Languages className={`h-4 w-4 ${lang ? 'text-pub-accent-hi' : ''}`} />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-md border border-pub-border bg-pub-raised py-1 text-[13px] shadow-lg">
                    <p className="px-3 py-1 text-[11px] uppercase tracking-wide text-[#71717a]">{t('tr.subtitles')}</p>
                    {info.languages.map(l => (
                        <button key={l} type="button" role="menuitemradio" aria-checked={lang === l} onClick={() => { onLang(l); setOpen(false); }}
                            className={`block w-full px-3 py-1.5 text-left hover:bg-white/10 ${lang === l ? 'font-bold text-white' : 'text-[#d4d4d8]'}`}>{name(l)}</button>
                    ))}
                    {lang && <button type="button" role="menuitem" onClick={() => { onLang(null); setOpen(false); }} className="block w-full border-t border-pub-border px-3 py-1.5 text-left text-[#a1a1aa] hover:bg-white/10">{t('tr.off')}</button>}
                    {!info.live && <p className="max-w-[14rem] px-3 py-1.5 text-[11px] text-[#71717a]">{t('tr.notLive')}</p>}
                </div>
            )}
        </div>
    );
}
