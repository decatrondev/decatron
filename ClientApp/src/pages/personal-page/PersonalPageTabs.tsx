import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2, Upload, Plus } from 'lucide-react';
import api from '../../services/api';
import { Card, Field, ScaledCanvas, inputClass } from '../../components/overlay-editor/ui';
import { FONTS, PLATFORM_NAMES, TEMPLATES, TEMPLATES_WITH_SIZE, TEMPLATE_FONT, linkChecks, newLinkId, usePageFonts, type PersonalPageLink } from './shared';
import TemplateRenderer from './TemplateRenderer';
import { errorOf, type PersonalPageState } from './usePersonalPage';

export type PanelTab = 'guide' | 'profile' | 'links' | 'appearance' | 'scene' | 'name';

/** Texto de un código de error del servidor (con el índice del enlace si lo trae, «link_url:2»). */
export function useErrorText() {
    const { t } = useTranslation('personal-page');
    return (code: string) => {
        const [key, index] = code.split(':');
        return t(`errors.${key}`, { n: index !== undefined ? Number(index) + 1 : '', defaultValue: t('errors.failed') });
    };
}

// ---------------- Guía ----------------

export function GuideTab({ onNavigate }: { onNavigate: (tab: PanelTab) => void }) {
    const { t } = useTranslation('personal-page');
    const steps: PanelTab[] = ['profile', 'links', 'appearance', 'name'];
    return (
        <div className="space-y-6">
            <Card title={t('guide.title')} description={t('guide.intro')}>
                <ol className="space-y-3 list-decimal pl-5 text-sm 3xl:text-base text-ds-text">
                    {steps.map(step => (
                        <li key={step}>
                            <button type="button" onClick={() => onNavigate(step)} className="font-bold text-ds-accent-text hover:underline">{t(`tabs.${step}`)}</button>
                            <span className="text-ds-soft">: {t(`guide.steps.${step}`)}</span>
                        </li>
                    ))}
                    <li><span className="font-bold">{t('guide.publishTitle')}</span><span className="text-ds-soft">: {t('guide.steps.publish')}</span></li>
                </ol>
            </Card>
            <Card title={t('guide.notesTitle')}>
                <ul className="space-y-2 list-disc pl-5 text-sm 3xl:text-base text-ds-soft">
                    {['draft', 'templates', 'scene', 'handle', 'appeal', 'links', 'adult', 'reports', 'permissions'].map(k => <li key={k}>{t(`guide.notes.${k}`)}</li>)}
                </ul>
            </Card>
            <p className="text-sm 3xl:text-base text-ds-soft">
                {t('guide.docsPrefix')} <Link to="/dashboard/docs/personal-page" className="text-ds-accent-text hover:underline">{t('guide.docsLink')}</Link>
            </p>
        </div>
    );
}

// ---------------- Perfil ----------------

