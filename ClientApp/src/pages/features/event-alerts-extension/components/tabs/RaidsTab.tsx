import React from 'react';
import type { RaidsAlertConfig } from '../../types/index';
import { AlertTierSection } from '../AlertTierSection';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface RaidsTabProps {
  config: RaidsAlertConfig;
  onConfigChange: (updates: Partial<RaidsAlertConfig>) => void;
}

export const RaidsTab: React.FC<RaidsTabProps> = ({ config, onConfigChange }) => (
  <AlertTierSection
    enabled={config.enabled}
    onEnabledChange={v => onConfigChange({ enabled: v })}
    baseAlert={config.baseAlert}
    onBaseAlertChange={updates => onConfigChange({ baseAlert: { ...config.baseAlert, ...updates } })}
    tiers={config.tiers}
    onTiersChange={tiers => onConfigChange({ tiers })}
    cooldown={config.cooldown}
    onCooldownChange={v => onConfigChange({ cooldown: v })}
    eventTitle="Alertas de Raids"
    eventEmoji="🚀"
    eventDescription="Configura alertas para cuando alguien hace raid a tu canal"
    messageVariables={EVENT_VARIABLES.raids}
    tierUnitLabel="viewers del raid"
    ttsVariables={EVENT_VARIABLES.raids}
    hasUserMessage={false}
    eventType="raids"
    messageTemplates={MESSAGE_TEMPLATES.raids}
    ttsTemplates={TTS_TEMPLATES.raids}
    chatTemplates={CHAT_TEMPLATES.raids}
  />
);
