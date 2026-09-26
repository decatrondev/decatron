import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SharedCanvasEditor, { type Rect } from '../overlay-editor/OverlayCanvasEditor';
import MusicOverlayRenderer, { type OverlayLabels } from './MusicOverlayRenderer';
import type { ElementId, MusicTrack, OverlayLayout, PlaybackProgress } from './types';
import { toggleElement } from './utils';
import VideoCoverNotice from './VideoCoverNotice';

/** Lo que se dibuja en el lienzo mientras se edita. */
export interface CanvasSample {
    current: MusicTrack;
    queue: MusicTrack[];
    progress: PlaybackProgress;
}

interface Props {
    layout: OverlayLayout;
    onChange: (layout: OverlayLayout) => void;
    /** Los elementos que ofrece este overlay. */
    elementIds: ElementId[];
    labels: OverlayLabels;
    sample: CanvasSample;
}

/** Editor visual de un overlay de música sobre el editor compartido de overlays. */
export default function MusicCanvasEditor({ layout, onChange, elementIds, labels, sample }: Props) {
    const { t } = useTranslation('overlays');
    const [coverHidden, setCoverHidden] = useState(false);
    // El arrastre manda muchos cambios seguidos: siempre se parte del último layout
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    const onRectChange = useCallback((id: string, patch: Partial<Rect>) => {
        const l = layoutRef.current;
        const key = id as ElementId;
        onChange({ ...l, elements: { ...l.elements, [key]: { ...l.elements[key], ...patch } } });
    }, [onChange]);

    const onToggle = useCallback((id: string, enabled: boolean) => {
        const r = toggleElement(layoutRef.current, id as ElementId, enabled);
        onChange(r.layout);
        setCoverHidden(r.coverHidden);
    }, [onChange]);

    return (
        <SharedCanvasEditor
            canvas={layout.canvas}
            elements={elementIds.map(id => {
                const e = layout.elements[id];
                return { id, label: t(`musicOverlay.elements.${id}`), x: e.x, y: e.y, width: e.width, height: e.height, enabled: e.enabled, zIndex: id === 'panel' ? 1 : 10 };
            })}
            onRectChange={onRectChange}
            onToggle={onToggle}
            initialSelected="title"
            title={t('musicOverlay.editor.title')}
            description={t('musicOverlay.editor.description')}
            notice={<VideoCoverNotice layout={layout} coverHidden={coverHidden} onDismiss={() => setCoverHidden(false)} />}
            onCanvasChange={size => onChange({ ...layoutRef.current, canvas: size })}
        >
            <MusicOverlayRenderer
                layout={{ ...layout, animations: { ...layout.animations, songChange: 'none' } }}
                current={sample.current}
                queue={sample.queue}
                progress={sample.progress}
                paused={false}
                labels={labels}
                alwaysVisible
            />
        </SharedCanvasEditor>
    );
}
