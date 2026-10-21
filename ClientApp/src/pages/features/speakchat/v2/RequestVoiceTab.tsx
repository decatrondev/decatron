// Solicitar voz: busca un personaje, escucha la muestra y pídelo; aquí también ves el estado de tus solicitudes.
import { useTranslation } from 'react-i18next';
import { Card } from '../../../../components/overlay-editor/ui';
import FishVoiceRequestBox from '../../FishVoiceRequestBox';

export default function RequestVoiceTab() {
    const { t } = useTranslation('speakchat');
    return (
        <Card title={t('v2.requestVoice.title')} description={t('v2.requestVoice.description')}>
            <FishVoiceRequestBox mode="request" />
        </Card>
    );
}
