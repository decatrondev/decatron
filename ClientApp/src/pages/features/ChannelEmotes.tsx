import TabIcon from '../../components/dashboard/TabIcon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useChannelEmotes } from './channel-emotes-extension/useChannelEmotes';
import GlobalEmotesAccessCard from '../../components/channel-emotes/GlobalEmotesAccessCard';
import { MyEmotesTab, UploadTab, ReviewTab, SettingsTab, type EmotesTabId } from './channel-emotes-extension/ChannelEmotesTabs';

// Emotes propios de Decatron (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3): el panel de quien administra el canal.

const TABS: { id: EmotesTabId; icon: string }[] = [
    { id: 'mine', icon: '😀' },
    { id: 'upload', icon: '⬆️' },
    { id: 'review', icon: '📋' },
    { id: 'settings', icon: '⚙️' },
];

export default function ChannelEmotes() {
    const { t } = useTranslation('emotes');
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const s = useChannelEmotes();
    const [tab, setTab] = useState<EmotesTabId>(() => {
        try { return (sessionStorage.getItem('emotes-tab') as EmotesTabId) || 'mine'; } catch { return 'mine'; }
    });

    useEffect(() => { try { sessionStorage.setItem('emotes-tab', tab); } catch { /* sin storage */ } }, [tab]);

    useEffect(() => {
        if (!permissionsLoading && !hasMinimumLevel('moderation')) navigate('/dashboard');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    if (s.loading || permissionsLoading) {
        return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent" /></div>;
    }

    if (s.error) {
        return (
            <div className="p-8">
                <div className="max-w-xl mx-auto p-6 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-ds-danger">
                    {s.error === 'forbidden' ? t('panel.forbidden') : t('panel.loadFailed')}
                </div>
            </div>
        );
    }

    const pending = s.emotes.filter(e => e.status === 'pending').length;
    const pct = s.usage.max > 0 ? Math.min(100, Math.round((s.usage.used / s.usage.max) * 100)) : 0;

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            <div className="panel-scale max-w-[1600px] mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/features')}
                            className="ds-btn ds-btn--secondary ds-icon-btn"
                            aria-label={t('panel.back')}
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('panel.title')}</h1>
                            <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('panel.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {s.channelLogin && (
                            <a
                                href={`/emotes/${s.channelLogin}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-4 py-2.5 rounded-lg border border-ds-border bg-ds-surface text-sm 3xl:text-base font-bold text-ds-soft hover:border-ds-accent flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" /> {t('panel.publicPage')}
                            </a>
                        )}
                    </div>
                </div>

                <div className="bg-ds-surface rounded-lg border border-ds-border p-5 3xl:p-6 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <span className="text-sm 3xl:text-base font-bold text-ds-text">{t('panel.usage', { used: s.usage.used, max: s.usage.max })}</span>
                        <span className="text-xs 3xl:text-sm text-ds-soft">{t('panel.usageHint')}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-ds-raised overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-ds-warn' : 'bg-ds-accent'}`} style={{ width: `${pct}%` }} />
                    </div>
                </div>

                <GlobalEmotesAccessCard />

                <div className="bg-ds-surface rounded-lg border border-ds-border p-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        {TABS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setTab(item.id)}
                                className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}
                            >
                                <TabIcon emoji={item.icon} />{t(`tabs.${item.id}`)}
                                {item.id === 'review' && pending > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-ds-warn text-ds-on-accent text-[11px]">{pending}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {tab === 'mine' && <MyEmotesTab s={s} onUpload={() => setTab('upload')} />}
                {tab === 'upload' && <UploadTab s={s} />}
                {tab === 'review' && <ReviewTab s={s} />}
                {tab === 'settings' && <SettingsTab s={s} />}
            </div>
        </div>
    );
}