export function ProfileTab({ s, photoFallback, onMessage }: { s: PersonalPageState; photoFallback: string; onMessage: (ok: boolean, text: string) => void }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const draft = s.draft!;
    const limits = s.data!.limits;
    const file = useRef<HTMLInputElement>(null);
    const photo = draft.avatarUrl || photoFallback;
    const forced = s.page?.forcedAdult === true;

    const upload = async (f: File | undefined) => {
        if (!f) return;
        const res = await s.uploadAvatar(f);
        if (res.error) { onMessage(false, errorText(res.error.code)); return; }
        const suggested = (res.data as { suggestedAccent?: string } | null)?.suggestedAccent;
        onMessage(true, suggested ? t('profile.uploadedWithAccent') : t('profile.uploaded'));
        if (suggested) s.edit({ accent: suggested });
    };

    return (
        <div className="space-y-6">
            <Card title={t('profile.photoTitle')} description={t('profile.photoHint')}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-24 h-24 3xl:w-32 3xl:h-32 rounded-full overflow-hidden border-2 border-ds-border bg-ds-raised shrink-0 flex items-center justify-center text-ds-soft">
                        {photo ? <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : t('profile.noPhoto')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                        <button type="button" className="ds-btn ds-btn--primary" disabled={s.busy} onClick={() => file.current?.click()}><Upload className="w-4 h-4" />{t('profile.upload')}</button>
                        {draft.avatarUrl && <button type="button" className="ds-btn ds-btn--secondary" onClick={() => s.edit({ avatarUrl: '' })}>{t('profile.useChannelPhoto')}</button>}
                    </div>
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft mt-3">{t('profile.uploadRules')}</p>
            </Card>
            <Card title={t('profile.textTitle')}>
                <div className="space-y-4">
                    <Field label={t('profile.displayName')} hint={`${draft.displayName.length}/${limits.displayName}`}>
                        <input className={inputClass} value={draft.displayName} maxLength={limits.displayName} onChange={e => s.edit({ displayName: e.target.value })} />
                    </Field>
                    <Field label={t('profile.bio')} hint={`${draft.bio.length}/${limits.bio}`}>
                        <textarea className={`${inputClass} min-h-[110px]`} value={draft.bio} maxLength={limits.bio} placeholder={t('profile.bioPlaceholder')} onChange={e => s.edit({ bio: e.target.value })} />
                    </Field>
                </div>
            </Card>
            <Card title={t('adult.pageTitle')} description={t('adult.pageHint')}>
                <label className={`flex items-start gap-3 ${forced ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input type="checkbox" className="mt-1 w-5 h-5 accent-ds-accent" checked={forced || draft.adult === true} disabled={forced}
                        onChange={e => s.edit({ adult: e.target.checked })} />
                    <span className="text-sm 3xl:text-base text-ds-text">
                        <span className="font-bold">{t('adult.pageToggle')}</span>
                        <span className="block text-ds-soft mt-1">{forced ? t('adult.pageForced') : t('adult.pageEffect')}</span>
                    </span>
                </label>
            </Card>
        </div>
    );
}

// ---------------- Redes y enlaces ----------------

export function LinksTab({ s, errors }: { s: PersonalPageState; errors: string[] }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const draft = s.draft!;
    const { platforms, limits, domains } = s.data!;
    const links = draft.links ?? [];
    const [newKind, setNewKind] = useState(platforms[0]?.key ?? 'twitch');

    const setLinks = (next: PersonalPageLink[]) => s.edit({ links: next });
    const update = (i: number, patch: Partial<PersonalPageLink>) => setLinks(links.map((l, j) => j === i ? { ...l, ...patch } : l));
    const move = (i: number, d: number) => {
        const j = i + d;
        if (j < 0 || j >= links.length) return;
        const next = [...links];
        [next[i], next[j]] = [next[j], next[i]];
        setLinks(next);
    };
    const add = (kind: string) => {
        if (links.length >= limits.links) return;
        setLinks([...links, { id: newLinkId(), kind, url: '', title: '', visible: true, size: 'normal' }]);
    };
    const errorsFor = (i: number) => errors.filter(e => e.endsWith(`:${i}`));

    return (
        <div className="space-y-6">
            <Card title={t('links.addTitle')} description={t('links.addHint')}>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select className={inputClass} value={newKind} onChange={e => setNewKind(e.target.value)} aria-label={t('links.network')}>
                        {platforms.map(p => <option key={p.key} value={p.key}>{p.name}{p.adult ? ` (${t('links.adultTag')})` : ''}</option>)}
                    </select>
                    <button type="button" className="ds-btn ds-btn--primary shrink-0" disabled={links.length >= limits.links} onClick={() => add(newKind)}><Plus className="w-4 h-4" />{t('links.addNetwork')}</button>
                    <button type="button" className="ds-btn ds-btn--secondary shrink-0" disabled={links.length >= limits.links} onClick={() => add('custom')}><Plus className="w-4 h-4" />{t('links.addCustom')}</button>
                </div>
                <p className="text-xs 3xl:text-sm text-ds-soft mt-2">{t('links.count', { count: links.length, max: limits.links })}</p>
            </Card>

            {links.length === 0 && <p className="text-sm 3xl:text-base text-ds-soft">{t('links.empty')}</p>}

            {links.map((l, i) => {
                const platform = platforms.find(p => p.key === l.kind);
                const errs = errorsFor(i);
                const checks = linkChecks(l, domains);
                // Lo que ya se ve mientras se escribe no se repite con el error del servidor
                const live = [checks.shortener && 'link_shortener', checks.blocked && 'link_blocked'].filter(Boolean) as string[];
                const serverErrs = errs.filter(e => !live.includes(e.split(':')[0]));
                return (
                    <div key={l.id} className={`bg-ds-surface rounded-lg border p-4 3xl:p-5 space-y-3 ${errs.length || live.length ? 'border-ds-danger/60' : 'border-ds-border'}`}>
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-ds-text text-sm 3xl:text-base min-w-0 truncate">
                                {l.kind === 'custom' ? t('links.customLabel') : PLATFORM_NAMES[l.kind] ?? l.kind}
                                {(checks.forcedAdult || l.adult) && <span className="ml-2 text-xs font-bold text-ds-warn">{t('links.adultTag')}</span>}
                                {!l.visible && <span className="ml-2 text-xs font-semibold text-ds-soft">{t('links.hiddenTag')}</span>}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.up')} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></button>
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.down')} disabled={i === links.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></button>
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={l.visible ? t('links.hide') : t('links.show')} onClick={() => update(i, { visible: !l.visible })}>{l.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                                <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn text-ds-danger" aria-label={t('links.remove')} onClick={() => setLinks(links.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label={l.kind === 'custom' ? t('links.title') : t('links.titleOptional')} hint={`${l.title.length}/${limits.title}`}>
                                <input className={inputClass} value={l.title} maxLength={limits.title} placeholder={l.kind === 'custom' ? t('links.titlePlaceholder') : PLATFORM_NAMES[l.kind]} onChange={e => update(i, { title: e.target.value })} />
                            </Field>
                            <Field label={t('links.url')}>
                                <input className={inputClass} value={l.url} maxLength={limits.url} inputMode="url" placeholder={platform ? `${platform.example}…` : 'https://'} onChange={e => update(i, { url: e.target.value.trim() })} />
                            </Field>
                        </div>
                        {TEMPLATES_WITH_SIZE.includes(draft.template) && (
                            <Field label={t(`links.size.${draft.template}.label`)} hint={t(`links.size.${draft.template}.hint`)}>
                                <div className="flex flex-wrap gap-2">
                                    {(['normal', 'wide', 'big'] as const).map(size => (
                                        <button key={size} type="button" onClick={() => update(i, { size })}
                                            className={(l.size ?? 'normal') === size ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`links.size.${draft.template}.${size}`)}</button>
                                    ))}
                                </div>
                            </Field>
                        )}
                        <label className={`flex items-start gap-2 text-sm 3xl:text-base ${checks.forcedAdult ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-ds-accent" checked={checks.forcedAdult || l.adult === true} disabled={checks.forcedAdult}
                                onChange={e => update(i, { adult: e.target.checked })} />
                            <span className="text-ds-text">{t('adult.linkToggle')}
                                <span className="block text-xs 3xl:text-sm text-ds-soft">{checks.forcedAdult ? t('adult.linkForced') : t('adult.linkEffect')}</span>
                            </span>
                        </label>
                        {live.map(code => <p key={code} className="text-xs 3xl:text-sm text-ds-danger">{errorText(`${code}:${i}`)}</p>)}
                        {serverErrs.map(e => <p key={e} className="text-xs 3xl:text-sm text-ds-danger">{errorText(e)}</p>)}
                    </div>
                );
            })}
        </div>
    );
}

