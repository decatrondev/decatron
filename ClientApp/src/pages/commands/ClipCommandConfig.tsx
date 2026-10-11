import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clapperboard, Save } from 'lucide-react';
import { Alert, Button, Spinner, Switch, Tabs } from '../../components/ds';
import { ConfigHeader } from '../../components/dashboard/config';
import { useClipConfig } from './clip/useClipConfig';
import GeneralTab from './clip/GeneralTab';
import PermissionsTab from './clip/PermissionsTab';
import CooldownsTab from './clip/CooldownsTab';
import MessagesTab from './clip/MessagesTab';
import HistoryTab from './clip/HistoryTab';

// Comando !clip (.dev/plans/CLIP_COMANDO_PLAN.md): pestañas General, Permisos, Cooldowns, Mensajes e Historial.
// Los textos viven en locales/{es,en}/clipcommand.json.

type TabId = 'general' | 'permissions' | 'cooldowns' | 'messages' | 'history';
const TAB_IDS: TabId[] = ['general', 'permissions', 'cooldowns', 'messages', 'history'];

export default function ClipCommandConfig() {
    const { t } = useTranslation('clipcommand');
    const navigate = useNavigate();
    const cfg = useClipConfig();
    const [tab, setTab] = useState<TabId>(() => {
        try { const saved = sessionStorage.getItem('clip-tab') as TabId; return TAB_IDS.includes(saved) ? saved : 'general'; } catch { return 'general'; }
    });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { try { sessionStorage.setItem('clip-tab', tab); } catch { /* sin storage */ } }, [tab]);

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
        setMessage({ ok: !err, text: err ? (err === 'save_failed' ? t('saveFailed') : err) : t('saved') });
    };

    const back = () => {
        if (cfg.dirty && !window.confirm(t('leaveConfirm'))) return;
        navigate('/commands');
    };

    if (cfg.loading) {
        return <div className="flex items-center justify-center h-64"><Spinner /></div>;
    }

    if (cfg.error) {
        return (
            <div className="panel-scale">
                <Alert tone="danger">{cfg.error === 'forbidden' ? t('forbidden') : t('loadFailed')}</Alert>
            </div>
        );
    }

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader
                onBack={back}
                icon={<Clapperboard />}
                title={t('title')}
                subtitle={t('subtitle')}
                actions={<>
                    {cfg.dirty && <span className="text-xs font-bold text-ds-warn">{t('unsaved')}</span>}
                    <div className="flex items-center gap-3 px-4 py-2 bg-ds-surface rounded-lg border border-ds-border">
                        <span className="text-sm font-semibold text-ds-soft">{t('enabled')}</span>
                        <Switch checked={cfg.config.enabled} onChange={v => cfg.update('enabled', v)} label={t('enabled')} />
                    </div>
                    <Button icon={<Save />} onClick={save} loading={cfg.saving} disabled={cfg.saving || !cfg.dirty}>
                        {cfg.saving ? t('saving') : t('save')}
                    </Button>
                </>}
            />

            {message && <Alert tone={message.ok ? 'ok' : 'danger'}>{message.text}</Alert>}

            <Tabs items={TAB_IDS.map(id => ({ id, label: t(`tabs.${id}`) }))} value={tab} onChange={id => setTab(id as TabId)} />

            {tab === 'general' && <GeneralTab cfg={cfg} />}
            {tab === 'permissions' && <PermissionsTab cfg={cfg} />}
            {tab === 'cooldowns' && <CooldownsTab cfg={cfg} />}
            {tab === 'messages' && <MessagesTab cfg={cfg} />}
            {tab === 'history' && <HistoryTab />}
        </div>
    );
}
