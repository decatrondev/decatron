import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Field, Input, Textarea } from '../../components/ds';
import ModalShell from '../../components/dashboard/ModalShell';
import type { AxiosInstance } from 'axios';
import api from '../../services/api';

// Llaves propias de IA, voz y traducción de un tenant (Fase 5.8). .dev/plans/plataforma/FASE5_8_DISENO.md.
// SOLO ESCRITURA: la llave nunca vuelve del servidor, solo «configurada, …últimos 4».

export interface ByoSummary { provider: string; hint: string; config: Record<string, string>; status: string; updatedAt: string }
const PROVIDERS = ['ai', 'deepgram', 'fishaudio'] as const;
type Provider = typeof PROVIDERS[number];
interface Form { apiKey: string; baseUrl: string; model: string; fallbackModel: string; voices: string }
const EMPTY: Form = { apiKey: '', baseUrl: '', model: '', fallbackModel: '', voices: '' };

// `client` y `basePath` permiten usarla también en el panel del comprador (su propia sesión y sus propios endpoints).
export default function PlatformByoSection({ tenantId, tenantName, byo, onChanged, client, basePath }: { tenantId: number; tenantName: string; byo: Record<string, ByoSummary | null> | null; onChanged: () => void; client?: AxiosInstance; basePath?: string }) {
    const http = client ?? api;
    const { t, i18n } = useTranslation('platform');
    const [editing, setEditing] = useState<Provider | null>(null);
    const [removing, setRemoving] = useState<Provider | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

    const errText = (code?: string) => t(`tenants.errors.${code}`, { defaultValue: t('tenants.errors.generic') });
    const base = basePath ?? `/admin/platform/tenants/${tenantId}/byo`;
    const close = () => { setEditing(null); setForm(EMPTY); }; // la llave no se queda en memoria de la pantalla

    const open = (p: Provider) => {
        const c = byo?.[p]?.config ?? {};
        setForm({ apiKey: '', baseUrl: c.base_url ?? '', model: c.model ?? '', fallbackModel: c.fallback_model ?? '', voices: c.voices ?? '' });
        setEditing(p);
    };

    const run = async (fn: () => Promise<unknown>, okText: string, after?: () => void) => {
        setBusy(true);
        try { await fn(); setNote({ ok: true, text: okText }); after?.(); onChanged(); }
        catch (e: any) { setNote({ ok: false, text: errText(e?.response?.data?.code) }); }
        setBusy(false);
    };

    const save = () => editing && run(() => http.put(`${base}/${editing}`, {
        apiKey: form.apiKey, baseUrl: form.baseUrl, model: form.model, fallbackModel: form.fallbackModel, voices: form.voices,
    }), t('tenants.byo.saved'), close);

    const canSave = form.apiKey.trim().length >= 8 && (editing !== 'ai' || (form.baseUrl.trim() !== '' && form.model.trim() !== ''));

    return (
        <div className="pt-3 border-t border-ds-border space-y-3">
            <div>
                <span className="text-sm font-bold text-ds-text">{t('tenants.byo.title')}</span>
                <p className="text-sm text-ds-soft">{t('tenants.byo.help')}</p>
            </div>
            {note && <Alert tone={note.ok ? 'ok' : 'danger'}>{note.text}</Alert>}
            <ul className="space-y-3">
                {PROVIDERS.map(p => {
                    const s = byo?.[p] ?? null;
                    return (
                        <li key={p} className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-ds-text">{t(`tenants.byo.providers.${p}.name`)}</span>
                                {s ? <Badge tone="ok">{t('tenants.byo.configured', { hint: s.hint })}</Badge> : <Badge tone="warn">{t('tenants.byo.none')}</Badge>}
                                {s?.config.model && <span className="text-sm text-ds-soft">{s.config.model}</span>}
                                {s && <span className="text-sm text-ds-soft">{new Date(s.updatedAt).toLocaleDateString(i18n.language)}</span>}
                            </div>
                            <p className="text-sm text-ds-soft">{t(`tenants.byo.providers.${p}.help`)}</p>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" disabled={busy} onClick={() => open(p)}>{s ? t('tenants.byo.replace') : t('tenants.byo.load')}</Button>
                                {s && <Button size="sm" variant="ghost" loading={busy} onClick={() => run(() => http.post(`${base}/${p}/test`), t('tenants.byo.tested'))}>{t('tenants.byo.test')}</Button>}
                                {s && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(p)}>{t('tenants.byo.remove')}</Button>}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {editing && (
                <ModalShell title={t('tenants.byo.formTitle', { provider: t(`tenants.byo.providers.${editing}.name`), name: tenantName })} size="lg" onClose={() => !busy && close()}
                    actions={<>
                        <Button variant="ghost" onClick={close} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button onClick={save} loading={busy} disabled={!canSave}>{t('tenants.validateSave')}</Button>
                    </>}>
                    <div className="space-y-4">
                        <p className="text-sm text-ds-soft">{t(`tenants.byo.providers.${editing}.formHelp`)}</p>
                        <Field label={t('tenants.byo.apiKey')} hint={t('tenants.byo.apiKeyHint')}>
                            <Input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} autoComplete="new-password" spellCheck={false} />
                        </Field>
                        {editing === 'ai' && (<>
                            <Field label={t('tenants.byo.baseUrl')} hint={t('tenants.byo.baseUrlHint')}>
                                <Input value={form.baseUrl} placeholder="https://openrouter.ai/api/v1" onChange={e => setForm({ ...form, baseUrl: e.target.value })} autoComplete="off" spellCheck={false} />
                            </Field>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label={t('tenants.byo.model')}><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} autoComplete="off" spellCheck={false} /></Field>
                                <Field label={t('tenants.byo.fallbackModel')} hint={t('tenants.byo.optional')}><Input value={form.fallbackModel} onChange={e => setForm({ ...form, fallbackModel: e.target.value })} autoComplete="off" spellCheck={false} /></Field>
                            </div>
                        </>)}
                        {editing === 'fishaudio' && (
                            <Field label={t('tenants.byo.voices')} hint={t('tenants.byo.voicesHint')}>
                                <Textarea rows={5} value={form.voices} placeholder={'[{"name":"Toji","referenceId":"…"}]'} onChange={e => setForm({ ...form, voices: e.target.value })} spellCheck={false} />
                            </Field>
                        )}
                    </div>
                </ModalShell>
            )}

            {removing && (
                <ModalShell title={t('tenants.byo.removeTitle')} size="md" onClose={() => !busy && setRemoving(null)}
                    actions={<>
                        <Button variant="ghost" onClick={() => setRemoving(null)} disabled={busy}>{t('admin.cancel')}</Button>
                        <Button variant="danger" loading={busy} onClick={() => run(() => http.delete(`${base}/${removing}`), t('tenants.byo.removed'), () => setRemoving(null))}>{t('tenants.byo.remove')}</Button>
                    </>}>
                    <p className="text-ds-soft">{t('tenants.byo.removeText', { provider: t(`tenants.byo.providers.${removing}.name`), name: tenantName })}</p>
                </ModalShell>
            )}
        </div>
    );
}
