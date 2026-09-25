import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SharedCanvasEditor, { type Rect } from '../../../../components/overlay-editor/OverlayCanvasEditor';
import SongOverlayRenderer, { type OverlayLabels } from './SongOverlayRenderer';
import { ELEMENT_ORDER, SAMPLE_SONGS } from '../constants/defaults';
import type { ElementId, OverlayKind, OverlayLayout } from '../types';
import { toggleElement } from '../utils';
import VideoCoverNotice from './VideoCoverNotice';

interface Props {
    kind: OverlayKind;
    layout: OverlayLayout;
    onChange: (layout: OverlayLayout) => void;
    labels: OverlayLabels;
}

/** Editor visual de Song Request sobre el editor compartido de overlays. */
export default function OverlayCanvasEditor({ kind, layout, onChange, labels }: Props) {
    const { t } = useTranslation('overlays');
    const [coverHidden, setCoverHidden] = useState(false);
    // El arrastre manda muchos cambios seguidos: siempre se parte del último layout
    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    const ids = ELEMENT_ORDER.filter(id => kind === 'player' || id !== 'video');

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
            elements={ids.map(id => {
                const e = layout.elements[id];
                return { id, label: t(`songRequest.elements.${id}`), x: e.x, y: e.y, width: e.width, height: e.height, enabled: e.enabled, zIndex: id === 'panel' ? 1 : 10 };
            })}
            onRectChange={onRectChange}
            onToggle={onToggle}
            initialSelected="title"
            title={t('songRequest.editor.title')}
            description={t('songRequest.editor.description')}
            notice={<VideoCoverNotice layout={layout} coverHidden={coverHidden} onDismiss={() => setCoverHidden(false)} />}
            onCanvasChange={size => onChange({ ...layoutRef.current, canvas: size })}
        >
            <SongOverlayRenderer
                layout={{ ...layout, animations: { ...layout.animations, songChange: 'none' } }}
                current={SAMPLE_SONGS[0]}
                queue={SAMPLE_SONGS.slice(1)}
                progress={{ itemId: SAMPLE_SONGS[0].id, position: 80, duration: SAMPLE_SONGS[0].durationSeconds ?? 200, playing: false }}
                paused={false}
                labels={labels}
                alwaysVisible
            />
        </SharedCanvasEditor>
    );
}
