import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, Spinner } from '../../components/ds';
import PlatformShell from './PlatformShell';

type State = 'loading' | 'ok' | 'error';

/** Destino del enlace del correo. Confirma con POST (no con GET) para que un antivirus o vista previa no confirme sin querer. */
export function PlatformConfirm() {
    const { t } = useTranslation('platform');
    const [params] = useSearchParams();
    const [state, setState] = useState<State>('loading');

    useEffect(() => {
        const token = params.get('token') ?? '';
        if (!token) { setState('error'); return; }
        let cancelled = false;
        fetch('/api/platform/waitlist/confirm', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
        })
            .then(r => { if (!cancelled) setState(r.ok ? 'ok' : 'error'); })
            .catch(() => { if (!cancelled) setState('error'); });
        return () => { cancelled = true; };
    }, [params]);

    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-24 text-center space-y-4" role="status">
                {state === 'loading' && <><Spinner /><p className="text-ds-soft">{t('confirm.loading')}</p></>}
                {state === 'ok' && <>
                    <CheckCircle2 className="w-12 h-12 mx-auto text-ds-ok" aria-hidden />
                    <h1 className="text-2xl font-extrabold text-ds-text">{t('confirm.okTitle')}</h1>
                    <p className="text-ds-soft">{t('confirm.okText')}</p>
                </>}
                {state === 'error' && <>
                    <XCircle className="w-12 h-12 mx-auto text-ds-danger" aria-hidden />
                    <h1 className="text-2xl font-extrabold text-ds-text">{t('confirm.errorTitle')}</h1>
                    <p className="text-ds-soft">{t('confirm.errorText')}</p>
                </>}
                {state !== 'loading' && <div className="pt-4"><Link to="/"><Button variant="secondary">{t('confirm.back')}</Button></Link></div>}
            </div>
        </PlatformShell>
    );
}

export function PlatformNotFound() {
    const { t } = useTranslation('platform');
    return (
        <PlatformShell showNav={false}>
            <div className="max-w-lg mx-auto px-5 py-24 text-center space-y-4">
                <h1 className="text-2xl font-extrabold text-ds-text">{t('notFound.title')}</h1>
                <p className="text-ds-soft">{t('notFound.text')}</p>
                <div className="pt-4"><Link to="/"><Button variant="secondary">{t('notFound.back')}</Button></Link></div>
            </div>
        </PlatformShell>
    );
}
