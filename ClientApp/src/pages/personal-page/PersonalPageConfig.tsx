import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Save, Send, Undo2 } from 'lucide-react';
import TabIcon from '../../components/dashboard/TabIcon';
import { Card, CopyButton, ScaledCanvas } from '../../components/overlay-editor/ui';
import TemplateRenderer from './TemplateRenderer';
import { usePageFonts } from './shared';
import { usePersonalPage } from './usePersonalPage';
import { AppealForm, AppearanceTab, GuideTab, HandleInput, LinksTab, NameTab, ProfileTab, useErrorText, type PanelTab } from './PersonalPageTabs';
import SceneTab from './SceneTab';
import MediaTab from './MediaTab';

// Panel «Mi página» (subfase 5.1). Mismo patrón que el panel de Song Request: pestañas con la Guía primero a la
// izquierda y vista previa a la derecha. Plan: .dev/plans/pagina-personal/PLAN.md §9.

const TABS: { id: PanelTab; icon: string }[] = [
    { id: 'guide', icon: '📚' },
    { id: 'profile', icon: '🙂' },
    { id: 'links', icon: '🔗' },
    { id: 'media', icon: '🎞️' },
    { id: 'appearance', icon: '🎨' },
    { id: 'scene', icon: '🎬' },
    { id: 'name', icon: '@' },
];

