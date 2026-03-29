import React from 'react';
import type { ResubsAlertConfig } from '../../types/index';
import { AlertTierSection } from '../AlertTierSection';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface ResubsTabProps {
  config: ResubsAlertConfig;
  onConfigChange: (updates: Partial<ResubsAlertConfig>) => void;
}

export const ResubsTab: React.FC<ResubsTabProps> = ({ config, onConfigChange }) => (
  <AlertTierSection
    enabled={config.enabled}
    onEnabledChange={v => onConfigChange({ enabled: v })}
    baseAlert={config.baseAlert}
    onBaseAlertChange={updates => onConfigChange({ baseAlert: { ...config.baseAlert, ...updates } })}
    tiers={config.tiers}
    onTiersChange={tiers => onConfigChange({ tiers })}
    cooldown={config.cooldown}
    onCooldownChange={v => onConfigChange({ cooldown: v })}
    eventTitle="Alertas de Resubs"
    eventEmoji="🎉"
    eventDescription="Configura alertas para cuando alguien renueva su subscripción"
    messageVariables={EVENT_VARIABLES.resubs}
    tierUnitLabel="meses de antigüedad"
    ttsVariables={EVENT_VARIABLES.resubs}
    hasUserMessage={true}
    eventType="resubs"
    messageTemplates={MESSAGE_TEMPLATES.resubs}
    ttsTemplates={TTS_TEMPLATES.resubs}
    chatTemplates={CHAT_TEMPLATES.resubs}
  />
);
