import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, EyeOff, Eye, Layers, Trash2, X, Copy } from 'lucide-react';
import { Card, Field, Select, inputClass } from '../../../components/overlay-editor/ui';
import UploadForm from '../../../components/channel-emotes/UploadForm';
import { EmoteThumb, NAME_PATTERN, formatBytes, type EmoteDto } from '../../../components/channel-emotes/shared';
import type { ChannelEmotesState, UploadMode } from './useChannelEmotes';

export type EmotesTabId = 'mine' | 'upload' | 'review' | 'settings';

interface TabProps { s: ChannelEmotesState }

const btn = 'px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const btnGray = `${btn} bg-ds-raised text-ds-soft hover:bg-ds-raised `;
const btnBlue = `${btn} bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent`;
const btnRed = `${btn} bg-ds-danger-solid hover:bg-ds-danger-hover text-ds-on-accent`;
const chip = 'px-2 py-0.5 rounded-full text-[11px] 3xl:text-xs font-bold';

const STATUS_CHIP: Record<string, string> = {
    approved: 'bg-ds-accent/10 text-ds-ok ',
    hidden: 'bg-ds-faint/10 text-ds-soft ',
    pending: 'bg-ds-warn/10 text-ds-warn ',
    rejected: 'bg-ds-danger-solid/10 text-ds-danger ',
    removed: 'bg-ds-danger-solid/10 text-ds-danger ',
};

// ── Mis emotes ─────────────────────────────────────────────────────────────

function EmoteCard({ e, s }: { e: EmoteDto; s: ChannelEmotesState }) {
    const { t } = useTranslation('emotes');
    const [name, setName] = useState(e.name);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const act = async (fn: () => Promise<string | null>) => {
        setBusy(true);
        const err = await fn();
        setBusy(false);
        setError(err);
        return err;
    };

    const saveName = async () => {
        if (name === e.name) { setEditing(false); return; }
        if (!NAME_PATTERN.test(name)) { setError('invalid_name'); return; }
        if (!(await act(() => s.update(e.id, { name })))) setEditing(false);
    };

    const remove = async () => {
        // Si lo subió otra persona, ella verá el motivo en su lista
        const own = e.uploadedBy.toLowerCase() === s.channelLogin.toLowerCase();
        const reason = own ? '' : window.prompt(t('panel.deleteReason', { user: e.uploadedBy }));
        if (reason === null) return;
        if (!window.confirm(t('panel.deleteConfirm', { name: e.name }))) return;
        await act(() => s.remove(e.id, reason || undefined));
    };

    return (
        <div className={`rounded-lg border border-ds-border bg-ds-surface p-3 flex flex-col gap-2 ${e.status === 'hidden' ? 'opacity-60' : ''}`}>
            <div className="flex justify-center"><EmoteThumb src={e.urls.x2} name={e.name} height={48} bg="checker" /></div>
            {editing ? (
                <div className="flex gap-1">
                    <input className={inputClass} value={name} onChange={ev => setName(ev.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 25))} onKeyDown={ev => { if (ev.key === 'Enter') saveName(); }} autoFocus />
                    <button type="button" className={btnBlue} onClick={saveName} disabled={busy} aria-label={t('panel.save')}><Check className="w-4 h-4" /></button>
                </div>
            ) : (
                <button type="button" onClick={() => setEditing(true)} className="font-bold text-sm 3xl:text-base text-ds-text truncate text-center hover:text-ds-accent-text" title={t('panel.rename')}>{e.name}</button>
            )}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className={`${chip} ${STATUS_CHIP[e.status]}`}>{t(`status.${e.status}`)}</span>
                {e.animated && <span className={`${chip} bg-ds-accent/10 text-ds-accent-text `}>GIF</span>}
                {e.zeroWidth && <span className={`${chip} bg-ds-accent/10 text-ds-accent-text `}>{t('panel.overlap')}</span>}
                {(e.reports ?? 0) > 0 && <span className={`${chip} bg-ds-danger-solid/10 text-ds-danger `}>{t('panel.reports', { count: e.reports })}</span>}
            </div>
            <p className="text-[11px] 3xl:text-xs text-center text-ds-soft truncate">{t('panel.by', { user: e.uploadedBy })} · {formatBytes(e.bytes)}</p>
            {error && <p className="text-xs text-ds-danger text-center">{t(`errors.${error}`, { defaultValue: t('errors.server_error') })}</p>}
            <div className="flex flex-wrap items-center justify-center gap-1 mt-auto">
                <button type="button" className={btnGray} disabled={busy} onClick={() => act(() => s.update(e.id, { visible: e.status === 'hidden' }))} title={e.status === 'hidden' ? t('panel.show') : t('panel.hide')} aria-label={e.status === 'hidden' ? t('panel.show') : t('panel.hide')}>
                    {e.status === 'hidden' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button type="button" className={e.zeroWidth ? btnBlue : btnGray} disabled={busy} onClick={() => act(() => s.update(e.id, { zeroWidth: !e.zeroWidth }))} title={`${t('upload.zeroWidth')}: ${t('upload.zeroWidthHint')}`} aria-label={t('upload.zeroWidth')} aria-pressed={e.zeroWidth}>
                    <Layers className="w-4 h-4" />
                </button>
                <button type="button" className={btnGray} onClick={() => navigator.clipboard?.writeText(e.name)} title={t('panel.copyName')} aria-label={t('panel.copyName')}><Copy className="w-4 h-4" /></button>
                <button type="button" className={`${btn} text-ds-danger hover:bg-ds-danger/10 `} disabled={busy} onClick={remove} title={t('panel.delete')} aria-label={t('panel.delete')}><Trash2 className="w-4 h-4" /></button>
            </div>
        </div>
    );
}

