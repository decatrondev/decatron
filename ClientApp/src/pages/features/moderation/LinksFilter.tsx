import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Play, Plus } from 'lucide-react';
import { usePermissions } from '../../../hooks/usePermissions';
import api from '../../../services/api';
import { Button, Checkbox, Field, Input, Select } from '../../../components/ds';
import { useToast } from '../../../components/dashboard/toast';
import {
    FilterSwitch, fetchModerationFilters, saveModerationFilter, type FilterSeverity
} from './filterSwitch';
import { Chip, ModerationPage, OffNotice, PageLoading, SaveBar, Section, SeveritySelect, StatusText, TestResultBox, hintCls } from './parts';

interface LinkSettings {
    allowedDomains: string[];
    allowSubscribers: boolean;
    allowVips: boolean;
    detectObfuscated: boolean;
    permitSeconds: number;
    permitSingleMessage: boolean;
}

interface TestResult {
    hasMatch: boolean;
    filter?: string;
    filterEnabled?: boolean;
    matchedWord?: string;
    actionNormal?: string;
}

const DEFAULT_SETTINGS: LinkSettings = {
    allowedDomains: [],
    allowSubscribers: false,
    allowVips: false,
    detectObfuscated: true,
    permitSeconds: 60,
    permitSingleMessage: false
};

const DEFAULT_MESSAGE = '🔗 $(user), no se permiten links sin permiso de un moderador. Strike $(strike)/5';

const PERMIT_SECONDS = [30, 60, 120, 300, 600];

