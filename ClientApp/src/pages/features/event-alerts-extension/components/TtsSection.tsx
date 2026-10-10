/**
 * TtsSection - Componente reutilizable de configuración de Text-to-Speech
 * Usado por todos los eventos que soportan TTS
 */

import React, { useState } from 'react';
import type { TtsConfig } from '../types/index';
import { TtsCreditsCard, useTtsCredits } from '../../../../components/tts/TtsCreditsCard';
import {
  useVoiceCatalog,
  standardVoicesForLanguage,
  premiumVoicesForLanguage,
  languagesFor,
  languageLabel,
  describeVoiceMismatch,
} from '../../../../components/tts/useVoiceCatalog';

// Las voces y los idiomas vienen del servidor, no de una lista escrita aquí. La que
// había en este archivo tenía 21 voces, la de Speak Chat 16, y ninguna coincidía con lo
// que AWS ofrece de verdad. Además marcaban todas `engines: ['standard']`, así que las
// voces neurales no se podían elegir aunque el cobro ya supiera cobrarlas.

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
    <div className="w-14 h-7 bg-ds-raised peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ds-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-ds-border after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-ds-surface after:border-ds-border after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-ds-accent"></div>
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

  const inputClass = "w-full px-4 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent outline-none text-sm";
  const labelClass = "text-xs font-bold text-ds-soft block mb-2";

  const { catalog: voiceCatalog } = useVoiceCatalog();

  // Voces premium del idioma y motor elegidos. Filtrar por motor importa: no todas las
  // voces hacen neural, y ofrecer una que no puede acaba en un fallo de síntesis en
  // directo.
  const compatibleVoices = premiumVoicesForLanguage(voiceCatalog, config.languageCode, config.engine);

  // Si la voz actual no está disponible con el nuevo idioma/engine, resetear
  const currentVoiceCompatible = compatibleVoices.some(v => v.id === config.voice);

  // Al cambiar de idioma se reajusta la voz de los dos catálogos: si solo se tocara
  // el del motor activo, cambiar de motor después dejaría una voz de otro idioma.
  //
  // Si no hay ninguna voz para la combinación nueva se deja vacío. Antes se conservaba
  // la anterior, y eso guardaba una voz que no puede hacer ese motor: se aceptaba sin
  // una queja y fallaba al sintetizar, en pleno directo.
  const handleLanguageChange = (langCode: string) => {
    const pollyVoices = premiumVoicesForLanguage(voiceCatalog, langCode, config.engine);
    const standardForLang = standardVoicesForLanguage(voiceCatalog, langCode);

    onChange({
      languageCode: langCode,
      voice: pollyVoices[0]?.id ?? '',
      standardVoice: standardForLang[0]?.id ?? '',
    });
  };

  // La calidad manda sobre el idioma, no al revés: hay 13 idiomas que solo existen en
  // alta calidad y 6 solo en normal. Al cambiarla se conserva el idioma si sigue estando
  // disponible; si no, se salta al primero que sí, y la pantalla lo dice.
  const handleEngineChange = (engine: 'standard' | 'neural') => {
    const availableLangs = languagesFor(voiceCatalog, 'polly', engine);
    const keepsLanguage = availableLangs.some(l => l.code === config.languageCode);
    const languageCode = keepsLanguage
      ? config.languageCode
      : (availableLangs[0]?.code ?? config.languageCode);

    const voices = premiumVoicesForLanguage(voiceCatalog, languageCode, engine);
    onChange({
      engine,
      languageCode,
      voice: voices[0]?.id ?? '',
    });
  };

  const { credits } = useTtsCredits();

  // Ausente = polly, para no cambiar lo ya configurado. "browser" es el motor viejo,
  // que ya no existe: se lee como voz estándar, que es lo que hace lo que aquella
  // prometía.
  const provider = config.provider === 'piper' || config.provider === 'browser' ? 'piper' : 'polly';
  const usingStandard = provider === 'piper';

  const voicesForThisLanguage = standardVoicesForLanguage(voiceCatalog, config.languageCode);
  const voiceMismatch = describeVoiceMismatch(voiceCatalog, config.voice, config.languageCode);

  // Los idiomas dependen de lo elegido antes: del proveedor y, en premium, también de la
  // calidad. Antes solo se miraba el proveedor, así que con alta calidad seguían saliendo
  // los idiomas que solo existen en normal y el selector de voces quedaba vacío.
  const languageOptions = usingStandard
    ? languagesFor(voiceCatalog, 'piper')
    : languagesFor(voiceCatalog, 'polly', config.engine);

  return (
    <div className={`rounded-lg border-2 transition-all ${
      config.enabled
        ? 'border-ds-accent bg-ds-accent/10 '
        : 'border-ds-border bg-ds-bg '
    }`}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🗣️</span>
          <div>
            <div className="text-sm font-bold text-ds-text 3xl:text-base">
              Text-to-Speech
            </div>
            {config.enabled && (
              <div className="text-xs text-ds-accent-text mt-0.5 3xl:text-sm">
                {usingStandard
                  ? `🆓 ${voiceCatalog.standard.voices.find(v => v.id === config.standardVoice)?.name ?? 'Voz automática'} · estándar · ${config.languageCode}`
                  : `🎙️ ${voiceCatalog.premium.voices.find(v => v.id === config.voice)?.name ?? config.voice} · ${config.engine === 'neural' ? 'alta calidad' : 'normal'} · ${languageLabel(voiceCatalog, config.languageCode)}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <Toggle checked={config.enabled} onChange={v => onChange({ enabled: v })} />
          <span className="text-sm font-bold text-ds-text 3xl:text-base">
            {config.enabled ? 'Activo' : 'Inactivo'}
          </span>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="text-ds-soft p-1"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Body - solo visible cuando expandido y habilitado */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-ds-accent">
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
                      ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok '
                      : 'bg-ds-surface border-ds-border text-ds-soft hover:border-ds-ok/40'
                  }`}
                >
                  <div className="text-sm font-bold 3xl:text-base">🆓 Voz estándar</div>
                  <div className="text-xs mt-0.5 opacity-80 3xl:text-sm">Incluida en tu plan. Suena en cualquier OBS.</div>
                </button>
                <button
                  onClick={() => onChange({ provider: 'polly' })}
                  className={`px-3 py-3 rounded-lg text-left transition-all border-2 ${
                    !usingStandard
                      ? 'bg-ds-accent/10 border-ds-accent text-ds-accent-text '
                      : 'bg-ds-surface border-ds-border text-ds-soft hover:border-ds-accent'
                  }`}
                >
                  <div className="text-sm font-bold 3xl:text-base">🎙️ Voz premium</div>
                  <div className="text-xs mt-0.5 opacity-80 3xl:text-sm">Gasta créditos premium. Más idiomas, incluido japonés.</div>
                </button>
              </div>

              {!usingStandard && (
                <p className="text-xs text-ds-soft mt-2 3xl:text-sm">
                  Si te quedas sin créditos premium la alerta no se queda muda: se lee con
                  tu voz estándar{voiceCatalog.standard.voices.length > 0 && voicesForThisLanguage.length === 0
                    ? ', y como este idioma no existe en voz estándar sonará en español'
                    : ''}.
                </p>
              )}
            </div>

            {/* Calidad primero: es lo que decide el precio y lo que recorta los idiomas */}
            {!usingStandard && (
              <div className="mb-4">
                <label className={labelClass}>Calidad</label>
                <select
                  value={config.engine}
                  onChange={e => handleEngineChange(e.target.value as 'standard' | 'neural')}
                  className={inputClass}
                >
                  <option value="standard">Normal · 1 crédito por carácter</option>
                  <option value="neural">Alta calidad · 4 créditos por carácter</option>
                </select>
                {config.engine === 'neural' && (
                  <p className="text-xs text-ds-warn mt-1 3xl:text-sm">
                    Suena bastante mejor, pero gasta cuatro veces más. Con el saldo
                    agotado, la alerta cae a voz estándar en vez de quedarse muda.
                  </p>
                )}
              </div>
            )}

            {/* Configuraciones guardadas antes de que existiera el filtro: la voz y el
                idioma pueden no cuadrar. El filtro nuevo impide crearlas, no arregla las
                que ya están, así que hay que decirlo. */}
            {!usingStandard && voiceMismatch && (
              <div className="mb-4 px-3 py-2 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-xs text-ds-warn 3xl:text-sm">
                ⚠️ {voiceMismatch}
              </div>
            )}

            {/* Idioma: depende de la calidad elegida arriba */}
            <div className="mb-4">
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
              {usingStandard ? (
                <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
                  El japonés y el coreano solo están en voz premium.
                </p>
              ) : (
                <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
                  Solo los idiomas con voces en la calidad elegida. Algunos existen en una
                  y no en la otra.
                </p>
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
                        className={config.standardVoice === v.id ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                      >
                        {v.name}
                        <span className="block text-[10px] font-normal opacity-70">
                          {v.languageName} · {v.quality}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ds-warn bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-3 3xl:text-sm">
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
                      className={config.voice === voice.id ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                      {voice.gender === 'Female' ? '👩' : '👨'} {voice.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ds-warn bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-3 3xl:text-sm">
                  ⚠️ No hay voces para este idioma en calidad {config.engine === 'neural' ? 'alta' : 'normal'}. Prueba con la otra.
                </p>
              )}
              {!currentVoiceCompatible && compatibleVoices.length > 0 && (
                <p className="text-xs text-ds-warn mt-1 3xl:text-sm">
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
                      className={config.template === preset.template ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
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
                    <span className="ml-2 text-ds-accent-text font-normal">Variables: {messageVariables}</span>
                  )}
                </label>
                {suggestedTemplate && !config.template && (
                  <button
                    onClick={applyTemplate}
                    className="text-xs px-2 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 font-bold transition-all 3xl:text-sm"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ds-soft hover:text-ds-danger p-1"
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
                  className="mt-2 w-full p-2 bg-ds-accent/10 rounded-lg border border-ds-accent text-left group hover:border-ds-accent transition-all"
                >
                  <p className="text-xs text-ds-soft 3xl:text-sm">
                    <span className="font-bold text-ds-accent-text">💡 Sugerido:</span>
                  </p>
                  <p className="text-sm text-ds-accent-text font-mono mt-1 group-hover:text-ds-accent-text 3xl:text-base">
                    "{suggestedTemplate}"
                  </p>
                  <p className="text-xs text-ds-accent-text mt-1 opacity-0 group-hover:opacity-100 transition-opacity 3xl:text-sm">
                    Click para usar este template
                  </p>
                </button>
              )}

              {/* Preview cuando hay template */}
              {config.template && (
                <div className="mt-2 p-2 bg-ds-surface rounded-lg border border-ds-accent">
                  <p className="text-xs text-ds-accent-text 3xl:text-sm">
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
                <span className="text-xs font-mono text-ds-accent-text 3xl:text-sm">{config.templateVolume ?? 80}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={config.templateVolume ?? 80}
                onChange={e => onChange({ templateVolume: Number(e.target.value) })}
                className="w-full accent-ds-accent"
              />
              <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
                Volumen del texto configurado arriba
              </p>
            </div>

            {/* Leer mensaje del usuario (solo para eventos con mensaje) */}
            {hasUserMessage && (
              <div className="p-3 bg-ds-surface rounded-lg border border-ds-accent space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-ds-text 3xl:text-sm">
                      💬 Leer mensaje del usuario
                    </div>
                    <div className="text-xs text-ds-soft mt-0.5 3xl:text-sm">
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
                        <span className="text-xs font-mono text-ds-accent-text 3xl:text-sm">{config.userMessageVolume ?? 80}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.userMessageVolume ?? 80}
                        onChange={e => onChange({ userMessageVolume: Number(e.target.value) })}
                        className="w-full accent-ds-accent"
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
                          className="flex-1 accent-ds-accent"
                        />
                        <span className="text-xs font-mono font-bold text-ds-accent-text w-12 text-right 3xl:text-sm">
                          {config.maxChars}
                        </span>
                      </div>
                      <p className="text-xs text-ds-soft mt-1 3xl:text-sm">
                        Si el mensaje supera este límite, se truncará
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Info orden de audio */}
            <div className="p-3 bg-ds-warn/10 border border-ds-warn/40 rounded-lg mb-3">
              <p className="text-xs text-ds-warn 3xl:text-sm">
                🔊 <strong>Orden de audio:</strong> 1. Sonido de alerta → 2. Audio del video → 3. TTS template → 4. TTS mensaje usuario
              </p>
            </div>

            {/* Info cache */}
            <div className="p-3 bg-ds-accent/10 border border-ds-accent rounded-lg">
              <p className="text-xs text-ds-accent-text 3xl:text-sm">
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
