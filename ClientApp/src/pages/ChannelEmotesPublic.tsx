import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flag, Trash2 } from 'lucide-react';
import api from '../services/api';
import { isTokenExpired } from '../utils/jwt';
import UploadForm from '../components/channel-emotes/UploadForm';
import { EmoteThumb, buildUploadForm, errorCodeOf, formatBytes, type EmoteDto } from '../components/channel-emotes/shared';

// Página pública de los emotes de un canal: /emotes/:channelName (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md, fase 3).
// Cualquiera ve la galería; con cuenta, según el modo que eligió el streamer, se sube un emote (directo o con revisión).

interface PublicData {
    channel: { login: string; displayName: string; avatarUrl?: string | null };
    uploadMode: 'owner' | 'staff' | 'approval' | 'list';
    emotes: EmoteDto[];
}

interface Me {
    canUpload: boolean;
    autoApprove: boolean;
    pendingLeft: number;
    channelFull: boolean;
    mine: EmoteDto[];
}

const STATUS_TONE: Record<string, string> = {
    approved: 'text-ds-ok border-ds-ok/40',
    hidden: 'text-ds-soft border-[#3f3f46]',
    pending: 'text-ds-warn border-ds-warn/40',
    rejected: 'text-ds-danger border-ds-danger/40',
    removed: 'text-ds-danger border-ds-danger/40',
};

