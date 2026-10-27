import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import { Alert, Spinner, Tabs } from '../../components/ds';
import { ConfigHeader } from '../../components/dashboard/config';
import { promoAdminApi } from './promo/api';
import { PiecesTab } from './promo/PiecesTab';
import { TemplatesTab } from './promo/TemplatesTab';
import { LimitsTab } from './promo/LimitsTab';
import { ZonesTab } from './promo/ZonesTab';
import type { Lang } from './promo/shared';
import type { PromoOverview } from './promo/types';

// Administración del overlay de Promociones: catálogo de piezas, plantillas y topes (.dev/plans/overlay-promo/PLAN.md, Fase 1).
export default function PromoAdmin() {
    const { t, i18n } = useTranslation('promo');
    const navigate = useNavigate();
    const [data, setData] = useState<PromoOverview | null>(null);
    const [failed, setFailed] = useState(false);
    const [tab, setTab] = useState('pieces');
    const [lang, setLang] = useState<Lang>(i18n.language?.startsWith('en') ? 'en' : 'es');
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try { setData(await promoAdminApi.overview()); setFailed(false); }
        catch { setFailed(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const notify = (ok: boolean, text: string) => { setNote({ ok, text }); window.setTimeout(() => setNote(n => (n?.text === text ? null : n)), 5000); };

    if (failed) return <div className="panel-scale"><Alert tone="danger">{t('admin.loadFailed')}</Alert></div>;
    if (!data) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<Megaphone />} title={t('admin.title')} subtitle={t('admin.subtitle')} />
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}
            <Tabs items={[{ id: 'pieces', label: t('admin.tabs.pieces') }, { id: 'templates', label: t('admin.tabs.templates') }, { id: 'zones', label: t('admin.tabs.zones') }, { id: 'limits', label: t('admin.tabs.limits') }]} value={tab} onChange={setTab} />
            {tab === 'pieces' && <PiecesTab data={data} lang={lang} onLang={setLang} onChanged={load} notify={notify} />}
            {tab === 'templates' && <TemplatesTab data={data} lang={lang} onLang={setLang} onChanged={load} notify={notify} />}
            {tab === 'zones' && <ZonesTab data={data} lang={lang} onChanged={load} notify={notify} />}
            {tab === 'limits' && <LimitsTab limits={data.limits} onChanged={load} notify={notify} />}
        </div>
    );
}
