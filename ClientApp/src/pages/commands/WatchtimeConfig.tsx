import { useMemo } from 'react';
import { Clock, Users, MessageSquare, Timer, Eye, History, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Field, Input } from '../../components/ds';
import { LoadingText } from '../../components/dashboard/Notices';
import {
    ChoiceButton, ConfigCard, ConfigDivider, ConfigError, ConfigHeader, EnabledSwitch, MessageField, SaveButton, SliderField, ToggleRow, VariableChips, hintCls,
} from '../../components/dashboard/config';
import PermissionPicker from '../../components/dashboard/PermissionPicker';
import { useCommandConfig } from '../../hooks/useCommandConfig';
import { parseJwtClaims } from '../../utils/jwt';
import { DEFAULT_CONFIG, MESSAGE_VARIABLES, TIME_FORMAT_OPTIONS, buildPreview, fromApi, toApi, type WatchtimeSettings } from './watchtime/config';

export default function WatchtimeConfig() {
    const navigate = useNavigate();

    // Watchtime en Twitch depende, para los "lurkers" (viewers que no escriben,
    // la mayoria), de consultar la lista de chatters conectados via la API de
    // Helix cada 90s (WatchtimeLurkerTrackingService.cs). La API publica de
    // Kick no expone ningun recurso equivalente — se reviso el indice completo
    // de su documentacion (categories, chat, channels, moderation, etc.) y no
    // hay forma de saber quien esta conectado sin que escriba. Es "No
    // disponible" y no "Proximamente": depende de que Kick agregue algo que
    // hoy no existe, no de trabajo pendiente de nuestro lado.
    const isKickSession = useMemo(() => {
        const claims = parseJwtClaims(localStorage.getItem('token'));
        return (claims.AuthProvider || 'twitch') === 'kick';
    }, []);

    const { config, set, loading, saving, saved, error, save } = useCommandConfig<WatchtimeSettings>({
        endpoint: '/watchtime/config', defaults: DEFAULT_CONFIG, fromApi, toApi, name: 'watchtime', skip: isKickSession,
    });

    if (loading) {
        return <div className="flex items-center justify-center h-64"><LoadingText>Cargando configuración...</LoadingText></div>;
    }

    if (isKickSession) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-surface border border-ds-border rounded-lg p-8 max-w-md text-center">
                    <Ban className="w-16 h-16 text-ds-faint mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-text mb-2">Watchtime — No disponible en Kick</h2>
                    <p className="text-ds-soft">
                        Kick no expone ninguna forma de saber quién está viendo el stream sin escribir en el chat. Sin ese dato, el tiempo de visualización quedaría sistemáticamente incompleto — preferimos no ofrecerlo a medias.
                    </p>
                </div>
            </div>
        );
    }

    const cmd = <span className="font-mono text-ds-accent-text">{config.commandName}</span>;

    return (
        <div className="panel-scale space-y-6">
            {error && <ConfigError>{error}</ConfigError>}

            <ConfigHeader
                onBack={() => navigate('/commands')}
                icon={<Clock />}
                title="Watchtime"
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
                        <Field label="Nombre / Alias" hint="Puedes cambiarlo a cualquier alias, ej: !tiempo">
                            <Input type="text" value={config.commandName} onChange={e => set('commandName', e.target.value)} placeholder="!watchtime" />
                        </Field>
                    </ConfigCard>

                    <ConfigCard icon={<Timer />} title="Cooldowns">
                        <div className="space-y-5">
                            <SliderField label="Cooldown Global" display={`${config.globalCooldown}s`} value={config.globalCooldown} min={0} max={60}
                                onChange={v => set('globalCooldown', v)} hint="Tiempo entre usos del comando en el chat general" />
                            <SliderField label="Cooldown por Usuario" display={`${config.userCooldown}s`} value={config.userCooldown} min={0} max={300}
                                onChange={v => set('userCooldown', v)} hint="Tiempo que cada usuario debe esperar entre usos" />
                        </div>
                    </ConfigCard>

                    <ConfigCard icon={<Users />} title="Permisos" hint="Nivel mínimo para usar el comando — los niveles superiores siempre pueden usarlo">
                        <PermissionPicker value={config.permission} onChange={p => set('permission', p)} />
                    </ConfigCard>
                </div>

                {/* Columna derecha */}
                <div className="space-y-6">
                    <ConfigCard icon={<Eye />} title="Comportamiento">
                        <div className="space-y-5">
                            <ToggleRow title="Contar Lurkers" description="Trackear viewers que no escriben en el chat" checked={config.trackLurkers} onChange={v => set('trackLurkers', v)} />
                            <ConfigDivider />
                            <ToggleRow title="Solo en Stream en Vivo" description="El comando no funciona si el stream está offline" checked={config.onlyWhenLive} onChange={v => set('onlyWhenLive', v)} />
                            <ConfigDivider />
                            <ToggleRow title="Mostrar Posición" checked={config.showPosition} onChange={v => set('showPosition', v)}
                                description={<>Incluir ranking del viewer (variable <span className="font-mono text-ds-accent-text">{'{position}'}</span>)</>} />
                            <ConfigDivider />
                            <SliderField label="Tiempo mínimo para responder" value={config.minMinutesToRespond} min={0} max={30}
                                display={config.minMinutesToRespond === 0 ? 'Sin mínimo' : `${config.minMinutesToRespond} min`}
                                onChange={v => set('minMinutesToRespond', v)} hint="0 = responde siempre" />
                        </div>
                    </ConfigCard>

                    <ConfigCard icon={<Clock />} title="Formato de Tiempo">
                        <div className="space-y-2">
                            {TIME_FORMAT_OPTIONS.map(opt => (
                                <ChoiceButton key={opt.value} selected={config.timeFormat === opt.value} onClick={() => set('timeFormat', opt.value)}>
                                    <span className={`text-sm font-bold ${config.timeFormat === opt.value ? 'text-ds-accent-text' : 'text-ds-text'}`}>{opt.label}</span>
                                    <span className={`${hintCls} font-mono`}>{opt.example}</span>
                                </ChoiceButton>
                            ))}
                        </div>
                    </ConfigCard>
                </div>
            </div>

            {/* Mensajes — ancho completo */}
            <ConfigCard icon={<MessageSquare />} title="Mensajes">
                <VariableChips vars={MESSAGE_VARIABLES} />

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                    <MessageField className="lg:col-span-2 xl:col-span-1" label="Mensaje Principal" value={config.customMessage}
                        onChange={v => set('customMessage', v)} preview={buildPreview(config)} />

                    <MessageField label="Primera Vez en el Stream" value={config.firstTimeMessage} onChange={v => set('firstTimeMessage', v)}
                        toggle={{ checked: config.useFirstTimeMessage, onChange: v => set('useFirstTimeMessage', v) }} disabled={!config.useFirstTimeMessage}
                        note={<>Se activa la primera vez que el viewer usa <span className="font-mono text-ds-accent-text">{config.commandName}</span> en el stream actual</>} />

                    <MessageField label="Tiempo Insuficiente" value={config.notEnoughTimeMessage} onChange={v => set('notEnoughTimeMessage', v)}
                        toggle={{ checked: config.useNotEnoughTimeMessage, onChange: v => set('useNotEnoughTimeMessage', v) }}
                        disabled={!config.useNotEnoughTimeMessage || config.minMinutesToRespond === 0}
                        note={config.minMinutesToRespond === 0 ? 'Activa el tiempo mínimo para usar este mensaje' : undefined} />

                    <MessageField label="Stream Offline" value={config.offlineMessage} onChange={v => set('offlineMessage', v)}
                        toggle={{ checked: config.useOfflineMessage, onChange: v => set('useOfflineMessage', v) }}
                        disabled={!config.useOfflineMessage || config.onlyWhenLive}
                        note={config.onlyWhenLive ? 'Desactiva "Solo en vivo" para usar este mensaje' : undefined} />
                </div>
            </ConfigCard>
        </div>
    );
}
