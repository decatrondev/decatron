// Mis voces: tu lista propia de voces de personaje (Patrocinador o superior). Con un rango menor se ve bloqueada, con el motivo.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Card } from '../../../../components/overlay-editor/ui';
import FishMyVoices from '../../FishMyVoices';
import { useFishVoices } from '../../fishVoices';

export default function MyVoicesTab() {
    const { t } = useTranslation('speakchat');
    const { canAddPrivate, loading } = useFishVoices();
    if (loading) return <Card><p className="text-sm text-ds-soft">{t('v2.credits.loading')}</p></Card>;
    if (!canAddPrivate) {
        return (
            <Card title={t('v2.myVoices.title')} description={t('v2.myVoices.description')}>
                <div className="flex items-start gap-3 rounded-lg border border-ds-border bg-ds-bg p-4">
                    <Lock className="w-5 h-5 text-ds-soft shrink-0 mt-0.5" aria-hidden />
                    <div className="text-sm 3xl:text-base text-ds-soft space-y-3">
                        <p>{t('v2.myVoices.locked')}</p>
                        <Link to="/supporters" className="ds-btn ds-btn--secondary ds-btn--sm inline-flex">{t('v2.myVoices.seeRanks')}</Link>
                    </div>
                </div>
            </Card>
        );
    }
    return (
        <Card title={t('v2.myVoices.title')}>
            <FishMyVoices bare />
        </Card>
    );
}