// ---------------- Apariencia ----------------

export function AppearanceTab({ s, onMessage, photoFallback }: { s: PersonalPageState; onMessage: (ok: boolean, text: string) => void; photoFallback: string }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const draft = s.draft!;
    const fonts = s.data!.fonts;
    usePageFonts(fonts);
    const [hex, setHex] = useState(draft.accent);
    useEffect(() => setHex(draft.accent), [draft.accent]);

    const fromPhoto = async () => {
        if (s.dirty) {
            const saved = await s.saveDraft();
            if (saved.error) { onMessage(false, errorText(saved.error.code)); return; }
        }
        try {
            const res = await api.post('/personal-page/accent-from-photo');
            s.edit({ accent: res.data.accent });
            onMessage(true, t('appearance.accentFromPhotoDone'));
        } catch (err) {
            onMessage(false, errorText(errorOf(err).code));
        }
    };

    return (
        <div className="space-y-6">
            <Card title={t('appearance.templateTitle')} description={t('appearance.templateHint')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {TEMPLATES.map(key => {
                        const active = draft.template === key;
                        return (
                            <button key={key} type="button" aria-pressed={active}
                                onClick={() => { if (!active) s.edit({ template: key, font: TEMPLATE_FONT[key] ?? draft.font }); }}
                                className={`text-left rounded-lg border p-2 transition-colors ${active ? 'border-ds-accent bg-ds-raised' : 'border-ds-border hover:border-ds-accent/60'}`}>
                                <div className="rounded-md overflow-hidden border border-ds-border pointer-events-none" aria-hidden="true">
                                    <ScaledCanvas width={390} height={520}>
                                        <div style={{ width: 390, height: 520, overflow: 'hidden' }}>
                                            <TemplateRenderer content={{ ...draft, template: key, font: active ? draft.font : (TEMPLATE_FONT[key] ?? draft.font) }} channelPhotoUrl={photoFallback} handle={s.page?.handle} embedded />
                                        </div>
                                    </ScaledCanvas>
                                </div>
                                <span className="block mt-2 px-1 font-bold text-ds-text">{t(`templates.${key}.name`)}{active && <span className="ml-2 text-xs font-semibold text-ds-accent-text">{t('appearance.inUse')}</span>}</span>
                                <span className="block px-1 pb-1 text-xs 3xl:text-sm text-ds-soft">{t(`templates.${key}.description`)}</span>
                            </button>
                        );
                    })}
                </div>
            </Card>
            <Card title={t('appearance.themeTitle')}>
                <div className="flex flex-wrap gap-2">
                    {(['dark', 'light'] as const).map(theme => (
                        <button key={theme} type="button" onClick={() => s.edit({ theme })} className={draft.theme === theme ? 'ds-btn ds-btn--primary' : 'ds-btn ds-btn--secondary'}>{t(`appearance.theme.${theme}`)}</button>
                    ))}
                </div>
            </Card>
            <Card title={t('appearance.accentTitle')} description={t('appearance.accentHint')}>
                <div className="flex flex-wrap items-center gap-3">
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.accent) ? draft.accent : '#5B8CFF'} onChange={e => s.edit({ accent: e.target.value.toUpperCase() })}
                        className="h-11 w-16 rounded-lg border border-ds-border bg-ds-surface cursor-pointer" aria-label={t('appearance.accentTitle')} />
                    <input className={`${inputClass} w-32 font-mono`} value={hex} maxLength={7}
                        onChange={e => { setHex(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) s.edit({ accent: e.target.value.toUpperCase() }); }} aria-label={t('appearance.accentHex')} />
                    <button type="button" className="ds-btn ds-btn--secondary" disabled={s.busy} onClick={fromPhoto}>{t('appearance.accentFromPhoto')}</button>
                </div>
            </Card>
            <Card title={t('appearance.fontTitle')} description={t('appearance.fontHint')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {fonts.map(key => (
                        <button key={key} type="button" onClick={() => s.edit({ font: key })}
                            className={`text-left rounded-lg border px-4 py-3 transition-colors ${draft.font === key ? 'border-ds-accent bg-ds-raised' : 'border-ds-border hover:border-ds-accent/60'}`}>
                            <span className="block text-xl 3xl:text-2xl text-ds-text" style={{ fontFamily: `'${FONTS[key]?.family}', sans-serif`, fontWeight: 800 }}>{FONTS[key]?.family ?? key}</span>
                            <span className="block text-xs 3xl:text-sm text-ds-soft mt-1">{t(`appearance.fonts.${key}`)}</span>
                        </button>
                    ))}
                </div>
            </Card>
        </div>
    );
}

