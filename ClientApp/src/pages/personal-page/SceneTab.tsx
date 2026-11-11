import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, ImagePlus, Trash2, Type, Undo2 } from 'lucide-react';
import OverlayCanvasEditor, { type EditorElement, type Rect } from '../../components/overlay-editor/OverlayCanvasEditor';
import { Card, Field, inputClass } from '../../components/overlay-editor/ui';
import MediaSelector from '../../components/timer/MediaSelector';
import SceneCanvas from './SceneCanvas';
import { FONTS, LAYER_SIZE, SCENE_H, SCENE_W, defaultScene, newLinkId, type PersonalPageLayer, type PersonalPageScene } from './shared';
import type { PersonalPageState } from './usePersonalPage';
import { useErrorText } from './PersonalPageTabs';

// Pestaña «Escena» del panel (subfase 5.3): la cabecera de la plantilla Escena como lienzo por capas, con el editor de
// overlays de siempre. Los archivos salen de la Galería de medios del canal (la misma de Timer y Alertas, con su cuota).

type Picker = { for: 'background' } | { for: 'sticker'; layerId?: string } | null;

export default function SceneTab({ s, photoFallback, errors = [] }: { s: PersonalPageState; photoFallback: string; errors?: string[] }) {
    const { t } = useTranslation('personal-page');
    const errorText = useErrorText();
    const sceneErrors = errors.filter(e => e.startsWith('layer') || e.startsWith('scene'));
    const draft = s.draft!;
    const limits = s.data!.scene;
    const missing = s.data!.missingMedia ?? [];
    const scene: PersonalPageScene | null = draft.scene ?? null;
    const [picker, setPicker] = useState<Picker>(null);
    const [selected, setSelected] = useState<string | undefined>(undefined);
    const layers = useMemo(() => scene?.layers ?? [], [scene]);

    const setScene = useCallback((patch: Partial<PersonalPageScene>) => {
        const base = draft.scene ?? defaultScene();
        s.edit({ scene: { ...base, ...patch } });
    }, [draft.scene, s]);
    const setLayers = (next: PersonalPageLayer[]) => setScene({ layers: next });
    const patchLayer = (id: string, patch: Partial<PersonalPageLayer>) => setLayers(layers.map(l => l.id === id ? { ...l, ...patch } : l));

    const enable = () => {
        // La primera vez arranca con las capas del diseño clásico; si ya había capas, vuelven tal cual
        if (!draft.scene || (draft.scene.layers ?? []).length === 0) s.edit({ scene: defaultScene() });
        else setScene({ enabled: true });
    };

    const count = (kind: string) => layers.filter(l => l.kind === kind).length;
    const addText = () => {
        if (count('text') >= limits.textsMax) return;
        const id = newLinkId();
        setLayers([...layers, { id, kind: 'text', x: 140, y: 560, width: 800, height: 160, visible: true, text: t('scene.newText'), size: LAYER_SIZE.text, align: 'center' }]);
        setSelected(id);
    };
    const onPicked = (url: string) => {
        if (!picker) return;
        if (picker.for === 'background') setScene({ background: 'media', bgMedia: url });
        else if (picker.layerId) patchLayer(picker.layerId, { mediaUrl: url });
        else if (count('sticker') < limits.stickersMax) {
            const id = newLinkId();
            setLayers([...layers, { id, kind: 'sticker', x: 690, y: 90, width: 300, height: 300, visible: true, mediaUrl: url }]);
            setSelected(id);
        }
        setPicker(null);
    };

    const labelOf = (l: PersonalPageLayer) => {
        if (l.kind === 'text') return `${t('scene.kinds.text')}: ${(l.text ?? '').slice(0, 24)}`;
        if (l.kind === 'sticker') return `${t('scene.kinds.sticker')} ${layers.filter(x => x.kind === 'sticker').indexOf(l) + 1}${missing.includes(l.mediaUrl ?? '') ? ` (${t('scene.missingShort')})` : ''}`;
        return t(`scene.kinds.${l.kind}`);
    };
    const elements: EditorElement[] = layers.map((l, i) => ({ id: l.id, label: labelOf(l), x: l.x, y: l.y, width: l.width, height: l.height, enabled: l.visible !== false, zIndex: i + 1 }));

    const move = (id: string, d: number) => {
        const i = layers.findIndex(l => l.id === id); const j = i + d;
        if (i < 0 || j < 0 || j >= layers.length) return;
        const next = [...layers]; [next[i], next[j]] = [next[j], next[i]]; setLayers(next);
    };
    const duplicate = (id: string) => {
        const l = layers.find(x => x.id === id);
        if (!l || (l.kind === 'sticker' && count('sticker') >= limits.stickersMax) || (l.kind === 'text' && count('text') >= limits.textsMax)) return;
        const copy = { ...l, id: newLinkId(), x: Math.min(SCENE_W - 40, l.x + 40), y: Math.min(SCENE_H - 40, l.y + 40) };
        const i = layers.findIndex(x => x.id === id);
        setLayers([...layers.slice(0, i + 1), copy, ...layers.slice(i + 1)]);
        setSelected(copy.id);
    };
    const remove = (id: string) => setLayers(layers.filter(l => l.id !== id));

    if (!scene?.enabled) {
        return (
            <div className="space-y-6">
                <Card title={t('scene.title')} description={t('scene.intro')}>
                    <ul className="space-y-2 list-disc pl-5 text-sm 3xl:text-base text-ds-soft mb-4">
                        {['layers', 'gallery', 'classic'].map(k => <li key={k}>{t(`scene.points.${k}`)}</li>)}
                    </ul>
                    <button type="button" className="ds-btn ds-btn--primary" onClick={enable}>{t(scene && layers.length ? 'scene.enableAgain' : 'scene.enable')}</button>
                </Card>
            </div>
        );
    }

    const extra = (id: string) => {
        const l = layers.find(x => x.id === id);
        if (!l) return null;
        const i = layers.indexOf(l);
        const isText = l.kind === 'name' || l.kind === 'bio' || l.kind === 'text';
        return (
            <div className="space-y-3">
                {l.kind === 'text' && (
                    <Field label={t('scene.text')} hint={`${(l.text ?? '').length}/${limits.textMax}`}>
                        <input className={inputClass} value={l.text ?? ''} maxLength={limits.textMax} onChange={e => patchLayer(id, { text: e.target.value })} />
                    </Field>
                )}
                {(l.kind === 'name' || l.kind === 'bio') && <p className="text-xs 3xl:text-sm text-ds-soft">{t(`scene.fromProfile.${l.kind}`)}</p>}
                {l.kind === 'photo' && <p className="text-xs 3xl:text-sm text-ds-soft">{t('scene.fromProfile.photo')}</p>}
                {l.kind === 'sticker' && (
                    <div className="space-y-2">
                        {missing.includes(l.mediaUrl ?? '') && <p className="text-xs 3xl:text-sm text-ds-danger">{t('scene.missingLayer')}</p>}
                        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setPicker({ for: 'sticker', layerId: id })}><ImagePlus className="w-4 h-4" />{t('scene.changeImage')}</button>
                    </div>
                )}
                {isText && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('scene.font')}>
                            <select className={inputClass} value={l.font ?? ''} onChange={e => patchLayer(id, { font: e.target.value })}>
                                <option value="">{t('scene.pageFont')}</option>
                                {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.family}</option>)}
                            </select>
                        </Field>
                        <Field label={t('scene.size')}>
                            <input type="number" className={inputClass} min={8} max={400} value={l.size || LAYER_SIZE[l.kind] || 72}
                                onChange={e => patchLayer(id, { size: Math.max(8, Math.min(400, Number(e.target.value) || 8)) })} />
                        </Field>
                        <Field label={t('scene.color')}>
                            <div className="flex items-center gap-2">
                                <input type="color" className="h-10 w-14 rounded-lg border border-ds-border bg-ds-surface cursor-pointer" value={/^#[0-9a-f]{6}$/i.test(l.color ?? '') ? l.color : (draft.theme === 'light' ? '#15181D' : '#E9EBEF')}
                                    onChange={e => patchLayer(id, { color: e.target.value.toUpperCase() })} aria-label={t('scene.color')} />
                                {l.color && <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm" onClick={() => patchLayer(id, { color: '' })}>{t('scene.colorAuto')}</button>}
                            </div>
                        </Field>
                        <Field label={t('scene.align')}>
                            <div className="flex gap-1">
                                {(['left', 'center', 'right'] as const).map(a => (
                                    <button key={a} type="button" onClick={() => patchLayer(id, { align: a })}
                                        className={(l.align ?? 'left') === a ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`scene.aligns.${a}`)}</button>
                                ))}
                            </div>
                        </Field>
                    </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={i === layers.length - 1} onClick={() => move(id, 1)}><ArrowUp className="w-4 h-4" />{t('scene.forward')}</button>
                    <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={i === 0} onClick={() => move(id, -1)}><ArrowDown className="w-4 h-4" />{t('scene.backward')}</button>
                    {(l.kind === 'sticker' || l.kind === 'text') && <>
                        <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => duplicate(id)}><Copy className="w-4 h-4" />{t('scene.duplicate')}</button>
                        <button type="button" className="ds-btn ds-btn--ghost ds-btn--sm text-ds-danger" onClick={() => remove(id)}><Trash2 className="w-4 h-4" />{t('scene.remove')}</button>
                    </>}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <Card title={t('scene.title')} description={t('scene.onHint')}
                actions={<button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setScene({ enabled: false })}><Undo2 className="w-4 h-4" />{t('scene.backToClassic')}</button>}>
                {missing.length > 0 && <p className="text-sm 3xl:text-base text-ds-danger">{t('scene.missing', { count: missing.length })}</p>}
                {sceneErrors.map(e => <p key={e} className="text-sm 3xl:text-base text-ds-danger">{errorText(e)}</p>)}
                <div className="space-y-3">
                    <p className="text-sm 3xl:text-base font-bold text-ds-text">{t('scene.background')}</p>
                    <div className="flex flex-wrap gap-2">
                        {(['pattern', 'color', 'media'] as const).map(kind => (
                            <button key={kind} type="button" onClick={() => kind === 'media' && !scene.bgMedia ? setPicker({ for: 'background' }) : setScene({ background: kind })}
                                className={scene.background === kind ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t(`scene.backgrounds.${kind}`)}</button>
                        ))}
                    </div>
                    {scene.background === 'color' && (
                        <input type="color" className="h-10 w-16 rounded-lg border border-ds-border bg-ds-surface cursor-pointer" value={/^#[0-9a-f]{6}$/i.test(scene.bgColor ?? '') ? scene.bgColor : '#0F1218'}
                            onChange={e => setScene({ bgColor: e.target.value.toUpperCase() })} aria-label={t('scene.backgrounds.color')} />
                    )}
                    {scene.background === 'media' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs 3xl:text-sm text-ds-soft break-all">{scene.bgMedia}</span>
                            <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => setPicker({ for: 'background' })}><ImagePlus className="w-4 h-4" />{t('scene.changeBackground')}</button>
                            {missing.includes(scene.bgMedia ?? '') && <span className="text-xs 3xl:text-sm text-ds-danger">{t('scene.missingShort')}</span>}
                        </div>
                    )}
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('scene.backgroundHint')}</p>
                </div>
            </Card>

            {/* Los tiradores de redimensionar sobresalen del lienzo: en móvil empujaban la página */}
            <div className="overflow-x-clip">
                <OverlayCanvasEditor
                    canvas={{ width: SCENE_W, height: SCENE_H }}
                    elements={elements}
                    selectedId={selected}
                    onRectChange={(id, rect: Partial<Rect>) => patchLayer(id, rect)}
                    onToggle={(id, enabled) => patchLayer(id, { visible: enabled })}
                    title={t('scene.canvasTitle')}
                    description={t('scene.canvasHint')}
                    layersActions={
                        <div className="flex flex-wrap gap-1">
                            <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={count('sticker') >= limits.stickersMax} onClick={() => setPicker({ for: 'sticker' })}>
                                <ImagePlus className="w-3 h-3" />{t('scene.addSticker')}</button>
                            <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" disabled={count('text') >= limits.textsMax} onClick={addText}>
                                <Type className="w-3 h-3" />{t('scene.addText')}</button>
                        </div>
                    }
                    selectedExtra={extra}
                >
                    <SceneCanvas content={draft} photo={draft.avatarUrl || photoFallback} initials={(draft.displayName || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '·'} />
                </OverlayCanvasEditor>
            </div>
            <p className="text-xs 3xl:text-sm text-ds-soft">{t('scene.limits', { stickers: count('sticker'), stickersMax: limits.stickersMax, texts: count('text'), textsMax: limits.textsMax })}</p>

            <MediaSelector isOpen={picker !== null} onClose={() => setPicker(null)} galleryOnly
                allowedTypes={picker?.for === 'background' ? ['image', 'gif', 'video'] : ['image', 'gif']}
                onSelect={url => onPicked(url)} />
        </div>
    );
}
