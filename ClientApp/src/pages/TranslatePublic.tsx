import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Globe, Github, Headphones, MessageSquareText, Monitor, Puzzle, ShieldCheck, Smile, Sparkles } from 'lucide-react';
import { useDesktopDownload } from '../hooks/useDesktopDownload';
import api from '../services/api';

// decatron.net/translate — página pública de la extensión Decatron para Twitch: qué hace, cómo instalarla y su
// política de privacidad (la exigen las tiendas; el ancla #privacy no debe cambiar). Es a donde apunta el
// anuncio del bot en el chat.

const SOURCE_URL = 'https://github.com/decatrondev/decatron-extension';
// Se enciende cuando cada tienda publique la extensión
const FIREFOX_URL: string | null = 'https://addons.mozilla.org/firefox/addon/decatron/';
const FIREFOX_LIVE = false;
const CHROME_URL: string | null = null;

// Frases del demo: original y traducción, en el orden en que "suenan".
const DEMO = [
    { es: 'Bueno chicos, ya estamos en vivo otra vez, ¿cómo están?', en: "Alright guys, we're live again. How's it going?" },
    { es: 'Gracias por el sub, hermano, de verdad se aprecia un montón.', en: 'Thanks for the sub, bro, seriously, means a lot.' },
    { es: 'Si llegamos a los cien likes hago el reto del chile picante.', en: "If we hit a hundred likes, I'm doing the spicy pepper challenge." },
];

interface GlobalEmote { id: number; name: string; urls: { x2: string } }

// Mensajes del chat de ejemplo; {0}, {1}... se reemplazan por emotes reales del set global
const CHAT = [
    { user: 'luna_play', color: '#ff7ab8', text: 'qué buena jugada {0}' },
    { user: 'kaiser', color: '#5eead4', text: 'GG {1} {1}' },
    { user: 'marina', color: '#fbbf24', text: 'ahora sí se entiende todo {0}' },
];

function ChatDemo({ emotes }: { emotes: GlobalEmote[] }) {
    const { t } = useTranslation(['landing']);
    const render = (text: string) =>
        text.split(/(\{\d\})/).map((part, k) => {
            const m = part.match(/^\{(\d)\}$/);
            if (!m) return <span key={k}>{part}</span>;
            const e = emotes[Number(m[1]) % Math.max(emotes.length, 1)];
            return e
                ? <img key={k} src={e.urls.x2} alt={e.name} title={e.name} className="inline-block h-7 align-middle mx-0.5" />
                : <span key={k} className="px-1 rounded bg-white/10 text-xs">emote</span>;
        });
    return (
        <div className="aspect-video bg-[#0e0e10] flex flex-col">
            <div className="px-3 py-2 text-xs uppercase tracking-wider text-white/50 border-b border-white/10">{t('translate.demo.chatTitle')}</div>
            <div className="flex-1 p-3 space-y-2 text-sm overflow-hidden">
                {CHAT.map(m => (
                    <div key={m.user}><b style={{ color: m.color }}>{m.user}</b><span className="text-white/60">: </span><span className="text-white/90">{render(m.text)}</span></div>
                ))}
            </div>
            <div className="px-3 pb-3">
                <div className="mb-2 rounded-lg bg-[#18181b] border border-white/10 p-2 w-48">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('translate.demo.picker')}</div>
                    {(emotes.length ? emotes.slice(0, 3) : []).map(e => (
                        <div key={e.id} className="flex items-center gap-2 py-0.5 text-xs text-white/80"><img src={e.urls.x2} alt="" className="h-5" />{e.name}</div>
                    ))}
                </div>
                <div className="rounded-md bg-[#18181b] border border-white/10 px-3 py-2 text-sm text-white/80"><span className="text-[#bf94ff]">:</span>{(emotes[0]?.name ?? 'emo').slice(0, 3).toLowerCase()}<span className="animate-pulse">|</span></div>
            </div>
        </div>
    );
}

