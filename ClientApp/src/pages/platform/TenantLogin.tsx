import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert, Spinner } from '../../components/ds';
import PlatformShell from './PlatformShell';
import api from '../../services/api';
import { notifyTokenChanged } from '../../utils/tokenEvents';

// Login del streamer en slug.decatron.top: solo Twitch (la app es la del tenant), con el nombre del tenant como marca y la lista de permisos a la vista.
// Kick y Discord se quedan fuera: usan las apps de Decatron, no las del tenant.
const TWITCH_PATH = 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z';

interface Info { name: string; active: boolean; twitchReady: boolean; scopes: { scope: string; module: string | null; es: string; en: string }[] }

export default function TenantLogin() {
    const { t, i18n } = useTranslation('platform');
    const nav = useNavigate();
    const [params] = useSearchParams();
    const code = params.get('code');
    const redirect = params.get('redirect');
    const error = params.get('error');
    const [info, setInfo] = useState<Info | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [exchangeError, setExchangeError] = useState(false);
    const exchanged = useRef(false); // el código de un solo uso se canjea una vez

    useEffect(() => {
        fetch('/api/platform/tenant-info').then(async r => { if (!r.ok) throw new Error(); setInfo(await r.json()); }).catch(() => setFailed(true));
    }, []);

    useEffect(() => {
        if (!code || exchanged.current) return;
        exchanged.current = true;
        setBusy(true);
        api.post('/auth/exchange', { code })
            .then(r => { localStorage.setItem('token', r.data.token); notifyTokenChanged(r.data.token); nav(redirect ? '/' + redirect : '/dashboard'); })
            .catch(() => { setExchangeError(true); setBusy(false); });
    }, [code, redirect, nav]);

    const start = () => {
        setBusy(true);
        window.location.href = `/api/auth/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;
    };

    const en = i18n.language?.startsWith('en');
    const errorText = exchangeError ? t('tenantLogin.errors.exchange')
        : error ? t(`tenantLogin.errors.${error}`, { defaultValue: t('tenantLogin.errors.generic') }) : '';

    return (
        <PlatformShell showNav={false} brandName={info?.name}>
            <div className="max-w-xl 3xl:max-w-3xl mx-auto px-5 py-14 3xl:py-24 space-y-6 3xl:space-y-8">
                {failed && <Alert tone="danger">{t('tenantLogin.unavailable')}</Alert>}
                {!info && !failed && <div className="text-center"><Spinner /></div>}
                {info && <>
                    <div>
                        <h1 className="text-3xl sm:text-4xl 3xl:text-6xl font-extrabold text-ds-text">{info.name}</h1>
                        <p className="text-ds-soft 3xl:text-xl mt-2 leading-relaxed">{t('tenantLogin.subtitle', { name: info.name })}</p>
                    </div>
                    {errorText && <Alert tone="danger">{errorText}</Alert>}
                    {!info.active && <Alert tone="warn">{t('tenantLogin.inactive')}</Alert>}
                    {info.active && !info.twitchReady && <Alert tone="info">{t('tenantLogin.notReady')}</Alert>}
                    <button type="button" onClick={start} disabled={busy || !info.active || !info.twitchReady}
                        className="w-full text-left flex items-center gap-3.5 px-5 py-3.5 3xl:py-5 3xl:text-xl rounded-md border border-ds-border bg-ds-surface hover:bg-ds-raised text-ds-text font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {busy ? <Loader2 className="w-6 h-6 animate-spin" aria-hidden /> : <svg className="w-6 h-6 text-[#9146ff]" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={TWITCH_PATH} /></svg>}
                        <span>{busy ? t('tenantLogin.redirecting') : t('tenantLogin.continue')}</span>
                    </button>
                    <details className="rounded-md border border-ds-border bg-ds-surface">
                        <summary className="cursor-pointer px-4 py-3 3xl:py-4 text-sm 3xl:text-lg font-semibold text-ds-text">{t('tenantLogin.permissionsTitle')}</summary>
                        <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm 3xl:text-lg text-ds-soft leading-relaxed">{t('tenantLogin.permissionsText', { name: info.name })}</p>
                            <ul className="divide-y divide-ds-border">
                                {info.scopes.map(s => (
                                    <li key={s.scope} className="py-2">
                                        <code className="text-xs 3xl:text-base text-ds-faint">{s.scope}</code>
                                        <p className="text-sm 3xl:text-lg text-ds-soft">{en ? s.en : s.es}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </details>
                </>}
            </div>
        </PlatformShell>
    );
}
