import TabIcon from '../../components/dashboard/TabIcon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import { useGoogleFonts } from '../../components/music-overlay/utils';
import { usePermissions } from '../../hooks/usePermissions';
import { useShoutoutConfig } from './shoutout-extension/hooks/useShoutoutConfig';
import ShoutoutPreview from './shoutout-extension/components/ShoutoutPreview';
import {
    GuideTab, GeneralTab, ClipTab, ThemeTab, ElementsTab, TextTab, AnimationsTab, EditorTab, AutoTab, PermissionsTab, type ShoutoutTabId,
} from './shoutout-extension/components/ShoutoutTabs';

// Shoutout (.dev/plans/SHOUTOUT_REDESIGN_PLAN.md, fase 1): mismo patrón que /overlays/now-playing —
// pestañas a la izquierda (2/3), vista previa en vivo a la derecha (1/3), un solo renderer para todo.

const TABS: { id: ShoutoutTabId; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'general', icon: '⚙️' },
    { id: 'clip', icon: '🎬' },
    { id: 'theme', icon: '🎨' },
    { id: 'elements', icon: '🖼️' },
    { id: 'text', icon: '🔤' },
    { id: 'animations', icon: '✨' },
    { id: 'editor', icon: '🖥️' },
    { id: 'auto', icon: '🤖' },
    { id: 'permissions', icon: '🛡️' },
];

export default function ShoutoutConfig() {
    const { t } = useTranslation('overlays');
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const cfg = useShoutoutConfig();
    const [tab, setTab] = useState<ShoutoutTabId>(() => {
        try { return (sessionStorage.getItem('so-tab') as ShoutoutTabId) || 'guide'; } catch { return 'guide'; }
    });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    useGoogleFonts(cfg.layout.elements.map(e => e.text?.fontFamily), 'so-fonts');

    useEffect(() => { try { sessionStorage.setItem('so-tab', tab); } catch { /* sin storage */ } }, [tab]);

    // Como antes: hace falta nivel de moderación en el canal
    useEffect(() => {
        if (!permissionsLoading && !hasMinimumLevel('moderation')) navigate('/dashboard');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    useEffect(() => {
        if (!cfg.dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [cfg.dirty]);

    useEffect(() => {
        if (!message) return;
        const id = window.setTimeout(() => setMessage(null), 4000);
        return () => window.clearTimeout(id);
    }, [message]);

    const save = async () => {
        const err = await cfg.save();
        setMessage({ ok: !err, text: err ? (err === 'save_failed' ? t('shoutout.saveFailed') : err) : t('shoutout.saved') });
    };

    const back = () => {
        if (cfg.dirty && !window.confirm(t('shoutout.leaveConfirm'))) return;
        navigate('/overlays');
    };

    if (cfg.loading || permissionsLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent" />
            </div>
        );
    }

    if (cfg.error) {
        return (
            <div className="p-8">
                <div className="max-w-xl mx-auto p-6 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-ds-danger">
                    {cfg.error === 'forbidden' ? t('shoutout.forbidden') : t('shoutout.loadFailed')}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            {/* panel-scale agranda todo en 2K/4K; el editor calcula el arrastre con el tamaño real en pantalla */}
            <div className="panel-scale max-w-[1920px] mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={back}
                            className="p-3 bg-ds-surface rounded-lg border border-ds-border hover:bg-ds-bg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('shoutout.title')}</h1>
                            <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('shoutout.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {cfg.dirty && <span className="text-xs 3xl:text-sm font-bold text-ds-warn">{t('shoutout.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={cfg.saving || !cfg.dirty}
                            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-bold ${cfg.saving || !cfg.dirty
                                ? 'bg-ds-faint cursor-not-allowed text-ds-text'
                                : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent'}`}
                        >
                            <Save className="w-5 h-5" />
                            {cfg.saving ? t('shoutout.saving') : t('shoutout.save')}
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg border ${message.ok
                        ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok '
                        : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger '}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6 min-w-0">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex flex-wrap gap-2">
                                {TABS.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setTab(item.id)}
                                        className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}
                                    >
                                        <TabIcon emoji={item.icon} />{t(`shoutout.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            {tab === 'guide' && <GuideTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'general' && <GeneralTab cfg={cfg} />}
                            {tab === 'clip' && <ClipTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'theme' && <ThemeTab cfg={cfg} />}
                            {tab === 'elements' && <ElementsTab cfg={cfg} onNavigate={setTab} />}
                            {tab === 'text' && <TextTab cfg={cfg} />}
                            {tab === 'animations' && <AnimationsTab cfg={cfg} />}
                            {tab === 'editor' && <EditorTab cfg={cfg} />}
                            {tab === 'auto' && <AutoTab cfg={cfg} />}
                            {tab === 'permissions' && <PermissionsTab cfg={cfg} />}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <ShoutoutPreview layout={cfg.layout} duration={cfg.settings.duration} noClipSeconds={cfg.settings.noClipSeconds} dirty={cfg.dirty} />
                    </div>
                </div>
            </div>
        </div>
    );
}
