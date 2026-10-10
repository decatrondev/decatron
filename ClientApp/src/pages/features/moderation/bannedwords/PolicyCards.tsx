import { Plus } from 'lucide-react';
import { Alert, Button, Checkbox, Field, Input, Select } from '../../../../components/ds';
import { Chip, Section, SaveBar, smallHintCls } from '../parts';
import type { ImmunityLevel, ModerationConfig, StrikeAction, StrikeExpiration } from './types';
import type { BannedWordsState } from './useBannedWords';

type MessageKey = 'warningMessage' | 'deleteMessage' | 'timeoutMessage' | 'banMessage' | 'severoMessage';

const MESSAGES: { key: MessageKey; label: string; placeholder: string; note?: string }[] = [
    { key: 'warningMessage', label: 'Warning (Advertencia)', placeholder: '⚠️ $(user), evita usar ese lenguaje. Strike $(strike)/5' },
    { key: 'deleteMessage', label: 'Delete (Borrar Mensaje)', placeholder: '🗑️ $(user), mensaje borrado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'timeoutMessage', label: 'Timeout (Suspensión Temporal)', placeholder: '⏱️ $(user), timeout aplicado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'banMessage', label: 'Ban (Baneo Permanente por Strikes)', placeholder: '🔨 $(user), has sido baneado por lenguaje inapropiado. Strike $(strike)/5' },
    { key: 'severoMessage', label: 'Ban por Palabra SEVERA (Ban Directo)', placeholder: '🔨 $(user), has sido baneado por usar: $(word)', note: 'Este mensaje se usa cuando detectas una palabra con severidad "Severo" (ban directo, sin strikes)' },
];

type StrikeKey = 'strike1Action' | 'strike2Action' | 'strike3Action' | 'strike4Action' | 'strike5Action';

const STRIKES: { key: StrikeKey; label: string; options: [StrikeAction, string][] }[] = [
    { key: 'strike1Action', label: 'Strike 1', options: [['warning', 'Advertencia'], ['delete', 'Borrar'], ['timeout_30s', 'Timeout 30s'], ['timeout_1m', 'Timeout 1m']] },
    { key: 'strike2Action', label: 'Strike 2', options: [['delete', 'Borrar'], ['timeout_1m', 'Timeout 1m'], ['timeout_5m', 'Timeout 5m'], ['timeout_10m', 'Timeout 10m']] },
    { key: 'strike3Action', label: 'Strike 3', options: [['timeout_5m', 'Timeout 5m'], ['timeout_10m', 'Timeout 10m'], ['timeout_30m', 'Timeout 30m'], ['timeout_1h', 'Timeout 1h']] },
    { key: 'strike4Action', label: 'Strike 4', options: [['timeout_10m', 'Timeout 10m'], ['timeout_30m', 'Timeout 30m'], ['timeout_1h', 'Timeout 1h'], ['ban', 'Ban']] },
    { key: 'strike5Action', label: 'Strike 5', options: [['timeout_30m', 'Timeout 30m'], ['timeout_1h', 'Timeout 1h'], ['ban', 'Ban']] },
];

function ImmunityChoice({ label, value, onChange }: { label: string; value: ImmunityLevel; onChange: (v: ImmunityLevel) => void }) {
    const name = `immunity-${label}`;
    return (
        <div>
            <p className="ds-label mb-2">{label}</p>
            <div className="flex flex-wrap gap-6">
                <Checkbox radio name={name} label="Inmunidad total" checked={value === 'total'} onChange={() => onChange('total')} />
                <Checkbox radio name={name} label="Entra en escalamiento" checked={value === 'escalamiento'} onChange={() => onChange('escalamiento')} />
            </div>
        </div>
    );
}

/** Inmunidad por rol, whitelist manual y mensajes del bot por acción. */
export function ImmunityCard({ s }: { s: BannedWordsState }) {
    const { config, setConfig } = s;
    const set = (changes: Partial<ModerationConfig>) => setConfig({ ...config, ...changes });
    return (
        <Section title="Sistema de Inmunidad">
            <div className="space-y-6">
                <Alert tone="info" title="Streamer, Lead Moderators y moderadores">
                    SIEMPRE tienen inmunidad total. También quien tenga control total del canal en el dashboard, aunque en el chat sea un viewer.
                </Alert>

                <ImmunityChoice label="VIPs" value={config.vipImmunity} onChange={(v) => set({ vipImmunity: v })} />
                <ImmunityChoice label="Suscriptores" value={config.subImmunity} onChange={(v) => set({ subImmunity: v })} />

                <div>
                    <p className="ds-label mb-2">Whitelist Manual</p>
                    <div className="flex gap-2 mb-2">
                        <Input
                            value={s.newWhitelistUser}
                            onChange={(e) => s.setNewWhitelistUser(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && s.addWhitelistUser()}
                            placeholder="nombre_de_usuario"
                        />
                        <Button variant="secondary" icon={<Plus />} onClick={s.addWhitelistUser}>Agregar</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {config.whitelistUsers.map((username) => (
                            <Chip key={username} onRemove={() => s.removeWhitelistUser(username)} removeLabel={`Quitar ${username}`}>@{username}</Chip>
                        ))}
                    </div>
                    <p className={`${smallHintCls} mt-2`}>Los usuarios en la whitelist SIEMPRE tienen inmunidad total</p>
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-bold text-ds-text">Mensajes Personalizados por Acción</p>
                    {MESSAGES.map(m => (
                        <Field key={m.key} label={m.label} hint={m.note}>
                            <Input value={config[m.key]} onChange={(e) => set({ [m.key]: e.target.value })} placeholder={m.placeholder} />
                        </Field>
                    ))}
                    <p className={smallHintCls}>Variables disponibles: $(user), $(strike), $(word)</p>
                </div>
            </div>
        </Section>
    );
}

/** Escala de strikes (qué pasa en cada nivel) y cuánto tardan en expirar; incluye el botón de guardar. */
export function StrikesCard({ s }: { s: BannedWordsState }) {
    const { config, setConfig } = s;
    return (
        <Section title="Sistema de Escalamiento de Strikes">
            <div className="space-y-6">
                <div className="max-w-md">
                    <Field label="Tiempo de Expiración de Strikes" hint="Los strikes disminuyen 1 nivel después del tiempo configurado sin infracciones">
                        <Select value={config.strikeExpiration} onChange={(e) => setConfig({ ...config, strikeExpiration: e.target.value as StrikeExpiration })}>
                            <option value="5min">5 minutos</option>
                            <option value="10min">10 minutos</option>
                            <option value="15min">15 minutos</option>
                            <option value="30min">30 minutos</option>
                            <option value="1hour">1 hora</option>
                            <option value="never">Nunca (permanente)</option>
                        </Select>
                    </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {STRIKES.map(st => (
                        <Field key={st.key} label={st.label}>
                            <Select value={config[st.key]} onChange={(e) => setConfig({ ...config, [st.key]: e.target.value as StrikeAction })}>
                                {st.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </Select>
                        </Field>
                    ))}
                </div>

                <SaveBar saving={s.saving} onClick={s.saveConfig} label="Guardar Configuración" savingLabel="Guardando Configuración..." />
            </div>
        </Section>
    );
}
