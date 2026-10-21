// Filtros: cada cuánto se lee, cuánto de largo y qué palabras o usuarios no se leen.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Field, NumberInput, Toggle, inputClass } from '../../../../components/overlay-editor/ui';
import type { SpeakChatState } from './useSpeakChatConfig';

const lines = (text: string) => text.split('\n').map(w => w.trim()).filter(Boolean);

export default function FiltersTab({ sc }: { sc: SpeakChatState }) {
    const { t } = useTranslation('speakchat');
    const { config, setConfig } = sc;
    const f = config.filters;
    // El texto se guarda tal cual lo escribe la persona (con líneas vacías mientras escribe); la configuración recibe las líneas limpias
    const [words, setWords] = useState(() => (f.blockedWords || []).join('\n'));
    const [users, setUsers] = useState(() => (f.blockedUsers || []).join('\n'));
    const set = (patch: Partial<typeof f>) => setConfig(c => ({ ...c, filters: { ...c.filters, ...patch } }));
    const cleanup = f.cleanup;
    const setCleanup = (patch: Partial<typeof cleanup>) => set({ cleanup: { ...cleanup, ...patch } });

    return (
        <div className="space-y-6">
            <Card title={t('v2.filters.cooldownsTitle')} description={t('v2.filters.cooldownsDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label={t('v2.filters.global')} hint={t('v2.filters.globalHint')}>
                        <NumberInput value={f.globalCooldownSeconds} min={0} onChange={n => set({ globalCooldownSeconds: n })} />
                    </Field>
                    <Field label={t('v2.filters.perUser')} hint={t('v2.filters.perUserHint')}>
                        <NumberInput value={f.perUserCooldownSeconds} min={0} onChange={n => set({ perUserCooldownSeconds: n })} />
                    </Field>
                    <Field label={t('v2.filters.maxChars')} hint={t('v2.filters.maxCharsHint')}>
                        <NumberInput value={f.maxChars} min={10} max={500} onChange={n => set({ maxChars: n })} />
                    </Field>
                </div>
            </Card>

            <Card title={t('v2.filters.cleanupTitle')} description={t('v2.filters.cleanupDescription')}>
                <div className="space-y-5">
                    <Field label={t('v2.filters.links')} hint={t('v2.filters.linksHint')}>
                        <select value={cleanup.links} onChange={e => setCleanup({ links: e.target.value as typeof cleanup.links })} className={`${inputClass} sm:w-80`}>
                            <option value="remove">{t('v2.filters.linksRemove')}</option>
                            <option value="replace">{t('v2.filters.linksReplace')}</option>
                            <option value="keep">{t('v2.filters.linksKeep')}</option>
                        </select>
                    </Field>
                    <Toggle checked={cleanup.emotes} onChange={v => setCleanup({ emotes: v })} label={t('v2.filters.emotes')} hint={t('v2.filters.emotesHint')} />
                    <Toggle checked={cleanup.repeats} onChange={v => setCleanup({ repeats: v })} label={t('v2.filters.repeats')} hint={t('v2.filters.repeatsHint')} />
                    <Toggle checked={cleanup.emojis} onChange={v => setCleanup({ emojis: v })} label={t('v2.filters.emojis')} hint={t('v2.filters.emojisHint')} />
                </div>
            </Card>

            <Card title={t('v2.filters.blockTitle')} description={t('v2.filters.blockDescription')}>
                <div className="space-y-5">
                    <Field label={t('filters.wordsMode')} hint={t('filters.wordsModeHint')}>
                        <select value={f.blockedWordsMode ?? 'partial'} onChange={e => set({ blockedWordsMode: e.target.value as 'whole' | 'partial' })} className={`${inputClass} sm:w-80`}>
                            <option value="whole">{t('filters.modeWhole')}</option>
                            <option value="partial">{t('filters.modePartial')}</option>
                        </select>
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Field label={t('v2.filters.words')}>
                            <textarea value={words} rows={6} className={`${inputClass} resize-none font-mono`} placeholder={t('v2.filters.wordsPlaceholder')}
                                onChange={e => { setWords(e.target.value); set({ blockedWords: lines(e.target.value) }); }} />
                        </Field>
                        <Field label={t('v2.filters.users')}>
                            <textarea value={users} rows={6} className={`${inputClass} resize-none font-mono`} placeholder={t('v2.filters.usersPlaceholder')}
                                onChange={e => { setUsers(e.target.value); set({ blockedUsers: lines(e.target.value) }); }} />
                        </Field>
                    </div>
                </div>
            </Card>
        </div>
    );
}
