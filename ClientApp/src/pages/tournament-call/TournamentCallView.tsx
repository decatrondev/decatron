import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUpRight, Radio, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLayoutView, BrandMark } from '../../brand/BrandMark';
import { useBrand } from '../../brand/BrandContext';
import { SLOT_BY_KEY } from '../../brand/slots';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button, DsRoot } from '../../components/ds';
import type { CallContent, CallCustodyOffer, CallProfile } from './content';
import CallApplicationForm from './CallApplicationForm';
import CallPrizes from './CallPrizes';
import CallCustodyOffers from './CallCustodyOffers';
import CallMyActivity from './CallMyActivity';
import CollaborateModal, { type CollaborateTab } from './CollaborateModal';
import type { PublicContribution } from './contributions';
import './call.css';

function CallBrand() {
    const { resolve } = useBrand();
    return <BrandMark slot="public-nav" theme="dark" fallback={<BrandLayoutView layout={SLOT_BY_KEY['public-nav'].defaults.base} resolve={ref => resolve(ref === 'builtin:lockup' ? 'builtin:lockup-light' : ref)} theme="dark" alt="" />} />;
}

export default function TournamentCallView({ content, preview = false, applicationsOpen = false, donationsOpen = false, contributions = [], pageVersion = '', profiles = [], custodyOffers = [], custodyNoticeVersion = '' }: { content: CallContent; preview?: boolean; applicationsOpen?: boolean; donationsOpen?: boolean; contributions?: PublicContribution[]; pageVersion?: string; profiles?: CallProfile[]; custodyOffers?: CallCustodyOffer[]; custodyNoticeVersion?: string }) {
    const { t, i18n } = useTranslation('tournament-call');
    const { changeLanguage, isLoading: changingLanguage } = useLanguage();
    const language = i18n.language?.startsWith('en') ? 'en' : 'es';
    const copy = content[language];
    const [collaborateTab, setCollaborateTab] = useState<CollaborateTab | null>(null);
    const [activityKey, setActivityKey] = useState(0);
    const refreshActivity = useCallback(() => setActivityKey(key => key + 1), []);
    const closeCollaborate = useCallback(() => { setCollaborateTab(null); refreshActivity(); }, [refreshActivity]);
    const canCollaborate = donationsOpen || applicationsOpen;
    return <DsRoot theme="dark" className="call-page">
        <header className="call-header call-wrap">
            <Link to="/" aria-label={t('home')}><CallBrand /></Link>
            <nav aria-label={t('navigation')}><a href="#format">{t('format')}</a><a href="#prizes">{t('prizes')}</a><a href="#community">{t('community')}</a></nav>
            <button className="ds-btn ds-btn--ghost ds-btn--sm" disabled={changingLanguage} onClick={() => { void changeLanguage(language === 'es' ? 'en' : 'es').catch(() => {}); }} aria-label={t('changeLanguage')}>{language === 'es' ? 'EN' : 'ES'}</button>
        </header>
        {preview && <div className="call-wrap call-preview" role="status">{t('previewNotice')}</div>}
        <main>
            <section className="call-hero call-wrap" aria-labelledby="call-title">
                <div className="call-hero-copy"><p className="call-kicker"><Radio size={16} aria-hidden />{t('eyebrow')}</p>
                    <h1 id="call-title">{copy.title || t('defaultTitle')}</h1>
                    <p className="call-intro">{copy.summary || t('defaultSummary')}</p>
                    <div className="call-hero-actions"><a className="ds-btn ds-btn--primary ds-btn--lg" href="#participate">{t('participate')}<ArrowDown size={17} aria-hidden /></a><a className="ds-btn ds-btn--secondary ds-btn--lg" href="#collaborate">{t('collaborate')}</a></div>
                    <p className="call-small">{t('datePending')}</p>
                    <p className="call-small">{t('collaboration')}</p>
                </div>
                <figure className="call-hero-art">
                    {content.imageUrl ? <img src={content.imageUrl} alt={copy.imageAlt} fetchPriority="high" /> : <div className="call-image-pending">{t('imagePending')}</div>}
                    <figcaption><span>{t('edition')}</span><span>{t('server')}</span></figcaption>
                </figure>
            </section>
            <div className="call-facts" id="format"><div className="call-wrap call-facts-inner">{['solo', 'zeroBuild', 'server', 'streamers'].map((key, index) => <div key={key}><span className="call-number">0{index + 1}</span><strong>{t(key)}</strong></div>)}</div></div>
            <section className="call-wrap call-section call-prizes" id="prizes" aria-labelledby="prize-title">
                <div><p className="call-kicker"><Trophy size={16} aria-hidden />{t('prizeEyebrow')}</p><h2 id="prize-title">{t('prizeTitle')}</h2><p className="call-body">{t('prizeDescription')}</p></div>
                <CallPrizes contributions={contributions} />
            </section>
            <section className="call-process" id="participate"><div className="call-wrap call-section">
                <div className="call-section-head"><p className="call-kicker">{t('participate')}</p><h2>{t('processTitle')}</h2><p className="call-body">{t(!preview && applicationsOpen ? 'applicationsIntro' : 'registrationPending')}</p></div>
                <ol className="call-steps">{['use', 'apply', 'play'].map((key, index) => <li key={key}><span className="call-step-index">0{index + 1}</span><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Description`)}</p></li>)}</ol>
                {(preview || !applicationsOpen) && <Link to="/login" className="ds-btn ds-btn--secondary">{t('discoverBot')}<ArrowUpRight size={16} aria-hidden /></Link>}
                {!preview && applicationsOpen && content.tournamentUrl && <div className="call-tournament-join"><p className="call-body">{t('tournament.help')}</p><Link to={content.tournamentUrl} className="ds-btn ds-btn--primary ds-btn--lg">{t('tournament.join')}<ArrowUpRight size={16} aria-hidden /></Link></div>}
                {!preview && <CallApplicationForm kind="participant" open={applicationsOpen} pageVersion={pageVersion} />}
            </div></section>
            <section className="call-wrap call-section call-community" id="community">
                <div id="collaborate"><p className="call-kicker">{t('community')}</p><h2>{t('collaborateTitle')}</h2><p className="call-body">{t('collaborateDescription')}</p>{preview && <p className="call-inline-note">{t('collaborationPending')}</p>}</div>
                <div className="call-contribution"><h3>{t('contributeTitle')}</h3><p>{t('contributeDescription')}</p><p className="call-small">{t('funding.onlyReceived')}</p>
                    {canCollaborate && !preview ? <Button className="mt-4" onClick={() => setCollaborateTab(donationsOpen ? 'money' : 'custody')}>{t('collaborateAction')}</Button> : <p className="call-small">{t('funding.closed')}</p>}</div>
                {!preview && <div className="call-collaboration-form"><CallMyActivity refreshKey={activityKey} onOpen={() => setCollaborateTab('custody')} /></div>}
            </section>
            <CallCustodyOffers offers={custodyOffers} />
            {profiles.length > 0 && <section className="call-wrap call-section"><p className="call-kicker">{t('community')}</p><h2>{t('publicProfilesTitle')}</h2><p className="call-body">{t('publicProfilesHelp')}</p><div className="call-public-profiles">{profiles.map(profile => <a key={`${profile.kind}:${profile.channelUrl}`} href={profile.channelUrl} target="_blank" rel="noopener noreferrer" className="call-public-profile">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" loading="lazy" />}<span><strong>{profile.displayName}</strong><span>{t(profile.kind === 'participant' ? 'interestedStreamer' : 'collaborationApplicant')}</span></span><ArrowUpRight size={18} aria-hidden /></a>)}</div></section>}
            <section className="call-wrap call-section call-rules" aria-labelledby="rules-title"><p className="call-kicker">{t('beforePlaying')}</p><h2 id="rules-title">{t('rulesTitle')}</h2><p className="call-body call-preserve">{copy.rules || t('defaultRules')}</p><p className="call-small">{t('operationalPending')}</p></section>
        </main>
        {collaborateTab && !preview && <CollaborateModal onClose={closeCollaborate} initialTab={collaborateTab} donationsOpen={donationsOpen} applicationsOpen={applicationsOpen} pageVersion={pageVersion} custodyNoticeVersion={custodyNoticeVersion} onChanged={refreshActivity} />}
        <footer className="call-wrap call-footer"><Link to="/" aria-label={t('home')}><CallBrand /></Link><div>{content.imageCredit && <p>{t('imageCredit', { credit: content.imageCredit })} {content.imageSource && <a href={content.imageSource} target="_blank" rel="noopener noreferrer">{t('source')}</a>}</p>}<p>{t('independent')}</p><p>{t('organizerNotice')}</p><Link to="/docs/convocatorias">{t('guide')}</Link></div></footer>
    </DsRoot>;
}
