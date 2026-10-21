import { cardClass, inputClass, labelClass, sectionTitle, sectionDesc } from './shared';
import type { ConfigProps } from './types';

interface FiltersTabProps extends ConfigProps {
    blockedWordsText: string;
    setBlockedWordsText: (v: string) => void;
    blockedUsersText: string;
    setBlockedUsersText: (v: string) => void;
}

export default function FiltersTab({ config, setConfig, blockedWordsText, setBlockedWordsText, blockedUsersText, setBlockedUsersText }: FiltersTabProps) {
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <p className={sectionTitle}>⏱️ Cooldowns</p>
                <p className={sectionDesc}>Controla la frecuencia con que se leen mensajes</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}>Cooldown global (segundos)</label>
                        <p className="text-xs text-ds-soft mb-2">Tiempo mínimo entre cualquier mensaje leído</p>
                        <input
                            type="number"
                            min={0}
                            value={config.filters.globalCooldownSeconds}
                            onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, globalCooldownSeconds: parseInt(e.target.value) || 0 } }))}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Cooldown por usuario (segundos)</label>
                        <p className="text-xs text-ds-soft mb-2">Tiempo mínimo entre mensajes del mismo usuario</p>
                        <input
                            type="number"
                            min={0}
                            value={config.filters.perUserCooldownSeconds}
                            onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, perUserCooldownSeconds: parseInt(e.target.value) || 0 } }))}
                            className={inputClass}
                        />
                    </div>
                </div>
                <div className="mt-6">
                    <label className={labelClass}>Máximo de caracteres por mensaje</label>
                    <input
                        type="number"
                        min={10}
                        max={500}
                        value={config.filters.maxChars}
                        onChange={e => setConfig(c => ({ ...c, filters: { ...c.filters, maxChars: parseInt(e.target.value) || 200 } }))}
                        className={`${inputClass} w-32`}
                    />
                </div>
            </div>

            <div className={cardClass}>
                <p className={sectionTitle}>🚫 Listas de bloqueo</p>
                <p className={sectionDesc}>Los mensajes con estas palabras o de estos usuarios no se leerán</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}>Palabras bloqueadas (una por línea)</label>
                        <textarea
                            value={blockedWordsText}
                            onChange={e => setBlockedWordsText(e.target.value)}
                            rows={6}
                            placeholder={'spam\nofensivo\n...'}
                            className={`${inputClass} resize-none font-mono`}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Usuarios bloqueados (uno por línea)</label>
                        <textarea
                            value={blockedUsersText}
                            onChange={e => setBlockedUsersText(e.target.value)}
                            rows={6}
                            placeholder={'usuario1\nusuario2\n...'}
                            className={`${inputClass} resize-none font-mono`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