export default function PersonalPageConfig() {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const s = usePersonalPage();
    const [tab, setTab] = useState<PanelTab>(() => {
        try { const saved = sessionStorage.getItem('pp-tab') as PanelTab | null; return saved && TABS.some(x => x.id === saved) ? saved : 'guide'; } catch { return 'guide'; }
    });
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<string[]>([]);
    const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
    // Alta: nombre elegido y su estado (undefined = sin comprobar, null = libre, texto = código del problema)
    const [newHandle, setNewHandle] = useState('');
    const [newStatus, setNewStatus] = useState<string | null | undefined>(undefined);
    const [claimFor, setClaimFor] = useState<string | null>(null);

    useEffect(() => { try { sessionStorage.setItem('pp-tab', tab); } catch { /* sin storage */ } }, [tab]);
    useEffect(() => { if (s.data?.suggestedHandle && !newHandle) setNewHandle(s.data.suggestedHandle); }, [s.data?.suggestedHandle, newHandle]);
    useEffect(() => {
        if (!message) return;
        const id = window.setTimeout(() => setMessage(null), 5000);
        return () => window.clearTimeout(id);
    }, [message]);
    useEffect(() => {
        if (!s.dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [s.dirty]);

    usePageFonts(s.draft ? [s.draft.font] : []);
    const notify = (ok: boolean, text: string) => setMessage({ ok, text });


    if (s.loading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent" /></div>;
    }
    if (s.loadError || !s.data) {
        return (
            <div className="max-w-xl mx-auto p-6 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-ds-danger">
                {t(`errors.${s.loadError === 'forbidden' || s.loadError === 'not_available' ? s.loadError : 'loadFailed'}`)}
            </div>
        );
    }

    const { data, page, draft } = s;
    const publicUrl = page ? `${window.location.origin}/@${page.handle}` : '';

    const save = async () => {
        const res = await s.saveDraft();
        setFieldErrors(res.error?.details ?? []);
        notify(!res.error, res.error ? errorText(res.error.code) : t('saved'));
    };
    const publish = async () => {
        if (s.dirty) {
            const saved = await s.saveDraft();
            if (saved.error) { setFieldErrors(saved.error.details); notify(false, errorText(saved.error.code)); return; }
        }
        const res = await s.publish();
        setFieldErrors(res.error?.details ?? []);
        if (res.error) {
            const details = res.error.details.map(errorText).join(' ');
            notify(false, `${errorText(res.error.code)} ${details}`.trim());
        } else notify(true, t('publishedOk'));
    };
    const discard = async () => {
        if (!window.confirm(t('discardConfirm'))) return;
        const res = await s.discard();
        setFieldErrors([]);
        notify(!res.error, res.error ? errorText(res.error.code) : t('discarded'));
    };
    const create = async () => {
        const res = await s.create(newHandle);
        if (res.error) notify(false, errorText(res.error.code));
        else { notify(true, t('onboarding.created')); setTab('guide'); }
    };

    return (
        <div className="panel-scale max-w-[1920px] mx-auto">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <div className="min-w-0">
                    <h1 className="text-3xl 3xl:text-4xl font-black text-ds-text">{t('title')}</h1>
                    <p className="text-sm 3xl:text-base text-ds-soft mt-1">{t('subtitle')}</p>
                </div>
                {page && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs 3xl:text-sm font-bold mr-1 ${s.dirty || page.hasUnpublishedChanges ? 'text-ds-warn' : 'text-ds-ok'}`}>
                            {s.dirty ? t('status.unsaved') : page.hasUnpublishedChanges ? (page.published ? t('status.unpublishedChanges') : t('status.neverPublished')) : t('status.published')}
                        </span>
                        {page.published && page.hasUnpublishedChanges && !s.dirty && (
                            <button type="button" className="ds-btn ds-btn--secondary" disabled={s.busy} onClick={discard}><Undo2 className="w-4 h-4" />{t('discard')}</button>
                        )}
                        <button type="button" className="ds-btn ds-btn--secondary" disabled={s.busy || !s.dirty} onClick={save}><Save className="w-4 h-4" />{t('save')}</button>
                        <button type="button" className="ds-btn ds-btn--primary" disabled={s.busy || (!s.dirty && !page.hasUnpublishedChanges)} onClick={publish}><Send className="w-4 h-4" />{t('publish')}</button>
                    </div>
                )}
            </div>

            {message && (
                <div role="status" className={`mb-6 p-4 rounded-lg border ${message.ok ? 'bg-ds-ok/10 border-ds-ok/40 text-ds-ok' : 'bg-ds-danger/10 border-ds-danger/40 text-ds-danger'}`}>{message.text}</div>
            )}

            {!data.publicOpen && (
                <div className="mb-6 p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-sm 3xl:text-base text-ds-text">
                    <p className="font-bold text-ds-warn">{t('notOpen.title')}</p>
                    <p className="mt-1 text-ds-soft">{t('notOpen.text')}</p>
                </div>
            )}
            {page?.status === 'hidden' && (
                <div className="mb-6 p-4 rounded-lg border border-ds-danger/40 bg-ds-danger/10 text-sm 3xl:text-base">
                    <p className="font-bold text-ds-danger">{t('hiddenNotice.title')}</p>
                    <p className="mt-1 text-ds-soft">{page.hiddenReason || t('hiddenNotice.noReason')}</p>
                </div>
            )}
            {page?.needsNewHandle && (
                <div className="mb-6 p-4 rounded-lg border border-ds-warn/40 bg-ds-warn/10 text-sm 3xl:text-base">
                    <p className="font-bold text-ds-warn">{t('name.needsNewTitle')}</p>
                    <p className="mt-1 text-ds-soft">{t('name.needsNew')}</p>
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm mt-3" onClick={() => setTab('name')}>{t('name.goChange')}</button>
                </div>
            )}

            {!page || !draft ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Card title={t('onboarding.title')} description={t('onboarding.text')}>
                        <div className="space-y-3">
                            <HandleInput value={newHandle} onChange={setNewHandle} onStatus={setNewStatus} />
                            <button type="button" className="ds-btn ds-btn--primary" disabled={s.busy || newStatus !== null} onClick={create}>{t('onboarding.create')}</button>
                            {(newStatus === 'taken' || newStatus === 'redirecting') && (
                                <div className="pt-2">
                                    <p className="text-sm 3xl:text-base text-ds-soft">{t('onboarding.takenHelp')}</p>
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm mt-2" onClick={() => setClaimFor(newHandle)}>{t('appeal.claimThis')}</button>
                                </div>
                            )}
                        </div>
                    </Card>
                    {claimFor !== null ? (
                        <Card title={t('appeal.title')} description={t('appeal.hint')}>
                            <AppealForm initialHandle={claimFor} onSent={() => notify(true, t('appeal.sent'))} />
                        </Card>
                    ) : (
                        <Card title={t('onboarding.whatTitle')}>
                            <ul className="space-y-2 list-disc pl-5 text-sm 3xl:text-base text-ds-soft">
                                {['links', 'design', 'draft', 'free'].map(k => <li key={k}>{t(`onboarding.what.${k}`)}</li>)}
                            </ul>
                        </Card>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6 min-w-0">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                            <div className="flex flex-wrap gap-2" role="tablist">
                                {TABS.filter(item => item.id !== 'scene' || draft.template === 'scene').map(item => (
                                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
                                        className={tab === item.id ? 'ds-btn ds-btn--primary ds-btn--sm whitespace-nowrap' : 'ds-btn ds-btn--secondary ds-btn--sm whitespace-nowrap'}>
                                        <TabIcon emoji={item.icon} />{t(`tabs.${item.id}`)}
                                        {item.id === 'links' && fieldErrors.some(e => e.startsWith('link')) && <span className="ml-1 w-2 h-2 rounded-full bg-ds-danger" aria-hidden="true" />}
                                        {item.id === 'media' && fieldErrors.some(e => /^(video|photo|sound)/.test(e)) && <span className="ml-1 w-2 h-2 rounded-full bg-ds-danger" aria-hidden="true" />}
                                        {item.id === 'scene' && (fieldErrors.some(e => e.startsWith('layer') || e.startsWith('scene')) || (data.missingMedia ?? []).length > 0) && <span className="ml-1 w-2 h-2 rounded-full bg-ds-danger" aria-hidden="true" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            {tab === 'guide' && <GuideTab onNavigate={setTab} />}
                            {tab === 'profile' && <ProfileTab s={s} photoFallback={data.channel?.photoUrl ?? ''} onMessage={notify} />}
                            {tab === 'links' && <LinksTab s={s} errors={fieldErrors} />}
                            {tab === 'media' && <MediaTab s={s} errors={fieldErrors} />}
                            {tab === 'appearance' && <AppearanceTab s={s} onMessage={notify} photoFallback={data.channel?.photoUrl ?? ''} />}
                            {tab === 'scene' && draft.template === 'scene' && <SceneTab s={s} photoFallback={data.channel?.photoUrl ?? ''} errors={fieldErrors} />}
                            {tab === 'scene' && draft.template !== 'scene' && <GuideTab onNavigate={setTab} />}
                            {tab === 'name' && <NameTab s={s} onMessage={notify} />}
                        </div>
                    </div>

                    <div className="xl:col-span-1 min-w-0">
                        <div className="xl:sticky xl:top-4 space-y-3">
                            <div className="bg-ds-surface rounded-lg border border-ds-border p-4 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h2 className="font-bold text-ds-text text-base 3xl:text-lg">{t('preview.title')}</h2>
                                    <div className="flex gap-1">
                                        {(['phone', 'desktop'] as const).map(d => (
                                            <button key={d} type="button" onClick={() => setDevice(d)} className={device === d ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`preview.${d}`)}</button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs 3xl:text-sm text-ds-soft">{t('preview.hint')}</p>
                                {device === 'phone' ? (
                                    <div className="mx-auto w-full max-w-[390px] h-[720px] 3xl:h-[860px] overflow-y-auto rounded-2xl border border-ds-border">
                                        <TemplateRenderer content={draft} channelPhotoUrl={data.channel?.photoUrl} handle={page.handle} embedded />
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-ds-border overflow-hidden">
                                        <ScaledCanvas width={1280} height={800}>
                                            <div style={{ width: 1280, height: 800, overflow: 'hidden' }}>
                                                <TemplateRenderer content={draft} channelPhotoUrl={data.channel?.photoUrl} handle={page.handle} embedded />
                                            </div>
                                        </ScaledCanvas>
                                    </div>
                                )}
                            </div>
                            <div className="bg-ds-surface rounded-lg border border-ds-border p-4 space-y-2">
                                <p className="text-xs 3xl:text-sm font-bold text-ds-soft">{t('preview.linkTitle')}</p>
                                <p className="text-sm 3xl:text-base text-ds-text break-all">{publicUrl}</p>
                                <div className="flex flex-wrap gap-2">
                                    <CopyButton text={publicUrl} label={t('preview.copy')} doneLabel={t('preview.copied')} />
                                    <a href={`/@${page.handle}`} target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn--secondary"><ExternalLink className="w-4 h-4" />{t('preview.open')}</a>
                                </div>
                                {!page.published && <p className="text-xs 3xl:text-sm text-ds-soft">{t('preview.notPublishedYet')}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
