import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { XCircle } from 'lucide-react';
import { Button, Spinner } from '../../components/ds';
import PlatformShell from './PlatformShell';

/** Destino del enlace del correo de registro. Confirma con POST (un antivirus o vista previa no debe crear el tenant) y salta al subdominio. */
export default function PlatformSignupConfirm() {
    const { t } = useTranslation('platform');
    const [params] = useSearchParams();
    const [error, setError] = useState('');
    const started = useRef(false); // el enlace es de un solo uso: la petición sale una vez, aunque el efecto se repita

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const token = params.get('t') ?? '';
        if (!token) { setError(t('signupConfirm.errorText')); return; }
        fetch('/api/platform/signup/confirm', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
        })
            .then(async r => ({ ok: r.ok, body: await r.json().catch(() => null) }))
            .then(({ ok, body }) => {
                if (ok && body?.url) { window.location.replace(body.url); return; }
                setError(body?.code === 'slug_taken' ? t('signupConfirm.slugTaken') : t('signupConfirm.errorText'));
            })
            .catch(() => setError(t('signupConfirm.errorText')));
    }, [params, t]);

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-24 text-center space-y-4" role="status">
                {!error && <><Spinner /><p className="text-ds-soft">{t('signupConfirm.loading')}</p></>}
                {error && <>
                    <XCircle className="w-12 h-12 mx-auto text-ds-danger" aria-hidden />
                    <h1 className="text-2xl font-extrabold text-ds-text">{t('signupConfirm.errorTitle')}</h1>
                    <p className="text-ds-soft">{error}</p>
                    <div className="pt-4"><Link to="/registro"><Button variant="secondary">{t('signupConfirm.retry')}</Button></Link></div>
                </>}
            </div>
        </PlatformShell>
    );
}
