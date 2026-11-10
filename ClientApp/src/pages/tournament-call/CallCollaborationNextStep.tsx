import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ds';
import type { CallApplication } from './content';

/** Approval and receipt are independent. Never infer an unpaid balance from an application. */
export default function CallCollaborationNextStep({ application, donationsOpen }: { application: CallApplication; donationsOpen: boolean }) {
    const { t } = useTranslation('tournament-call');
    if (application.kind !== 'collaborator' || application.status !== 'approved') return null;
    const monetary = application.contributionType === 'money';
    return <section className="call-collaboration-next" aria-label={t('collaborationNext.title')}>
        <Alert tone="info">
            <strong>{t('collaborationNext.title')}</strong>
            <p>{t(monetary ? 'collaborationNext.moneyHelp' : 'collaborationNext.deliveryHelp')}</p>
            {monetary ? <>
                {!donationsOpen && <p>{t('collaborationNext.closedHelp')}</p>}
                <p>{t('collaborationNext.receiptHelp')}</p>
                <Link className={`ds-btn ds-btn--${donationsOpen ? 'primary' : 'secondary'} mt-4`} to="/supporters?call=fortnite-streamers#donar">{t(donationsOpen ? 'collaborationNext.contribute' : 'collaborationNext.receipt')}</Link>
            </> : <p>{t(application.reviewNote?.trim() ? 'collaborationNext.followReview' : 'collaborationNext.awaitInstructions')}</p>}
            <p className="mt-4">{t('funding.onlyReceived')}</p>
        </Alert>
    </section>;
}