// ---------------- Nombre ----------------

/** Campo de @nombre con comprobación en vivo (forma y disponibilidad). */
export function HandleInput({ value, onChange, onStatus, current }: { value: string; onChange: (v: string) => void; onStatus: (code: string | null | undefined) => void; current?: string }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const [code, setCode] = useState<string | null | undefined>(undefined);
    useEffect(() => {
        const handle = value.trim().replace(/^@/, '').toLowerCase();
        if (!handle || handle === current) { setCode(undefined); onStatus(undefined); return; }
        setCode(undefined); onStatus(undefined);
        const id = window.setTimeout(async () => {
            try {
                const res = await api.get('/personal-page/handle-check', { params: { handle } });
                setCode(res.data.code ?? null); onStatus(res.data.code ?? null);
            } catch { setCode('failed'); onStatus('failed'); }
        }, 400);
        return () => window.clearTimeout(id);
        // onStatus cambia en cada render del padre: solo importa el valor escrito
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, current]);
    return (
        <div>
            <div className="flex items-stretch rounded-lg border border-ds-border bg-ds-surface focus-within:ring-2 focus-within:ring-ds-accent/40 overflow-hidden">
                <span className="px-3 flex items-center text-ds-soft text-sm 3xl:text-base border-r border-ds-border bg-ds-raised whitespace-nowrap">decatron.net/@</span>
                <input className="flex-1 min-w-0 px-3 py-2 bg-transparent text-ds-text text-sm 3xl:text-base focus:outline-none" value={value} maxLength={26}
                    onChange={e => onChange(e.target.value.replace(/^@/, '').toLowerCase())} aria-label={t('name.handleLabel')} autoCapitalize="none" spellCheck={false} />
            </div>
            <p className={`text-xs 3xl:text-sm mt-1 ${code === null ? 'text-ds-ok' : code ? 'text-ds-danger' : 'text-ds-soft'}`}>
                {code === null ? t('name.available') : code ? errorText(code) : t('name.rules')}
            </p>
        </div>
    );
}

