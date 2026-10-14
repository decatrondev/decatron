import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight, Bell, Bot, Building2, KeyRound, Languages, MessageSquare, Music, Palette, RefreshCw,
    ShieldCheck, Sparkles, Trophy, Tv, Users,
} from 'lucide-react';
import { Button, Card, Eyebrow } from '../../components/ds';
import PlatformShell, { wrap } from './PlatformShell';
import WaitlistForm from './WaitlistForm';

// Landing de la plataforma (decatron.top). Solo lista de espera: sin precios, sin registro, sin textos legales propios
// (.dev/plans/PLATAFORMA_PLAN.md, Fase L; contenido en PLATAFORMA_LANDING_CONTENIDO.md).

type Item = { title: string; text: string };

const WHAT_ICONS = [KeyRound, Palette, RefreshCw];
const INCLUDES_ICONS = [MessageSquare, ShieldCheck, Bell, Music, Languages, Trophy, Sparkles];
const WHO_ICONS = [Tv, Users, Building2];

const sectionTitle = 'font-extrabold tracking-tight text-ds-text text-3xl 3xl:text-4xl 4xl:text-5xl leading-tight';
const section = 'py-20 3xl:py-28 border-t border-ds-border-soft';

function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }

/** Esquema de la idea: tu aplicación + el motor + tu bot. */
function Diagram({ nodes }: { nodes: Item[] }) {
    return (
        <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-2" role="img" aria-label={nodes.map(n => n.title).join(' → ')}>
            {nodes.map((n, i) => (
                <Fragment key={n.title}>
                    {i > 0 && <ArrowRight className="hidden md:block w-5 h-5 self-center shrink-0 text-ds-faint" aria-hidden />}
                    <Card variant={i === 1 ? 'raised' : undefined} className="flex-1">
                        <p className="font-mono text-xs text-ds-accent-text mb-2">{`0${i + 1}`}</p>
                        <p className="font-bold text-ds-text mb-1">{n.title}</p>
                        <p className="text-sm text-ds-soft leading-relaxed">{n.text}</p>
                    </Card>
                </Fragment>
            ))}
        </div>
    );
}

