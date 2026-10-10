import { Download, Plus, Play, Shield, Trash2, TrendingUp, Upload, Users } from 'lucide-react';
import { Button, Field, Input, Select } from '../../../../components/ds';
import { Section, SeverityBadge, TestResultBox, hintCls, smallHintCls } from '../parts';
import { getActionLabel, type SeverityLevel } from './types';
import type { BannedWordsState } from './useBannedWords';

/** Tres contadores: palabras, detecciones de hoy y usuarios sancionados. */
export function StatsRow({ s }: { s: BannedWordsState }) {
    const items = [
        { label: s.t('banned.stats.words'), value: `${s.stats.totalWords}/500`, icon: Shield },
        { label: s.t('banned.stats.detections'), value: s.stats.detectionsToday, icon: TrendingUp },
        { label: s.t('banned.stats.sanctioned'), value: s.stats.usersSanctionedToday, icon: Users },
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
        <Section title={s.t('banned.add.title')}>
            <div className="space-y-4">
                <Field label={s.t('banned.add.wordLabel')} hint={s.t('banned.add.tip')}>
                    <Input
                        value={s.newWord}
                        onChange={(e) => s.setNewWord(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && s.addWord()}
                        placeholder={s.t('banned.add.placeholder')}
                    />
                </Field>
                <Field label={s.t('banned.add.severityLabel')}>
                    <Select value={s.newWordSeverity} onChange={(e) => s.setNewWordSeverity(e.target.value as SeverityLevel)}>
                        <option value="leve">{s.t('banned.add.leve')}</option>
                        <option value="medio">{s.t('common.sev.medioLong')}</option>
                        <option value="severo">{s.t('common.sev.severo')}</option>
                    </Select>
                </Field>
                <Button block icon={<Plus />} onClick={s.addWord}>{s.t('banned.add.button')}</Button>
            </div>
        </Section>
    );
}

/** Lista de palabras con importar y exportar. */
export function WordList({ s }: { s: BannedWordsState }) {
    return (
        <Section
            title={s.t('banned.list.title', { n: s.stats.totalWords })}
            right={
                <div className="flex gap-2">
                    <label className="ds-btn ds-btn--secondary ds-btn--sm cursor-pointer">
                        <Upload />
                        {s.t('banned.list.import')}
                        <input type="file" accept=".json" onChange={s.importWords} className="hidden" />
                    </label>
                    <Button variant="secondary" size="sm" icon={<Download />} onClick={s.exportWords}>{s.t('banned.list.export')}</Button>
                </div>
            }
        >
            <div className="max-h-96 overflow-y-auto space-y-2">
                {s.bannedWords.length === 0 ? (
                    <p className={`text-center py-8 ${hintCls}`}>{s.t('banned.list.empty')}</p>
                ) : (
                    s.bannedWords.map((word) => (
                        <div key={word.id} className="flex items-center justify-between p-3 bg-ds-bg border border-ds-border rounded-lg">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <SeverityBadge severity={word.severity} />
                                <span className="font-mono text-ds-text truncate">{word.word}</span>
                                <span className={`${smallHintCls} whitespace-nowrap`}>{s.t('banned.list.detections', { count: word.detections })}</span>
                            </div>
                            <button
                                onClick={() => s.deleteWord(word.id)}
                                aria-label={s.t('banned.list.delete', { word: word.word })}
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
        <Section title={s.t('banned.test.title')}>
            <div className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        value={s.testMessage}
                        onChange={(e) => s.setTestMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && s.testMessageAnalysis()}
                        placeholder={s.t('banned.test.placeholder')}
                    />
                    <Button onClick={s.testMessageAnalysis} loading={s.testing} disabled={s.testing} icon={<Play />}>
                        {s.testing ? s.t('common.analyzing') : s.t('common.analyze')}
                    </Button>
                </div>

                {r && (
                    <TestResultBox match={r.hasMatch}>
                        {r.hasMatch ? (
                            <div className="space-y-2 text-sm text-ds-text">
                                <p className="font-bold text-ds-danger text-base">{s.t('banned.test.match')}</p>
                                <p><strong>{s.t('banned.test.word')}</strong> {r.matchedWord}</p>
                                <p><strong>{s.t('banned.test.severity')}</strong> {r.severity && s.t(`common.sevName.${r.severity}`).toUpperCase()}</p>
                                <p><strong>{s.t('banned.test.actionNormal')}</strong> {r.actionNormal && getActionLabel(s.t, r.actionNormal)}</p>
                                <p><strong>{s.t('banned.test.actionEsc')}</strong> {r.actionEscalamiento && getActionLabel(s.t, r.actionEscalamiento)}</p>
                                {r.filterEnabled === false && (
                                    <p className="font-semibold text-ds-warn">{s.t('links.test.offWarn')}</p>
                                )}
                            </div>
                        ) : (
                            <p className="font-bold text-ds-ok">{s.t('banned.test.none')}</p>
                        )}
                    </TestResultBox>
                )}
            </div>
        </Section>
    );
}
