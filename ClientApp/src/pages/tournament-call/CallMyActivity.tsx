import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Card } from '../../components/ds';
import api from '../../services/api';
import { CALL_ME_API, type CallApplication, type CallMe } from './content';
import { DONATIONS_API, type MyContribution } from './contributions';

/**
 * Lo que la persona con sesion tiene en esta convocatoria: sus aportes (por su cuenta, no por el recibo de una pestana)
 * y el estado de su solicitud de colaborador. Los montos recibidos y de premios aparecen solo tras la confirmacion del organizador.
 */
export default function CallMyActivity({ refreshKey, onOpen }: { refreshKey: number; onOpen: () => void }) {
    const { t, i18n } = useTranslation('tournament-call');
    const [application, setApplication] = useState<CallApplication | null>(null);
    const [contributions, setContributions] = useState<MyContribution[]>([]);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!localStorage.getItem('token')) return;
        let alive = true; setFailed(false);
        Promise.all([api.get<CallMe>(CALL_ME_API), api.get<MyContribution[]>(DONATIONS_API + '/mine')]).then(([me, mine]) => {
            if (!alive) return;
            setApplication(me.data.applications.find(a => a.kind === 'collaborator') ?? null); setContributions(mine.data);
        }).catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [refreshKey]);
    const date = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));
    const money = (value: number | null, currency: string) => value == null ? '—' : `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(value)} ${currency}`;
    if (!localStorage.getItem('token')) return null;
    if (failed) return <Alert tone="danger">{t('mine.loadError')}</Alert>;
    if (!application && !contributions.length) return null;
    return <section className="call-my-activity" aria-label={t('mine.title')}>
        <h3>{t('mine.title')}</h3>
        {application && <Card><div className="call-review-heading"><div><strong>{t('mine.application')}</strong><p className="call-small">{t(`contributionTypes.${application.contributionType}`)}{application.origin === 'payment' ? ` · ${t('origin.payment')}` : ''}</p></div>
            <Badge tone={application.status === 'approved' ? 'ok' : application.status === 'rejected' ? 'danger' : undefined}>{t(`applicationStatus.${application.status}`)}</Badge></div>
            {application.origin === 'payment' && application.status === 'pending' && <p className="call-small">{t('origin.pendingHelp')}</p>}
            {application.reviewNote && <p className="call-preserve">{application.reviewNote}</p>}
            <Button variant="secondary" onClick={onOpen}>{t('mine.openApplication')}</Button></Card>}
        {contributions.length > 0 && <ul className="call-my-contributions">{contributions.map(item => <li key={item.id}>
            <div className="call-review-heading"><div><strong>{item.reference}</strong><p className="call-small">{date(item.createdAt)} · {money(item.grossAmount, item.currency)}</p></div>
                <span>{item.isTest && <Badge tone="warn">{t('mine.test')}</Badge>} <Badge tone={item.status === 'confirmed' ? 'ok' : item.status === 'reversed' ? 'danger' : undefined}>{t(`mine.status.${item.status}`)}</Badge></span></div>
            {item.isTest && <p className="call-small">{t('funding.testPayment')}</p>}
            {item.status === 'confirmed' && <p className="call-small">{t('funding.received')}: {money(item.receivedAmount, item.currency)} · {t('funding.allocated')}: {money(item.prizeAmount, item.currency)}</p>}
            {item.status === 'pending' && !item.isTest && <p className="call-small">{t('funding.awaitingReview')}</p>}
        </li>)}</ul>}
    </section>;
}
