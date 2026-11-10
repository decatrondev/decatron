import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, DsRoot } from '../../components/ds';
import TournamentCallView from './TournamentCallView';
import { CALL_PATH, type CallContent, type CallCustodyOffer, type CallProfile } from './content';
import type { PublicContribution } from './contributions';

export default function TournamentCallPage() {
    const { t } = useTranslation('tournament-call');
    const [content, setContent] = useState<CallContent | null>(null);
    const [state, setState] = useState('loading');
    const [applicationsOpen, setApplicationsOpen] = useState(false);
    const [donationsOpen, setDonationsOpen] = useState(false);
    const [contributions, setContributions] = useState<PublicContribution[]>([]);
    const [pageVersion, setPageVersion] = useState('');
    const [profiles, setProfiles] = useState<CallProfile[]>([]);
    const [custodyOffers, setCustodyOffers] = useState<CallCustodyOffer[]>([]);
    const [custodyNoticeVersion, setCustodyNoticeVersion] = useState('');
    const [attempt, retry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setState('loading');
        fetch(`/api${CALL_PATH}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
            if (response.status === 404) { setState('unpublished'); return; }
            if (!response.ok) throw new Error();
            const data = await response.json();
            setContent(data.content); setApplicationsOpen(data.applicationsOpen === true);
            setDonationsOpen(data.donationsOpen === true); setContributions(data.contributions ?? []);
            setPageVersion(data.pageVersion ?? ''); setProfiles(data.profiles ?? []);
            setCustodyOffers(data.custodyOffers ?? []); setCustodyNoticeVersion(data.custodyNoticeVersion ?? ''); setState('ready');
        }).catch(error => { if (error.name !== 'AbortError') setState('error'); });
        return () => controller.abort();
    }, [attempt]);
    if (state === 'ready' && content) return <TournamentCallView content={content} applicationsOpen={applicationsOpen} donationsOpen={donationsOpen} contributions={contributions} pageVersion={pageVersion} profiles={profiles} custodyOffers={custodyOffers} custodyNoticeVersion={custodyNoticeVersion} />;
    return <DsRoot theme="dark" className="call-page"><main className="call-wrap call-section"><h1>{t(state === 'unpublished' ? 'unpublished' : state === 'error' ? 'loadError' : 'loading')}</h1>{state === 'error' && <Alert tone="danger">{t('loadErrorHelp')}</Alert>}{state === 'error' && <Button onClick={() => retry(attempt + 1)}>{t('retry')}</Button>}<Link className="ds-btn ds-btn--secondary" to="/">{t('home')}</Link></main></DsRoot>;
}
