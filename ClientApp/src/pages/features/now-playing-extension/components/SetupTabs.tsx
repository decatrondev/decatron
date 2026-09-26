import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ExternalLink, Link as LinkIcon, Unlink, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { Card, Field, Toggle, Slider, CopyButton, inputClass } from '../../../../components/overlay-editor/ui';
import api from '../../../../services/api';
import type { NowPlayingConfigState } from '../hooks/useNowPlayingConfig';

export type NowPlayingTabId = 'guide' | 'connection' | 'theme' | 'elements' | 'typography' | 'animations' | 'editor';

interface TabProps { cfg: NowPlayingConfigState }

const btnBase = 'px-4 py-2 rounded-lg text-sm 3xl:text-base font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
const btnGray = `${btnBase} bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`;

/** ¿Hay de dónde sacar la canción? */
export function isConnected(s: NowPlayingConfigState['settings']): boolean {
    return s.provider === 'lastfm' ? !!s.lastfmUsername : s.spotifyConnected && s.spotifySlotAssigned;
}

// ── Guía ───────────────────────────────────────────────────────────────────

export function GuideTab({ cfg, onNavigate }: TabProps & { onNavigate: (tab: NowPlayingTabId) => void }) {
    const { t } = useTranslation('overlays');
    const s = cfg.settings;
    const step = (n: number, title: string, body: React.ReactNode) => (
        <div className="flex gap-4">
            <span className="w-8 h-8 3xl:w-10 3xl:h-10 shrink-0 rounded-full bg-[#2563eb] text-white font-black flex items-center justify-center text-sm 3xl:text-base">{n}</span>
            <div className="flex-1 min-w-0 space-y-2">
                <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm 3xl:text-base">{title}</h4>
                <div className="text-sm 3xl:text-base text-[#64748b] dark:text-[#94a3b8] space-y-2">{body}</div>
            </div>
        </div>
    );
    const warning = !s.isEnabled ? t('nowPlaying.guide.disabledWarning') : !isConnected(s) ? t('nowPlaying.guide.notConnectedWarning') : null;

    return (
        <div className="space-y-6">
            {warning && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm 3xl:text-base">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>{warning} <button className="underline font-bold" onClick={() => onNavigate('connection')}>{t('nowPlaying.guide.goConnection')}</button></div>
                </div>
            )}
            <Card title={t('nowPlaying.guide.title')} description={t('nowPlaying.guide.description')}>
                <div className="space-y-6">
                    {step(1, t('nowPlaying.guide.step1Title'), (
                        <p>{t('nowPlaying.guide.step1Body')} <button className="underline text-[#2563eb]" onClick={() => onNavigate('connection')}>{t('nowPlaying.guide.goConnection')}</button></p>
                    ))}
                    {step(2, t('nowPlaying.guide.step2Title'), (
                        <>
                            <p>{t('nowPlaying.guide.step2Body')}</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input readOnly value={cfg.overlayUrl} className={`${inputClass} font-mono text-xs 3xl:text-sm`} onFocus={e => e.currentTarget.select()} />
                                <div className="flex gap-2">
                                    <CopyButton text={cfg.overlayUrl} label={t('nowPlaying.guide.copy')} doneLabel={t('nowPlaying.guide.copied')} />
                                    <a href={cfg.overlayUrl} target="_blank" rel="noreferrer" className={`${btnGray} shrink-0`}><ExternalLink className="w-4 h-4" /> {t('nowPlaying.guide.open')}</a>
                                </div>
                            </div>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>{t('nowPlaying.guide.obs1')}</li>
                                <li>{t('nowPlaying.guide.obs2')}</li>
                                <li>{t('nowPlaying.guide.obs3', { width: cfg.layout.canvas.width, height: cfg.layout.canvas.height })}</li>
                            </ol>
                        </>
                    ))}
                    {step(3, t('nowPlaying.guide.step3Title'), (
                        <p>{t('nowPlaying.guide.step3Body')} <button className="underline text-[#2563eb]" onClick={() => onNavigate('editor')}>{t('nowPlaying.guide.goEditor')}</button></p>
                    ))}
                    {step(4, t('nowPlaying.guide.step4Title'), <p>{t('nowPlaying.guide.step4Body')}</p>)}
                </div>
            </Card>
        </div>
    );
}

// ── Conexión ───────────────────────────────────────────────────────────────

