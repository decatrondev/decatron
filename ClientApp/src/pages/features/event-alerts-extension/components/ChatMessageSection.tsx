/**
 * ChatMessageSection - Configuración de mensaje del bot en chat
 */
import React, { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type { ChatMessageConfig } from '../types/index';

interface ChatMessageSectionProps {
  config?: ChatMessageConfig;
  onChange: (config: ChatMessageConfig) => void;
  messageVariables?: string;
  suggestedTemplate?: string;
}

export const ChatMessageSection: React.FC<ChatMessageSectionProps> = ({
  config,
  onChange,
  messageVariables = '{username}',
  suggestedTemplate = '¡Gracias {username}!',
}) => {
  const [expanded, setExpanded] = useState(false);

  // Defaults
  const currentConfig: ChatMessageConfig = config ?? {
    enabled: false,
    template: '',
  };

  const handleToggle = (enabled: boolean) => {
    onChange({ ...currentConfig, enabled });
  };

  const handleTemplateChange = (template: string) => {
    onChange({ ...currentConfig, template });
  };

  const applyTemplate = () => {
    onChange({ ...currentConfig, template: suggestedTemplate });
  };

  const inputClass = "w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none";

  return (
    <div className="border border-ds-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-ds-bg cursor-pointer hover:bg-ds-raised transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-ds-accent-text" />
          <span className="text-sm font-bold text-ds-text 3xl:text-base">
            Mensaje en Chat
          </span>
          {currentConfig.enabled && (
            <span className="px-2 py-0.5 bg-ds-ok/10 text-ds-ok text-xs font-bold rounded-full 3xl:text-sm">
              Activo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={currentConfig.enabled}
              onChange={e => handleToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-ok/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ds-accent"></div>
          </label>
          {expanded ? <ChevronUp className="w-4 h-4 text-ds-soft" /> : <ChevronDown className="w-4 h-4 text-ds-soft" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 border-t border-ds-border">
          <p className="text-xs text-ds-soft 3xl:text-sm">
            El bot enviará este mensaje en el chat cuando ocurra el evento.
            Variables: <code className="bg-ds-bg px-2 py-0.5 rounded text-ds-ok">{messageVariables}</code>
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-ds-soft 3xl:text-sm">
                Mensaje del Bot
              </label>
              {!currentConfig.template && suggestedTemplate && (
                <button
                  onClick={applyTemplate}
                  className="text-xs px-2 py-1 bg-ds-ok/10 text-ds-ok rounded-lg hover:bg-ds-ok/10 font-bold 3xl:text-sm"
                >
                  ✨ Usar predefinido
                </button>
              )}
            </div>
            <input
              type="text"
              value={currentConfig.template}
              onChange={e => handleTemplateChange(e.target.value)}
              placeholder={suggestedTemplate}
              className={inputClass + " font-mono text-sm"}
              disabled={!currentConfig.enabled}
            />

            {/* Sugerencia */}
            {!currentConfig.template && suggestedTemplate && currentConfig.enabled && (
              <button
                onClick={applyTemplate}
                className="mt-2 w-full p-2 bg-ds-ok/10 rounded-lg border border-ds-ok/40 text-left group hover:border-ds-ok/40 transition-all"
              >
                <p className="text-xs text-ds-soft 3xl:text-sm">
                  💡 <span className="font-bold text-ds-ok">Sugerido:</span>
                </p>
                <p className="text-sm text-ds-ok font-mono mt-1 3xl:text-base">"{suggestedTemplate}"</p>
              </button>
            )}

            {/* Preview */}
            {currentConfig.template && currentConfig.enabled && (
              <div className="mt-2 p-2 bg-ds-ok/10 rounded-lg border border-ds-ok/40">
                <p className="text-xs text-ds-ok 3xl:text-sm">
                  <strong>💬 Bot dirá:</strong> {
                    currentConfig.template
                      .replace('{username}', 'EjemploUser')
                      .replace('{amount}', '500')
                      .replace('{viewers}', '150')
                      .replace('{months}', '12')
                      .replace('{tier}', 'Tier 1')
                      .replace('{level}', '3')
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
