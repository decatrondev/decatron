import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save } from 'lucide-react';
import TabIcon from '../../components/dashboard/TabIcon';
import { useFishVoices } from './fishVoices';
import { useVoiceCatalog } from '../../components/tts/useVoiceCatalog';
import { useSpeakChatConfig } from './speakchat/v2/useSpeakChatConfig';
import { TABS2, type TabId2 } from './speakchat/v2/tabs';
import SummaryTab from './speakchat/v2/SummaryTab';
import CommandsTab from './speakchat/v2/CommandsTab';
import VoicesTab from './speakchat/v2/VoicesTab';
import FiltersTab from './speakchat/v2/FiltersTab';
import OverlayTab from './speakchat/v2/OverlayTab';
import TestsTab from './speakchat/v2/TestsTab';

// Speak Chat (rediseño, .dev/plans/speak-chat/PLAN.md F6): mismo patrón que Chat en pantalla — encabezado con
// «sin guardar», pestañas con icono, un solo botón de guardar que solo se enciende si hay cambios.

export default function SpeakChatConfig() {
    const { t } = useTranslation('speakchat');
    const navigate = useNavigate();
    const { voices: fishVoices, creditsPerByte } = useFishVoices();
    const { catalog } = useVoiceCatalog();
    const sc = useSpeakChatConfig(catalog);
    const [tab, setTab] = useState<TabId2>(() => {
        try { return (sessionStorage.getItem('speakchat-tab') as TabId2) || 'summary'; } catch { return 'summary'; }
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
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent" aria-label={t('v2.page.loading')} />
            </div>
        );
    }

    return (
        <div className="panel-scale max-w-6xl mx-auto">
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
                    <button onClick={save} disabled={sc.saving || !sc.dirty} className="ds-btn ds-btn--primary ds-btn--lg">
                        <Save className="w-5 h-5" /> {sc.saving ? t('v2.page.saving') : t('v2.page.save')}
                    </button>
                </div>
            </div>

            {message && (
                <div role="status" className={`mb-6 p-4 rounded-lg border ${message.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-ds-surface rounded-lg border border-ds-border p-4 mb-6">
                <div className="flex flex-wrap gap-2" role="tablist">
                    {TABS2.map(item => (
                        <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                            className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}>
                            <TabIcon emoji={item.icon} />{t(`v2.tabs.${item.id}`)}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'summary' && <SummaryTab sc={sc} goTo={setTab} />}
            {tab === 'commands' && <CommandsTab sc={sc} voiceCatalog={catalog} fishVoices={fishVoices} />}
            {tab === 'voices' && <VoicesTab sc={sc} voiceCatalog={catalog} fishVoices={fishVoices} fishCreditsPerByte={creditsPerByte} />}
            {tab === 'filters' && <FiltersTab sc={sc} />}
            {tab === 'overlay' && <OverlayTab sc={sc} />}
            {tab === 'tests' && <TestsTab sc={sc} fishFallback={fishVoices[0]?.id ?? ''} />}
        </div>
    );
}
