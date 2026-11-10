import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DsRoot } from '../../components/ds';
import { CALL_PATH } from './content';
import './call.css';
export default function TournamentCallGuide() {
    const { t } = useTranslation('tournament-call');
    return <DsRoot theme="dark" className="call-page"><main className="call-wrap call-section"><Link to={CALL_PATH} className="ds-btn ds-btn--ghost">{t('backCall')}</Link><h1 className="text-4xl font-bold my-8">{t('guideTitle')}</h1><p className="call-body">{t('publicGuideBody')}</p><p className="call-body mt-6">{t('publicApplicationGuide')}</p><p className="call-body mt-6">{t('funding.publicGuide')}</p><p className="call-body mt-6">{t('collaborationNext.guide')}</p><h2 className="mt-10">{t('rulesTitle')}</h2><p className="call-body call-preserve">{t('defaultRules')}</p><p className="call-body mt-6">{t('phaseNotice')}</p></main></DsRoot>;
}
