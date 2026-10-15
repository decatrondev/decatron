import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Field, Input, Spinner } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import { ConfigCard, ConfigHeader } from '../../components/dashboard/config';
import api from '../../services/api';

// Tenants de la plataforma (decatron.top). .dev/plans/plataforma/FASE4_DISENO.md, paso 4.
// El dueño carga aquí la app de Twitch de cada tenant. Los secretos son SOLO ESCRITURA: nunca se devuelven, solo «configurado, …últimos 4».

interface AppSummary { clientId: string; redirectUri: string | null; scopes: string | null; secretHint: string | null; status: string; lastValidatedAt: string | null }
interface Tenant { id: number; slug: string; name: string; status: string; mode: string; twitchApp: AppSummary | null }
interface Form { clientId: string; clientSecret: string; redirectUri: string; scopes: string }

const EMPTY: Form = { clientId: '', clientSecret: '', redirectUri: '', scopes: '' };

export default function PlatformTenantsAdmin() {
    const { t, i18n } = useTranslation('platform');
    const navigate = useNavigate();
    const [items, setItems] = useState<Tenant[] | null>(null);
    const [error, setError] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const [editing, setEditing] = useState<Tenant | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [toDelete, setToDelete] = useState<Tenant | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/platform/tenants');
            setItems(res.data.items);
            setError(false);
        } catch { setError(true); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language);
    const errText = (code?: string) => t(`tenants.errors.${code}`, { defaultValue: t('tenants.errors.generic') });

    const openEdit = (row: Tenant) => {
        setForm({ ...EMPTY, clientId: row.twitchApp?.clientId ?? '', redirectUri: row.twitchApp?.redirectUri ?? '', scopes: row.twitchApp?.scopes ?? '' });
        setEditing(row);
    };

    const save = async () => {
        if (!editing) return;
        setBusy(true);
        try {
            await api.put(`/admin/platform/tenants/${editing.id}/twitch-app`, form);
            setNote({ ok: true, text: t('tenants.saved') });
            setEditing(null);
            setForm(EMPTY); // el secreto no se queda en memoria de la pantalla
            await load();
        } catch (e: any) {
            setNote({ ok: false, text: errText(e?.response?.data?.code) });
        }
        setBusy(false);
    };

    const remove = async () => {
        if (!toDelete) return;
        setBusy(true);
        try {
            await api.delete(`/admin/platform/tenants/${toDelete.id}/twitch-app`);
            setNote({ ok: true, text: t('tenants.deleted') });
            setToDelete(null);
            await load();
        } catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    if (error) return <div className="panel-scale"><Alert tone="danger">{t('tenants.loadFailed')}</Alert></div>;
    if (!items) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

    const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <div className="panel-scale space-y-6">
            <ConfigHeader onBack={() => navigate('/admin')} icon={<KeyRound />} title={t('tenants.title')} subtitle={t('tenants.subtitle')} />
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}

            {items.map(row => (
                <ConfigCard key={row.id} icon={<KeyRound />} title={`${row.name} (#${row.id})`} hint={row.slug}>
                    {row.id === 1 ? (
                        <p className="text-sm text-ds-soft">{t('tenants.legacy')}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={row.twitchApp?.status === 'ok' ? 'ok' : 'warn'}>
                                    {row.twitchApp ? t(`tenants.status.${row.twitchApp.status}`, { defaultValue: row.twitchApp.status }) : t('tenants.notConfigured')}
                                </Badge>
                                {row.twitchApp?.secretHint && <span className="text-sm text-ds-soft">{t('tenants.secretSet', { hint: row.twitchApp.secretHint })}</span>}
                            </div>
                            {row.twitchApp && (
                                <dl className="text-sm grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
                                    <dt className="text-ds-soft">{t('tenants.clientId')}</dt><dd className="text-ds-text break-all">{row.twitchApp.clientId}</dd>
                                    <dt className="text-ds-soft">{t('tenants.redirectUri')}</dt><dd className="text-ds-text break-all">{row.twitchApp.redirectUri ?? '—'}</dd>
                                    <dt className="text-ds-soft">{t('tenants.validatedAt')}</dt><dd className="text-ds-text">{row.twitchApp.lastValidatedAt ? fmt(row.twitchApp.lastValidatedAt) : '—'}</dd>
                                </dl>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => openEdit(row)}>{row.twitchApp ? t('tenants.replace') : t('tenants.load')}</Button>
                                {row.twitchApp && (
                                    <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={() => setToDelete(row)}>{t('tenants.remove')}</Button>
                                )}
                            </div>
                        </div>
                    )}
                </ConfigCard>
            ))}

            {editing && (
                <ModalShell
                    title={t('tenants.formTitle', { name: editing.name })} size="lg" onClose={() => { if (!busy) { setEditing(null); setForm(EMPTY); } }}
                    actions={<>
                        <Button variant="ghost" onClick={() => { setEditing(null); setForm(EMPTY); }} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button onClick={save} loading={busy} disabled={!form.clientId.trim() || !form.clientSecret.trim()}>{t('tenants.validateSave')}</Button>
                    </>}
                >
                    <div className="space-y-4">
                        <p className="text-sm text-ds-soft">{t('tenants.formHelp')}</p>
                        <Field label={t('tenants.clientId')}><Input value={form.clientId} onChange={set('clientId')} autoComplete="off" spellCheck={false} /></Field>
                        <Field label={t('tenants.clientSecret')} hint={t('tenants.secretHint')}>
                            <Input type="password" value={form.clientSecret} onChange={set('clientSecret')} autoComplete="new-password" spellCheck={false} />
                        </Field>
                        <Field label={t('tenants.redirectUri')} hint={t('tenants.redirectHint')}><Input value={form.redirectUri} onChange={set('redirectUri')} placeholder="https://" autoComplete="off" /></Field>
                        <Field label={t('tenants.scopes')} hint={t('tenants.scopesHint')}><Input value={form.scopes} onChange={set('scopes')} autoComplete="off" spellCheck={false} /></Field>
                    </div>
                </ModalShell>
            )}

            {toDelete && (
                <ModalShell
                    title={t('tenants.removeTitle')} size="md" onClose={() => !busy && setToDelete(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" onClick={remove} loading={busy}>{t('tenants.remove')}</Button>
                    </>}
                >
                    <p className="text-ds-soft">{t('tenants.removeText', { name: toDelete.name })}</p>
                </ModalShell>
            )}
        </div>
    );
}
