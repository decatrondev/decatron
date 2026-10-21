// Voz propia de un comando de Speak Chat (!goku, !narrador…): motor, voz, qué hacer sin saldo y enfriamientos.
import { useTranslation } from 'react-i18next';
import { fishVoiceLabel } from '../fishVoices';
import type { FishVoiceOption } from '../fishVoices';
import { premiumVoicesForLanguage, standardVoicesForLanguage } from '../../../components/tts/useVoiceCatalog';
import type { VoiceCatalog } from '../../../components/tts/useVoiceCatalog';
import { inputClass, labelClass } from './shared';
import type { ActivationRule, RuleVoice, SpeakChatConfigData } from './types';

interface Props {
    rule: ActivationRule;
    config: SpeakChatConfigData;
    voiceCatalog: VoiceCatalog;
    fishVoices: FishVoiceOption[];
    /** Hay créditos para voces de pago (premium y de personaje). */
    paidAvailable: boolean;
    onChange: (patch: Partial<ActivationRule>) => void;
}

interface FieldsProps extends Props {}

/** Motor, voz y qué hacer sin saldo. El comando ya tiene voz propia: no hay casilla para activarla. */
export function RuleVoiceFields({ rule, config, voiceCatalog, fishVoices, paidAvailable, onChange }: FieldsProps) {
    const { t } = useTranslation('speakchat');
    const voice = rule.voice;
    const lang = config.voice.languageCode;
    const standardVoices = standardVoicesForLanguage(voiceCatalog, lang);
    const premiumVoices = premiumVoicesForLanguage(voiceCatalog, lang, config.voice.pollyEngine);

    const setEngine = (engine: RuleVoice['engine']) => {
        const next: RuleVoice = { engine };
        if (engine === 'piper') next.standardVoice = standardVoices[0]?.id ?? '';
        if (engine === 'polly') next.pollyVoice = premiumVoices[0]?.id ?? '';
        if (engine === 'fish') next.fishVoice = fishVoices[0]?.id ?? '';
        onChange({ voice: next });
    };

    if (!voice) return null;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>{t('commandVoice.engine')}</label>
                <select value={voice.engine} onChange={e => setEngine(e.target.value as RuleVoice['engine'])} className={inputClass}>
                    <option value="piper">{t('commandVoice.piper')}</option>
                    <option value="polly" disabled={!paidAvailable}>{t('commandVoice.polly')}</option>
                    <option value="fish" disabled={!paidAvailable}>{t('commandVoice.fish')}</option>
                </select>
                {!paidAvailable && <p className="text-xs text-ds-soft mt-1">{t('commandVoice.needCredits')}</p>}
            </div>

            <div>
                <label className={labelClass}>{t('commandVoice.voice')}</label>
                {voice.engine === 'piper' && (
                    <select value={voice.standardVoice ?? ''} onChange={e => onChange({ voice: { ...voice, standardVoice: e.target.value } })} className={inputClass}>
                        {standardVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                )}
                {voice.engine === 'polly' && (
                    <select value={voice.pollyVoice ?? ''} onChange={e => onChange({ voice: { ...voice, pollyVoice: e.target.value } })} className={inputClass}>
                        {premiumVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                )}
                {voice.engine === 'fish' && (
                    <select value={voice.fishVoice ?? ''} onChange={e => onChange({ voice: { ...voice, fishVoice: e.target.value } })} className={inputClass}>
                        {fishVoices.map(v => <option key={v.id} value={v.id}>{fishVoiceLabel(v)}</option>)}
                    </select>
                )}
            </div>

            {voice.engine !== 'piper' && (
                <div className="sm:col-span-2">
                    <label className={labelClass}>{t('commandVoice.noBalance')}</label>
                    <select value={rule.noBalance ?? 'silence'} onChange={e => onChange({ noBalance: e.target.value as 'silence' | 'standard' })} className={inputClass}>
                        <option value="silence">{t('commandVoice.noBalanceSilence')}</option>
                        <option value="standard">{t('commandVoice.noBalanceStandard')}</option>
                    </select>
                    <p className="text-xs text-ds-soft mt-1">{t('commandVoice.noBalanceHint')}</p>
                </div>
            )}
        </div>
    );
}

/** Enfriamientos propios del comando; vacíos heredan los del canal. */
export function RuleCooldownFields({ rule, config, onChange }: Pick<Props, 'rule' | 'config' | 'onChange'>) {
    const { t } = useTranslation('speakchat');
    const num = (v: string): number | undefined => (v.trim() === '' ? undefined : Math.max(0, parseInt(v) || 0));
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className={labelClass}>{t('commandVoice.cooldown')}</label>
                <input type="number" min={0} value={rule.cooldownSeconds ?? ''}
                    placeholder={t('commandVoice.inherits', { value: config.filters.globalCooldownSeconds })}
                    onChange={e => onChange({ cooldownSeconds: num(e.target.value) })} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>{t('commandVoice.cooldownUser')}</label>
                <input type="number" min={0} value={rule.perUserCooldownSeconds ?? ''}
                    placeholder={t('commandVoice.inherits', { value: config.filters.perUserCooldownSeconds })}
                    onChange={e => onChange({ perUserCooldownSeconds: num(e.target.value) })} className={inputClass} />
            </div>
        </div>
    );
}
