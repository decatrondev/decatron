/**
 * SettingsExtras - Opciones configurables del giveaway que van en `settings`:
 * mensajes del bot, avisos de rechazo, topes de peso, recordatorios, anti cuentas duplicadas y roles.
 * Los campos de texto vacíos usan el texto por defecto (se muestra como guía).
 */

import React, { useEffect, useState } from 'react';
import { MessageSquare, ShieldAlert, Scale, BellRing, Users, UserCog, Globe2, Check, X } from 'lucide-react';
import api from '../../../../../services/api';
import type { GiveawaySettings, PlatformCapabilities } from '../../types';
import { DEFAULT_SETTINGS_TEXTS, REJECTION_REASONS, CAPABILITY_LABELS, PLATFORM_LABELS } from '../../types';

interface SettingsExtrasProps {
    settings: GiveawaySettings;
    onUpdateSettings: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

const MESSAGE_FIELDS: { key: keyof GiveawaySettings['messages']; label: string; hint: string; vars: string }[] = [
    { key: 'joined', label: 'Alguien se une', hint: 'Se envía si «Mostrar contador de participantes» está activo', vars: '{user} {count} {prize} {command}' },
    { key: 'winnerResponded', label: 'El ganador responde', hint: 'Cuando responde y aún faltan otros ganadores', vars: '{winner} {prize}' },
    { key: 'completed', label: 'Giveaway completado', hint: 'Cuando responde el último ganador o vence el último plazo', vars: '{responded} {total} {winner} {prize}' },
    { key: 'promoted', label: 'Un respaldo pasa a ganador', hint: 'Cuando el ganador no responde y entra el siguiente', vars: '{winner} {timeout} {prize}' },
    { key: 'noParticipants', label: 'Sin participantes', hint: 'Cuando termina sin nadie válido y se cancela solo', vars: '{reason} {prize}' },
    { key: 'cancelled', label: 'Cancelado por el streamer', hint: 'Vacío = no se avisa al chat (como hasta ahora)', vars: '{reason} {prize}' },
];

const NumberField: React.FC<{
    label: string;
    hint?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step, onChange }) => (
    <div>
        <label className="block text-sm font-bold text-ds-soft mb-2">{label}</label>
        <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange(Number.isFinite(n) ? n : 0);
            }}
            className="ds-input w-full"
        />
        {hint && <p className="text-xs text-ds-soft mt-1">{hint}</p>}
    </div>
);

