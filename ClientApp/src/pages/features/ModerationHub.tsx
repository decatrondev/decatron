import { useEffect, useState } from 'react';
import { ShieldBan, Settings, Link2, Terminal, MessageSquareWarning, Siren, History, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilterSwitch, fetchModerationOverview, saveModerationFilter, type ModerationFilterState, type ModerationPlatform } from './moderation/filterSwitch';
import { SPAM_FILTERS } from './moderation/SpamFilters';
import api from '../../services/api';

interface ModerationCard {
    key: string;
    /** Clave del filtro en el backend; sin filtro, la tarjeta no lleva interruptor */
    filter?: string;
    /** Grupo de filtros: la tarjeta muestra cuántos están activos */
    group?: string[];
    icon: React.ReactNode;
    route: string;
}

// Los filtros solo se muestran si el backend los conoce
const CARDS: ModerationCard[] = [
    {
        key: 'banned_words',
        filter: 'banned_words',
        icon: <ShieldBan className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/banned-words'
    },
    {
        key: 'links',
        filter: 'links',
        icon: <Link2 className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/links'
    },
    {
        key: 'spam',
        group: SPAM_FILTERS.map(f => f.key),
        icon: <MessageSquareWarning className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/spam'
    },
    {
        key: 'raids',
        group: ['account_age', 'bot_phrases'],
        icon: <Siren className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/raids'
    },
    {
        key: 'commands',
        icon: <Terminal className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/commands'
    },
    {
        key: 'bots',
        icon: <Bot className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/bots'
    },
    {
        key: 'history',
        icon: <History className="w-6 h-6 shrink-0 text-ds-accent-text" />,
        route: '/features/moderation/history'
    }
];

export default function ModerationHub() {
    const { t } = useTranslation('moderation');
    const navigate = useNavigate();
    const [filters, setFilters] = useState<ModerationFilterState[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [panicActive, setPanicActive] = useState(false);
    const [platform, setPlatform] = useState<ModerationPlatform>('twitch');

    useEffect(() => {
        fetchModerationOverview()
            .then(o => { setFilters(o.filters); setPlatform(o.platform); })
            .catch(() => setError(t('hub.loadFailed')));
        api.get('/moderation/panic')
            .then(res => setPanicActive(Boolean(res.data.state?.active)))
            .catch(() => { });
    }, []);

    const toggle = async (key: string, next: boolean) => {
        if (!filters) return;
        const previous = filters;
        setFilters(filters.map(f => (f.key === key ? { ...f, enabled: next } : f)));
        try {
            if (!(await saveModerationFilter(key, { enabled: next }))) throw new Error();
        } catch {
            setFilters(previous);
            setError(t('hub.saveFailed'));
        }
    };

    const cards = CARDS.filter(card => !card.filter || !filters || filters.some(f => f.key === card.filter));

    return (
        <div className="panel-scale space-y-6">
            <div>
                <h1 className="text-3xl font-black text-ds-text">{t('hub.title')}</h1>
                <p className="text-ds-soft mt-2">
                    {t('hub.subtitle')}
                </p>
            </div>

            {platform === 'kick' && (
                <div className="p-4 rounded-lg bg-ds-raised border border-ds-border text-sm text-ds-text max-w-7xl">
                    <strong>{t('hub.kickLabel')}</strong> {t('hub.kickBody')}
                </div>
            )}

            {error && (
                <p className="text-sm font-semibold text-ds-danger">{error}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl">
                {cards.map((card) => {
                    const state = card.filter ? filters?.find(f => f.key === card.filter) : undefined;
                    // En Kick, de "Raids y bots" solo existen las frases de bots
                    const group = platform === 'kick' && card.key === 'raids' ? ['bot_phrases'] : card.group;
                    const groupActive = group && filters?.filter(f => group.includes(f.key) && f.enabled).length;
                    return (
                        <div
                            key={card.key}
                            className="bg-ds-surface rounded-lg p-6 border border-ds-border transition-all flex flex-col"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    {card.icon}
                                    <h3 className="text-lg font-black leading-tight text-ds-text">
                                        {t(`hub.cards.${card.key}.name`)}
                                    </h3>
                                </div>
                                {state && (
                                    <FilterSwitch
                                        on={state.enabled}
                                        onChange={(next) => toggle(card.filter!, next)}
                                        label={t('hub.activate', { name: t(`hub.cards.${card.key}.name`) })}
                                    />
                                )}
                            </div>
                            <p className="text-sm text-ds-soft flex-1">
                                {platform === 'kick' && card.key === 'raids' ? t('hub.kickRaids') : t(`hub.cards.${card.key}.description`)}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 mt-4 border-t border-ds-border">
                                <span className={`text-xs font-bold whitespace-nowrap ${(state?.enabled || (groupActive ?? 0) > 0) ? 'text-ds-ok' : 'text-ds-soft'}`}>
                                    {card.key === 'raids' && panicActive ? <span className="text-ds-danger">{t('hub.panicActive')}</span>
                                        : state ? (state.enabled ? t('common.on') : t('common.off'))
                                        : group && filters ? t('hub.groupCount', { active: groupActive, total: group.length, count: group.length }) : ''}
                                </span>
                                <button
                                    onClick={() => navigate(card.route)}
                                    className="ds-btn ds-btn--primary"
                                >
                                    <Settings className="w-4 h-4" />
                                    {t('common.configure')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
