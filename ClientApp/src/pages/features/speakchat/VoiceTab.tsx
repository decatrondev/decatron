import { Lock } from 'lucide-react';
import FishVoiceRequestBox from '../FishVoiceRequestBox';
import { fishVoiceLabel, fishCostPer100 } from '../fishVoices';
import type { FishVoiceOption } from '../fishVoices';
import {
    standardVoicesForLanguage,
    premiumVoicesForLanguage,
    languagesFor,
    describeVoiceMismatch,
} from '../../../components/tts/useVoiceCatalog';
import type { VoiceCatalog } from '../../../components/tts/useVoiceCatalog';
import { cardClass, inputClass, labelClass, usageDateLabels } from './shared';
import type { ConfigProps, CreditUsage } from './types';

interface VoiceTabProps extends ConfigProps {
    usage: CreditUsage | null;
    voiceCatalog: VoiceCatalog;
    fishVoices: FishVoiceOption[];
    fishCreditsPerByte: number;
    reloading: boolean;
    reloadOverlays: () => void;
}

export default function VoiceTab({ config, setConfig, usage, voiceCatalog, fishVoices, fishCreditsPerByte, reloading, reloadOverlays }: VoiceTabProps) {
    // Polly depende de tener créditos, no del tier: una cuenta free con créditos
    // comprados o de la transición puede usarlo.
    const isPollyAvailable = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);

    // Catálogo de voces estándar, servido por el servidor: igual para todo el mundo
    const standardVoicesForLang = standardVoicesForLanguage(voiceCatalog, config.voice.languageCode);
    // Filtradas por la calidad elegida: no todas las voces hacen neural, y ofrecer una
    // que no puede acabaría en un fallo de síntesis en pleno directo.
    const premiumVoicesForLang = premiumVoicesForLanguage(
        voiceCatalog, config.voice.languageCode, config.voice.pollyEngine);

    // Los idiomas dependen de lo elegido antes: del proveedor y, en premium, también de
    // la calidad. Hay 13 idiomas que solo existen en alta calidad y 6 solo en normal, así
    // que sin filtrar por ella se puede elegir un idioma sin ninguna voz detrás.
    const languageOptions = config.voice.engine === 'polly'
        ? languagesFor(voiceCatalog, 'polly', config.voice.pollyEngine)
        : languagesFor(voiceCatalog, 'piper');

    // Configuraciones guardadas antes del filtro: la voz puede ser de otro idioma. El
    // filtro nuevo impide crear esas combinaciones, no arregla las que ya existen.
    const voiceMismatch = describeVoiceMismatch(
        voiceCatalog, config.voice.pollyVoice, config.voice.languageCode);

    // Cambiar la calidad puede dejar el idioma sin voces. Se conserva si sigue estando y,
    // si no, se salta al primero disponible: nunca se guarda una combinación imposible.
    const changePollyEngine = (pollyEngine: 'standard' | 'neural') => {
        const langs = languagesFor(voiceCatalog, 'polly', pollyEngine);
        const keeps = langs.some(l => l.code === config.voice.languageCode);
        const languageCode = keeps ? config.voice.languageCode : (langs[0]?.code ?? config.voice.languageCode);
        const firstVoice = premiumVoicesForLanguage(voiceCatalog, languageCode, pollyEngine)[0];

        setConfig(c => ({
            ...c,
            voice: {
                ...c.voice,
                pollyEngine,
                languageCode,
                pollyVoice: firstVoice?.id ?? '',
            }
        }));
    };

    // Créditos Polly restantes
    const charsLeft = usage && !usage.isUnlimited ? usage.totalAvailable : null;
    const creditsExhausted = charsLeft !== null && charsLeft === 0;
    const creditsLow = charsLeft !== null && !creditsExhausted &&
        usage!.monthlyGranted > 0 && usage!.percentage >= 85 && usage!.purchasedBalance === 0;

    const { transitionEndsLabel, tierExpiryLabel } = usageDateLabels(usage);

    return (
        <div className="space-y-6">
            {/* Recarga de overlays. Se actualizan solos al detectar un despliegue
                nuevo; el botón es para no esperar. */}
            <div className={cardClass}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="font-bold text-ds-text">
                            El audio se genera en el servidor
                        </p>
                        <p className="text-xs text-ds-soft mt-1">
                            Con voz estándar o premium sale siempre un MP3, así que suena en cualquier
                            OBS sin depender de las voces que tenga instaladas ese equipo.
                        </p>
                    </div>
                    <button
                        onClick={reloadOverlays}
                        disabled={reloading}
                        className="ds-btn ds-btn--secondary"
                        title="Los overlays se actualizan solos, pero esto lo hace al instante"
                    >
                        {reloading ? '♻️ Recargando…' : '♻️ Recargar overlays'}
                    </button>
                </div>
            </div>

            {/* Plan badge */}
            <div className={`${cardClass} ${
                isPollyAvailable
                    ? 'border-ds-accent bg-ds-accent/10 '
                    : ''
            }`}>
                <div className="flex items-start gap-4">
                    {isPollyAvailable
                        ? <div className="text-3xl">🎙️</div>
                        : <Lock className="w-8 h-8 text-ds-soft flex-shrink-0 mt-1" />
                    }
                    <div className="flex-1">
                        <p className="font-bold text-ds-text">
                            {usage?.isUnlimited
                                ? `Plan ${usage.tier} — créditos ilimitados`
                                : isPollyAvailable
                                    ? `${(usage?.totalAvailable ?? 0).toLocaleString()} créditos premium disponibles`
                                    : 'Sin créditos premium'
                            }
                        </p>
                        <p className="text-xs text-ds-soft mt-1">
                            {usage?.isUnlimited
                                ? 'Las voces de AWS Polly suenan en cualquier OBS.'
                                : isPollyAvailable
                                    ? `Cada carácter consume créditos premium (las tarifas vigentes están en la página de créditos). ${usage!.monthlyUsed.toLocaleString()} usados este mes de ${usage!.monthlyGranted.toLocaleString()} de tu plan${usage!.purchasedBalance > 0 ? `, más ${usage!.purchasedBalance.toLocaleString()} comprados que no caducan` : ''}.`
                                    : 'Los créditos premium abren las voces de Polly, con más idiomas y japonés. La voz estándar sigue funcionando sin ellos.'
                            }
                        </p>
                        {usage && !usage.isUnlimited && usage.standardGranted > 0 && (
                            <p className="text-xs text-ds-ok mt-1 font-bold">
                                🆓 Voz estándar: {usage.standardRemaining.toLocaleString()} de {usage.standardGranted.toLocaleString()} caracteres este mes, incluidos en tu plan.
                            </p>
                        )}
                        {isPollyAvailable && !usage?.isUnlimited && creditsLow && (
                            <p className="text-xs mt-1 font-bold text-ds-warn">
                                ⚠️ Te queda poco saldo premium — al agotarse tendrás que cambiar a voz estándar.
                            </p>
                        )}
                        {creditsExhausted && (
                            <p className="text-xs mt-1 font-bold text-ds-danger">
                                ❌ Sin créditos premium. Se seguirá leyendo con voz estándar hasta tu cuota del día 1.
                            </p>
                        )}
                        {config.voice.engine === 'polly' && (
                            <p className="text-xs text-ds-soft mt-1">
                                Si te quedas sin créditos premium el chat no se queda mudo: se lee con voz estándar.
                                {config.voice.languageCode.startsWith('ja') && ' Como el japonés no existe en voz estándar, sonará en español.'}
                            </p>
                        )}
                        {usage?.inTransitionWindow && usage.tier === 'free' && transitionEndsLabel && (
                            <p className="text-xs text-ds-accent-text mt-1">
                                🎁 Créditos de bienvenida hasta el {transitionEndsLabel}. Después de esa fecha
                                necesitarás un plan o un paquete de créditos para seguir usando Polly.
                            </p>
                        )}
                        {isPollyAvailable && tierExpiryLabel && (
                            <p className="text-xs text-ds-warn mt-1">
                                ⏳ Tu plan vence el {tierExpiryLabel}. Los créditos comprados no se pierden.
                            </p>
                        )}
                        {isPollyAvailable && usage && !usage.isUnlimited && usage.monthlyGranted > 0 && (
                            <div className="mt-3 h-2 bg-ds-raised rounded-full overflow-hidden w-64">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        usage.percentage > 90 ? 'bg-ds-danger-solid' : usage.percentage > 70 ? 'bg-ds-warn' : 'bg-ds-accent'
                                    }`}
                                    style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={cardClass}>
                <div className="space-y-6">
                    {/* Motor */}
                    <div>
                        <label className={labelClass}>Motor de voz</label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { id: 'piper', label: '🆓 Voz estándar', available: true },
                                { id: 'polly', label: '🎙️ Voz premium', available: !!isPollyAvailable },
                                { id: 'fish', label: '🎭 Voz de personaje', available: !!isPollyAvailable },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => opt.available && setConfig(c => ({ ...c, voice: { ...c.voice, engine: opt.id as any } }))}
                                    disabled={!opt.available}
                                    className={`flex-1 min-w-[10rem] py-3 px-4 rounded-lg border-2 text-sm font-bold transition-all ${
                                        config.voice.engine === opt.id
                                            ? 'border-ds-accent bg-ds-accent/10 text-ds-accent-text'
                                            : opt.available
                                                ? 'border-ds-border text-ds-soft hover:border-ds-faint'
                                                : 'border-ds-border text-ds-soft opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    {opt.label} {!opt.available && <Lock className="w-3 h-3 inline ml-1" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {config.voice.engine === 'polly' && voiceMismatch && (
                        <div className="px-3 py-2 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-xs text-ds-warn">
                            ⚠️ {voiceMismatch}
                        </div>
                    )}

                    {/* Calidad primero: decide el precio y recorta los idiomas */}
                    {config.voice.engine === 'polly' && (
                        <div>
                            <label className={labelClass}>Calidad</label>
                            <select
                                value={config.voice.pollyEngine}
                                onChange={e => changePollyEngine(e.target.value as 'standard' | 'neural')}
                                className={inputClass}
                            >
                                <option value="standard">Normal</option>
                                <option value="neural">Alta calidad · cuesta más que Normal</option>
                            </select>
                            {config.voice.pollyEngine === 'neural' && (
                                <p className="text-xs text-ds-warn mt-1">
                                    Suena mucho mejor, pero cada mensaje gasta cuatro veces más.
                                    Speak Chat lee mucho: revisa el saldo antes de dejarlo puesto.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Idioma: depende de la calidad elegida arriba */}
                    <div>
                        <label className={labelClass}>Idioma</label>
                        <select
                            value={config.voice.languageCode}
                            onChange={e => {
                                const lang = e.target.value;
                                // Al cambiar de idioma se reasignan las dos voces. Dejar la
                                // anterior es lo que producía "voz japonesa, idioma español".
                                const firstPremium = premiumVoicesForLanguage(
                                    voiceCatalog, lang, config.voice.pollyEngine)[0];
                                const firstStandard = standardVoicesForLanguage(voiceCatalog, lang)[0];
                                setConfig(c => ({
                                    ...c,
                                    voice: {
                                        ...c.voice,
                                        languageCode: lang,
                                        pollyVoice: firstPremium?.id ?? '',
                                        standardVoice: firstStandard?.id ?? '',
                                    }
                                }));
                            }}
                            className={inputClass}
                        >
                            {languageOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                        {config.voice.engine === 'fish' ? (
                            <p className="text-xs text-ds-soft mt-1">
                                La voz de personaje habla con su propio idioma. Este idioma se usa si hay que
                                leer el mensaje con la voz estándar de respaldo.
                            </p>
                        ) : config.voice.engine !== 'polly' ? (
                            <p className="text-xs text-ds-soft mt-1">
                                El japonés y el coreano solo están en voz premium.
                            </p>
                        ) : (
                            <p className="text-xs text-ds-soft mt-1">
                                Solo los idiomas con voces en la calidad elegida. Algunos existen
                                en una y no en la otra.
                            </p>
                        )}
                    </div>

                    {/* Voz — el catálogo depende del motor */}
                    {config.voice.engine === 'fish' ? (
                        <div>
                            <label className={labelClass}>Voz de personaje</label>
                            <select
                                value={config.voice.fishVoice || fishVoices[0]?.id || ''}
                                onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, fishVoice: e.target.value } }))}
                                className={inputClass}
                            >
                                {fishVoices.length === 0 && <option value="">No hay voces de personaje disponibles</option>}
                                {fishVoices.map(v => <option key={v.id} value={v.id}>{fishVoiceLabel(v)}</option>)}
                            </select>
                            <p className="text-xs text-ds-soft mt-1">
                                Gasta créditos premium{fishCreditsPerByte > 0 ? ` (unos ${fishCostPer100(fishCreditsPerByte)} cada 100 caracteres)` : ''}, más que la voz estándar. Si te quedas sin créditos
                                o la voz falla, el chat no se queda mudo: se lee con voz estándar.
                            </p>
                            <FishVoiceRequestBox />
                        </div>
                    ) : config.voice.engine === 'polly' ? (
                        <div>
                            <label className={labelClass}>Voz (AWS Polly)</label>
                            <select
                                value={config.voice.pollyVoice}
                                onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, pollyVoice: e.target.value } }))}
                                className={inputClass}
                            >
                                {premiumVoicesForLang.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.name}{v.gender ? ` · ${v.gender === 'Female' ? 'F' : 'M'}` : ''}
                                    </option>
                                ))}
                            </select>
                            {premiumVoicesForLang.length === 0 && (
                                <p className="text-xs text-ds-warn mt-1">
                                    No hay voces para este idioma en calidad{' '}
                                    {config.voice.pollyEngine === 'neural' ? 'alta' : 'normal'}. Prueba con la otra.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className={labelClass}>
                                Voz estándar
                                {standardVoicesForLang.length > 0 && (
                                    <span className="font-normal normal-case ml-1">
                                        ({standardVoicesForLang.length} para este idioma)
                                    </span>
                                )}
                            </label>

                            {standardVoicesForLang.length === 0 ? (
                                <div className="px-4 py-3 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-xs text-ds-warn">
                                    No hay voces estándar para este idioma. Cambia de idioma o usa voz premium.
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={config.voice.standardVoice}
                                        onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, standardVoice: e.target.value } }))}
                                        className={inputClass}
                                    >
                                        <option value="">Automática (la primera del idioma)</option>
                                        {standardVoicesForLang.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name} — {v.languageName} ({v.quality})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-ds-soft mt-1">
                                        Se generan en el servidor, así que suenan igual en cualquier OBS.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Volumen */}
                    <div>
                        <label className={labelClass}>Volumen — {config.voice.volume}%</label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={config.voice.volume}
                            onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, volume: parseInt(e.target.value) } }))}
                            className="w-full accent-ds-accent"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
