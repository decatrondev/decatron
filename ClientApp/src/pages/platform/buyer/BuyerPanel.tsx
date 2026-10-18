import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MailCheck, XCircle } from 'lucide-react';
import { Alert, Button, Card, Field, Input, Spinner, Tabs } from '../../../components/ds';
import PlatformShell from '../PlatformShell';
import BuyerSetup from './BuyerSetup';
import BuyerSetupReadOnly from './BuyerSetupReadOnly';
import BuyerTeam from './BuyerTeam';
import BuyerTransparency from './BuyerTransparency';
import BuyerSecurity from './BuyerSecurity';
import BuyerStepUp from './BuyerStepUp';
import { useTurnstile } from '../useTurnstile';

// La sesión del comprador va aparte de la del streamer: otra clave y su propio encabezado (nunca toca el login de Twitch).
const KEY = 'decatron.buyerToken';
const getToken = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const setToken = (v: string) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };
const onPlatformHost = () => /\.decatron\.top$/i.test(window.location.hostname) && !/^www\./i.test(window.location.hostname);

async function exchange(code: string): Promise<boolean> {
    const r = await fetch('/api/auth/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const b = await r.json().catch(() => null);
    if (!r.ok || !b?.token) return false;
    setToken(b.token);
    return true;
}

type Me = {
    tenant: { slug: string; name: string; status: string };
    plan: { key: string | null; name: string | null; status: string | null; sandboxEndsAt: string | null; daysLeft: number | null };
    buyer: { email: string; role: 'owner' | 'admin' };
    mfa?: { enabled: boolean; required: boolean };
};

function Home() {
    const { t } = useTranslation('platform');
    const nav = useNavigate();
    const [params] = useSearchParams();
    const [me, setMe] = useState<Me | null>(null);
    const [error, setError] = useState(false);
    const exchanged = useRef(false);
    const [tab, setTab] = useState(params.get('tab') === 'equipo' ? 'team' : 'home');

    const load = useCallback(async () => {
        const token = getToken();
        if (!token) { nav('/panel/login', { replace: true }); return; }
        const r = await fetch('/api/platform/buyer/me', { headers: { Authorization: `Bearer ${token}` } });
        if (r.status === 401 || r.status === 403) { setToken(''); nav('/panel/login', { replace: true }); return; }
        if (!r.ok) { setError(true); return; }
        setMe(await r.json());
    }, [nav]);

    useEffect(() => {
        const code = params.get('code');
        if (code) {
            if (exchanged.current) return;
            exchanged.current = true;
            exchange(code).then(ok => { if (ok) nav('/panel', { replace: true }); else nav('/panel/login', { replace: true }); });
            return;
        }
        load().catch(() => setError(true));
    }, [params, nav, load]);

    const logout = () => { setToken(''); nav('/panel/login', { replace: true }); };

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-2xl mx-auto px-5 py-16 space-y-6">
                {error && <Alert tone="danger">{t('buyer.errorLoad')}</Alert>}
                {!me && !error && <div className="text-center"><Spinner /></div>}
                {me && <>
                    <div>
                        <h1 className="text-3xl font-extrabold text-ds-text">{me.tenant.name}</h1>
                        <p className="text-ds-soft mt-1">{me.tenant.slug}.decatron.top</p>
                    </div>
                    <Card>
                        <dl className="grid sm:grid-cols-2 gap-4 p-5">
                            <div><dt className="text-sm text-ds-faint">{t('buyer.plan')}</dt><dd className="text-ds-text font-semibold">{me.plan.name ?? '—'}</dd></div>
                            <div><dt className="text-sm text-ds-faint">{t('buyer.sandboxLeft')}</dt>
                                <dd className="text-ds-text font-semibold">{me.plan.daysLeft == null ? '—' : t('buyer.days', { count: me.plan.daysLeft })}</dd></div>
                            <div><dt className="text-sm text-ds-faint">{t('buyer.account')}</dt><dd className="text-ds-text font-semibold break-all">{me.buyer.email}</dd></div>
                            <div><dt className="text-sm text-ds-faint">{t('buyer.role')}</dt><dd className="text-ds-text font-semibold">{t(me.buyer.role === 'owner' ? 'buyer.owner' : 'buyer.adminRole')}</dd></div>
                        </dl>
                    </Card>
                    {me.mfa?.required ? <>
                        <Alert tone="warn">
                            <strong className="block">{t('buyer.mfa.requiredTitle')}</strong>
                            {t('buyer.mfa.requiredText')}
                        </Alert>
                        <BuyerSecurity onChange={() => { load().catch(() => setError(true)); }} />
                    </> : me.buyer.role === 'owner' ? <>
                        <Tabs value={tab} onChange={setTab} items={[{ id: 'home', label: t('buyer.tabHome') }, { id: 'team', label: t('buyer.tabTeam') }]} />
                        {tab === 'team' ? <BuyerTeam /> : <>
                            <BuyerSecurity onChange={() => { load().catch(() => setError(true)); }} />
                            <BuyerSetup />
                            <BuyerTransparency />
                        </>}
                    </> : <>
                        <Alert tone="info">{t('buyer.adminNotice')}</Alert>
                        <BuyerSetupReadOnly />
                        <BuyerTransparency />
                    </>}
                    <Button variant="secondary" onClick={logout}>{t('buyer.logout')}</Button>
                    <BuyerStepUp />
                </>}
            </div>
        </PlatformShell>
    );
}

