import { Clapperboard, Clock3, Download, Globe, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, Field, Input, Segmented, Switch } from '../../../components/ds';
import { ConfigCard, ConfigDivider, ToggleRow, hintCls } from '../../../components/dashboard/config';
import { DURATION_LIMITS, TITLE_LIMIT, type ClipCfg } from './useClipConfig';

const num = (v: string, fallback: number) => (v === '' || Number.isNaN(Number(v)) ? fallback : Number(v));

export default function GeneralTab({ cfg }: { cfg: ClipCfg }) {
    const { t } = useTranslation('clipcommand');
    const c = cfg.config;
    const aliases = c.aliases.split(',').map(a => a.trim()).filter(Boolean);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <ConfigCard icon={<Clapperboard />} title={t('general.commandTitle')}
                    hint={t('general.commandHint', { command: '!clip' })}>
                    <div className="space-y-5">
                        <Field label={t('general.language')} hint={t('general.languageHint')}>
                            <Segmented value={c.language} onChange={v => cfg.update('language', v as 'es' | 'en')}
                                items={[{ id: 'es', label: t('messages.spanish') }, { id: 'en', label: t('messages.english') }]} />
                        </Field>
                        <Field label={t('general.aliases')} hint={t('general.aliasesHint')}>
                            <Input value={c.aliases} maxLength={300} placeholder={t('general.aliasesPlaceholder')}
                                onChange={e => cfg.update('aliases', e.target.value)} />
                        </Field>
                        {aliases.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {aliases.map(a => (
                                    <code key={a} className="px-2 py-0.5 bg-ds-bg border border-ds-border rounded text-xs text-ds-accent-text font-mono">!{a.replace(/^!/, '')}</code>
                                ))}
                            </div>
                        )}
                    </div>
                </ConfigCard>

                <ConfigCard icon={<Globe />} title={t('general.otherPlatformsTitle')} hint={t('general.otherPlatformsHint')}>
                    <Segmented value={c.unsupportedPlatformMode} onChange={v => cfg.update('unsupportedPlatformMode', v as 'message' | 'silent')}
                        items={[{ id: 'message', label: t('general.unsupportedMessage') }, { id: 'silent', label: t('general.unsupportedSilent') }]} />
                </ConfigCard>

                <ConfigCard icon={<Download />} title={t('general.downloadTitle')}>
                    <div className="space-y-4">
                        <ToggleRow title={t('general.downloadEnabled')} description={t('general.downloadEnabledHint')}
                            checked={c.downloadEnabled} onChange={v => cfg.update('downloadEnabled', v)} />
                        {c.downloadMonthlyCap != null && <Alert tone="info">{t('general.downloadCap', { cap: c.downloadMonthlyCap })}</Alert>}
                    </div>
                </ConfigCard>
            </div>

            <div className="space-y-6">
                <ConfigCard icon={<Clock3 />} title={t('general.durationTitle')} hint={t('general.durationHint')}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label={t('general.minDuration')}>
                            <Input type="number" inputMode="decimal" step={0.5} min={DURATION_LIMITS.min} max={DURATION_LIMITS.max} value={c.minDuration}
                                onChange={e => cfg.update('minDuration', num(e.target.value, c.minDuration))} />
                        </Field>
                        <Field label={t('general.defaultDuration')}>
                            <Input type="number" inputMode="decimal" step={0.5} min={c.minDuration} max={c.maxDuration} value={c.defaultDuration}
                                onChange={e => cfg.update('defaultDuration', num(e.target.value, c.defaultDuration))} />
                        </Field>
                        <Field label={t('general.maxDuration')}>
                            <Input type="number" inputMode="decimal" step={0.5} min={DURATION_LIMITS.min} max={DURATION_LIMITS.max} value={c.maxDuration}
                                onChange={e => cfg.update('maxDuration', num(e.target.value, c.maxDuration))} />
                        </Field>
                    </div>
                    <div className="mt-5">
                        <ToggleRow title={t('general.allowViewerDuration')}
                            description={t('general.allowViewerDurationHint', { example: '!clip 20' })}
                            checked={c.allowViewerDuration} onChange={v => cfg.update('allowViewerDuration', v)} />
                    </div>
                </ConfigCard>

                <ConfigCard icon={<Tag />} title={t('general.titleTitle')}>
                    <div className="space-y-5">
                        <ToggleRow title={t('general.allowTitle')}
                            description={t('general.allowTitleHint', { example: '!clip 20 …' })}
                            checked={c.allowTitle} onChange={v => cfg.update('allowTitle', v)} />
                        <ConfigDivider />
                        <Field label={t('general.maxTitleLength')} hint={t('general.maxTitleLengthHint')}>
                            <Input type="number" inputMode="numeric" min={1} max={TITLE_LIMIT} value={c.maxTitleLength} disabled={!c.allowTitle}
                                onChange={e => cfg.update('maxTitleLength', Math.min(TITLE_LIMIT, Math.max(1, num(e.target.value, c.maxTitleLength))))} />
                        </Field>
                    </div>
                </ConfigCard>

                <ConfigCard icon={<Clock3 />} title={t('general.retentionTitle')} hint={t('general.retentionHint')}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-semibold text-ds-text">{t('general.retentionForever')}</span>
                            <Switch checked={c.historyRetentionDays === null} label={t('general.retentionForever')}
                                onChange={v => cfg.update('historyRetentionDays', v ? null : 90)} />
                        </div>
                        {c.historyRetentionDays !== null && (
                            <Field label={t('general.retentionDays')}>
                                <Input type="number" inputMode="numeric" min={1} max={3650} value={c.historyRetentionDays}
                                    onChange={e => cfg.update('historyRetentionDays', Math.max(1, num(e.target.value, 90)))} />
                            </Field>
                        )}
                        <p className={hintCls}>{t('general.retentionHint')}</p>
                    </div>
                </ConfigCard>
            </div>
        </div>
    );
}