/** "https://www.YouTube.com/watch?v=x" → "youtube.com"; null si no parece un dominio. Igual que el backend. */
function normalizeDomain(value: string): string | null {
    let d = value.trim().toLowerCase();
    const scheme = d.indexOf('://');
    if (scheme >= 0) d = d.slice(scheme + 3);
    d = d.split(/[/?#:]/)[0];
    if (d.startsWith('*.')) d = d.slice(2);
    if (d.startsWith('www.')) d = d.slice(4);
    d = d.replace(/^\.+|\.+$/g, '');
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}

export default function LinksFilter() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { t } = useTranslation('moderation');
    const { toast, showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [severity, setSeverity] = useState<FilterSeverity>('leve');
    const [settings, setSettings] = useState<LinkSettings>(DEFAULT_SETTINGS);
    const [message, setMessage] = useState('');
    const [newDomain, setNewDomain] = useState('');
    const [domainError, setDomainError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [togglingSaving, setTogglingSaving] = useState(false);
    const showNotice = (type: 'success' | 'error', text: string) => showToast(text, type);

    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (permissionsLoading) return;
        if (!hasMinimumLevel('moderation')) {
            navigate('/dashboard');
            return;
        }
        fetchModerationFilters()
            .then(filters => {
                const links = filters.find(f => f.key === 'links');
                if (links) {
                    setEnabled(links.enabled);
                    setSeverity(links.severity);
                    setSettings({ ...DEFAULT_SETTINGS, ...(links.settings as Partial<LinkSettings>) });
                    setMessage(links.message ?? '');
                }
            })
            .catch(() => showNotice('error', t('common.loadFailed')))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const toggle = async (next: boolean) => {
        setEnabled(next);
        setTogglingSaving(true);
        try {
            if (!(await saveModerationFilter('links', { enabled: next }))) throw new Error();
        } catch {
            setEnabled(!next);
            showNotice('error', t('common.toggleFailed'));
        } finally {
            setTogglingSaving(false);
        }
    };

    const addDomain = () => {
        if (!newDomain.trim()) return;
        const domain = normalizeDomain(newDomain);
        if (!domain) {
            setDomainError(t('links.domainError'));
            return;
        }
        setDomainError(null);
        if (!settings.allowedDomains.includes(domain)) {
            setSettings({ ...settings, allowedDomains: [...settings.allowedDomains, domain] });
        }
        setNewDomain('');
    };

    const removeDomain = (domain: string) =>
        setSettings({ ...settings, allowedDomains: settings.allowedDomains.filter(d => d !== domain) });

    const save = async () => {
        setSaving(true);
        try {
            const ok = await saveModerationFilter('links', { severity, settings: { ...settings }, message });
            showNotice(ok ? 'success' : 'error', ok ? t('common.saved') : t('common.saveFailed'));
        } catch {
            showNotice('error', t('common.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const runTest = async () => {
        if (!testMessage.trim()) return;
        setTesting(true);
        try {
            const res = await api.post('/moderation/test-message', { message: testMessage, filter: 'links' });
            if (res.data.success) setTestResult(res.data);
        } catch {
            showNotice('error', t('links.analyzeFailed'));
        } finally {
            setTesting(false);
        }
    };

    if (!permissionsLoading && !hasMinimumLevel('moderation')) return null;

    return (
        <ModerationPage
            title={t('links.title')}
            subtitle={<Trans i18nKey="links.subtitle" ns="moderation" components={{ code: <code /> }} />}
            toast={toast}
            actions={!loading && (
                <div className="flex items-center gap-3">
                    <StatusText on={enabled} />
                    <FilterSwitch on={enabled} disabled={togglingSaving} onChange={toggle} label={t('links.toggleLabel')} />
                </div>
            )}
        >
            {!loading && !enabled && <OffNotice>{t('links.offNotice')}</OffNotice>}

            {loading ? <PageLoading /> : (
                <div className="space-y-6">
                    <Section
                        title={t('links.allowed.title')}
                        hint={<Trans i18nKey="links.allowed.hint" ns="moderation" components={{ code: <code /> }} />}
                    >
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={newDomain}
                                onChange={(e) => { setNewDomain(e.target.value); setDomainError(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                                placeholder="youtube.com"
                                error={!!domainError}
                            />
                            <Button variant="secondary" icon={<Plus />} onClick={addDomain}>{t('common.add')}</Button>
                        </div>
                        {domainError && <p className="text-sm text-ds-danger mt-2">{domainError}</p>}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {settings.allowedDomains.length === 0 ? (
                                <p className={hintCls}>{t('links.allowed.none')}</p>
                            ) : settings.allowedDomains.map(domain => (
                                <Chip key={domain} onRemove={() => removeDomain(domain)} removeLabel={t('common.remove', { name: domain })}>{domain}</Chip>
                            ))}
                        </div>
                    </Section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Section
                            title={t('links.who.title')}
                            hint={t('links.who.hint')}
                        >
                            <div className="space-y-3">
                                <Checkbox label={t('links.who.subs')} checked={settings.allowSubscribers} onChange={(e) => setSettings({ ...settings, allowSubscribers: e.target.checked })} />
                                <div><Checkbox label={t('links.who.vips')} checked={settings.allowVips} onChange={(e) => setSettings({ ...settings, allowVips: e.target.checked })} /></div>
                            </div>
                        </Section>

                        <Section title={t('links.obf.title')} hint={t('links.obf.hint')}>
                            <Checkbox
                                label={<Trans i18nKey="links.obf.label" ns="moderation" components={{ code: <code /> }} />}
                                checked={settings.detectObfuscated}
                                onChange={(e) => setSettings({ ...settings, detectObfuscated: e.target.checked })}
                            />
                        </Section>
                    </div>

                    <Section
                        title={t('links.permit.title')}
                        hint={<Trans i18nKey="links.permit.hint" ns="moderation" components={{ code: <code /> }} />}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={t('links.permit.duration')}>
                                <Select value={settings.permitSeconds} onChange={(e) => setSettings({ ...settings, permitSeconds: Number(e.target.value) })}>
                                    {PERMIT_SECONDS.map(v => <option key={v} value={v}>{t(`links.permit.durations.${v}`)}</option>)}
                                </Select>
                            </Field>
                            <div>
                                <span className="ds-label block mb-2">{t('links.permit.what')}</span>
                                <div className="space-y-2">
                                    <Checkbox radio name="permitMode" label={t('links.permit.allLinks')} checked={!settings.permitSingleMessage} onChange={() => setSettings({ ...settings, permitSingleMessage: false })} />
                                    <div><Checkbox radio name="permitMode" label={t('links.permit.oneMessage')} checked={settings.permitSingleMessage} onChange={() => setSettings({ ...settings, permitSingleMessage: true })} /></div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section
                        title={t('links.sanction.title')}
                        hint={t('links.sanction.hint')}
                    >
                        <div className="space-y-4">
                            <Field label={t('common.severity')}><SeveritySelect long value={severity} onChange={setSeverity} /></Field>
                            <Field label={t('common.chatMessage')} hint={t('links.sanction.messageHint')}>
                                <Input value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder={DEFAULT_MESSAGE} />
                            </Field>
                        </div>
                    </Section>

                    <SaveBar saving={saving} onClick={save} label={t('common.saveSettings')} savingLabel={t('common.saving')} />

                    <Section title={t('links.test.title')} hint={t('links.test.hint')}>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runTest()}
                                placeholder={t('links.test.placeholder')}
                            />
                            <Button onClick={runTest} loading={testing} disabled={testing} icon={<Play />}>{testing ? t('common.analyzing') : t('common.analyze')}</Button>
                        </div>
                        {testResult && (
                            <div className="mt-4">
                                <TestResultBox match={testResult.hasMatch}>
                                    {testResult.hasMatch ? (
                                        <div className="space-y-1">
                                            <p className="font-bold text-ds-danger">{t('links.test.blocked', { domain: testResult.matchedWord })}</p>
                                            <p className="text-sm text-ds-text">
                                                {t('links.test.actionNormal', { action: t(`actions.${testResult.actionNormal ?? ''}`, { defaultValue: testResult.actionNormal ?? '' }) })}
                                            </p>
                                            {testResult.filterEnabled === false && (
                                                <p className="text-sm font-semibold text-ds-warn">{t('links.test.offWarn')}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="font-bold text-ds-ok">{t('links.test.passes')}</p>
                                    )}
                                </TestResultBox>
                            </div>
                        )}
                    </Section>
                </div>
            )}
        </ModerationPage>
    );
}
