import { Download, Plus, Play, Shield, Trash2, TrendingUp, Upload, Users } from 'lucide-react';
import { Button, Field, Input, Select } from '../../../../components/ds';
import { Section, SeverityBadge, TestResultBox, hintCls, smallHintCls } from '../parts';
import { getActionLabel, type SeverityLevel } from './types';
import type { BannedWordsState } from './useBannedWords';

/** Tres contadores: palabras, detecciones de hoy y usuarios sancionados. */
export function StatsRow({ s }: { s: BannedWordsState }) {
    const items = [
        { label: 'Palabras Configuradas', value: `${s.stats.totalWords}/500`, icon: Shield },
        { label: 'Detecciones Hoy', value: s.stats.detectionsToday, icon: TrendingUp },
        { label: 'Usuarios Sancionados', value: s.stats.usersSanctionedToday, icon: Users },
    ];
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {items.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-ds-surface rounded-lg border border-ds-border p-6 flex items-center justify-between">
                    <div>
                        <p className={hintCls}>{label}</p>
                        <p className="text-2xl font-black text-ds-text mt-1">{value}</p>
                    </div>
                    <Icon className="w-10 h-10 text-ds-accent-text" />
                </div>
            ))}
        </div>
    );
}

/** Formulario para agregar una palabra o frase con su severidad. */
export function AddWordCard({ s }: { s: BannedWordsState }) {
    return (
        <Section title="Agregar Palabra Prohibida">
            <div className="space-y-4">
                <Field label="Palabra o Frase" hint={'Tip: usa asteriscos (*) para wildcards. Ejemplo: *spam* detecta "spam", "spammer", "antispam"'}>
                    <Input
                        value={s.newWord}
                        onChange={(e) => s.setNewWord(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && s.addWord()}
                        placeholder="Escribe la palabra o frase"
                    />
                </Field>
                <Field label="Nivel de Severidad">
                    <Select value={s.newWordSeverity} onChange={(e) => s.setNewWordSeverity(e.target.value as SeverityLevel)}>
                        <option value="leve">Leve (Escalamiento normal)</option>
                        <option value="medio">Medio (strike + timeout de 10 min como mínimo)</option>
                        <option value="severo">Severo (Ban directo)</option>
                    </Select>
                </Field>
                <Button block icon={<Plus />} onClick={s.addWord}>Agregar Palabra</Button>
            </div>
        </Section>
    );
}

/** Lista de palabras con importar y exportar. */
export function WordList({ s }: { s: BannedWordsState }) {
    return (
        <Section
            title={`Lista de Palabras (${s.stats.totalWords}/500)`}
            right={
                <div className="flex gap-2">
                    <label className="ds-btn ds-btn--secondary ds-btn--sm cursor-pointer">
                        <Upload />
                        Importar
                        <input type="file" accept=".json" onChange={s.importWords} className="hidden" />
                    </label>
                    <Button variant="secondary" size="sm" icon={<Download />} onClick={s.exportWords}>Exportar</Button>
                </div>
            }
        >
            <div className="max-h-96 overflow-y-auto space-y-2">
                {s.bannedWords.length === 0 ? (
                    <p className={`text-center py-8 ${hintCls}`}>No hay palabras prohibidas configuradas</p>
                ) : (
                    s.bannedWords.map((word) => (
                        <div key={word.id} className="flex items-center justify-between p-3 bg-ds-bg border border-ds-border rounded-lg">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <SeverityBadge severity={word.severity} />
                                <span className="font-mono text-ds-text truncate">{word.word}</span>
                                <span className={`${smallHintCls} whitespace-nowrap`}>{word.detections} detecciones</span>
                            </div>
                            <button
                                onClick={() => s.deleteWord(word.id)}
                                aria-label={`Eliminar ${word.word}`}
                                className="text-ds-soft hover:text-ds-danger transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </Section>
    );
}

/** Probar un mensaje contra la lista y ver qué acción tomaría el bot. */
export function TestCard({ s }: { s: BannedWordsState }) {
    const r = s.testResult;
    return (
        <Section title="Probar Detección de Mensajes">
            <div className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        value={s.testMessage}
                        onChange={(e) => s.setTestMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && s.testMessageAnalysis()}
                        placeholder="Escribe un mensaje de prueba"
                    />
                    <Button onClick={s.testMessageAnalysis} loading={s.testing} disabled={s.testing} icon={<Play />}>
                        {s.testing ? 'Analizando...' : 'Analizar'}
                    </Button>
                </div>

                {r && (
                    <TestResultBox match={r.hasMatch}>
                        {r.hasMatch ? (
                            <div className="space-y-2 text-sm text-ds-text">
                                <p className="font-bold text-ds-danger text-base">Coincidencia Detectada</p>
                                <p><strong>Palabra detectada:</strong> {r.matchedWord}</p>
                                <p><strong>Severidad:</strong> {r.severity?.toUpperCase()}</p>
                                <p><strong>Acción (viewer, primer strike):</strong> {r.actionNormal && getActionLabel(r.actionNormal)}</p>
                                <p><strong>Acción (VIP/sub con escalamiento):</strong> {r.actionEscalamiento && getActionLabel(r.actionEscalamiento)}</p>
                                {r.filterEnabled === false && (
                                    <p className="font-semibold text-ds-warn">El filtro está apagado: hoy este mensaje pasaría sin sanción.</p>
                                )}
                            </div>
                        ) : (
                            <p className="font-bold text-ds-ok">No se detectaron palabras prohibidas</p>
                        )}
                    </TestResultBox>
                )}
            </div>
        </Section>
    );
}
