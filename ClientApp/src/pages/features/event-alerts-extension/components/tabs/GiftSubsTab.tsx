import React from 'react';
import type { GiftSubsAlertConfig } from '../../types/index';
import { AlertTierSection } from '../AlertTierSection';
import { MESSAGE_TEMPLATES, TTS_TEMPLATES, EVENT_VARIABLES, CHAT_TEMPLATES } from '../../constants/defaults';

interface GiftSubsTabProps {
  config: GiftSubsAlertConfig;
  onConfigChange: (updates: Partial<GiftSubsAlertConfig>) => void;
}

export const GiftSubsTab: React.FC<GiftSubsTabProps> = ({ config, onConfigChange }) => (
  <AlertTierSection
    enabled={config.enabled}
    onEnabledChange={v => onConfigChange({ enabled: v })}
    baseAlert={config.baseAlert}
    onBaseAlertChange={updates => onConfigChange({ baseAlert: { ...config.baseAlert, ...updates } })}
    tiers={config.tiers}
    onTiersChange={tiers => onConfigChange({ tiers })}
    cooldown={config.cooldown}
    onCooldownChange={v => onConfigChange({ cooldown: v })}
    eventTitle="Alertas de Gift Subs"
    eventEmoji="🎁"
    eventDescription="Configura alertas para cuando alguien regala subscripciones"
    messageVariables={EVENT_VARIABLES.giftSubs}
    tierUnitLabel="subs regalados"
    ttsVariables={EVENT_VARIABLES.giftSubs}
    hasUserMessage={false}
    eventType="giftSubs"
    messageTemplates={MESSAGE_TEMPLATES.giftSubs}
    ttsTemplates={TTS_TEMPLATES.giftSubs}
    chatTemplates={CHAT_TEMPLATES.giftSubs}
  />
);
