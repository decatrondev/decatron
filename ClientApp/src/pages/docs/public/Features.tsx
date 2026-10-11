import { Zap, Clock, Gift, Bell, MessageSquare, Shield, Sparkles, Volume2, DollarSign, BarChart3, Users, ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// El texto vive en public/locales/{es,en}/docs-public.json → features.
interface Card { id: string; icon: ReactNode; link: string; auth?: boolean }
const ic = 'w-6 h-6';
const SECTIONS: { key: string; cards: Card[] }[] = [
    { key: 'sCommands', cards: [
        { id: 'default', icon: <Zap className={ic} />, link: '/docs/commands/default' },
        { id: 'custom', icon: <MessageSquare className={ic} />, link: '/docs/commands/custom' },
        { id: 'micro', icon: <Zap className={ic} />, link: '/docs/commands/microcommands' },
        { id: 'scripting', icon: <Sparkles className={ic} />, link: '/docs/commands/scripting' },
    ] },
    { key: 'sMain', cards: [
        { id: 'timer', icon: <Clock className={ic} />, link: '/dashboard/docs/features/timer', auth: true },
        { id: 'eventAlerts', icon: <Bell className={ic} />, link: '/dashboard/docs/features/event-alerts', auth: true },
        { id: 'giveaway', icon: <Gift className={ic} />, link: '/dashboard/docs/features/giveaway', auth: true },
        { id: 'sound', icon: <Volume2 className={ic} />, link: '/dashboard/docs/features/sound-alerts', auth: true },
        { id: 'tips', icon: <DollarSign className={ic} />, link: '/dashboard/docs/features/tips', auth: true },
    ] },
    { key: 'sTools', cards: [
        { id: 'shoutout', icon: <MessageSquare className={ic} />, link: '/docs/overlays/shoutout' },
        { id: 'moderation', icon: <Shield className={ic} />, link: '/docs/moderation' },
        { id: 'ai', icon: <Sparkles className={ic} />, link: '/dashboard/docs/features/ai', auth: true },
        { id: 'analytics', icon: <BarChart3 className={ic} />, link: '/dashboard/docs/features/analytics', auth: true },
        { id: 'followers', icon: <Users className={ic} />, link: '/dashboard/docs/features/followers', auth: true },
    ] },
];

export default function Features() {
    const { t } = useTranslation('docs-public');
    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-4xl font-black text-ds-text mb-4">{t('features.title')}</h1>
                <p className="text-xl text-ds-soft">{t('features.subtitle')}</p>
            </div>

            {SECTIONS.map(s => (
                <div key={s.key}>
                    <h2 className="text-2xl font-black text-ds-text mb-6">{t(`features.${s.key}`)}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {s.cards.map(c => (
                            <Link key={c.id} to={c.link} className="group block p-6 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-ds-raised text-ds-accent-text rounded-lg flex items-center justify-center">{c.icon}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-bold text-ds-text group-hover:text-ds-accent-text transition-colors">{t(`features.cards.${c.id}.t`)}</h3>
                                            {c.auth && <span className="px-2 py-0.5 text-xs font-medium bg-ds-bg text-ds-soft rounded">{t('features.dashboard')}</span>}
                                        </div>
                                        <p className="text-sm text-ds-soft">{t(`features.cards.${c.id}.d`)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 text-ds-accent-text text-sm font-bold group-hover:gap-3 transition-all">
                                    {t('features.seeDocs')}
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}

            <div className="bg-ds-surface border border-ds-border rounded-lg p-8 text-ds-text text-center">
                <h2 className="text-2xl font-black mb-4">{t('features.ctaTitle')}</h2>
                <p className="text-ds-soft mb-6 max-w-xl mx-auto">{t('features.ctaText')}</p>
                <Link to="/login" className="ds-btn ds-btn--primary ds-btn--lg">
                    {t('features.ctaButton')}
                    <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    );
}
