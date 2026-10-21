import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import TabIcon from '../../components/dashboard/TabIcon';
import { useFishVoices } from './fishVoices';
import { useVoiceCatalog } from '../../components/tts/useVoiceCatalog';
import { useSpeakChatConfig } from './speakchat/v2/useSpeakChatConfig';
import { TABS2, type TabId2 } from './speakchat/v2/tabs';
import SidePanel from './speakchat/v2/SidePanel';
import GuideTab from './speakchat/v2/GuideTab';
import GeneralTab from './speakchat/v2/GeneralTab';
import ActivationTab from './speakchat/v2/ActivationTab';
import VoiceCommandsTab from './speakchat/v2/VoiceCommandsTab';
import ChannelVoiceTab from './speakchat/v2/ChannelVoiceTab';
import LibraryTab from './speakchat/v2/LibraryTab';
import RequestVoiceTab from './speakchat/v2/RequestVoiceTab';
import MyVoicesTab from './speakchat/v2/MyVoicesTab';
import FiltersTab from './speakchat/v2/FiltersTab';
import OverlayTab from './speakchat/v2/OverlayTab';
import CreditsTab from './speakchat/v2/CreditsTab';
import HistoryTab from './speakchat/v2/HistoryTab';
import TestsTab from './speakchat/v2/TestsTab';

// Speak Chat (rediseño, .dev/plans/speak-chat/PLAN.md F6): mismo esqueleto que Song Request y Chat en pantalla —
// pestañas a la izquierda (2/3), panel fijo a la derecha (1/3), botón de guardar que solo se enciende con cambios.

export default function SpeakChatConfig() {
    const { t } = useTranslation('speakchat');
    const navigate = useNavigate();
    const { voices: fishVoices, creditsPerByte } = useFishVoices();
    const { catalog } = useVoiceCatalog();
    const sc = useSpeakChatConfig(catalog);
    const [tab, setTab] = useState<TabId2>(() => {
        try {
            const saved = sessionStorage.getItem('speakchat-tab') as TabId2 | null;
            return saved && TABS2.some(x => x.id === saved) ? saved : 'guide';
        } catch { return 'guide'; }
    });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { try { sessionStorage.setItem('speakchat-tab', tab); } catch { /* sin storage */ } }, [tab]);

    useEffect(() => {
        if (!sc.dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [sc.dirty]);

    useEffect(() => {
        if (!message) return;
        const id = window.setTimeout(() => setMessage(null), 5000);
        return () => window.clearTimeout(id);
    }, [message]);

    const save = async () => {
        const r = await sc.save();
        setMessage(r.ok ? { ok: true, text: t('v2.page.saved') } : { ok: false, text: r.message ?? t('v2.page.saveFailed') });
    };

    const back = () => {
        if (sc.dirty && !window.confirm(t('v2.page.leaveConfirm'))) return;
        navigate('/features');
    };

    if (sc.loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent" aria-label={t('v2.page.loading')} />
            </div>
        );
    }

    const fishFallback = fishVoices[0]?.id ?? '';

    return (
        <div className="min-h-screen bg-ds-bg p-4 sm:p-6 lg:p-8">
            {/* panel-scale agranda todo en 2K/4K */}
            <div className="panel-scale max-w-[1920px] mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={back} className="ds-btn ds-btn--secondary ds-icon-btn" aria-label={t('v2.page.back')}>
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('v2.page.title')}</h1>
                            <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('v2.page.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {sc.dirty && <span className="text-xs 3xl:text-sm font-bold text-ds-warn">{t('v2.page.unsaved')}</span>}
                        <button
                            onClick={save}
                            disabled={sc.saving || !sc.dirty}
                            className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-bold ${sc.saving || !sc.dirty
                                ? 'bg-ds-faint cursor-not-allowed text-ds-text'
                                : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent'}`}
                        >
                            <Save className="w-5 h-5" /> {sc.saving ? t('v2.page.saving') : t('v2.page.save')}
                        </button>
                    </div>
                </div>

                {message && (
                    <div role="status" className={`mb-6 p-4 rounded-lg border ${message.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger'}`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6 min-w-0">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:overflow-visible" role="tablist">
                                {TABS2.map(item => (
                                    <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                                        className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}>
                                        <TabIcon emoji={item.icon} />{t(`v2.tabs.${item.id}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            {tab === 'guide' && <GuideTab sc={sc} goTo={setTab} />}
                            {tab === 'general' && <GeneralTab sc={sc} />}
                            {tab === 'activation' && <ActivationTab sc={sc} />}
                            {tab === 'voiceCommands' && <VoiceCommandsTab sc={sc} voiceCatalog={catalog} fishVoices={fishVoices} />}
                            {tab === 'channelVoice' && <ChannelVoiceTab sc={sc} voiceCatalog={catalog} fishVoices={fishVoices} fishCreditsPerByte={creditsPerByte} />}
                            {tab === 'library' && <LibraryTab sc={sc} voiceCatalog={catalog} fishVoices={fishVoices} />}
                            {tab === 'requestVoice' && <RequestVoiceTab />}
                            {tab === 'myVoices' && <MyVoicesTab />}
                            {tab === 'filters' && <FiltersTab sc={sc} />}
                            {tab === 'overlay' && <OverlayTab sc={sc} />}
                            {tab === 'credits' && <CreditsTab sc={sc} />}
                            {tab === 'history' && <HistoryTab sc={sc} />}
                            {tab === 'tests' && <TestsTab sc={sc} fishFallback={fishFallback} />}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <SidePanel sc={sc} fishFallback={fishFallback} />
                    </div>
                </div>
            </div>
        </div>
    );
}
