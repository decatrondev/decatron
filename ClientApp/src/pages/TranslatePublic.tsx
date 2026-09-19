import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Chrome, Globe, Headphones, MessageSquareText, ShieldCheck, Monitor } from 'lucide-react';

const EXTENSION_URL = 'https://github.com/decatrondev/decatron-extension';
const DESKTOP_URL = 'https://github.com/decatrondev/decatron-desktop/releases/latest';

// Frases del demo: original y traducción, en el orden en que "suenan".
const DEMO = [
    { es: 'Bueno chicos, ya estamos en vivo otra vez, ¿cómo están?', en: "Alright guys, we're live again. How's it going?" },
    { es: 'Gracias por el sub, hermano, de verdad se aprecia un montón.', en: 'Thanks for the sub, bro, seriously, means a lot.' },
    { es: 'Si llegamos a los cien likes hago el reto del chile picante.', en: 'If we hit a hundred likes, I\'m doing the spicy pepper challenge.' },
];

/**
 * decatron.net/translate — página pública para los viewers: qué es, cómo instalarlo y la
 * política de privacidad de la extensión (la exige la Chrome Web Store). Es a donde
 * apunta el anuncio del bot en el chat.
 */
export default function TranslatePublic() {
    const { t } = useTranslation(['landing']);
    const [i, setI] = useState(0);
    const [shown, setShown] = useState(0); // palabras reveladas de la frase actual

    // Demo del subtítulo: revela palabra a palabra y pasa a la siguiente frase.
    useEffect(() => {
        const words = DEMO[i].en.split(' ').length;
        if (shown < words) {
            const id = setTimeout(() => setShown(shown + 1), 160);
            return () => clearTimeout(id);
        }
        const id = setTimeout(() => { setShown(0); setI((i + 1) % DEMO.length); }, 2600);
        return () => clearTimeout(id);
    }, [i, shown]);

    const words = DEMO[i].en.split(' ');

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            {/* Hero: la promesa y el demo del player, nada más. */}
            <section className="bg-[#0B0D12] px-4 pt-24 pb-20 text-white">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <p className="text-[#bf94ff] font-semibold mb-3 flex items-center gap-2"><Globe className="w-5 h-5" /> Decatron Translate</p>
                        <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight">{t('translate.hero.title')}</h1>
                        <p className="text-lg text-[#9ca3af] mt-5 max-w-xl">{t('translate.hero.text')}</p>
                        <div className="flex flex-wrap gap-3 mt-8">
                            <a href={EXTENSION_URL} target="_blank" rel="noreferrer"
                               className="px-5 py-3 rounded-xl bg-[#9146FF] hover:bg-[#a970ff] font-semibold flex items-center gap-2">
                                <Chrome className="w-5 h-5" /> {t('translate.hero.cta')}
                            </a>
                            <a href="#how" className="px-5 py-3 rounded-xl border border-white/15 hover:border-white/40 font-semibold">{t('translate.hero.how')}</a>
                        </div>
                        <p className="text-sm text-[#6b7280] mt-4">{t('translate.hero.note')}</p>
                    </div>

                    {/* Player falso con el botón y el subtítulo animado */}
                    <div className="rounded-2xl border border-white/10 bg-[#05070a] overflow-hidden shadow-[0_0_60px_-15px_rgba(145,70,255,0.45)]">
                        <div className="relative aspect-video bg-gradient-to-br from-[#1f1235] via-[#0e0e10] to-[#0b1b2a]">
                            <div className="absolute inset-x-0 top-[28%] flex items-center justify-center text-[#3f3f46] font-mono text-sm select-none">{t('translate.demo.stream')}</div>
                            {/* Original arriba en gris, traducción abajo revelándose */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-16 w-[86%] text-center">
                                <div className="text-xs md:text-sm italic text-white/60 mb-1">{DEMO[i].es}</div>
                                <div className="inline-block px-3 py-1.5 rounded-md bg-black/60 text-base md:text-xl font-semibold">
                                    {words.map((w, k) => (
                                        <span key={k} className={`transition-opacity duration-150 ${k < shown ? 'opacity-100' : 'opacity-30'}`}>{w} </span>
                                    ))}
                                </div>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between px-3 text-white/80 text-sm">
                                <span>▶ &nbsp; 🔊</span>
                                <span className="flex items-center gap-3">
                                    <span className="relative inline-flex items-center justify-center w-8 h-8 rounded bg-white/15">
                                        <Globe className="w-4 h-4" />
                                        <span className="absolute right-1 bottom-1 w-1.5 h-1.5 rounded-full bg-[#9146FF]" />
                                    </span>
                                    <span>⚙</span><span>⛶</span>
                                </span>
                            </div>
                        </div>
                        <div className="px-4 py-3 text-xs text-[#6b7280] border-t border-white/10">{t('translate.demo.caption')}</div>
                    </div>
                </div>
            </section>

            {/* Cómo funciona: tres pasos reales, sin numeración decorativa porque sí son secuencia */}
            <section id="how" className="py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-display text-3xl font-bold text-center text-[#1e293b] dark:text-[#f8fafc] mb-12">{t('translate.how.title')}</h2>
                    <ol className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: <Chrome className="w-6 h-6" />, k: 'install' },
                            { icon: <Globe className="w-6 h-6" />, k: 'pick' },
                            { icon: <Headphones className="w-6 h-6" />, k: 'listen' },
                        ].map((s, n) => (
                            <li key={s.k} className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 bg-white dark:bg-[#222324]">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-10 h-10 rounded-lg bg-[#9146FF] text-white flex items-center justify-center">{s.icon}</span>
                                    <span className="text-sm text-[#64748b] dark:text-[#94a3b8]">{n + 1} / 3</span>
                                </div>
                                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{t(`translate.how.${s.k}.title`)}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">{t(`translate.how.${s.k}.text`)}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* Qué hace y qué no */}
            <section className="py-16 px-4 bg-gray-50 dark:bg-[#161718]">
                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
                    {[
                        { icon: <Headphones className="w-5 h-5" />, k: 'private' },
                        { icon: <MessageSquareText className="w-5 h-5" />, k: 'captions' },
                        { icon: <ShieldCheck className="w-5 h-5" />, k: 'noaccount' },
                    ].map(f => (
                        <div key={f.k} className="flex gap-3">
                            <span className="w-9 h-9 shrink-0 rounded-lg bg-[#9146FF]/15 text-[#7c3aed] dark:text-[#bf94ff] flex items-center justify-center">{f.icon}</span>
                            <div>
                                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{t(`translate.facts.${f.k}.title`)}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{t(`translate.facts.${f.k}.text`)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Para streamers */}
            <section className="py-16 px-4">
                <div className="max-w-3xl mx-auto rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-8 flex gap-5 items-start bg-white dark:bg-[#222324]">
                    <span className="w-12 h-12 shrink-0 rounded-xl bg-[#1e293b] dark:bg-[#374151] text-white flex items-center justify-center"><Monitor className="w-6 h-6" /></span>
                    <div>
                        <h2 className="font-display text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('translate.streamers.title')}</h2>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">{t('translate.streamers.text')}</p>
                        <div className="flex flex-wrap gap-3 mt-4">
                            <Link to="/login" className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#a970ff] text-white font-semibold">{t('translate.streamers.cta')}</Link>
                            <a href={DESKTOP_URL} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] font-semibold">{t('translate.streamers.app')}</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Privacidad: lo que pide la Web Store, en lenguaje llano */}
            <section id="privacy" className="py-16 px-4 bg-gray-50 dark:bg-[#161718]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="font-display text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">{t('translate.privacy.title')}</h2>
                    <ul className="space-y-3 text-[#475569] dark:text-[#cbd5e1]">
                        {(() => { const v = t('translate.privacy.points', { returnObjects: true }); return Array.isArray(v) ? (v as string[]) : []; })().map((p, k) => (
                            <li key={k} className="flex gap-3"><ShieldCheck className="w-5 h-5 shrink-0 text-[#9146FF] mt-0.5" /><span>{p}</span></li>
                        ))}
                    </ul>
                    <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-6">{t('translate.privacy.contact')} <a className="text-[#7c3aed] dark:text-[#bf94ff]" href="mailto:anthonydeca@decatron.net">anthonydeca@decatron.net</a></p>
                </div>
            </section>
        </div>
    );
}
