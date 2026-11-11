import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Music, Play, Plus, Trash2, X } from 'lucide-react';
import { Card, Field, inputClass } from '../../components/overlay-editor/ui';
import MediaSelector from '../../components/timer/MediaSelector';
import { useErrorText } from './PersonalPageTabs';
import { VIDEO_PLATFORM, newLinkId, parseVideo, type PersonalPagePhoto, type PersonalPageSound, type PersonalPageVideo } from './shared';
import type { PersonalPageState } from './usePersonalPage';

// Pestaña «Multimedia» del panel (subfase 5.4): videos insertados, fotos y sonidos. Las fotos y los sonidos salen de la
// Galería de medios del canal (misma cuota por plan); los videos son enlaces de YouTube, Twitch, Kick o TikTok.

type Picker = 'photo' | 'entry' | 'click' | null;
const DEFAULT_SOUND: PersonalPageSound = { entryUrl: '', clickUrl: '', clickEnabled: false, volume: 70 };

function swap<T>(list: T[], i: number, d: number): T[] {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; return next;
}
const fileName = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);

export default function MediaTab({ s, errors = [] }: { s: PersonalPageState; errors?: string[] }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const draft = s.draft!;
    const limits = s.data!.media;
    const missing = s.data!.missingMedia ?? [];
    const videos = draft.videos ?? [];
    const photos = draft.photos ?? [];
    const sound = draft.sound ?? DEFAULT_SOUND;
    const [newUrl, setNewUrl] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [picker, setPicker] = useState<Picker>(null);
    const parsed = newUrl ? parseVideo(newUrl.trim()) : null;

    const setVideos = (next: PersonalPageVideo[]) => s.edit({ videos: next });
    const setPhotos = (next: PersonalPagePhoto[]) => s.edit({ photos: next });
    const setSound = (patch: Partial<PersonalPageSound>) => s.edit({ sound: { ...sound, ...patch } });
    const errorsOf = (prefix: string, i: number) => errors.filter(e => e.startsWith(prefix) && e.endsWith(`:${i}`));
    const general = errors.filter(e => ['videos_count', 'photos_count', 'sound_entry', 'sound_click', 'sound_volume'].includes(e));

    const addVideo = () => {
        if (!parsed || videos.length >= limits.videosMax) return;
        setVideos([...videos, { id: newLinkId(), url: newUrl.trim(), title: newTitle.trim(), visible: true }]);
        setNewUrl(''); setNewTitle('');
    };
    const onPicked = (url: string) => {
        if (picker === 'photo' && photos.length < limits.photosMax) setPhotos([...photos, { id: newLinkId(), mediaUrl: url, caption: '' }]);
        if (picker === 'entry') setSound({ entryUrl: url });
        if (picker === 'click') setSound({ clickUrl: url, clickEnabled: true });
        setPicker(null);
    };
    const preview = (url: string) => {
        const a = new Audio(url);
        a.volume = sound.volume / 100;
        a.play().catch(() => undefined);
    };

    return (
        <div className="space-y-6">
            {general.map(e => <p key={e} className="text-sm 3xl:text-base text-ds-danger">{errorText(e)}</p>)}
            {missing.length > 0 && <p className="text-sm 3xl:text-base text-ds-danger">{t('media.missing', { count: missing.length })}</p>}

            <Card title={t('media.videosTitle')} description={t('media.videosHint')}>
                <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input className={inputClass} value={newUrl} inputMode="url" placeholder="https://youtu.be/…" maxLength={500} onChange={e => setNewUrl(e.target.value)} aria-label={t('media.videoUrl')} />
                        <input className={inputClass} value={newTitle} placeholder={t('media.videoTitleOptional')} maxLength={60} onChange={e => setNewTitle(e.target.value)} aria-label={t('media.videoTitleOptional')} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" className="ds-btn ds-btn--primary" disabled={!parsed || videos.length >= limits.videosMax} onClick={addVideo}><Plus className="w-4 h-4" />{t('media.addVideo')}</button>
                        <span className={`text-xs 3xl:text-sm ${newUrl && !parsed ? 'text-ds-danger' : 'text-ds-soft'}`}>
                            {newUrl ? (parsed ? t('media.recognized', { platform: VIDEO_PLATFORM[parsed.kind] }) : t('media.notRecognized')) : t('media.platforms')}
                        </span>
                    </div>
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('media.videosCount', { count: videos.length, max: limits.videosMax })}</p>
                </div>
                {videos.length > 0 && (
                    <ul className="mt-4 divide-y divide-ds-border">
                        {videos.map((v, i) => {
                            const ref = parseVideo(v.url);
                            const errs = errorsOf('video', i);
                            return (
                                <li key={v.id} className="py-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm 3xl:text-base font-bold text-ds-text min-w-0 truncate">
                                            {ref ? VIDEO_PLATFORM[ref.kind] : t('media.notRecognized')}
                                            {!v.visible && <span className="ml-2 text-xs font-semibold text-ds-soft">{t('links.hiddenTag')}</span>}
                                        </p>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.up')} disabled={i === 0} onClick={() => setVideos(swap(videos, i, -1))}><ArrowUp className="w-4 h-4" /></button>
                                            <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.down')} disabled={i === videos.length - 1} onClick={() => setVideos(swap(videos, i, 1))}><ArrowDown className="w-4 h-4" /></button>
                                            <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={v.visible ? t('links.hide') : t('links.show')} onClick={() => setVideos(videos.map((x, j) => j === i ? { ...x, visible: !x.visible } : x))}>{v.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
                                            <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn text-ds-danger" aria-label={t('links.remove')} onClick={() => setVideos(videos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <p className="text-xs 3xl:text-sm text-ds-soft break-all">{v.url}</p>
                                    <input className={inputClass} value={v.title} maxLength={60} placeholder={t('media.videoTitleOptional')} onChange={e => setVideos(videos.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} aria-label={t('media.videoTitleOptional')} />
                                    {errs.map(e => <p key={e} className="text-xs 3xl:text-sm text-ds-danger">{errorText(e)}</p>)}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            <Card title={t('media.photosTitle')} description={t('media.photosHint')}
                actions={<button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={photos.length >= limits.photosMax} onClick={() => setPicker('photo')}><ImagePlus className="w-4 h-4" />{t('media.addPhoto')}</button>}>
                <p className="text-xs 3xl:text-sm text-ds-soft mb-3">{t('media.photosCount', { count: photos.length, max: limits.photosMax })}</p>
                {photos.length > 0 && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                        {photos.map((p, i) => (
                            <li key={p.id} className={`rounded-lg border p-2 space-y-2 ${missing.includes(p.mediaUrl) || errorsOf('photo', i).length ? 'border-ds-danger/60' : 'border-ds-border'}`}>
                                <div className="aspect-square rounded-md overflow-hidden bg-ds-raised flex items-center justify-center">
                                    {missing.includes(p.mediaUrl) ? <span className="text-xs text-ds-danger p-2 text-center">{t('media.missingShort')}</span>
                                        : <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <input className={inputClass} value={p.caption} maxLength={limits.captionMax} placeholder={t('media.captionOptional')}
                                    onChange={e => setPhotos(photos.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} aria-label={t('media.captionOptional')} />
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.up')} disabled={i === 0} onClick={() => setPhotos(swap(photos, i, -1))}><ArrowUp className="w-4 h-4" /></button>
                                        <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn" aria-label={t('links.down')} disabled={i === photos.length - 1} onClick={() => setPhotos(swap(photos, i, 1))}><ArrowDown className="w-4 h-4" /></button>
                                    </div>
                                    <button type="button" className="ds-btn ds-btn--ghost ds-icon-btn text-ds-danger" aria-label={t('links.remove')} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
                                </div>
                                {errorsOf('photo', i).map(e => <p key={e} className="text-xs 3xl:text-sm text-ds-danger">{errorText(e)}</p>)}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title={t('media.soundsTitle')} description={t('media.soundsHint')}>
                <div className="space-y-4">
                    {(['entry', 'click'] as const).map(kind => {
                        const url = kind === 'entry' ? sound.entryUrl : sound.clickUrl;
                        const on = kind === 'entry' ? !!url : sound.clickEnabled;
                        return (
                            <div key={kind} className="space-y-2">
                                <p className="text-sm 3xl:text-base font-bold text-ds-text">{t(`media.${kind}Sound`)}</p>
                                <p className="text-xs 3xl:text-sm text-ds-soft">{t(`media.${kind}SoundHint`)}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    {url ? <span className={`text-sm 3xl:text-base break-all ${missing.includes(url) ? 'text-ds-danger' : 'text-ds-text'}`}><Music className="inline w-4 h-4 mr-1" />{fileName(url)}{missing.includes(url) ? ` (${t('media.missingShort')})` : ''}</span>
                                        : <span className="text-sm 3xl:text-base text-ds-soft">{t('media.noSound')}</span>}
                                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setPicker(kind)}>{url ? t('media.changeSound') : t('media.chooseSound')}</button>
                                    {url && <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => preview(url)}><Play className="w-4 h-4" />{t('media.listen')}</button>}
                                    {kind === 'entry' && url && <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => setSound({ entryUrl: '' })}><X className="w-4 h-4" />{t('media.removeSound')}</button>}
                                    {kind === 'click' && url && (
                                        <label className="flex items-center gap-2 text-sm 3xl:text-base text-ds-text cursor-pointer">
                                            <input type="checkbox" className="w-4 h-4 accent-ds-accent" checked={on} onChange={e => setSound({ clickEnabled: e.target.checked })} />{t('media.clickOn')}
                                        </label>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <Field label={t('media.volume', { value: sound.volume })}>
                        <input type="range" min={0} max={100} step={5} value={sound.volume} onChange={e => setSound({ volume: Number(e.target.value) })} className="w-full max-w-sm accent-ds-accent" />
                    </Field>
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('media.gateNote')}</p>
                </div>
            </Card>

            <MediaSelector isOpen={picker !== null} onClose={() => setPicker(null)} galleryOnly
                allowedTypes={picker === 'photo' ? ['image', 'gif'] : ['sound']} onSelect={url => onPicked(url)} />
        </div>
    );
}
