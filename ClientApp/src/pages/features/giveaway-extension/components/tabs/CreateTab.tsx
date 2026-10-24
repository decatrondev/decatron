/**
 * CreateTab - Tab para crear/configurar un nuevo giveaway
 */

import React from 'react';
import { Gift, Clock, Users, Trophy } from 'lucide-react';
import type { GiveawayConfig, GiveawaySettings } from '../../types';

interface CreateTabProps {
    config: GiveawayConfig;
    onUpdateConfig: (updates: Partial<GiveawayConfig>) => void;
    settings?: GiveawaySettings;
    onUpdateSettings?: <K extends keyof GiveawaySettings>(group: K, updates: Partial<GiveawaySettings[K]>) => void;
}

export const CreateTab: React.FC<CreateTabProps> = ({ config, onUpdateConfig, settings, onUpdateSettings }) => {
    const draw = settings?.draw;
    const setDraw = (u: Partial<GiveawaySettings['draw']>) => onUpdateSettings?.('draw', u);
    const DrawToggle = ({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
        <div className="flex items-center justify-between gap-4 p-4 bg-ds-bg rounded-lg border border-ds-border">
            <div>
                <p className="font-bold text-ds-text">{title}</p>
                <p className="text-xs text-ds-soft">{hint}</p>
            </div>
            <button onClick={() => onChange(!value)} className={value ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{value ? 'Sí' : 'No'}</button>
        </div>
    );

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-ds-border">
                <div className="p-3 bg-ds-bg rounded-lg">
                    <Gift className="w-6 h-6 text-ds-soft" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-ds-text">
                        Crear Giveaway
                    </h2>
                    <p className="text-sm text-ds-soft">
                        Configura los detalles básicos de tu sorteo
                    </p>
                </div>
            </div>

            {/* Información del Premio */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-ds-accent-text" />
                    Información del Premio
                </h3>

                <div className="grid grid-cols-1 gap-4">
                    {/* Nombre del Giveaway */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Nombre del Giveaway
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => onUpdateConfig({ name: e.target.value })}
                            placeholder="Ej: Sorteo de Navidad"
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Nombre del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Nombre del Premio *
                        </label>
                        <input
                            type="text"
                            value={config.prizeName}
                            onChange={(e) => onUpdateConfig({ prizeName: e.target.value })}
                            placeholder="Ej: Steam Deck, $50 Amazon, Teclado Mecánico"
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Descripción del Premio */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Descripción del Premio (Opcional)
                        </label>
                        <textarea
                            value={config.prizeDescription || ''}
                            onChange={(e) => onUpdateConfig({ prizeDescription: e.target.value })}
                            placeholder="Detalles adicionales sobre el premio..."
                            rows={3}
                            className="ds-input w-full resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Duración */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-ds-accent-text" />
                    Duración
                </h3>

                <div className="space-y-4">
                    {/* Tipo de duración */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'timed' })}
                            className={`${config.durationType === 'timed' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'} ds-btn--lg flex-1`}
                        >
                            ⏱️ Con Tiempo Límite
                        </button>
                        <button
                            onClick={() => onUpdateConfig({ durationType: 'manual' })}
                            className={`${config.durationType === 'manual' ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'} ds-btn--lg flex-1`}
                        >
                            ✋ Manual (lo termino yo)
                        </button>
                    </div>

                    {/* Duración en minutos (solo si es timed) */}
                    {config.durationType === 'timed' && (
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">
                                Duración (minutos)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={1440}
                                value={config.durationMinutes}
                                onChange={(e) => onUpdateConfig({ durationMinutes: parseInt(e.target.value) || 10 })}
                                className="ds-input w-full"
                            />
                            <p className="text-xs text-ds-soft mt-1">
                                El giveaway finalizará automáticamente después de {config.durationMinutes} minutos
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Participantes */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Users className="w-5 h-5 text-ds-accent-text" />
                    Participantes
                </h3>

                <div className="space-y-4">
                    {/* Comando de entrada */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Comando de Entrada
                        </label>
                        <input
                            type="text"
                            value={config.entryCommand}
                            onChange={(e) => onUpdateConfig({ entryCommand: e.target.value })}
                            placeholder="!join"
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Entrada automática */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Entrada Automática</p>
                            <p className="text-sm text-ds-soft">
                                Cualquiera que escriba en chat entra automáticamente
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowAutoEntry: !config.allowAutoEntry })}
                            className={config.allowAutoEntry ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.allowAutoEntry ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Múltiples entradas */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Permitir Múltiples Entradas</p>
                            <p className="text-sm text-ds-soft">
                                Un usuario puede usar el comando varias veces
                            </p>
                        </div>
                        <button
                            onClick={() => onUpdateConfig({ allowMultipleEntries: !config.allowMultipleEntries })}
                            className={config.allowMultipleEntries ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                        >
                            {config.allowMultipleEntries ? 'Activado' : 'Desactivado'}
                        </button>
                    </div>

                    {/* Límite de participantes */}
                    <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold text-ds-text">Límite de Participantes</p>
                                <button
                                    onClick={() => onUpdateConfig({ maxParticipantsEnabled: !config.maxParticipantsEnabled })}
                                    className={config.maxParticipantsEnabled ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                >
                                    {config.maxParticipantsEnabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {config.maxParticipantsEnabled && (
                                <input
                                    type="number"
                                    min={1}
                                    value={config.maxParticipants}
                                    onChange={(e) => onUpdateConfig({ maxParticipants: parseInt(e.target.value) || 100 })}
                                    className="ds-input w-full"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ganadores */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-ds-text flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-ds-accent-text" />
                    Ganadores
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Número de ganadores */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Número de Ganadores
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={config.numberOfWinners}
                            onChange={(e) => onUpdateConfig({ numberOfWinners: parseInt(e.target.value) || 1 })}
                            className="ds-input w-full"
                        />
                    </div>

                    {/* Ganadores de respaldo */}
                    <div>
                        <label className="block text-sm font-bold text-ds-soft mb-2">
                            Ganadores de Respaldo
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onUpdateConfig({ hasBackupWinners: !config.hasBackupWinners })}
                                className={config.hasBackupWinners ? 'ds-btn ds-btn--primary ds-btn--lg' : 'ds-btn ds-btn--secondary ds-btn--lg'}
                            >
                                {config.hasBackupWinners ? 'Activado' : 'Desactivado'}
                            </button>
                            {config.hasBackupWinners && (
                                <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={config.numberOfBackupWinners}
                                    onChange={(e) => onUpdateConfig({ numberOfBackupWinners: parseInt(e.target.value) || 1 })}
                                    className="ds-input flex-1"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Cómo se sortea y se valida */}
                {draw && (
                    <div className="space-y-3 p-4 bg-ds-bg rounded-lg border border-ds-border">
                        <div>
                            <p className="font-bold text-ds-text">Cómo se sortea y se valida</p>
                            <p className="text-xs text-ds-soft">Vale desde el siguiente giveaway. Los comandos de chat (choose, reroll, close) están en la pestaña Comandos.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-ds-soft mb-2">Varios ganadores</label>
                            <select className="ds-input w-full" value={draw.mode} onChange={(e) => setDraw({ mode: e.target.value as 'all' | 'one_by_one' })}>
                                <option value="all">Todos de golpe: cada sorteo elige todos los lugares libres</option>
                                <option value="one_by_one">Uno por uno: cada «choose» elige al siguiente y el giveaway sigue hasta confirmar todos los lugares</option>
                            </select>
                            {draw.mode === 'one_by_one' && config.hasBackupWinners && (
                                <p className="text-xs text-amber-500 mt-1">En «uno por uno» no se eligen ganadores de respaldo de antemano.</p>
                            )}
                        </div>
                        <DrawToggle title="La participación sigue abierta tras sortear" hint="Se cierra con «close». Apagado: se cierra en el primer sorteo" value={draw.keepEntriesOpen} onChange={(v) => setDraw({ keepEntriesOpen: v })} />
                        <DrawToggle title="Quien no responde queda descartado" hint="No vuelve a salir sorteado en este giveaway. Apagado: puede volver a ganar" value={draw.discardNoResponse} onChange={(v) => setDraw({ discardNoResponse: v })} />
                        <DrawToggle title="Un ganador confirmado puede ganar otro lugar" hint="Apagado: quien ya respondió no vuelve a salir en este giveaway" value={draw.confirmedCanWinAgain} onChange={(v) => setDraw({ confirmedCanWinAgain: v })} />
                        <DrawToggle title="Dejar el giveaway abierto al salir los ganadores" hint="Apagado: al resolverse todos los lugares se completa solo. Encendido: sigue abierto, «choose» suma un ganador extra y «finish» lo termina" value={draw.onComplete === 'keep_open'} onChange={(v) => setDraw({ onComplete: v ? 'keep_open' : 'finish' })} />
                        <DrawToggle title="«reroll @ganador» puede reemplazar a quien ya respondió" hint="Apagado: un ganador confirmado no se puede anular" value={draw.replaceConfirmed} onChange={(v) => setDraw({ replaceConfirmed: v })} />
                        <DrawToggle title="«reroll» usa primero al ganador de respaldo" hint="Apagado: siempre sortea a otra persona al azar" value={draw.backupsOnReroll} onChange={(v) => setDraw({ backupsOnReroll: v })} />
                    </div>
                )}

                {/* Timeout de respuesta */}
                <div>
                    <label className="block text-sm font-bold text-ds-soft mb-2">
                        Tiempo de Respuesta (segundos)
                    </label>
                    <input
                        type="number"
                        min={10}
                        max={300}
                        value={config.winnerResponseTimeout}
                        onChange={(e) => onUpdateConfig({ winnerResponseTimeout: parseInt(e.target.value) || 60 })}
                        className="ds-input w-full"
                    />
                    <p className="text-xs text-ds-soft mt-1">
                        Tiempo que tiene el ganador para responder antes de ser descalificado
                    </p>
                </div>

                {/* Auto reroll */}
                <div className="flex items-center justify-between p-4 bg-ds-bg rounded-lg border border-ds-border">
                    <div>
                        <p className="font-bold text-ds-text">Re-sorteo Automático</p>
                        <p className="text-sm text-ds-soft">
                            Sortear nuevo ganador si no responde a tiempo
                        </p>
                    </div>
                    <button
                        onClick={() => onUpdateConfig({ autoRerollOnTimeout: !config.autoRerollOnTimeout })}
                        className={config.autoRerollOnTimeout ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}
                    >
                        {config.autoRerollOnTimeout ? 'Activado' : 'Desactivado'}
                    </button>
                </div>
            </div>
        </div>
    );
};