export function ConnectionTab({ cfg }: TabProps) {
    const { t } = useTranslation('overlays');
    const s = cfg.settings;
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [username, setUsername] = useState(s.lastfmUsername || '');
    const [email, setEmail] = useState('');

    useEffect(() => { setUsername(s.lastfmUsername || ''); }, [s.lastfmUsername]);

    // Vuelta del login de Spotify
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const r = params.get('spotify');
        if (r === 'success') {
            setMsg({ ok: true, text: t('nowPlaying.connection.spotifyOk') });
            cfg.update({ provider: 'spotify', spotifyConnected: true }, false);
        } else if (r === 'error') {
            setMsg({ ok: false, text: t('nowPlaying.connection.spotifyError', { message: params.get('message') || '' }) });
        }
        if (r) window.history.replaceState({}, '', window.location.pathname);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const run = async (key: string, fn: () => Promise<void>) => {
        setBusy(key);
        setMsg(null);
        try { await fn(); } catch (e: any) { setMsg({ ok: false, text: e?.response?.data?.message || t('nowPlaying.connection.error') }); } finally { setBusy(null); }
    };

    const validate = () => run('validate', async () => {
        const res = await api.post('/nowplaying/validate/lastfm', { username: username.trim() });
        const ok = res.data?.success && res.data?.valid;
        setMsg({ ok, text: ok ? t('nowPlaying.connection.lastfmValid') : t('nowPlaying.connection.lastfmInvalid') });
    });
    const connect = () => run('connect', async () => {
        const res = await api.post('/nowplaying/connect/lastfm', { username: username.trim() });
        if (!res.data?.success) throw { response: { data: { message: res.data?.message } } };
        cfg.update({ lastfmUsername: username.trim(), provider: 'lastfm' }, false);
        setMsg({ ok: true, text: t('nowPlaying.connection.lastfmConnected') });
    });
    const disconnect = () => run('disconnect', async () => {
        const res = await api.post('/nowplaying/disconnect', {});
        if (res.data?.success) { cfg.update({ lastfmUsername: null }, false); setUsername(''); setMsg({ ok: true, text: t('nowPlaying.connection.lastfmDisconnected') }); }
    });
    const spotifyConnect = () => run('spotify', async () => {
        const res = await api.get('/spotify/authorize-url');
        if (res.data?.success && res.data.url) window.location.href = res.data.url;
        else throw { response: { data: { message: res.data?.message } } };
    });
    const spotifyDisconnect = () => run('spotifyOff', async () => {
        const res = await api.post('/spotify/disconnect', {});
        if (res.data?.success) { cfg.update({ spotifyConnected: false, spotifySlotRequested: false, spotifySlotAssigned: false }, false); setMsg({ ok: true, text: t('nowPlaying.connection.spotifyDisconnected') }); }
    });
    const requestCupo = () => run('cupo', async () => {
        const res = await api.post('/nowplaying/request-spotify-cupo', { spotifyEmail: email.trim() });
        if (!res.data?.success) throw { response: { data: { message: res.data?.message } } };
        cfg.update({ spotifySlotRequested: true }, false);
        setMsg({ ok: true, text: t('nowPlaying.connection.cupoRequested') });
    });

    const providerCard = (id: 'lastfm' | 'spotify', color: string) => (
        <button
            onClick={() => cfg.update({ provider: id })}
            className={`p-4 rounded-xl border-2 text-left transition-all ${s.provider === id ? '' : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#94a3b8]'}`}
            style={s.provider === id ? { borderColor: color, background: `${color}14` } : undefined}
        >
            <div className="font-bold text-sm 3xl:text-base text-[#1e293b] dark:text-[#f8fafc]">{t(`nowPlaying.connection.${id}`)}</div>
            <div className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">{t(`nowPlaying.connection.${id}Hint`)}</div>
        </button>
    );

    const spotifyStatus = !s.spotifyConnected ? 'off' : s.spotifySlotAssigned ? 'ready' : s.spotifySlotRequested ? 'pending' : 'noCupo';
    const dot = { off: 'bg-[#94a3b8]', ready: 'bg-green-500', pending: 'bg-amber-500', noCupo: 'bg-blue-500' }[spotifyStatus];

    return (
        <div className="space-y-6">
            <Card title={t('nowPlaying.connection.statusTitle')}>
                <div className="space-y-6">
                    <Toggle checked={s.isEnabled} onChange={v => cfg.update({ isEnabled: v })} label={t('nowPlaying.connection.enabled')} hint={t('nowPlaying.connection.enabledHint')} />
                    <Field label={t('nowPlaying.connection.polling')} hint={t('nowPlaying.connection.pollingHint')}>
                        <Slider value={s.pollingInterval} min={3} max={10} suffix=" s" onChange={v => cfg.update({ pollingInterval: v })} />
                    </Field>
                </div>
            </Card>

            <Card title={t('nowPlaying.connection.providerTitle')} description={t('nowPlaying.connection.providerDescription')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {providerCard('lastfm', '#D51007')}
                    {providerCard('spotify', '#1DB954')}
                </div>
            </Card>

            {s.provider === 'lastfm' ? (
                <Card title={t('nowPlaying.connection.lastfmTitle')}>
                    <div className="space-y-4">
                        <p className="flex items-center gap-2 text-sm 3xl:text-base font-semibold">
                            <span className={`w-2.5 h-2.5 rounded-full ${s.lastfmUsername ? 'bg-green-500' : 'bg-[#94a3b8]'}`} />
                            <span className={s.lastfmUsername ? 'text-green-600 dark:text-green-400' : 'text-[#64748b] dark:text-[#94a3b8]'}>
                                {s.lastfmUsername ? t('nowPlaying.connection.lastfmAs', { user: s.lastfmUsername }) : t('nowPlaying.connection.notConnected')}
                            </span>
                        </p>
                        <Field label={t('nowPlaying.connection.lastfmUser')} hint={t('nowPlaying.connection.lastfmUserHint')}>
                            <input className={inputClass} value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario-lastfm" />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                            <button className={btnGray} onClick={validate} disabled={!!busy || !username.trim()}>
                                {busy === 'validate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {t('nowPlaying.connection.verify')}
                            </button>
                            <button className={`${btnBase} bg-[#D51007] hover:bg-[#b50d06] text-white`} onClick={connect} disabled={!!busy || !username.trim()}>
                                {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />} {t('nowPlaying.connection.connect')}
                            </button>
                            {s.lastfmUsername && (
                                <button className={`${btnBase} border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`} onClick={disconnect} disabled={!!busy}>
                                    {busy === 'disconnect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />} {t('nowPlaying.connection.disconnect')}
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            ) : (
                <Card title={t('nowPlaying.connection.spotifyTitle')} description={t('nowPlaying.connection.spotifyDescription')}>
                    <div className="space-y-4">
                        <p className="flex items-center gap-2 text-sm 3xl:text-base font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} /> {t(`nowPlaying.connection.spotifyStatus.${spotifyStatus}`)}
                        </p>

                        {!s.spotifyConnected && (
                            <button className={`${btnBase} bg-[#1DB954] hover:bg-[#1aa34a] text-white`} onClick={spotifyConnect} disabled={!!busy}>
                                {busy === 'spotify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />} {t('nowPlaying.connection.spotifyConnect')}
                            </button>
                        )}

                        {spotifyStatus === 'noCupo' && (
                            <div className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] space-y-3">
                                <p className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('nowPlaying.connection.cupoTitle')}</p>
                                <p className="text-xs 3xl:text-sm text-[#64748b] dark:text-[#94a3b8]">{t('nowPlaying.connection.cupoHint')}</p>
                                <div className="flex items-center gap-2">
                                    {Array.from({ length: cfg.cupos.total }).map((_, i) => (
                                        <span key={i} className={`w-3 h-3 rounded-full ${i < cfg.cupos.used ? 'bg-[#1DB954]' : 'bg-[#cbd5e1] dark:bg-[#374151]'}`} />
                                    ))}
                                    <span className="text-xs 3xl:text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">{cfg.cupos.used}/{cfg.cupos.total}</span>
                                </div>
                                {cfg.cupos.available > 0 ? (
                                    <>
                                        <Field label={t('nowPlaying.connection.cupoEmail')}>
                                            <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu-email@ejemplo.com" />
                                        </Field>
                                        <button className={`${btnBase} bg-[#1DB954] hover:bg-[#1aa34a] text-white`} onClick={requestCupo} disabled={!!busy || !email.trim()}>
                                            {busy === 'cupo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t('nowPlaying.connection.cupoRequest')}
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm 3xl:text-base text-amber-700 dark:text-amber-300">{t('nowPlaying.connection.cupoFull', { total: cfg.cupos.total })}</p>
                                )}
                            </div>
                        )}

                        {spotifyStatus === 'pending' && (
                            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm 3xl:text-base text-amber-800 dark:text-amber-200">
                                {t('nowPlaying.connection.cupoPending')}
                            </div>
                        )}

                        {s.spotifyConnected && (
                            <button className={`${btnBase} border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`} onClick={spotifyDisconnect} disabled={!!busy}>
                                {busy === 'spotifyOff' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />} {t('nowPlaying.connection.spotifyDisconnect')}
                            </button>
                        )}
                    </div>
                </Card>
            )}

            {msg && (
                <div className={`p-4 rounded-xl border text-sm 3xl:text-base ${msg.ok
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
                    {msg.text}
                </div>
            )}
        </div>
    );
}
