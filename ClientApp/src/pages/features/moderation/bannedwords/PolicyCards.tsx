import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Field, Input, Select } from '../../../../components/ds';
import { Chip, Section, SaveBar, smallHintCls } from '../parts';
import type { ImmunityLevel, ModerationConfig, StrikeAction, StrikeExpiration } from './types';
import type { BannedWordsState } from './useBannedWords';

type MessageKey = 'warningMessage' | 'deleteMessage' | 'timeoutMessage' | 'banMessage' | 'severoMessage';

const MESSAGES: { key: MessageKey; placeholder: string; note?: boolean }[] = [
    { key: 'warningMessage', placeholder: '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5' },
    { key: 'deleteMessage', placeholder: '🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'timeoutMessage', placeholder: '⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'banMessage', placeholder: '🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'severoMessage', placeholder: '🔨 $(user), has sido baneado por usar: $(word)', note: true },
];

type StrikeKey = 'strike1Action' | 'strike2Action' | 'strike3Action' | 'strike4Action' | 'strike5Action';

const STRIKES: { key: StrikeKey; n: number; options: StrikeAction[] }[] = [
    { key: 'strike1Action', n: 1, options: ['warning', 'delete', 'timeout_30s', 'timeout_1m'] },
    { key: 'strike2Action', n: 2, options: ['delete', 'timeout_1m', 'timeout_5m', 'timeout_10m'] },
    { key: 'strike3Action', n: 3, options: ['timeout_5m', 'timeout_10m', 'timeout_30m', 'timeout_1h'] },
    { key: 'strike4Action', n: 4, options: ['timeout_10m', 'timeout_30m', 'timeout_1h', 'ban'] },
    { key: 'strike5Action', n: 5, options: ['timeout_30m', 'timeout_1h', 'ban'] },
];

function ImmunityChoice({ label, value, onChange }: { label: string; value: ImmunityLevel; onChange: (v: ImmunityLevel) => void }) {
    const { t } = useTranslation('moderation');
    const name = `immunity-${label}`;
    return (
        <div>
            <p className="ds-label mb-2">{label}</p>
            <div className="flex flex-wrap gap-6">
                <Checkbox radio name={name} label={t('banned.immunity.total')} checked={value === 'total'} onChange={() => onChange('total')} />
                <Checkbox radio name={name} label={t('banned.immunity.escalation')} checked={value === 'escalamiento'} onChange={() => onChange('escalamiento')} />
            </div>
        </div>
    );
}

/** Inmunidad por rol, whitelist manual y mensajes del bot por acción. */
export function ImmunityCard({ s }: { s: BannedWordsState }) {
    const { config, setConfig } = s;
    const set = (changes: Partial<ModerationConfig>) => setConfig({ ...config, ...changes });
    return (
        <Section title={s.t('banned.immunity.title')}>
            <div className="space-y-6">
                <Alert tone="info" title={s.t('banned.immunity.alwaysTitle')}>
                    {s.t('banned.immunity.alwaysBody')}
                </Alert>

                <ImmunityChoice label={s.t('links.who.vips')} value={config.vipImmunity} onChange={(v) => set({ vipImmunity: v })} />
                <ImmunityChoice label={s.t('links.who.subs')} value={config.subImmunity} onChange={(v) => set({ subImmunity: v })} />

                <div>
                    <p className="ds-label mb-2">{s.t('banned.whitelist.title')}</p>
                    <div className="flex gap-2 mb-2">
                        <Input
                            value={s.newWhitelistUser}
                            onChange={(e) => s.setNewWhitelistUser(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && s.addWhitelistUser()}
                            placeholder={s.t('banned.whitelist.placeholder')}
                        />
                        <Button variant="secondary" icon={<Plus />} onClick={s.addWhitelistUser}>{s.t('common.add')}</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {config.whitelistUsers.map((username) => (
                            <Chip key={username} onRemove={() => s.removeWhitelistUser(username)} removeLabel={s.t('common.remove', { name: username })}>@{username}</Chip>
                        ))}
                    </div>
                    <p className={`${smallHintCls} mt-2`}>{s.t('banned.whitelist.note')}</p>
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-bold text-ds-text">{s.t('banned.messages.title')}</p>
                    {MESSAGES.map(m => (
                        <Field key={m.key} label={s.t(`banned.messages.${m.key}`)} hint={m.note ? s.t('banned.messages.severoNote') : undefined}>
                            <Input value={config[m.key]} onChange={(e) => set({ [m.key]: e.target.value })} placeholder={m.placeholder} />
                        </Field>
                    ))}
                    <p className={smallHintCls}>{s.t('banned.messages.vars')}</p>
                </div>
            </div>
        </Section>
    );
}

/** Escala de strikes (qué pasa en cada nivel) y cuánto tardan en expirar; incluye el botón de guardar. */
export function StrikesCard({ s }: { s: BannedWordsState }) {
    const { config, setConfig } = s;
    return (
        <Section title={s.t('banned.strikes.title')}>
            <div className="space-y-6">
                <div className="max-w-md">
                    <Field label={s.t('banned.strikes.expiration')} hint={s.t('banned.strikes.expirationHint')}>
                        <Select value={config.strikeExpiration} onChange={(e) => setConfig({ ...config, strikeExpiration: e.target.value as StrikeExpiration })}>
                            <option value="5min">{s.t('banned.strikes.exp.5min')}</option>
                            <option value="10min">{s.t('banned.strikes.exp.10min')}</option>
                            <option value="15min">{s.t('banned.strikes.exp.15min')}</option>
                            <option value="30min">{s.t('banned.strikes.exp.30min')}</option>
                            <option value="1hour">{s.t('banned.strikes.exp.1hour')}</option>
                            <option value="never">{s.t('banned.strikes.exp.never')}</option>
                        </Select>
                    </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {STRIKES.map(st => (
                        <Field key={st.key} label={s.t('banned.strikes.strikeN', { n: st.n })}>
                            <Select value={config[st.key]} onChange={(e) => setConfig({ ...config, [st.key]: e.target.value as StrikeAction })}>
                                {st.options.map(value => <option key={value} value={value}>{s.t(`actions.${value}`)}</option>)}
                            </Select>
                        </Field>
                    ))}
                </div>

                <SaveBar saving={s.saving} onClick={s.saveConfig} label={s.t('common.saveSettings')} savingLabel={s.t('common.saving')} />
            </div>
        </Section>
    );
}