interface Appeal { id: number; handle: string; message: string; status: string; reviewNote: string; createdAt: string }

export function AppealForm({ initialHandle, onSent }: { initialHandle: string; onSent: () => void }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const [handle, setHandle] = useState(initialHandle);
    const [message, setMessage] = useState('');
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const [sending, setSending] = useState(false);
    useEffect(() => setHandle(initialHandle), [initialHandle]);
    const send = async () => {
        setSending(true);
        try {
            await api.post('/personal-page/appeals', { handle, message });
            setResult({ ok: true, text: t('appeal.sent') });
            setMessage('');
            onSent();
        } catch (err) {
            setResult({ ok: false, text: errorText(errorOf(err).code) });
        } finally { setSending(false); }
    };
    return (
        <div className="space-y-3">
            <Field label={t('appeal.handle')}>
                <input className={inputClass} value={handle} maxLength={25} onChange={e => setHandle(e.target.value.replace(/^@/, '').toLowerCase())} />
            </Field>
            <Field label={t('appeal.message')} hint={`${message.length}/1000 · ${t('appeal.messageHint')}`}>
                <textarea className={`${inputClass} min-h-[100px]`} value={message} maxLength={1000} onChange={e => setMessage(e.target.value)} />
            </Field>
            <button type="button" className="ds-btn ds-btn--primary" disabled={sending || message.trim().length < 10 || !handle} onClick={send}>{t('appeal.send')}</button>
            {result && <p className={`text-sm ${result.ok ? 'text-ds-ok' : 'text-ds-danger'}`}>{result.text}</p>}
        </div>
    );
}

