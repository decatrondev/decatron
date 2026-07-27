/**
 * TtsSection - Componente reutilizable de configuración de Text-to-Speech
 * Usado por todos los eventos que soportan TTS
 */

import React, { useState } from 'react';
import type { TtsConfig } from '../types/index';
import { TtsCreditsCard, useTtsCredits } from '../../../../components/tts/TtsCreditsCard';
import { useStandardVoices, standardVoicesForLanguage } from '../../../../components/tts/useStandardVoices';

// Voces TTS disponibles organizadas por idioma
const TTS_VOICES = [
  // Español
  { id: 'Lupe',      name: 'Lupe',      lang: 'es-US', langLabel: 'Español (US)',    gender: 'F', engines: ['standard'] },
  { id: 'Penelope',  name: 'Penelope',  lang: 'es-US', langLabel: 'Español (US)',    gender: 'F', engines: ['standard'] },
  { id: 'Miguel',    name: 'Miguel',    lang: 'es-US', langLabel: 'Español (US)',    gender: 'M', engines: ['standard'] },
  { id: 'Lucia',     name: 'Lucía',     lang: 'es-ES', langLabel: 'Español (España)', gender: 'F', engines: ['standard'] },
  { id: 'Conchita',  name: 'Conchita',  lang: 'es-ES', langLabel: 'Español (España)', gender: 'F', engines: ['standard'] },
  { id: 'Enrique',   name: 'Enrique',   lang: 'es-ES', langLabel: 'Español (España)', gender: 'M', engines: ['standard'] },
  { id: 'Mia',       name: 'Mia',       lang: 'es-MX', langLabel: 'Español (México)', gender: 'F', engines: ['standard'] },
  // Inglés
  { id: 'Joanna',    name: 'Joanna',    lang: 'en-US', langLabel: 'English (US)',    gender: 'F', engines: ['standard'] },
  { id: 'Matthew',   name: 'Matthew',   lang: 'en-US', langLabel: 'English (US)',    gender: 'M', engines: ['standard'] },
  { id: 'Kendra',    name: 'Kendra',    lang: 'en-US', langLabel: 'English (US)',    gender: 'F', engines: ['standard'] },
  { id: 'Kimberly',  name: 'Kimberly',  lang: 'en-US', langLabel: 'English (US)',    gender: 'F', engines: ['standard'] },
  { id: 'Joey',      name: 'Joey',      lang: 'en-US', langLabel: 'English (US)',    gender: 'M', engines: ['standard'] },
  { id: 'Amy',       name: 'Amy',       lang: 'en-GB', langLabel: 'English (UK)',    gender: 'F', engines: ['standard'] },
  { id: 'Brian',     name: 'Brian',     lang: 'en-GB', langLabel: 'English (UK)',    gender: 'M', engines: ['standard'] },
  { id: 'Emma',      name: 'Emma',      lang: 'en-GB', langLabel: 'English (UK)',    gender: 'F', engines: ['standard'] },
  // Portugués
  { id: 'Camila',    name: 'Camila',    lang: 'pt-BR', langLabel: 'Português (BR)',  gender: 'F', engines: ['standard'] },
  { id: 'Ricardo',   name: 'Ricardo',   lang: 'pt-BR', langLabel: 'Português (BR)',  gender: 'M', engines: ['standard'] },
  { id: 'Vitoria',   name: 'Vitória',   lang: 'pt-BR', langLabel: 'Português (BR)',  gender: 'F', engines: ['standard'] },
  // Japonés
  { id: 'Takumi',    name: 'Takumi',    lang: 'ja-JP', langLabel: '日本語 (Japanese)', gender: 'M', engines: ['standard'] },
  { id: 'Mizuki',    name: 'Mizuki',    lang: 'ja-JP', langLabel: '日本語 (Japanese)', gender: 'F', engines: ['standard'] },
  { id: 'Kazuha',    name: 'Kazuha',    lang: 'ja-JP', langLabel: '日本語 (Japanese)', gender: 'F', engines: ['standard'] },
];

