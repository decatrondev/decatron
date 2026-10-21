// De qué plataformas lee Speak Chat: una sola decisión para todo el overlay, igual que en Chat en pantalla.
import { useTranslation } from 'react-i18next';
import { Card, Toggle } from '../../../../components/overlay-editor/ui';
import type { SpeakChatState } from './useSpeakChatConfig';

export default function PlatformsCard({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, status } = sc;
    return (
        <Card title={t('v2.platforms.title')} description={t('v2.platforms.description')}>
            <div className="space-y-4">
                {(['twitch', 'kick'] as const).map(p => (
                    <Toggle
                        key={p}
                        checked={config.global.sources?.[p] ?? false}
                        onChange={v => setConfig(c => ({ ...c, global: { ...c.global, sources: { twitch: true, kick: false, ...c.global.sources, [p]: v } } }))}
                        label={p === 'twitch' ? 'Twitch' : 'Kick'}
                        hint={(p === 'twitch' ? status.hasTwitch : status.hasKick) ? t('v2.platforms.linked') : t('v2.platforms.notLinked')}
                    />
                ))}
            </div>
            <p className="text-xs 3xl:text-sm text-ds-soft mt-4">{t('v2.platforms.note')}</p>
        </Card>
    );
}