export default function PlatformLanding() {
    const { t } = useTranslation('platform');
    // Mientras el idioma carga, t() devuelve el texto de la clave y no el arreglo: se protege para no romper la página.
    const arr = <T,>(key: string): T[] => { const v = t(key, { returnObjects: true }); return Array.isArray(v) ? (v as T[]) : []; };
    const list = (key: string) => arr<Item>(key);
    const faq = arr<{ q: string; a: string }>('faq.items');

    return (
        <PlatformShell>
            {/* Hero */}
            <section className={`${wrap} pt-14 sm:pt-20 3xl:pt-28 pb-20 3xl:pb-28`}>
                <div className="max-w-3xl lg:max-w-5xl 3xl:max-w-6xl 4xl:max-w-7xl space-y-7">
                    <Eyebrow>{t('hero.tag')}</Eyebrow>
                    <h1 style={{ textWrap: 'balance' }} className="font-extrabold tracking-tight leading-[1.02] text-ds-text text-[clamp(2.4rem,5.2vw,4.75rem)]">
                        {t('hero.titleA')}<br />
                        <span className="text-ds-accent-text">{t('hero.titleB')}</span>
                    </h1>
                    <p className="text-lg 3xl:text-2xl text-ds-soft max-w-2xl 3xl:max-w-3xl leading-relaxed">{t('hero.description')}</p>
                    <div className="flex flex-wrap gap-3 pt-1">
                        <Button size="lg" onClick={() => scrollTo('lista')} icon={<Bot className="w-4 h-4" />}>{t('hero.primary')}</Button>
                        <Button size="lg" variant="secondary" onClick={() => scrollTo('como')}>{t('hero.secondary')}</Button>
                    </div>
                    <p className="font-mono text-sm text-ds-faint">{t('hero.note')}</p>
                </div>
                <div className="mt-14 3xl:mt-20">
                    <Diagram nodes={list('hero.diagram')} />
                </div>
            </section>

            {/* Qué es */}
            <section id="que-es" className={section}>
                <div className={wrap}>
                    <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-start mb-12">
                        <h2 className={sectionTitle}>{t('what.title')}</h2>
                        <p className="text-ds-soft text-lg 3xl:text-xl leading-relaxed">{t('what.body')}</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 3xl:gap-6">
                        {list('what.cards').map((c, i) => {
                            const Icon = WHAT_ICONS[i];
                            return (
                                <Card key={c.title}>
                                    <Icon className="w-6 h-6 text-ds-accent-text mb-4" aria-hidden />
                                    <h3 className="text-lg 3xl:text-xl font-bold text-ds-text mb-2">{c.title}</h3>
                                    <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed">{c.text}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Cómo funciona */}
            <section id="como" className={section}>
                <div className={wrap}>
                    <h2 className={`${sectionTitle} mb-10`}>{t('how.title')}</h2>
                    <ol className="grid md:grid-cols-3 gap-4 3xl:gap-6">
                        {list('how.steps').map((s, i) => (
                            <li key={s.title}>
                                <Card className="h-full">
                                    <p className="font-mono text-sm text-ds-accent-text mb-3">{`0${i + 1}`}</p>
                                    <h3 className="text-lg 3xl:text-xl font-bold text-ds-text mb-2">{s.title}</h3>
                                    <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed">{s.text}</p>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* Qué incluye */}
            <section id="incluye" className={section}>
                <div className={wrap}>
                    <div className="mb-10">
                        <h2 className={sectionTitle}>{t('includes.title')}</h2>
                        <p className="text-ds-soft mt-2 3xl:text-lg">{t('includes.subtitle')}</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 4xl:grid-cols-4 gap-4 3xl:gap-6">
                        {list('includes.items').map((it, i) => {
                            const Icon = INCLUDES_ICONS[i];
                            return (
                                <Card key={it.title}>
                                    <div className="flex items-start gap-4">
                                        <Icon className="w-5 h-5 3xl:w-6 3xl:h-6 text-ds-accent-text mt-1 shrink-0" aria-hidden />
                                        <div>
                                            <h3 className="font-bold text-ds-text 3xl:text-lg">{it.title}</h3>
                                            <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed mt-1">{it.text}</p>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    <p className="font-mono text-sm text-ds-faint mt-6">{t('includes.note')}</p>
                </div>
            </section>

            {/* Para quién */}
            <section className={section}>
                <div className={wrap}>
                    <h2 className={`${sectionTitle} mb-10 max-w-3xl`}>{t('who.title')}</h2>
                    <div className="grid md:grid-cols-3 gap-4 3xl:gap-6">
                        {list('who.items').map((it, i) => {
                            const Icon = WHO_ICONS[i];
                            return (
                                <Card key={it.title}>
                                    <Icon className="w-6 h-6 text-ds-accent-text mb-4" aria-hidden />
                                    <h3 className="text-lg 3xl:text-xl font-bold text-ds-text mb-2">{it.title}</h3>
                                    <p className="text-sm 3xl:text-base text-ds-soft leading-relaxed">{it.text}</p>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Seguridad (versión corta hasta que las Fases 3-5 estén hechas) */}
            <section className={section}>
                <div className={`${wrap} flex flex-col md:flex-row md:items-center gap-6 md:gap-10`}>
                    <ShieldCheck className="w-10 h-10 3xl:w-12 3xl:h-12 text-ds-accent-text shrink-0" aria-hidden />
                    <div>
                        <h2 className="text-2xl 3xl:text-3xl font-extrabold tracking-tight text-ds-text">{t('trust.title')}</h2>
                        <p className="text-ds-soft mt-2 3xl:text-lg">{t('trust.text')}</p>
                    </div>
                </div>
            </section>

            {/* Lista de espera */}
            <section id="lista" className={`${section} scroll-mt-16`}>
                <div className="max-w-xl 3xl:max-w-2xl mx-auto px-5 sm:px-8">
                    <div className="text-center mb-8">
                        <h2 className={sectionTitle}>{t('form.title')}</h2>
                        <p className="text-ds-soft mt-3 3xl:text-lg leading-relaxed">{t('form.text')}</p>
                    </div>
                    <Card variant="raised"><div className="p-1 sm:p-3"><WaitlistForm /></div></Card>
                </div>
            </section>

            {/* Preguntas */}
            <section id="preguntas" className={section}>
                <div className="max-w-3xl 3xl:max-w-4xl mx-auto px-5 sm:px-8">
                    <h2 className={`${sectionTitle} mb-8`}>{t('faq.title')}</h2>
                    <div className="divide-y divide-ds-border-soft border-y border-ds-border-soft">
                        {faq.map(f => (
                            <details key={f.q} className="group py-4">
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-ds-text 3xl:text-lg [&::-webkit-details-marker]:hidden">
                                    {f.q}
                                    <span className="text-ds-faint font-mono transition-transform group-open:rotate-45" aria-hidden>+</span>
                                </summary>
                                <p className="mt-3 text-ds-soft leading-relaxed 3xl:text-lg">{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>
        </PlatformShell>
    );
}