export default function ChannelEmotesPublic() {
    const { channelName = '' } = useParams<{ channelName: string }>();
    const { t } = useTranslation('emotes');
    const channel = channelName.toLowerCase();
    const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
    const [data, setData] = useState<PublicData | null>(null);
    const [me, setMe] = useState<Me | null>(null);
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const [reported, setReported] = useState<Set<number>>(new Set());

    const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
    const loggedIn = !!token && !isTokenExpired(token, 60);
    const loginUrl = `/login?redirect=${encodeURIComponent(`/emotes/${channel}`)}`;

    const loadMe = useCallback(async () => {
        if (!loggedIn) return;
        try { setMe((await api.get(`/public/emotes/${channel}/me`)).data); } catch { setMe(null); }
    }, [channel, loggedIn]);

    const load = useCallback(async () => {
        try {
            const res = await api.get(`/public/emotes/${channel}`);
            setData(res.data);
            setStatus('ok');
        } catch (e) {
            setStatus((e as { response?: { status?: number } })?.response?.status === 404 ? 'notfound' : 'error');
        }
    }, [channel]);

    useEffect(() => { load(); loadMe(); }, [load, loadMe]);

    useEffect(() => {
        if (data) document.title = t('public.pageTitle', { name: data.channel.displayName });
    }, [data, t]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (data?.emotes ?? []).filter(e => !q || e.name.toLowerCase().includes(q));
    }, [data, search]);

    const copy = async (name: string) => {
        try { await navigator.clipboard.writeText(name); } catch { /* sin permiso del portapapeles */ }
        setCopied(name);
        window.setTimeout(() => setCopied(c => (c === name ? null : c)), 1500);
    };

    const report = async (e: EmoteDto) => {
        if (!loggedIn) { window.location.href = loginUrl; return; }
        const reason = window.prompt(t('public.reportPrompt', { name: e.name }));
        if (reason === null) return;
        try {
            await api.post(`/public/emotes/${channel}/${e.id}/report`, { reason });
            setReported(prev => new Set(prev).add(e.id));
        } catch { /* se puede reintentar */ }
    };

    const upload = async (file: File, name: string, zeroWidth: boolean): Promise<string | null> => {
        try {
            await api.post(`/public/emotes/${channel}/upload`, buildUploadForm(file, name, zeroWidth), { headers: { 'Content-Type': 'multipart/form-data' } });
            await Promise.all([load(), loadMe()]);
            return null;
        } catch (e) {
            return errorCodeOf(e);
        }
    };

    const removeMine = async (e: EmoteDto) => {
        if (!window.confirm(t('panel.deleteConfirm', { name: e.name }))) return;
        try { await api.delete(`/public/emotes/${channel}/mine/${e.id}`); await Promise.all([load(), loadMe()]); } catch { /* se puede reintentar */ }
    };

    const modeAllowsViewers = data?.uploadMode === 'approval' || data?.uploadMode === 'list';
    const disabledReason = me && !me.canUpload ? t(`public.cannot.${data?.uploadMode ?? 'staff'}`)
        : me?.channelFull ? t('errors.limit_reached')
        : me && !me.autoApprove && me.pendingLeft === 0 ? t('errors.too_many_pending')
        : null;

    return (
        <div className="min-h-screen bg-pub-bg text-ds-text relative overflow-x-hidden">
            <div className="relative max-w-3xl 3xl:max-w-5xl 4xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 4xl:py-24">
                <header className="flex items-center gap-4 4xl:gap-6 mb-8 4xl:mb-12">
                    {data?.channel.avatarUrl
                        ? <img src={data.channel.avatarUrl} alt="" className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full border-2 border-pub-accent/40 shrink-0" />
                        : <div className="w-14 h-14 3xl:w-16 3xl:h-16 4xl:w-20 4xl:h-20 rounded-full bg-pub-raised border-2 border-pub-border shrink-0" />}
                    <div className="min-w-0">
                        <p className="font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-pub-accent-hi/80">{t('public.label')}</p>
                        <h1 className="text-2xl sm:text-3xl 3xl:text-4xl 4xl:text-5xl font-black text-ds-text truncate">{data?.channel.displayName ?? channel}</h1>
                    </div>
                </header>

                {status === 'loading' && <p className="font-mono text-sm 3xl:text-base text-ds-soft animate-pulse">{t('public.loading')}</p>}
                {status === 'notfound' && <p className="font-mono text-sm 3xl:text-base text-ds-soft">{t('public.notFound')}</p>}
                {status === 'error' && <p className="font-mono text-sm 3xl:text-base text-ds-danger">{t('public.error')}</p>}

                {status === 'ok' && data && (
                    <>
                        <div className="flex flex-wrap items-center gap-3 mb-5">
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('public.search')}
                                className="flex-1 min-w-[12rem] px-4 py-2.5 rounded-lg bg-pub-surface border border-pub-border text-ds-text text-sm 3xl:text-base focus:outline-none focus:border-pub-accent/60"
                            />
                            <span className="font-mono text-xs 3xl:text-sm text-ds-soft">{t('public.count', { count: data.emotes.length })}</span>
                        </div>

                        {data.emotes.length === 0 ? (
                            <p className="font-mono text-sm 3xl:text-base text-ds-soft py-8">{t('public.empty')}</p>
                        ) : (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] 3xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] 4xl:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                                {shown.map(e => (
                                    <div key={e.id} className="group relative rounded-lg border border-pub-border bg-pub-surface p-3 flex flex-col items-center gap-2 hover:border-pub-accent/40 transition-colors">
                                        <button type="button" onClick={() => copy(e.name)} className="flex flex-col items-center gap-2 w-full" title={t('public.clickToCopy')}>
                                            <EmoteThumb src={e.urls.x2} name={e.name} height={48} bg="dark" />
                                            <span className="font-mono text-xs 3xl:text-sm font-bold text-ds-text truncate max-w-full">{copied === e.name ? t('public.copied') : e.name}</span>
                                        </button>
                                        <span className="text-[10px] 3xl:text-xs text-ds-soft truncate max-w-full">{t('panel.by', { user: e.uploadedBy })}</span>
                                        <button
                                            type="button"
                                            onClick={() => report(e)}
                                            disabled={reported.has(e.id)}
                                            className="absolute top-1.5 right-1.5 p-1 rounded-md text-ds-soft hover:text-ds-danger opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-100 disabled:text-ds-danger transition-opacity"
                                            title={reported.has(e.id) ? t('public.reported') : t('public.report')}
                                            aria-label={t('public.report')}
                                        >
                                            <Flag className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <section className="mt-12">
                            <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-ds-soft font-bold">
                                <span className="text-pub-accent-hi">#</span>{t('public.uploadTitle')}
                            </h2>

                            {!loggedIn && (
                                modeAllowsViewers ? (
                                    <div className="rounded-lg border border-pub-border bg-pub-surface p-5 space-y-3">
                                        <p className="text-sm 3xl:text-base">{t(`public.invite.${data.uploadMode}`)}</p>
                                        <a href={loginUrl} className="inline-block px-6 py-2.5 rounded-lg bg-pub-accent hover:bg-pub-accent-hover text-ds-text font-bold text-sm 3xl:text-base">{t('public.login')}</a>
                                    </div>
                                ) : (
                                    <p className="text-sm 3xl:text-base text-ds-soft">{t(`public.cannot.${data.uploadMode}`)}</p>
                                )
                            )}

                            {loggedIn && me && (
                                <div className="space-y-5">
                                    {me.canUpload && (
                                        <p className="text-sm 3xl:text-base text-ds-soft">{me.autoApprove ? t('public.willPublish') : t('public.willReview', { left: me.pendingLeft })}</p>
                                    )}
                                    <UploadForm tone="public" allowZeroWidth={false} onSubmit={upload} disabledReason={disabledReason} />
                                </div>
                            )}
                            {loggedIn && !me && <p className="font-mono text-sm text-ds-soft animate-pulse">{t('public.loading')}</p>}
                        </section>

                        {loggedIn && me && me.mine.length > 0 && (
                            <section className="mt-10">
                                <h2 className="flex items-center gap-2 mb-3 font-mono text-xs 3xl:text-sm 4xl:text-base uppercase tracking-widest text-ds-soft font-bold">
                                    <span className="text-pub-accent-hi">#</span>{t('public.mineTitle')}
                                </h2>
                                <div className="space-y-2">
                                    {me.mine.map(e => (
                                        <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-pub-border bg-pub-surface p-3">
                                            {e.status !== 'removed' && e.status !== 'rejected'
                                                ? <EmoteThumb src={e.urls.x2} name={e.name} height={36} bg="dark" />
                                                : <span className="w-12 h-12 rounded-lg bg-pub-raised shrink-0" />}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-mono text-sm font-bold text-ds-text truncate">{e.name}</p>
                                                <p className="text-xs text-ds-soft">{formatBytes(e.bytes)}{e.reason ? ` · ${e.reason}` : ''}</p>
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${STATUS_TONE[e.status]}`}>{t(`public.mineStatus.${e.status}`)}</span>
                                            <button type="button" onClick={() => removeMine(e)} className="p-2 rounded-lg text-ds-soft hover:text-ds-danger" aria-label={t('panel.delete')}><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <p className="mt-12 text-xs 3xl:text-sm text-ds-soft">{t('public.chatNote')}</p>
                    </>
                )}
            </div>
        </div>
    );
}