export function NameTab({ s, onMessage }: { s: PersonalPageState; onMessage: (ok: boolean, text: string) => void }) {
    const { t, i18n } = useTranslation('personal-page');
    const errorText = useErrorText();
    const page = s.page!;
    const [value, setValue] = useState('');
    const [status, setStatus] = useState<string | null | undefined>(undefined);
    const [appeals, setAppeals] = useState<Appeal[]>([]);
    const [claimFor, setClaimFor] = useState('');

    const loadAppeals = async () => {
        try { setAppeals((await api.get('/personal-page/appeals')).data.appeals); } catch { /* la lista es accesoria */ }
    };
    useEffect(() => { loadAppeals(); }, []);

    const change = async () => {
        const res = await s.changeHandle(value);
        if (res.error) { onMessage(false, errorText(res.error.code)); return; }
        onMessage(true, t('name.changed'));
        setValue('');
    };
    const withdraw = async (id: number) => {
        try { await api.post(`/personal-page/appeals/${id}/withdraw`); loadAppeals(); } catch (err) { onMessage(false, errorText(errorOf(err).code)); }
    };
    const fmt = (d: string) => new Date(d).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <Card title={t('name.currentTitle')}>
                <p className="text-lg 3xl:text-xl font-bold text-ds-text break-all">decatron.net/@{page.handle}</p>
                {page.needsNewHandle && <p className="mt-2 text-sm 3xl:text-base text-ds-warn">{t('name.needsNew')}</p>}
            </Card>
            <Card title={t('name.changeTitle')} description={t('name.changeHint')}>
                {page.canChangeHandle ? (
                    <div className="space-y-3">
                        <HandleInput value={value} onChange={setValue} onStatus={setStatus} current={page.handle} />
                        <button type="button" className="ds-btn ds-btn--primary" disabled={s.busy || status !== null} onClick={change}>{t('name.change')}</button>
                        {(status === 'taken' || status === 'redirecting') && (
                            <button type="button" className="ds-btn ds-btn--secondary ml-2" onClick={() => setClaimFor(value)}>{t('appeal.claimThis')}</button>
                        )}
                    </div>
                ) : (
                    <p className="text-sm 3xl:text-base text-ds-soft">{t('name.cooldown', { date: page.nextHandleChange ? fmt(page.nextHandleChange) : '' })}</p>
                )}
            </Card>
            <Card title={t('appeal.title')} description={t('appeal.hint')}>
                <AppealForm initialHandle={claimFor} onSent={loadAppeals} />
            </Card>
            {appeals.length > 0 && (
                <Card title={t('appeal.mineTitle')}>
                    <ul className="divide-y divide-ds-border">
                        {appeals.map(a => (
                            <li key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                                <div className="min-w-0">
                                    <p className="font-bold text-ds-text">@{a.handle} <span className={`ml-2 text-xs font-bold ${a.status === 'transferred' ? 'text-ds-ok' : a.status === 'rejected' ? 'text-ds-danger' : a.status === 'pending' ? 'text-ds-warn' : 'text-ds-soft'}`}>{t(`appeal.status.${a.status}`)}</span></p>
                                    <p className="text-xs 3xl:text-sm text-ds-soft">{fmt(a.createdAt)}{a.reviewNote ? ` · ${a.reviewNote}` : ''}</p>
                                </div>
                                {a.status === 'pending' && <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => withdraw(a.id)}>{t('appeal.withdraw')}</button>}
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}