export function MyEmotesTab({ s, onUpload }: TabProps & { onUpload: () => void }) {
    const { t } = useTranslation('emotes');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'approved' | 'hidden'>('all');
    const live = useMemo(() => s.emotes.filter(e => e.status === 'approved' || e.status === 'hidden'), [s.emotes]);
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return live.filter(e => (filter === 'all' || e.status === filter) && (!q || e.name.toLowerCase().includes(q)));
    }, [live, search, filter]);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
                <input className={`${inputClass} max-w-xs`} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('panel.search')} />
                <div className="w-48">
                    <Select<'all' | 'approved' | 'hidden'> value={filter} onChange={setFilter}
                        options={[{ value: 'all', label: t('panel.filterAll') }, { value: 'approved', label: t('status.approved') }, { value: 'hidden', label: t('status.hidden') }]} />
                </div>
            </div>
            {live.length === 0 ? (
                <Card>
                    <div className="text-center py-8 space-y-4">
                        <p className="text-ds-soft">{t('panel.empty')}</p>
                        {s.canUpload && <button type="button" className={btnBlue} onClick={onUpload}>{t('panel.uploadFirst')}</button>}
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                    {shown.map(e => <EmoteCard key={e.id} e={e} s={s} />)}
                </div>
            )}
        </div>
    );
}

// ── Subir ──────────────────────────────────────────────────────────────────

export function UploadTab({ s }: TabProps) {
    const { t } = useTranslation('emotes');
    const full = s.usage.used >= s.usage.max;
    return (
        <div className="space-y-4">
            <UploadForm
                allowZeroWidth
                onSubmit={(file, name, zw) => s.upload(file, name, zw)}
                disabledReason={!s.canUpload ? t('panel.cannotUpload') : full ? t('errors.limit_reached') : null}
            />
        </div>
    );
}

// ── Revisión ───────────────────────────────────────────────────────────────

function PendingRow({ e, selected, onToggle, s }: { e: EmoteDto; selected: boolean; onToggle: () => void; s: ChannelEmotesState }) {
    const { t } = useTranslation('emotes');
    const [reason, setReason] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const decide = async (approve: boolean) => {
        setBusy(true);
        const err = await s.review(e.id, approve, approve ? undefined : reason);
        setBusy(false);
        setError(err);
    };

    return (
        <div className="rounded-lg border border-ds-border bg-ds-surface p-3 flex flex-wrap items-center gap-4">
            <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4" aria-label={t('review.select', { name: e.name })} />
            <div className="flex items-center gap-2">
                <EmoteThumb src={e.urls.x2} name={e.name} height={48} bg="dark" />
                <EmoteThumb src={e.urls.x2} name={e.name} height={48} bg="light" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-bold text-ds-text truncate">{e.name}</p>
                <p className="text-xs 3xl:text-sm text-ds-soft">{t('panel.by', { user: e.uploadedBy })} · {formatBytes(e.bytes)}{e.animated ? ' · GIF' : ''}</p>
                {error && <p className="text-xs text-ds-danger mt-1">{t(`errors.${error}`, { defaultValue: t('errors.server_error') })}</p>}
            </div>
            {rejecting ? (
                <div className="flex flex-wrap items-center gap-2">
                    <input className={`${inputClass} w-56`} value={reason} onChange={ev => setReason(ev.target.value)} placeholder={t('review.reasonPlaceholder')} maxLength={300} />
                    <button type="button" className={btnRed} disabled={busy} onClick={() => decide(false)}>{t('review.confirmReject')}</button>
                    <button type="button" className={btnGray} onClick={() => setRejecting(false)}>{t('panel.cancel')}</button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button type="button" className={btnBlue} disabled={busy} onClick={() => decide(true)}><Check className="w-4 h-4 inline -mt-0.5" /> {t('review.approve')}</button>
                    <button type="button" className={btnGray} disabled={busy} onClick={() => setRejecting(true)}><X className="w-4 h-4 inline -mt-0.5" /> {t('review.reject')}</button>
                </div>
            )}
        </div>
    );
}

