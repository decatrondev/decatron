import { Crosshair, Users, MessageSquare, Timer, Target, ShieldAlert, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Field, Input } from '../../components/ds';
import { LoadingText } from '../../components/dashboard/Notices';
import {
    ConfigCard, ConfigDivider, ConfigError, ConfigHeader, EnabledSwitch, SaveButton, SliderField, ToggleRow, VariableChips, hintCls,
} from '../../components/dashboard/config';
import PermissionPicker from '../../components/dashboard/PermissionPicker';
import { useCommandConfig } from '../../hooks/useCommandConfig';
import {
    DEFAULT_CONFIG, MESSAGE_VARIABLES, fromApi, normalizeTimeouts, toApi, type RuletaSettings, type UserListKey, type VariantKey,
} from './ruleta/config';
import VariantList from './ruleta/VariantList';
import UserListEditor from './ruleta/UserListEditor';

export default function RuletaConfig() {
    const navigate = useNavigate();
    const { config, set, loading, saving, saved, error, save } = useCommandConfig<RuletaSettings>({
        endpoint: '/ruleta/config', defaults: DEFAULT_CONFIG, fromApi, toApi, name: 'ruleta', normalize: normalizeTimeouts,
    });

    const updateVariant = (key: VariantKey, index: number, value: string) => set(key, config[key].map((m, i) => i === index ? value : m));
    const addVariant = (key: VariantKey) => set(key, [...config[key], '']);
    const removeVariant = (key: VariantKey, index: number) => {
        if (config[key].length <= 1) return;
        set(key, config[key].filter((_, i) => i !== index));
    };

    const addUser = (key: UserListKey, username: string) => {
        const clean = username.toLowerCase();
        if (config[key].includes(clean)) return;
        set(key, [...config[key], clean]);
    };
    const removeUser = (key: UserListKey, username: string) => set(key, config[key].filter(u => u !== username));

    if (loading) {
        return <div className="flex items-center justify-center h-64"><LoadingText>Cargando configuración...</LoadingText></div>;
    }

    const cmd = <span className="font-mono text-ds-accent-text">{config.commandName}</span>;
    const variantProps = (key: VariantKey, disabled?: boolean) => ({
        values: config[key], config, disabled,
        onChange: (i: number, v: string) => updateVariant(key, i, v),
        onAdd: () => addVariant(key),
        onRemove: (i: number) => removeVariant(key, i),
    });

    return (
        <div className="panel-scale space-y-6">
            {error && <ConfigError>{error}</ConfigError>}

            <ConfigHeader
                onBack={() => navigate('/commands')}
                icon={<Crosshair />}
                title="Ruleta"
                subtitle={<>Configura el comando {cmd}</>}
                actions={<>
                    <EnabledSwitch enabled={config.enabled} onChange={v => set('enabled', v)} />
                    <SaveButton saving={saving} saved={saved} onClick={save} />
                </>}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Columna izquierda */}
                <div className="space-y-6">
                    <ConfigCard icon={<MessageSquare />} title="Comando">
                        <Field label="Nombre / Alias"
                            hint={<>Uso: <span className="font-mono">{config.commandName}</span> (a uno mismo) o <span className="font-mono">{config.commandName} usuario</span></>}>
                            <Input type="text" value={config.commandName} onChange={e => set('commandName', e.target.value)} placeholder="!ruleta" />
                        </Field>
                    </ConfigCard>

                    <ConfigCard icon={<Target />} title="Probabilidad y Duración">
                        <div className="space-y-5">
                            <SliderField label="Probabilidad de Bala" display={`${config.chancePercent}%`} value={config.chancePercent} min={1} max={100}
                                onChange={v => set('chancePercent', v)} hint="Ruleta rusa clásica ≈ 17% (1 de 6)" />
                            <SliderField label="Timeout Mínimo" display={`${config.minTimeoutSeconds}s`} value={config.minTimeoutSeconds} min={5} max={600}
                                onChange={v => set('minTimeoutSeconds', v)} />
                            <SliderField label="Timeout Máximo" display={`${config.maxTimeoutSeconds}s`} value={config.maxTimeoutSeconds} min={5} max={600}
                                onChange={v => set('maxTimeoutSeconds', v)}
                                hint={config.minTimeoutSeconds === config.maxTimeoutSeconds
                                    ? 'Duración fija'
                                    : `Duración aleatoria entre ${config.minTimeoutSeconds}s y ${config.maxTimeoutSeconds}s`} />
                        </div>
                    </ConfigCard>

                    <ConfigCard icon={<Timer />} title="Cooldowns">
                        <div className="space-y-5">
                            <SliderField label="Cooldown Global" display={`${config.globalCooldown}s`} value={config.globalCooldown} min={0} max={120}
                                onChange={v => set('globalCooldown', v)} hint="Tiempo entre usos del comando en el chat general" />
                            <SliderField label="Cooldown por Usuario" display={`${config.userCooldown}s`} value={config.userCooldown} min={0} max={600}
                                onChange={v => set('userCooldown', v)} hint="Tiempo que cada usuario debe esperar entre usos" />
                        </div>
                    </ConfigCard>
                </div>

                {/* Columna derecha */}
                <div className="space-y-6">
                    <ConfigCard icon={<Users />} title="Permisos" hint="Nivel mínimo para usar el comando — los niveles superiores siempre pueden usarlo">
                        <PermissionPicker value={config.permission} onChange={p => set('permission', p)} />
                    </ConfigCard>

                    <ConfigCard icon={<ShieldAlert />} title="Objetivos">
                        <div className="space-y-5">
                            <ToggleRow title="Permitir Apuntarse a Uno Mismo" checked={config.allowSelfTarget} onChange={v => set('allowSelfTarget', v)}
                                description={<>Usar <span className="font-mono">{config.commandName}</span> sin usuario objetivo</>} />
                            <ConfigDivider />
                            <ToggleRow title="Permitir Apuntar a Moderadores" checked={config.allowTargetModerators} onChange={v => set('allowTargetModerators', v)}
                                description='Cualquiera que cumpla el nivel de "Permisos" de abajo va a poder apuntarle a un moderador' />

                            <Alert tone="info">
                                El <span className="font-semibold">streamer</span> siempre es inmune a <span className="font-mono text-ds-accent-text">{config.commandName}</span>, no es configurable.
                                {config.allowTargetModerators && (
                                    <span className="block mt-1">
                                        Si el moderador apuntado no recibe el mod de vuelta manualmente antes de que expire el timeout, el bot se lo restaura automáticamente.
                                    </span>
                                )}
                            </Alert>
                        </div>
                    </ConfigCard>

                    <ConfigCard icon={<ShieldAlert />} title="Usuarios Especiales">
                        <div className="space-y-5">
                            <UserListEditor title="Protegidos" hint="Nunca pueden ser el objetivo de la ruleta" values={config.protectedUsers} placeholder="usuario"
                                onAdd={u => addUser('protectedUsers', u)} onRemove={u => removeUser('protectedUsers', u)} />
                            <ConfigDivider />
                            <UserListEditor title="Bloqueados" hint="No pueden usar el comando, sin importar su nivel de Permisos" values={config.blockedUsers} placeholder="usuario"
                                onAdd={u => addUser('blockedUsers', u)} onRemove={u => removeUser('blockedUsers', u)} />
                        </div>
                    </ConfigCard>
                </div>
            </div>

            {/* Mensajes — ancho completo */}
            <ConfigCard icon={<MessageSquare />} title="Mensajes">
                <VariableChips vars={MESSAGE_VARIABLES} />
                <p className={`${hintCls} mb-4`}>Cada categoría acepta varias variantes — el bot elige una al azar en cada disparo.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <VariantList title="Cuando le da (timeout aplicado)" {...variantProps('hitMessages')} />
                    <VariantList title="Cuando falla (sobrevive)" {...variantProps('missMessages')} />
                </div>

                <div className="border-t border-ds-border my-4" />

                <div className="mb-4">
                    <ToggleRow title="Mensajes Distintos al Apuntarse a Sí Mismo" checked={config.useSelfMessages} onChange={v => set('useSelfMessages', v)}
                        description="Si está desactivado, se usan los mensajes de arriba también para autoruleta" />
                </div>

                {config.useSelfMessages && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <VariantList title="Autoruleta — le da" {...variantProps('selfHitMessages', !config.allowSelfTarget)} />
                        <VariantList title="Autoruleta — falla" {...variantProps('selfMissMessages', !config.allowSelfTarget)} />
                    </div>
                )}
                {!config.allowSelfTarget && (
                    <p className={`${hintCls} mt-2`}>Activa "Permitir Apuntarse a Uno Mismo" para usar estos mensajes</p>
                )}
            </ConfigCard>

            {/* Overlay — próximamente */}
            <ConfigCard icon={<Sparkles />} title="Overlay del Mini-Juego" className="opacity-75">
                <div className="flex items-start justify-between gap-3 -mt-2">
                    <p className="text-sm text-ds-soft">
                        Animación visual de la ruleta para el overlay de OBS, sincronizada en vivo con cada disparo. Todavía no está disponible.
                    </p>
                    <Badge>Próximamente</Badge>
                </div>
            </ConfigCard>
        </div>
    );
}
