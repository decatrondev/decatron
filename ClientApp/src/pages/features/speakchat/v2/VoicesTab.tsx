// Voces: la voz con la que lee el canal (motor, calidad, idioma, voz y volumen). Los comandos pueden traer la suya (pestaña Comandos).
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Card, Field, Slider, inputClass } from '../../../../components/overlay-editor/ui';
import FishVoiceRequestBox from '../../FishVoiceRequestBox';
import { fishVoiceLabel, fishCostPer100 } from '../../fishVoices';
import type { FishVoiceOption } from '../../fishVoices';
import {
    standardVoicesForLanguage, premiumVoicesForLanguage, languagesFor, describeVoiceMismatch,
} from '../../../../components/tts/useVoiceCatalog';
import type { VoiceCatalog } from '../../../../components/tts/useVoiceCatalog';
import type { SpeakChatState } from './useSpeakChatConfig';

interface Props {
    sc: SpeakChatState;
    voiceCatalog: VoiceCatalog;
    fishVoices: FishVoiceOption[];
    fishCreditsPerByte: number;
}

export default function VoicesTab({ sc, voiceCatalog, fishVoices, fishCreditsPerByte }: Props) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig, usage } = sc;
    const v = config.voice;
    // Las voces de pago dependen de tener créditos, no del rango: una cuenta free con créditos comprados puede usarlas
    const paidAvailable = !!usage && (usage.isUnlimited || usage.totalAvailable > 0);

    const standardVoices = standardVoicesForLanguage(voiceCatalog, v.languageCode);
    // Filtradas por la calidad: no todas las voces hacen neural, y ofrecer una que no puede acabaría en un fallo en pleno directo
    const premiumVoices = premiumVoicesForLanguage(voiceCatalog, v.languageCode, v.pollyEngine);
    // Los idiomas dependen del proveedor y, en premium, de la calidad (13 existen solo en alta y 6 solo en normal)
    const languageOptions = v.engine === 'polly' ? languagesFor(voiceCatalog, 'polly', v.pollyEngine) : languagesFor(voiceCatalog, 'piper');
    const mismatch = describeVoiceMismatch(voiceCatalog, v.pollyVoice, v.languageCode);

    // Cambiar la calidad puede dejar el idioma sin voces: se conserva si sigue estando y, si no, se salta al primero disponible
    const changePollyEngine = (pollyEngine: 'standard' | 'neural') => {
        const langs = languagesFor(voiceCatalog, 'polly', pollyEngine);
        const keeps = langs.some(l => l.code === v.languageCode);
        const languageCode = keeps ? v.languageCode : (langs[0]?.code ?? v.languageCode);
        const first = premiumVoicesForLanguage(voiceCatalog, languageCode, pollyEngine)[0];
        setConfig(c => ({ ...c, voice: { ...c.voice, pollyEngine, languageCode, pollyVoice: first?.id ?? '' } }));
    };

    const changeLanguage = (lang: string) => {
        // Al cambiar de idioma se reasignan las dos voces: dejar la anterior producía «voz japonesa, idioma español»
        const firstPremium = premiumVoicesForLanguage(voiceCatalog, lang, v.pollyEngine)[0];
        const firstStandard = standardVoicesForLanguage(voiceCatalog, lang)[0];
        setConfig(c => ({ ...c, voice: { ...c.voice, languageCode: lang, pollyVoice: firstPremium?.id ?? '', standardVoice: firstStandard?.id ?? '' } }));
    };

    const engines = [
        { id: 'piper' as const, label: t('v2.engine.piper'), hint: t('v2.voices.piperHint'), available: true },
        { id: 'polly' as const, label: t('v2.engine.polly'), hint: t('v2.voices.pollyHint'), available: paidAvailable },
        { id: 'fish' as const, label: t('v2.engine.fish'), hint: t('v2.voices.fishHint'), available: paidAvailable },
    ];

    return (
        <div className="space-y-6">
            <Card title={t('v2.voices.engineTitle')} description={t('v2.voices.engineDescription')}>
                <div role="radiogroup" aria-label={t('v2.voices.engineTitle')} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {engines.map(e => (
                        <button key={e.id} type="button" role="radio" aria-checked={v.engine === e.id} disabled={!e.available}
                            onClick={() => setConfig(c => ({ ...c, voice: { ...c.voice, engine: e.id } }))}
                            className={`text-left rounded-lg border-2 p-4 transition-all ${v.engine === e.id ? 'border-ds-accent bg-ds-accent/10' : 'border-ds-border hover:border-ds-faint'} ${e.available ? '' : 'opacity-50 cursor-not-allowed'}`}>
                            <span className="flex items-center gap-2 text-sm 3xl:text-base font-bold text-ds-text">
                                {e.label} {!e.available && <Lock className="w-3.5 h-3.5" aria-hidden />}
                            </span>
                            <span className="block text-xs 3xl:text-sm text-ds-soft mt-1">{e.available ? e.hint : t('v2.voices.needCredits')}</span>
                        </button>
                    ))}
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft mt-4">{t('v2.voices.serverAudio')}</p>
                {v.engine !== 'piper' && <p className="text-xs 3xl:text-sm text-ds-soft mt-1">{t('v2.voices.fallback')}</p>}
            </Card>

            <Card title={t('v2.voices.voiceTitle')}>
                <div className="space-y-5">
                    {v.engine === 'polly' && mismatch && (
                        <div className="rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-3 py-2 text-xs 3xl:text-sm text-ds-warn">{mismatch}</div>
                    )}

                    {v.engine === 'polly' && (
                        <Field label={t('v2.voices.quality')} hint={v.pollyEngine === 'neural' ? t('v2.voices.qualityHigh') : undefined}>
                            <select value={v.pollyEngine} onChange={e => changePollyEngine(e.target.value as 'standard' | 'neural')} className={inputClass}>
                                <option value="standard">{t('v2.voices.qualityNormalOption')}</option>
                                <option value="neural">{t('v2.voices.qualityHighOption')}</option>
                            </select>
                        </Field>
                    )}

                    <Field label={t('v2.voices.language')}
                        hint={v.engine === 'fish' ? t('v2.voices.languageFish') : v.engine === 'polly' ? t('v2.voices.languagePolly') : t('v2.voices.languagePiper')}>
                        <select value={v.languageCode} onChange={e => changeLanguage(e.target.value)} className={inputClass}>
                            {languageOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                    </Field>

                    {v.engine === 'fish' && (
                        <div>
                            <Field label={t('v2.engine.fish')}
                                hint={t('v2.voices.fishCost', { about: fishCreditsPerByte > 0 ? t('v2.voices.fishCostAbout', { cost: fishCostPer100(fishCreditsPerByte) }) : '' })}>
                                <select value={v.fishVoice || fishVoices[0]?.id || ''} onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, fishVoice: e.target.value } }))} className={inputClass}>
                                    {fishVoices.length === 0 && <option value="">{t('v2.voices.noFishVoices')}</option>}
                                    {fishVoices.map(f => <option key={f.id} value={f.id}>{fishVoiceLabel(f)}</option>)}
                                </select>
                            </Field>
                            <FishVoiceRequestBox />
                        </div>
                    )}

                    {v.engine === 'polly' && (
                        <Field label={t('v2.voices.pollyVoice')}>
                            <select value={v.pollyVoice} onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, pollyVoice: e.target.value } }))} className={inputClass}>
                                {premiumVoices.map(p => <option key={p.id} value={p.id}>{p.name}{p.gender ? ` · ${p.gender === 'Female' ? 'F' : 'M'}` : ''}</option>)}
                            </select>
                            {premiumVoices.length === 0 && (
                                <p className="text-xs 3xl:text-sm text-ds-warn mt-1">{t('v2.voices.noPremiumVoices', { quality: v.pollyEngine === 'neural' ? t('v2.voices.qualityHighWord') : t('v2.voices.qualityNormalWord') })}</p>
                            )}
                        </Field>
                    )}

                    {v.engine === 'piper' && (
                        standardVoices.length === 0 ? (
                            <div className="rounded-lg border border-ds-warn/40 bg-ds-warn/10 px-4 py-3 text-xs 3xl:text-sm text-ds-warn">{t('v2.voices.noStandardVoices')}</div>
                        ) : (
                            <Field label={t('v2.voices.standardVoice', { count: standardVoices.length })} hint={t('v2.voices.standardHint')}>
                                <select value={v.standardVoice} onChange={e => setConfig(c => ({ ...c, voice: { ...c.voice, standardVoice: e.target.value } }))} className={inputClass}>
                                    <option value="">{t('v2.voices.automatic')}</option>
                                    {standardVoices.map(s => <option key={s.id} value={s.id}>{s.name} — {s.languageName} ({s.quality})</option>)}
                                </select>
                            </Field>
                        )
                    )}

                    <Field label={t('v2.voices.volume')}>
                        <Slider value={v.volume} min={0} max={100} suffix="%" onChange={n => setConfig(c => ({ ...c, voice: { ...c.voice, volume: n } }))} />
                    </Field>
                </div>
            </Card>
        </div>
    );
}