export function ReviewTab({ s }: TabProps) {
    const { t } = useTranslation('emotes');
    const pending = useMemo(() => s.emotes.filter(e => e.status === 'pending'), [s.emotes]);
    const reported = useMemo(() => s.emotes.filter(e => (e.reports ?? 0) > 0 && (e.status === 'approved' || e.status === 'hidden')), [s.emotes]);
    const history = useMemo(() => s.emotes.filter(e => e.status === 'rejected' || e.status === 'removed'), [s.emotes]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [batchReason, setBatchReason] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    const toggle = (id: number) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const ids = [...selected].filter(id => pending.some(p => p.id === id));

    const batch = async (approve: boolean) => {
        const err = await s.reviewBatch(ids, approve, approve ? undefined : batchReason);
        setMessage(err ? t(`errors.${err}`, { defaultValue: t('errors.server_error') }) : null);
        if (!err) setSelected(new Set());
    };

    return (
        <div className="space-y-6">
            <Card title={t('review.pendingTitle', { count: pending.length })} description={t('review.pendingDescription')}>
                {pending.length === 0 ? (
                    <p className="text-sm text-ds-soft">{t('review.noPending')}</p>
                ) : (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className={btnGray} onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map(p => p.id)))}>
                                {selected.size === pending.length ? t('review.selectNone') : t('review.selectAll')}
                            </button>
                            {ids.length > 0 && (
                                <>
                                    <button type="button" className={btnBlue} onClick={() => batch(true)}>{t('review.approveSelected', { count: ids.length })}</button>
                                    <input className={`${inputClass} w-56`} value={batchReason} onChange={e => setBatchReason(e.target.value)} placeholder={t('review.reasonPlaceholder')} maxLength={300} />
                                    <button type="button" className={btnRed} onClick={() => batch(false)}>{t('review.rejectSelected', { count: ids.length })}</button>
                                </>
                            )}
                        </div>
                        {message && <p className="text-sm text-ds-danger font-semibold">{message}</p>}
                        {pending.map(e => <PendingRow key={e.id} e={e} selected={selected.has(e.id)} onToggle={() => toggle(e.id)} s={s} />)}
                    </div>
                )}
            </Card>

            {reported.length > 0 && (
                <Card title={t('review.reportedTitle', { count: reported.length })} description={t('review.reportedDescription')}>
                    <div className="space-y-3">
                        {reported.map(e => {
                            const info = s.reports.find(r => r.emoteId === e.id);
                            return (
                                <div key={e.id} className="rounded-lg border border-ds-danger/40 p-3 flex flex-wrap items-center gap-4">
                                    <EmoteThumb src={e.urls.x2} name={e.name} height={44} bg="checker" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-ds-text">{e.name} · {t('panel.reports', { count: e.reports })}</p>
                                        {info && info.reasons.length > 0 && <p className="text-xs 3xl:text-sm text-ds-soft break-words">{info.reasons.join(' · ')}</p>}
                                    </div>
                                    <button type="button" className={btnGray} onClick={() => s.dismissReports(e.id)}>{t('review.dismiss')}</button>
                                    <button type="button" className={btnGray} onClick={() => s.update(e.id, { visible: false })}>{t('panel.hide')}</button>
                                    <button type="button" className={btnRed} onClick={() => { if (window.confirm(t('panel.deleteConfirm', { name: e.name }))) s.remove(e.id); }}>{t('panel.delete')}</button>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {history.length > 0 && (
                <Card title={t('review.historyTitle')} actions={<button type="button" className={btnGray} onClick={() => s.purgeHistory()}>{t('review.purge')}</button>}>
                    <div className="space-y-2">
                        {history.map(e => (
                            <div key={e.id} className="flex flex-wrap items-center gap-3 text-sm">
                                <span className="font-bold text-ds-text">{e.name}</span>
                                <span className={`${chip} ${STATUS_CHIP[e.status]}`}>{t(`status.${e.status}`)}</span>
                                <span className="text-ds-soft">{t('panel.by', { user: e.uploadedBy })}{e.reviewedBy ? ` · ${t('review.reviewedBy', { user: e.reviewedBy })}` : ''}{e.reason ? ` · ${e.reason}` : ''}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

// ── Configuración ──────────────────────────────────────────────────────────

const MODES: UploadMode[] = ['owner', 'staff', 'approval', 'list'];

export function SettingsTab({ s }: TabProps) {
    const { t } = useTranslation('emotes');
    const [login, setLogin] = useState('');
    const [platform, setPlatform] = useState<'twitch' | 'kick'>('twitch');
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const publicUrl = `${window.location.origin}/emotes/${s.channelLogin}`;

    // Los permitidos se cargan al entrar a esta pestaña
    useEffect(() => {
        if (s.isOwnerLevel) s.loadUploaders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.isOwnerLevel]);

    const save = async (patch: { uploadMode?: UploadMode; maxPendingPerUser?: number }) => {
        const err = await s.saveSettings(patch);
        setError(err);
        setSaved(!err);
        window.setTimeout(() => setSaved(false), 2000);
    };

    const add = async () => {
        if (!login.trim()) return;
        const err = await s.addUploader(platform, login);
        setError(err);
        if (!err) setLogin('');
    };

    if (!s.isOwnerLevel) {
        return <Card title={t('settings.title')}><p className="text-sm text-ds-soft">{t('settings.ownerOnly')}</p></Card>;
    }

    return (
        <div className="space-y-6">
            <Card title={t('settings.modeTitle')} description={t('settings.modeDescription')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODES.map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => save({ uploadMode: m })}
                            className={`text-left p-4 rounded-lg border transition-colors ${s.settings.uploadMode === m ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border hover:border-ds-accent'}`}
                        >
                            <span className="block font-bold text-ds-text">{t(`settings.modes.${m}.name`)}</span>
                            <span className="block text-xs 3xl:text-sm text-ds-soft mt-1">{t(`settings.modes.${m}.description`)}</span>
                        </button>
                    ))}
                </div>
                {(s.settings.uploadMode === 'approval') && (
                    <div className="mt-5 max-w-xs">
                        <Field label={t('settings.maxPending')} hint={t('settings.maxPendingHint')}>
                            <input type="number" min={1} max={50} className={inputClass} value={s.settings.maxPendingPerUser}
                                onChange={e => { const v = Math.min(50, Math.max(1, Number(e.target.value) || 1)); save({ maxPendingPerUser: v }); }} />
                        </Field>
                    </div>
                )}
                {saved && <p className="text-sm font-semibold text-ds-ok mt-3">{t('settings.saved')}</p>}
                {error && <p className="text-sm font-semibold text-ds-danger mt-3">{t(`errors.${error}`, { defaultValue: t('errors.server_error') })}</p>}
            </Card>

            <Card title={t('settings.uploadersTitle')} description={t('settings.uploadersDescription')}>
                <div className="flex flex-wrap gap-2">
                    <div className="w-32"><Select<'twitch' | 'kick'> value={platform} onChange={setPlatform} options={[{ value: 'twitch', label: 'Twitch' }, { value: 'kick', label: 'Kick' }]} /></div>
                    <input className={`${inputClass} max-w-xs`} value={login} onChange={e => setLogin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder={t('settings.uploaderPlaceholder')} maxLength={40} />
                    <button type="button" className={btnBlue} onClick={add}>{t('settings.add')}</button>
                </div>
                {s.uploaders.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {s.uploaders.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full text-xs 3xl:text-sm font-bold bg-ds-raised text-ds-soft">
                                {u.login} <span className="opacity-60 font-normal">({u.platform})</span>
                                <button type="button" onClick={() => s.removeUploader(u.id)} aria-label={t('settings.remove', { name: u.login })} className="ds-btn ds-btn--ghost ds-icon-btn ds-btn--sm"><X className="w-3.5 h-3.5" /></button>
                            </span>
                        ))}
                    </div>
                )}
            </Card>

            <Card title={t('settings.publicTitle')} description={t('settings.publicDescription')}>
                <div className="flex gap-2">
                    <input className={`${inputClass} font-mono`} readOnly value={publicUrl} onFocus={e => e.currentTarget.select()} />
                    <button type="button" className={btnBlue} onClick={() => navigator.clipboard?.writeText(publicUrl)}>{t('settings.copy')}</button>
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft mt-4">{t('settings.shownInOverlayHint')}</p>
            </Card>
        </div>
    );
}