const Toggle: React.FC<{ title: string; hint: string; value: boolean; onChange: (v: boolean) => void; on?: string; off?: string }> = ({
    title, hint, value, onChange, on = 'Activado', off = 'Desactivado',
}) => (
    <div className="flex items-center justify-between gap-4 p-4 bg-ds-bg rounded-lg border border-ds-border">
        <div>
            <p className="font-bold text-ds-text">{title}</p>
            <p className="text-xs text-ds-soft">{hint}</p>
        </div>
        <button onClick={() => onChange(!value)} className={value ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
            {value ? on : off}
        </button>
    </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; text?: string }> = ({ icon, title, text }) => (
    <div>
        <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">{icon}{title}</h3>
        {text && <p className="text-sm text-ds-soft mt-1">{text}</p>}
    </div>
);

/** Dónde se puede participar + qué se puede comprobar en cada plataforma (la tabla viene del servidor). */
const PlatformsSection: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    const [caps, setCaps] = useState<PlatformCapabilities | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/giveaway/platforms')
            .then((res) => {
                if (cancelled) return;
                if (res.data?.success) setCaps(res.data as PlatformCapabilities);
                else setFailed(true);
            })
            .catch(() => !cancelled && setFailed(true));
        return () => { cancelled = true; };
    }, []);

    const platforms = caps?.supported ? Object.keys(caps.supported) : [];
    const kickLinked = caps?.linked?.kick ?? false;
    const rules = settings.platforms;

    return (
        <div className="space-y-4">
            <SectionTitle
                icon={<Globe2 className="w-5 h-5 text-ds-accent-text" />}
                title="Dónde se puede participar"
                text="Cada plataforma comprueba lo que su API permite. Lo que no se pueda comprobar en una plataforma se muestra abajo y lo decides tú."
            />
            <Toggle title="Twitch" hint="Se comprueba todo: seguidor, suscripción, edad de cuenta, tiempo viendo y mensajes"
                value={rules.twitch} onChange={(v) => onUpdateSettings('platforms', { twitch: v })} on="Acepta" off="No acepta" />
            <Toggle title="Kick"
                hint={kickLinked ? 'Solo se comprueban los roles; el resto aparece como «no verificable» en la tabla'
                    : 'Esta cuenta no tiene Kick vinculado: vincúlalo en tu perfil para poder activarlo'}
                value={rules.kick && kickLinked}
                onChange={(v) => kickLinked && onUpdateSettings('platforms', { kick: v })} on="Acepta" off="No acepta" />

            {failed && <p className="text-xs text-ds-soft">No se pudo cargar la tabla de verificación. Los interruptores funcionan igual.</p>}

            {caps?.supported && caps.capabilities && (
                <div className="overflow-x-auto rounded-lg border border-ds-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-ds-bg text-left text-ds-soft">
                                <th className="p-3 font-bold">Qué se comprueba</th>
                                {platforms.map((p) => <th key={p} className="p-3 font-bold text-center">{PLATFORM_LABELS[p] ?? p}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {caps.capabilities.map((c) => (
                                <tr key={c} className="border-t border-ds-border">
                                    <td className="p-3">
                                        <p className="text-ds-text">{CAPABILITY_LABELS[c]?.label ?? c}</p>
                                        <p className="text-xs text-ds-soft">{CAPABILITY_LABELS[c]?.hint}</p>
                                    </td>
                                    {platforms.map((p) => {
                                        const ok = caps.supported[p]?.includes(c);
                                        return (
                                            <td key={p} className="p-3 text-center">
                                                {ok
                                                    ? <span className="inline-flex items-center gap-1 text-green-500"><Check className="w-4 h-4" />Sí</span>
                                                    : <span className="inline-flex items-center gap-1 text-ds-soft"><X className="w-4 h-4" />No verificable</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="p-4 bg-ds-bg rounded-lg border border-ds-border space-y-2">
                <p className="font-bold text-ds-text">Si un requisito no se puede comprobar en la plataforma del viewer</p>
                <p className="text-xs text-ds-soft">Por ejemplo, «Debe seguir el canal» para alguien que escribe desde Kick.</p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => onUpdateSettings('platforms', { unverifiable: 'allow' })}
                        className={rules.unverifiable === 'allow' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
                        Omitir el requisito y dejarlo entrar
                    </button>
                    <button onClick={() => onUpdateSettings('platforms', { unverifiable: 'reject' })}
                        className={rules.unverifiable === 'reject' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>
                        Rechazarlo
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Marco común de las pestañas: encabezado con icono, título y subtítulo, como el resto del panel. */
export const TabShell: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
    <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
            <div className="p-3 bg-ds-raised rounded-lg">{icon}</div>
            <div>
                <h2 className="text-2xl font-black text-ds-text">{title}</h2>
                <p className="text-sm text-ds-soft">{subtitle}</p>
            </div>
        </div>
        {children}
    </div>
);

/** Pestaña «Plataformas»: dónde se puede participar y qué se puede comprobar en cada una. */
export const PlatformsTab: React.FC<SettingsExtrasProps> = (props) => (
    <TabShell icon={<Globe2 className="w-6 h-6 text-ds-text" />} title="Plataformas" subtitle="Dónde se puede participar y qué se puede comprobar en cada plataforma">
        <PlatformsSection {...props} />
    </TabShell>
);

/** Pestaña «Mensajes»: lo que dice el bot y los avisos de rechazo. */
export const MessagesTab: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => (
    <TabShell icon={<MessageSquare className="w-6 h-6 text-ds-text" />} title="Mensajes del bot" subtitle="Textos del chat y avisos cuando alguien no puede entrar">
        <>
            {/* Mensajes del bot */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<MessageSquare className="w-5 h-5 text-ds-accent-text" />}
                    title="Otros mensajes del bot"
                    text="Déjalos vacíos para usar el texto por defecto (aparece como guía en cada campo)."
                />
                <div className="space-y-4">
                    {MESSAGE_FIELDS.map((f) => (
                        <div key={f.key}>
                            <label className="block text-sm font-bold text-ds-soft mb-1">{f.label}</label>
                            <textarea
                                value={settings.messages[f.key]}
                                onChange={(e) => onUpdateSettings('messages', { [f.key]: e.target.value })}
                                placeholder={f.key === 'cancelled' ? 'Sin mensaje' : DEFAULT_SETTINGS_TEXTS[f.key]}
                                rows={2}
                                className="ds-input w-full resize-none"
                            />
                            <p className="text-xs text-ds-soft mt-1">{f.hint}. Variables: <code>{f.vars}</code></p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rechazos */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<ShieldAlert className="w-5 h-5 text-ds-accent-text" />}
                    title="Cuando alguien no puede entrar"
                    text="Siempre verás el motivo en la pestaña Activo. Si activas el aviso, el bot también responde en el chat (una vez cada 2 minutos por persona y motivo)."
                />
                <Toggle
                    title="Avisar en el chat al rechazado"
                    hint="Apagado por defecto para no llenar el chat"
                    value={settings.rejections.announceInChat}
                    onChange={(v) => onUpdateSettings('rejections', { announceInChat: v })}
                />
                <div className="space-y-3">
                    {REJECTION_REASONS.map((r) => (
                        <div key={r.code}>
                            <label className="block text-sm font-bold text-ds-soft mb-1">{r.label}</label>
                            <input
                                type="text"
                                value={settings.rejections.messages[r.code] ?? ''}
                                onChange={(e) =>
                                    onUpdateSettings('rejections', { messages: { ...settings.rejections.messages, [r.code]: e.target.value } })
                                }
                                placeholder={r.text}
                                className="ds-input w-full"
                            />
                        </div>
                    ))}
                    <p className="text-xs text-ds-soft">Variables: <code>{'{user} {prize} {command} {count}'}</code></p>
                </div>
            </div>

        </>
    </TabShell>
);

export const SettingsExtras: React.FC<SettingsExtrasProps> = ({ settings, onUpdateSettings }) => {
    return (
        <>

            {/* Pesos */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<Scale className="w-5 h-5 text-ds-accent-text" />}
                    title="Límites del peso"
                    text="Los multiplicadores por tiempo, bits y racha crecen de forma exponencial; estos topes evitan que una persona acapare el sorteo."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberField label="Tope de cada multiplicador" min={1} step={1} value={settings.weightLimits.maxPerFactor}
                        onChange={(v) => onUpdateSettings('weightLimits', { maxPerFactor: v })} hint="Por defecto 1000" />
                    <NumberField label="Tope del peso total" min={1} step={1} value={settings.weightLimits.maxTotal}
                        onChange={(v) => onUpdateSettings('weightLimits', { maxTotal: v })} hint="Por defecto 10000" />
                    <NumberField label="Peso mínimo" min={0.01} step={0.1} value={settings.weightLimits.min}
                        onChange={(v) => onUpdateSettings('weightLimits', { min: v })} hint="1 = nadie baja del peso base; menos de 1 permite penalizar" />
                </div>
            </div>

            {/* Recordatorios */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<BellRing className="w-5 h-5 text-ds-accent-text" />}
                    title="Reglas de los recordatorios"
                    text="El intervalo y el texto se configuran arriba, en Anuncios y Mensajes."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberField label="Dejar de recordar si faltan menos de (segundos)" min={0} step={5} value={settings.reminders.stopBeforeEndSeconds}
                        onChange={(v) => onUpdateSettings('reminders', { stopBeforeEndSeconds: v })} hint="Solo para giveaways con tiempo límite" />
                    <NumberField label="Dejar de recordar un giveaway olvidado tras (horas)" min={0} step={1} value={settings.reminders.maxAgeHours}
                        onChange={(v) => onUpdateSettings('reminders', { maxAgeHours: v })} hint="0 = recordar siempre mientras esté activo" />
                </div>
            </div>

            {/* Cuentas duplicadas */}
            <div className="space-y-4">
                <SectionTitle
                    icon={<Users className="w-5 h-5 text-ds-accent-text" />}
                    title="Detección de cuentas duplicadas"
                    text="Twitch no entrega la IP ni el dispositivo de nadie, así que esto es solo una pista: compara cuándo se crearon las cuentas y cuándo siguieron el canal. Se activa con «Bloquear múltiples cuentas» en Requisitos."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <NumberField label="Cuentas creadas con menos de (días) de diferencia" min={0} step={0.5} value={settings.multiAccount.sameCreationDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { sameCreationDays: v })} hint="Por defecto 1" />
                    <NumberField label="Follows con menos de (días) de diferencia" min={0} step={0.5} value={settings.multiAccount.sameFollowDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { sameFollowDays: v })} hint="Por defecto 1" />
                    <NumberField label="Una cuenta es «nueva» si tiene menos de (días)" min={0} step={1} value={settings.multiAccount.newAccountDays}
                        onChange={(v) => onUpdateSettings('multiAccount', { newAccountDays: v })} hint="Por defecto 30 (para la regla de follows)" />
                </div>
            </div>

            {/* Roles */}
            <div className="space-y-4">
                <SectionTitle icon={<UserCog className="w-5 h-5 text-ds-accent-text" />} title="Roles" />
                <Toggle
                    title="El streamer puede participar"
                    hint="Si lo apagas, el dueño del canal es rechazado como cualquier otro"
                    value={settings.roles.streamerCanJoin}
                    onChange={(v) => onUpdateSettings('roles', { streamerCanJoin: v })}
                    on="Puede" off="No puede"
                />
                <Toggle
                    title="El Lead Moderator cuenta como moderador"
                    hint="Al aplicar «Moderadores: pueden participar / bloqueados» en Requisitos"
                    value={settings.roles.leadModCountsAsMod}
                    onChange={(v) => onUpdateSettings('roles', { leadModCountsAsMod: v })}
                    on="Sí cuenta" off="No cuenta"
                />
            </div>
        </>
    );
};