function Login() {
    const { t, i18n } = useTranslation('platform');
    const [email, setEmail] = useState('');
    const [trap, setTrap] = useState('');
    const [done, setDone] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const captcha = useTurnstile();

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (sending) return;
        const clean = email.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(clean)) { setError(t('signup.errorEmail')); return; }
        if (captcha.enabled && !captcha.token) { setError(t('form.errorCaptcha')); return; }
        setSending(true); setError('');
        try {
            const r = await fetch('/api/platform/buyer/login-link', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: clean, locale: i18n.language?.startsWith('en') ? 'en' : 'es', website: trap, turnstileToken: captcha.token }),
            });
            if (r.ok) { setDone(true); return; }
            const b = await r.json().catch(() => null);
            setError(r.status === 429 ? t('form.errorLimit') : r.status === 503 ? t('form.errorBusy') : b?.code === 'captcha' ? t('form.errorCaptcha') : t('form.errorGeneric'));
        } catch { setError(t('form.errorGeneric')); }
        captcha.reset();
        setSending(false);
    };

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-md mx-auto px-5 py-16">
                {done ? (
                    <div className="text-center py-6" role="status">
                        <MailCheck className="w-10 h-10 mx-auto text-ds-accent-text mb-4" aria-hidden />
                        <h1 className="text-2xl font-extrabold text-ds-text mb-2">{t('buyer.sentTitle')}</h1>
                        <p className="text-ds-soft leading-relaxed">{t('buyer.sentText')}</p>
                    </div>
                ) : (
                    <form onSubmit={submit} noValidate className="space-y-5">
                        <div>
                            <h1 className="text-3xl font-extrabold text-ds-text">{t('buyer.loginTitle')}</h1>
                            <p className="text-ds-soft mt-2 leading-relaxed">{t('buyer.loginText')}</p>
                        </div>
                        <Field label={t('form.email')}>
                            <Input type="email" inputMode="email" autoComplete="email" required value={email}
                                onChange={e => setEmail(e.target.value)} placeholder={t('form.emailPlaceholder')} />
                        </Field>
                        <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                            <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
                        </div>
                        {captcha.enabled && <div ref={captcha.boxRef} className="flex justify-center" />}
                        {error && <Alert tone="danger">{error}</Alert>}
                        <Button type="submit" size="lg" block loading={sending}>{sending ? t('form.sending') : t('buyer.sendLink')}</Button>
                    </form>
                )}
            </div>
        </PlatformShell>
    );
}

/** Destino del enlace de entrada del correo. Confirma con POST para que una vista previa no gaste el enlace. */
function Enter() {
    const { t } = useTranslation('platform');
    const nav = useNavigate();
    const [params] = useSearchParams();
    const [failed, setFailed] = useState(false);
    const started = useRef(false); // enlace de un solo uso: una petición, sin descartar su respuesta

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const token = params.get('t') ?? '';
        if (!token) { setFailed(true); return; }
        fetch('/api/platform/buyer/login-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
            .then(async r => ({ ok: r.ok, b: await r.json().catch(() => null) }))
            .then(async ({ ok, b }) => {
                if (ok && b?.code && await exchange(b.code)) { nav('/panel', { replace: true }); return; }
                setFailed(true);
            })
            .catch(() => setFailed(true));
    }, [params, nav]);

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-24 text-center space-y-4" role="status">
                {!failed && <><Spinner /><p className="text-ds-soft">{t('buyer.entering')}</p></>}
                {failed && <>
                    <XCircle className="w-12 h-12 mx-auto text-ds-danger" aria-hidden />
                    <h1 className="text-2xl font-extrabold text-ds-text">{t('buyer.enterErrorTitle')}</h1>
                    <p className="text-ds-soft">{t('buyer.enterErrorText')}</p>
                    <div className="pt-4"><Button variant="secondary" onClick={() => nav('/panel/login')}>{t('buyer.sendLink')}</Button></div>
                </>}
            </div>
        </PlatformShell>
    );
}

/** Destino del enlace de invitación del correo. Confirma con POST para que una vista previa no gaste el enlace. */
function Invitation() {
    const { t } = useTranslation('platform');
    const nav = useNavigate();
    const [params] = useSearchParams();
    const [failure, setFailure] = useState<string | null>(null);
    const started = useRef(false); // enlace de un solo uso: una petición, sin descartar su respuesta

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const token = params.get('t') ?? '';
        if (!token) { setFailure('invalid_token'); return; }
        fetch('/api/platform/buyer/team/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
            .then(async r => ({ ok: r.ok, b: await r.json().catch(() => null) }))
            .then(async ({ ok, b }) => {
                if (ok && b?.code && await exchange(b.code)) { nav('/panel', { replace: true }); return; }
                setFailure(b?.code ?? 'invalid_token');
            })
            .catch(() => setFailure('invalid_token'));
    }, [params, nav]);

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-24 text-center space-y-4" role="status">
                {!failure && <><Spinner /><p className="text-ds-soft">{t('buyer.invitation.accepting')}</p></>}
                {failure && <>
                    <XCircle className="w-12 h-12 mx-auto text-ds-danger" aria-hidden />
                    <h1 className="text-2xl font-extrabold text-ds-text">{t('buyer.invitation.errorTitle')}</h1>
                    <p className="text-ds-soft">{t(`buyer.invitation.errors.${failure}`, { defaultValue: t('buyer.invitation.errors.invalid_token') })}</p>
                </>}
            </div>
        </PlatformShell>
    );
}

/** Panel del comprador en slug.decatron.top/panel. Fuera de un subdominio de la plataforma no existe. */
export default function BuyerPanel() {
    if (!onPlatformHost()) return <Navigate to="/" replace />;
    return (
        <Routes>
            <Route path="login" element={<Login />} />
            <Route path="entrar" element={<Enter />} />
            <Route path="invitacion" element={<Invitation />} />
            <Route path="*" element={<Home />} />
        </Routes>
    );
}
