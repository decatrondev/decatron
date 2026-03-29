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

  const inputClass = "w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="border border-[#e2e8f0] dark:border-[#374151] rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-[#262626] cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-500" />
          <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
            Mensaje en Chat
          </span>
          {currentConfig.enabled && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
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
            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-600"></div>
          </label>
          {expanded ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 border-t border-[#e2e8f0] dark:border-[#374151]">
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
            El bot enviará este mensaje en el chat cuando ocurra el evento.
            Variables: <code className="bg-[#f8fafc] dark:bg-[#374151] px-2 py-0.5 rounded text-green-600">{messageVariables}</code>
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                Mensaje del Bot
              </label>
              {!currentConfig.template && suggestedTemplate && (
                <button
                  onClick={applyTemplate}
                  className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-lg hover:bg-green-200 font-bold"
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
                className="mt-2 w-full p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800 text-left group hover:border-green-400 transition-all"
              >
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  💡 <span className="font-bold text-green-600 dark:text-green-400">Sugerido:</span>
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 font-mono mt-1">"{suggestedTemplate}"</p>
              </button>
            )}

            {/* Preview */}
            {currentConfig.template && currentConfig.enabled && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300">
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