export default function TranslatePublic() {
    const { t } = useTranslation(['landing']);
    const download = useDesktopDownload();
    const [tab, setTab] = useState<'translation' | 'emotes'>('translation');
    const [i, setI] = useState(0);
    const [shown, setShown] = useState(0); // palabras reveladas de la frase actual
    const [emotes, setEmotes] = useState<GlobalEmote[]>([]);

    useEffect(() => {
        api.get('/public/global-emotes').then(r => setEmotes(r.data.emotes ?? [])).catch(() => { /* sin set global todavía */ });
    }, []);

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

    const storeBtn = (label: string, url: string | null, live: boolean) => live && url
        ? <a href={url} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-[#9146FF] hover:bg-[#a970ff] font-semibold">{label}</a>
        : <span className="px-5 py-3 rounded-xl border border-white/15 text-white/50 font-semibold cursor-default">{label}</span>;

    return (
        <div className="panel-scale min-h-screen bg-white dark:bg-[#1B1C1D]">
            {/* Hero: la promesa y el demo, nada más. */}
            <section className="bg-[#0B0D12] px-4 pt-24 pb-20 text-white">
                <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <p className="text-[#bf94ff] font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5" /> {t('translate.hero.badge')}</p>
                        <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight">{t('translate.hero.title')}</h1>
                        <p className="text-lg text-[#9ca3af] mt-5 max-w-xl">{t('translate.hero.text')}</p>
                        <div className="flex flex-wrap gap-3 mt-8">
                            {storeBtn(t(FIREFOX_LIVE ? 'translate.hero.firefox' : 'translate.hero.firefoxSoon'), FIREFOX_URL, FIREFOX_LIVE)}
                            {storeBtn(t('translate.hero.chrome'), CHROME_URL, false)}
                            <a href="#modules" className="px-5 py-3 rounded-xl border border-white/15 hover:border-white/40 font-semibold">{t('translate.hero.modules')}</a>
                        </div>
                        <p className="text-sm text-[#6b7280] mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>{t('translate.hero.note')}</span>
                            <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><Github className="w-4 h-4" />{t('translate.hero.source')}</a>
                        </p>
                    </div>

                    {/* Demo: player con subtítulo animado, o chat con emotes y selector */}
                    <div>
                        <div className="flex gap-2 mb-3">
                            {(['translation', 'emotes'] as const).map(k => (
                                <button key={k} type="button" onClick={() => setTab(k)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${tab === k ? 'bg-[#9146FF] text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                                    {t(k === 'translation' ? 'translate.demo.tabTranslation' : 'translate.demo.tabEmotes')}
                                </button>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-[#05070a] overflow-hidden shadow-[0_0_60px_-15px_rgba(145,70,255,0.45)]">
                            {tab === 'translation' ? (
                                <div className="relative aspect-video bg-gradient-to-br from-[#1f1235] via-[#0e0e10] to-[#0b1b2a]">
                                    <div className="absolute inset-x-0 top-[28%] flex items-center justify-center text-[#3f3f46] font-mono text-sm select-none">{t('translate.demo.stream')}</div>
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
                            ) : <ChatDemo emotes={emotes} />}
                            <div className="px-4 py-3 text-xs text-[#6b7280] border-t border-white/10">{t(tab === 'translation' ? 'translate.demo.caption' : 'translate.demo.chatCaption')}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Qué incluye */}
            <section id="modules" className="py-20 px-4">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-display text-3xl font-bold text-center text-[#1e293b] dark:text-[#f8fafc] mb-12">{t('translate.modules.title')}</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            { icon: <Headphones className="w-6 h-6" />, k: 'translation' },
                            { icon: <Smile className="w-6 h-6" />, k: 'emotes' },
                            { icon: <Puzzle className="w-6 h-6" />, k: 'points', soon: true },
                        ].map(m => (
                            <div key={m.k} className={`rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 bg-white dark:bg-[#222324] ${m.soon ? 'opacity-70' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="w-10 h-10 rounded-lg bg-[#9146FF] text-white flex items-center justify-center">{m.icon}</span>
                                    {m.soon && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[#9146FF]/15 text-[#7c3aed] dark:text-[#bf94ff]">{t('translate.modules.points.soon')}</span>}
                                </div>
                                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{t(`translate.modules.${m.k}.title`)}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">{t(`translate.modules.${m.k}.text`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Cómo funciona: tres pasos reales */}
            <section id="how" className="py-16 px-4 bg-gray-50 dark:bg-[#161718]">
                <div className="max-w-5xl mx-auto">
                    <h2 className="font-display text-3xl font-bold text-center text-[#1e293b] dark:text-[#f8fafc] mb-12">{t('translate.how.title')}</h2>
                    <ol className="grid md:grid-cols-3 gap-6">
                        {['install', 'open', 'use'].map((k, n) => (
                            <li key={k} className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 bg-white dark:bg-[#222324]">
                                <span className="text-sm font-semibold text-[#7c3aed] dark:text-[#bf94ff]">{n + 1} / 3</span>
                                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mt-2">{t(`translate.how.${k}.title`)}</h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">{t(`translate.how.${k}.text`)}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* Qué hace y qué no */}
            <section className="py-16 px-4">
                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
                    {[
                        { icon: <MessageSquareText className="w-5 h-5" />, k: 'private' },
                        { icon: <ShieldCheck className="w-5 h-5" />, k: 'noaccount' },
                        { icon: <Github className="w-5 h-5" />, k: 'open' },
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

            {/* Set global */}
            <section className="px-4 pb-16">
                <div className="max-w-3xl mx-auto rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-8 bg-white dark:bg-[#222324]">
                    <h2 className="font-display text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('translate.global.title')}</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">{t('translate.global.text')}</p>
                    {emotes.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-4">
                            {emotes.slice(0, 12).map(e => <img key={e.id} src={e.urls.x2} alt={e.name} title={e.name} className="h-10" />)}
                        </div>
                    )}
                    <Link to="/emotes/global" className="inline-block mt-5 px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#a970ff] text-white font-semibold">{t('translate.global.cta')}</Link>
                </div>
            </section>

            {/* Para streamers */}
            <section className="pb-16 px-4">
                <div className="max-w-3xl mx-auto rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-8 flex gap-5 items-start bg-white dark:bg-[#222324]">
                    <span className="w-12 h-12 shrink-0 rounded-xl bg-[#1e293b] dark:bg-[#374151] text-white flex items-center justify-center"><Monitor className="w-6 h-6" /></span>
                    <div>
                        <h2 className="font-display text-2xl font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('translate.streamers.title')}</h2>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-2">{t('translate.streamers.text')}</p>
                        <div className="flex flex-wrap gap-3 mt-4">
                            <Link to="/login" className="px-4 py-2 rounded-lg bg-[#9146FF] hover:bg-[#a970ff] text-white font-semibold">{t('translate.streamers.cta')}</Link>
                            <a href={download.url} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] text-[#1e293b] dark:text-[#f8fafc] font-semibold">{download.label}</a>
                            <a href={download.releasesUrl} target="_blank" rel="noreferrer" className="px-2 py-2 text-sm text-[#64748b] dark:text-[#94a3b8] hover:underline self-center">{download.otherPlatformsLabel}</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Privacidad: lo que piden las tiendas, en lenguaje llano. El ancla #privacy está registrada en ellas */}
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