const LANGUAGE_OPTIONS = [
  { code: 'es-US', label: 'Español (US)' },
  { code: 'es-ES', label: 'Español (España)' },
  { code: 'es-MX', label: 'Español (México)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'pt-BR', label: 'Português (BR)' },
  { code: 'ja-JP', label: '日本語 (Japanese)' },
];

// Presets de templates por tipo de evento
const TTS_PRESETS: Record<string, { label: string; template: string }[]> = {
  bits: [
    { label: '🎉 Agradecimiento', template: '¡Gracias {userName} por los {amount} bits!' },
    { label: '💎 Épico', template: '¡Increíble! {userName} acaba de enviar {amount} bits!' },
    { label: '🔥 Hype', template: '¡{userName} está en llamas con {amount} bits!' },
    { label: '🎮 Gamer', template: '¡{userName} donó {amount} bits al stream!' },
  ],
  sub: [
    { label: '⭐ Bienvenida', template: '¡Bienvenido {userName} a la familia!' },
    { label: '🎉 Celebración', template: '¡{userName} se ha suscrito! ¡Gracias por el apoyo!' },
    { label: '💜 Amor', template: '¡Muchísimas gracias {userName} por suscribirte!' },
    { label: '🏆 VIP', template: '¡{userName} ahora es parte del club VIP!' },
  ],
  gift: [
    { label: '🎁 Regalo', template: '¡{userName} regaló {amount} suscripciones!' },
    { label: '🎄 Generoso', template: '¡Qué generoso! {userName} acaba de regalar {amount} subs!' },
    { label: '💝 Amor', template: '¡{userName} comparte el amor con {amount} subs de regalo!' },
  ],
  raid: [
    { label: '🚀 Bienvenida', template: '¡Bienvenidos {amount} raiders de {userName}!' },
    { label: '⚔️ Épico', template: '¡La raid de {userName} ha llegado con {amount} guerreros!' },
    { label: '🎉 Fiesta', template: '¡{userName} trae la fiesta con {amount} personas!' },
  ],
  follow: [
    { label: '❤️ Simple', template: '¡Gracias por seguirme {userName}!' },
    { label: '🎉 Celebración', template: '¡Bienvenido {userName} a la comunidad!' },
    { label: '💜 Amor', template: '¡{userName} se unió al stream! ¡Gracias!' },
  ],
  hypetrain: [
    { label: '🚂 Tren', template: '¡El Hype Train alcanzó el nivel {amount}!' },
    { label: '🔥 Fuego', template: '¡Nivel {amount} del Hype Train! ¡Qué locura!' },
    { label: '🎉 Épico', template: '¡Increíble! ¡Hype Train nivel {amount}!' },
  ],
  tips: [
    { label: '💰 Agradecimiento', template: '¡Gracias {userName} por donar {amount}!' },
    { label: '💵 Donación', template: '¡{userName} acaba de donar {amount}! ¡Eres increíble!' },
    { label: '🎉 Celebración', template: '¡Wow! ¡{amount} de {userName}! ¡Muchísimas gracias!' },
    { label: '💜 Amor', template: '¡{userName} apoya el stream con {amount}! ¡Te quiero!' },
  ],
};

interface TtsSectionProps {
  config: TtsConfig;
  onChange: (updates: Partial<TtsConfig>) => void;
  messageVariables?: string;   // ej: "({username}, {amount})"
  hasUserMessage?: boolean;    // Mostrar toggle "Leer mensaje del usuario"
  suggestedTemplate?: string;  // Template sugerido para este evento
  eventType?: string;          // Tipo de evento (para info)
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
    <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
  </label>
);

export const TtsSection: React.FC<TtsSectionProps> = ({
  config,
  onChange,
  messageVariables = '',
  hasUserMessage = false,
  suggestedTemplate = '',
  eventType = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  // Usar template sugerido si el actual está vacío
  const applyTemplate = () => {
    if (suggestedTemplate) {
      onChange({ template: suggestedTemplate });
    }
  };

  const inputClass = "w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm";
  const labelClass = "text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2";

  // Filtrar voces compatibles con el idioma y engine seleccionados
  const compatibleVoices = TTS_VOICES.filter(
    v => v.lang === config.languageCode && v.engines.includes(config.engine)
  );

  // Si la voz actual no está disponible con el nuevo idioma/engine, resetear
  const currentVoiceCompatible = compatibleVoices.some(v => v.id === config.voice);

  // Al cambiar de idioma se reajusta la voz de los dos catálogos: si solo se tocara
  // el del motor activo, cambiar de motor después dejaría una voz de otro idioma.
  const handleLanguageChange = (langCode: string) => {
    const pollyVoices = TTS_VOICES.filter(v => v.lang === langCode && v.engines.includes(config.engine));
    const standardForLang = standardVoicesForLanguage(standardVoices, langCode);

    onChange({
      languageCode: langCode,
      voice: pollyVoices[0]?.id ?? config.voice,
      standardVoice: standardForLang[0]?.id ?? '',
    });
  };

  const handleEngineChange = (engine: 'standard' | 'neural') => {
    const voices = TTS_VOICES.filter(v => v.lang === config.languageCode && v.engines.includes(engine));
    onChange({
      engine,
      voice: voices[0]?.id ?? config.voice,
    });
  };

  const { credits } = useTtsCredits();

  // Ausente = polly, para no cambiar lo ya configurado. "browser" es el motor viejo,
  // que ya no existe: se lee como voz estándar, que es lo que hace lo que aquella
  // prometía.
  const provider = config.provider === 'piper' || config.provider === 'browser' ? 'piper' : 'polly';
  const usingStandard = provider === 'piper';

  const { voices: standardVoices } = useStandardVoices();
  const voicesForThisLanguage = standardVoicesForLanguage(standardVoices, config.languageCode);

  // Piper no tiene japonés ni coreano a ninguna calidad, así que ofrecerlos con voz
  // estándar sería mentir: se listan solo los idiomas que hay instalados de verdad.
  const standardPrefixes = new Set(standardVoices.map(v => v.languagePrefix));
  const languageOptions = (usingStandard && standardPrefixes.size > 0)
    ? LANGUAGE_OPTIONS.filter(l => standardPrefixes.has(l.code.substring(0, 2).toLowerCase()))
    : LANGUAGE_OPTIONS;

  return (
    <div className={`rounded-xl border-2 transition-all ${
      config.enabled
        ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20'
        : 'border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626]'
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🗣️</span>
          <div>
            <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              Text-to-Speech
            </div>
            {config.enabled && (
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                {usingStandard
                  ? `🆓 ${standardVoices.find(v => v.id === config.standardVoice)?.speaker ?? 'Voz automática'} · estándar · ${config.languageCode}`
                  : `🎙️ ${TTS_VOICES.find(v => v.id === config.voice)?.name ?? config.voice} · ${config.engine} · ${config.languageCode}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <Toggle checked={config.enabled} onChange={v => onChange({ enabled: v })} />
          <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
            {config.enabled ? 'Activo' : 'Inactivo'}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="text-[#64748b] dark:text-[#94a3b8] p-1"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Body - solo visible cuando expandido y habilitado */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-purple-200 dark:border-purple-800">
          <div className="pt-4">
            {/* Saldo de créditos */}
            <div className="mb-4">
              <TtsCreditsCard credits={credits} compact standard={usingStandard} />
            </div>

            {/* Motor de voz: la decisión que más cambia el resultado, así que va primero */}
            <div className="mb-4">
              <label className={labelClass}>Motor de voz</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onChange({ provider: 'piper' })}
                  className={`px-3 py-3 rounded-lg text-left transition-all border-2 ${
                    usingStandard
                      ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300'
                      : 'bg-white dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-green-300'
                  }`}
                >
                  <div className="text-sm font-bold">🆓 Voz estándar</div>
                  <div className="text-xs mt-0.5 opacity-80">Incluida en tu plan. Suena en cualquier OBS.</div>
                </button>
                <button
                  onClick={() => onChange({ provider: 'polly' })}
                  className={`px-3 py-3 rounded-lg text-left transition-all border-2 ${
                    !usingStandard
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300'
                      : 'bg-white dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:border-purple-300'
                  }`}
                >
                  <div className="text-sm font-bold">🎙️ Voz premium</div>
                  <div className="text-xs mt-0.5 opacity-80">Gasta créditos premium. Más idiomas, incluido japonés.</div>
                </button>
              </div>

              {!usingStandard && (
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                  Si te quedas sin créditos premium la alerta no se queda muda: se lee con
                  tu voz estándar{standardPrefixes.size > 0 && !standardPrefixes.has(config.languageCode.substring(0, 2).toLowerCase())
                    ? ', y como este idioma no existe en voz estándar sonará en español'
                    : ''}.
                </p>
              )}
            </div>

            {/* Idioma + Engine (el engine solo aplica a Polly) */}
            <div className={`grid gap-4 mb-4 ${usingStandard ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <label className={labelClass}>Idioma</label>
                <select
                  value={config.languageCode}
                  onChange={e => handleLanguageChange(e.target.value)}
                  className={inputClass}
                >
                  {languageOptions.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                {usingStandard && (
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                    El japonés y el coreano solo están en voz premium.
                  </p>
                )}
              </div>
              {!usingStandard && (
                <div>
                  <label className={labelClass}>Calidad</label>
                  <select
                    value={config.engine}
                    onChange={e => handleEngineChange(e.target.value as 'standard' | 'neural')}
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="neural" disabled>Neural (próximamente)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Voz estándar */}
            {usingStandard && (
              <div className="mb-4">
                <label className={labelClass}>Voz</label>
                {voicesForThisLanguage.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {voicesForThisLanguage.map(v => (
                      <button
                        key={v.id}
                        onClick={() => onChange({ standardVoice: v.id })}
                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                          config.standardVoice === v.id
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-transparent shadow-md'
                            : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-green-300'
                        }`}
                      >
                        {v.speaker}
                        <span className="block text-[10px] font-normal opacity-70">
                          {v.languageName} · {v.quality}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    ⚠️ No hay voces estándar para este idioma. Cambia de idioma o usa voz premium.
                  </p>
                )}
              </div>
            )}

            {/* Voz de Polly */}
            {!usingStandard && (
            <div className="mb-4">
              <label className={labelClass}>Voz</label>
              {compatibleVoices.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {compatibleVoices.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => onChange({ voice: voice.id })}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                        config.voice === voice.id
                          ? 'bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white border-transparent shadow-md'
                          : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300'
                      }`}
                    >
                      {voice.gender === 'F' ? '👩' : '👨'} {voice.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  ⚠️ No hay voces disponibles para este idioma con motor {config.engine}. Prueba con otro motor.
                </p>
              )}
              {!currentVoiceCompatible && compatibleVoices.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Voz "{config.voice}" no compatible. Se usará {compatibleVoices[0].name}.
                </p>
              )}
            </div>
            )}

            {/* Presets */}
            {eventType && TTS_PRESETS[eventType] && (
              <div className="mb-4">
                <label className={labelClass}>Plantillas predefinidas</label>
                <div className="flex flex-wrap gap-2">
                  {TTS_PRESETS[eventType].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => onChange({ template: preset.template })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        config.template === preset.template
                          ? 'bg-gradient-to-r from-[#7c3aed] to-[#9333ea] text-white border-transparent'
                          : 'bg-white dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300 hover:text-purple-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Template */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass + ' mb-0'}>
                  Texto a leer
                  {messageVariables && (
                    <span className="ml-2 text-blue-500 font-normal">Variables: {messageVariables}</span>
                  )}
                </label>
                {suggestedTemplate && !config.template && (
                  <button
                    onClick={applyTemplate}
                    className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 font-bold transition-all"
                  >
                    ✨ Usar predefinido
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={config.template}
                  onChange={e => onChange({ template: e.target.value })}
                  placeholder={suggestedTemplate || `Ej: ¡Gracias {userName} por el evento!`}
                  className={inputClass + ' font-mono pr-10'}
                />
                {config.template && (
                  <button
                    onClick={() => onChange({ template: '' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-1"
                    title="Limpiar"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sugerencia cuando está vacío */}
              {!config.template && suggestedTemplate && !eventType && (
                <button
                  onClick={applyTemplate}
                  className="mt-2 w-full p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 text-left group hover:border-purple-400 transition-all"
                >
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    <span className="font-bold text-purple-600 dark:text-purple-400">💡 Sugerido:</span>
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300 font-mono mt-1 group-hover:text-purple-900 dark:group-hover:text-purple-100">
                    "{suggestedTemplate}"
                  </p>
                  <p className="text-xs text-purple-500 dark:text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click para usar este template
                  </p>
                </button>
              )}

              {/* Preview cuando hay template */}
              {config.template && (
                <div className="mt-2 p-2 bg-white dark:bg-[#1B1C1D] rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    <strong>🔊 Se leerá:</strong> "{
                      config.template
                        .replace('{userName}', 'StreamerEjemplo')
                        .replace('{username}', 'StreamerEjemplo')
                        .replace('{user}', 'StreamerEjemplo')
                        .replace('{name}', 'StreamerEjemplo')
                        .replace('{donor}', 'StreamerEjemplo')
                        .replace('{donorName}', 'StreamerEjemplo')
                        .replace('{amount}', '500')
                        .replace('{bits}', '500')
                        .replace('{viewers}', '150')
                        .replace('{months}', '12')
                        .replace('{subs}', '5')
                        .replace('{tier}', 'Tier 1')
                        .replace('{level}', '3')
                        .replace('{message}', 'mensaje de ejemplo')
                    }"
                  </p>
                </div>
              )}
            </div>

            {/* Volumen del Template */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <label className={labelClass + ' mb-0'}>Volumen del Template</label>
                <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{config.templateVolume ?? 80}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.templateVolume ?? 80}
                onChange={e => onChange({ templateVolume: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                Volumen del texto configurado arriba
              </p>
            </div>

            {/* Leer mensaje del usuario (solo para eventos con mensaje) */}
            {hasUserMessage && (
              <div className="p-3 bg-white dark:bg-[#1B1C1D] rounded-lg border border-purple-200 dark:border-purple-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1e293b] dark:text-[#f8fafc]">
                      💬 Leer mensaje del usuario
                    </div>
                    <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                      Leer el mensaje que escribió el usuario con la donación/sub
                    </div>
                  </div>
                  <Toggle
                    checked={config.readUserMessage}
                    onChange={v => onChange({ readUserMessage: v })}
                  />
                </div>

                {config.readUserMessage && (
                  <>
                    {/* Volumen del mensaje del usuario */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className={labelClass + ' mb-0'}>Volumen del Mensaje</label>
                        <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{config.userMessageVolume ?? 80}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.userMessageVolume ?? 80}
                        onChange={e => onChange({ userMessageVolume: Number(e.target.value) })}
                        className="w-full accent-purple-500"
                      />
                    </div>

                    {/* Límite de caracteres */}
                    <div>
                      <label className={labelClass}>Límite de caracteres</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="20"
                          max="300"
                          step="10"
                          value={config.maxChars}
                          onChange={e => onChange({ maxChars: Number(e.target.value) })}
                          className="flex-1 accent-purple-500"
                        />
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 w-12 text-right">
                          {config.maxChars}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                        Si el mensaje supera este límite, se truncará
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Info orden de audio */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                🔊 <strong>Orden de audio:</strong> 1. Sonido de alerta → 2. Audio del video → 3. TTS template → 4. TTS mensaje usuario
              </p>
            </div>

            {/* Info cache */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Cache activo:</strong> Los audios generados se guardan localmente.
                Textos idénticos se reutilizan automáticamente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
