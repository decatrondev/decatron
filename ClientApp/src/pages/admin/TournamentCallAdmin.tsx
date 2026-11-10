import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Field, Input, Tabs, Textarea } from '../../components/ds';
import { useBrand } from '../../brand/BrandContext';
import api from '../../services/api';
import TournamentCallView from '../tournament-call/TournamentCallView';
import CallApplicationsReview from './CallApplicationsReview';
import CallContributions from './CallContributions';
import { blankContent, CALL_API, CALL_PATH, CALL_COVER, CALL_COVER_SOURCE, type CallAdminData, type CallCopy } from '../tournament-call/content';

export default function TournamentCallAdmin() {
    const { t, i18n } = useTranslation('tournament-call');
    const brand = useBrand();
    const [data, setData] = useState<CallAdminData | null>(null);
    const [tab, setTab] = useState('guide');
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);
    const load = async () => {
        setBusy(true); setError('');
        try { const response = await api.get<CallAdminData>(CALL_API); setData(response.data); setDirty(false); }
        catch (e: any) { setError(e.response?.status === 403 ? t('ownerOnly') : t('adminLoadError')); }
        finally { setBusy(false); }
    };
    useEffect(() => { void load(); }, []);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);
    const change = (values: Partial<CallAdminData['content']>) => {
        if (!data || busy) return;
        setData({ ...data, content: { ...data.content, ...values } }); setDirty(true); setNotice('');
    };
    const copy = (language: 'es' | 'en', key: keyof CallCopy, value: string) => data && change({ [language]: { ...data.content[language], [key]: value } });
    const action = async (kind: 'save' | 'publish' | 'unpublish') => {
        if (!data || busy) return;
        if (kind !== 'save' && !window.confirm(t(kind === 'publish' ? 'confirmPublish' : 'confirmUnpublish'))) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = kind === 'save' ? await api.put(CALL_API, { content: data.content, revision: data.revision }) : await api.post(`${CALL_API}/${kind}`, { revision: data.revision });
            setData({ ...data, ...response.data }); setDirty(false); setNotice(t(`${kind}Success`));
        } catch (e: any) {
            const code = e.response?.data?.code;
            setError(t(code === 'stale_revision' ? 'conflict' : code === 'incomplete_content' ? 'incomplete' : 'saveError'));
        } finally { setBusy(false); }
    };
    const template = async () => {
        setBusy(true); setError('');
        try {
        await i18n.reloadResources(['es', 'en'], ['tournament-call']);
        const content = blankContent();
        for (const language of ['es', 'en'] as const) content[language] = {
            title: t('defaultTitle', { lng: language }), summary: t('defaultSummary', { lng: language }), imageAlt: t('officialImageAlt', { lng: language }), rules: t('defaultRules', { lng: language }),
        };
        content.imageUrl = CALL_COVER; content.imageCredit = 'Epic Games'; content.imageSource = CALL_COVER_SOURCE;
        change(content);
        } catch { setError(t('saveError')); }
        finally { setBusy(false); }
    };
    const assets = [{ id: 0, name: t('officialCover'), url: CALL_COVER }, ...(brand.data?.assets.filter(asset => /^\/uploads\/brand\/[^?#]+\.(png|jpe?g|webp)$/i.test(asset.url)) ?? [])];
    const toggleApplications = async () => {
        if (!data || busy || !window.confirm(t(data.applicationsOpen ? 'confirmCloseApplications' : 'confirmOpenApplications'))) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await api.put(`${CALL_API}/applications-open`, { open: !data.applicationsOpen, revision: data.revision });
            setData({ ...data, ...response.data }); setNotice(t(response.data.applicationsOpen ? 'applicationsOpened' : 'applicationsClosedSuccess'));
        } catch { setError(t('applicationConflictHelp')); }
        finally { setBusy(false); }
    };
    const toggleDonations = async () => {
        if (!data || busy || !window.confirm(t(data.donationsOpen ? 'funding.confirmClose' : 'funding.confirmOpen'))) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const response = await api.put(`${CALL_API}/donations-open`, { open: !data.donationsOpen, revision: data.revision });
            setData({ ...data, ...response.data }); setNotice(t('funding.openStateSaved'));
        } catch { setError(t('applicationConflictHelp')); } finally { setBusy(false); }
    };
    return <main className="call-editor panel-scale">
        <Link to="/admin" className="ds-btn ds-btn--ghost">{t('backAdmin')}</Link>
        <h1 className="text-3xl font-bold text-ds-text my-5">{t('adminTitle')}</h1>
        <Tabs items={[{ id: 'guide', label: t('guide') }, { id: 'content', label: t('content') }, { id: 'participants', label: t('participantApplications') }, { id: 'collaborators', label: t('collaboratorApplications') }, { id: 'contributions', label: t('funding.tab') }]} value={tab} onChange={setTab} />
        {error && <Alert tone="danger">{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
        {!data && <Button loading={busy} onClick={load}>{t('retry')}</Button>}
        {tab === 'guide' ? <section className="py-6 space-y-5 text-ds-text"><h2 className="text-xl font-bold">{t('guideTitle')}</h2><p>{t('guideBody')}</p><ol className="list-decimal pl-6 space-y-3">{['guide1', 'guide2', 'guide3', 'guide4', 'guide5'].map(key => <li key={key}>{t(key)}</li>)}</ol><Alert>{t('phaseNotice')}</Alert><p>{t('funding.guide')}</p><p>{t('collaborationNext.guide')}</p><Alert>{t('funding.noticeActive')}</Alert>{data && <div><p>{t(data.donationsOpen ? 'funding.open' : 'funding.closed')}</p><Button disabled={busy || dirty || !data.published} onClick={toggleDonations}>{t(data.donationsOpen ? 'funding.closeDonations' : 'funding.openDonations')}</Button></div>}{data && <div><p>{t(data.applicationsOpen ? 'applicationsAreOpen' : 'applicationsAreClosed')}</p><p>{t('openingHelp')}</p><Button disabled={busy || dirty || !data.published} onClick={toggleApplications}>{t(data.applicationsOpen ? 'closeApplications' : 'openApplications')}</Button></div>}<Link className="ds-btn ds-btn--secondary" to="/docs/convocatorias">{t('fullGuide')}</Link></section> : tab === 'contributions' ? <CallContributions /> : tab === 'participants' || tab === 'collaborators' ? <CallApplicationsReview key={tab} kind={tab === 'participants' ? 'participant' : 'collaborator'} /> : data && <>
            <div className="call-editor-actions"><Button variant="secondary" disabled={busy || !!data.content.es.title || !!data.content.en.title} onClick={template}>{t('template')}</Button><Button variant="ghost" disabled={busy} onClick={() => { if (!dirty || window.confirm(t('discard'))) void load(); }}>{t('reload')}</Button></div>
            <div className="call-editor-fields">{(['es', 'en'] as const).map(language => <section key={language}><h2>{t(language === 'es' ? 'spanish' : 'english')}</h2>{(['title', 'summary', 'imageAlt', 'rules'] as const).map(key => <Field key={key} label={t(key)}>{key === 'summary' || key === 'rules' ? <Textarea disabled={busy} rows={key === 'rules' ? 7 : 4} maxLength={key === 'rules' ? 6000 : 1200} value={data.content[language][key]} onChange={event => copy(language, key, event.target.value)} /> : <Input disabled={busy} maxLength={key === 'title' ? 120 : 250} value={data.content[language][key]} onChange={event => copy(language, key, event.target.value)} />}</Field>)}</section>)}</div>
            <section><h2 className="text-xl font-bold text-ds-text">{t('cover')}</h2><p className="text-ds-soft mt-2">{t('coverHelp')}</p><Link to="/admin/brand" className="ds-btn ds-btn--ghost">{t('openLibrary')}</Link><Button variant="ghost" onClick={() => brand.reload()}>{t('refreshLibrary')}</Button>
                <div className="call-assets">{assets.map(asset => <button key={asset.id} type="button" disabled={busy} aria-pressed={data.content.imageUrl === asset.url} onClick={() => change({ imageUrl: asset.url })} className={`ds-btn ds-btn--${data.content.imageUrl === asset.url ? 'primary' : 'secondary'} call-asset`}><img src={asset.url} alt="" loading="lazy" /><span>{asset.name}</span></button>)}</div>
                {!assets.length && <Alert>{t('noImages')}</Alert>}
                {data.content.imageUrl && <Button variant="ghost" onClick={() => change({ imageUrl: '' })}>{t('removeCover')}</Button>}
                <div className="call-editor-fields"><Field label={t('credit')}><Input disabled={busy} maxLength={250} value={data.content.imageCredit} onChange={event => change({ imageCredit: event.target.value })} /></Field><Field label={t('sourceUrl')}><Input disabled={busy} type="url" maxLength={2000} value={data.content.imageSource} onChange={event => change({ imageSource: event.target.value })} /></Field></div>
                <div className="call-editor-fields"><Field label={t('tournamentLink')}><Input disabled={busy} maxLength={150} placeholder="/torneos/canal/edicion" value={data.content.tournamentUrl ?? ''} onChange={event => change({ tournamentUrl: event.target.value.trim() })} /></Field><p className="call-small">{t('tournamentLinkHelp')}</p></div>
            </section>
            <Alert>{t(data.published ? 'publishedState' : 'draftState')}</Alert>
            <div className="call-editor-actions"><Button loading={busy} disabled={!dirty} onClick={() => action('save')}>{t('save')}</Button><Button variant="secondary" onClick={() => setPreview(!preview)}>{t(preview ? 'hidePreview' : 'preview')}</Button><Button variant="secondary" disabled={busy || dirty} onClick={() => action('publish')}>{t('publish')}</Button>{data.published && <Button variant="danger" disabled={busy || dirty} onClick={() => action('unpublish')}>{t('unpublish')}</Button>}<Link to={CALL_PATH} target="_blank" className="ds-btn ds-btn--ghost">{t('openPublic')}</Link></div>
            {dirty && <p className="text-ds-soft">{t('unsaved')}</p>}
            {preview && <div className="call-editor-preview"><TournamentCallView content={data.content} preview /></div>}
        </>}
    </main>;
}
