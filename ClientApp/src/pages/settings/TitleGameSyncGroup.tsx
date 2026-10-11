import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Switch } from '../../components/ds';
import { SettingsGroup, SettingsRow } from './parts';

/**
 * «Título y categoría»: aplicar !title, !game, !g y los micro comandos en Twitch y Kick a la vez. Solo se dibuja si la cuenta tiene
 * las dos plataformas vinculadas (la API dice `available`). Plan: .dev/plans/KICK_TITULO_CATEGORIA_PLAN.md. Textos: settings.json → sync.
 */
export default function TitleGameSyncGroup() {
    const { t } = useTranslation('settings');
    const [state, setState] = useState<{ available: boolean; enabled: boolean } | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        api.get('/channel-sync')
            .then(res => { if (alive) setState({ available: !!res.data?.available, enabled: !!res.data?.enabled }); })
            .catch(() => { if (alive) setState(null); });
        return () => { alive = false; };
    }, []);

    if (!state?.available) return null;

    const change = async (enabled: boolean) => {
        setSaving(true);
        setFailed(false);
        try {
            await api.put('/channel-sync', { enabled });
            setState({ available: true, enabled });
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsGroup title={t('sync.title')} description={t('sync.description')}>
            <SettingsRow title={t('sync.rowTitle')} description={failed ? <span className="text-ds-danger">{t('sync.failed')}</span> : t('sync.rowDescription')}>
                <Switch checked={state.enabled} onChange={change} label={t('sync.rowTitle')} disabled={saving} />
            </SettingsRow>
        </SettingsGroup>
    );
}
