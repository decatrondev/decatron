import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import SharedCanvasEditor, { type EditorElement, type Rect } from '../../../../components/overlay-editor/OverlayCanvasEditor';
import SoundAlertRenderer from './SoundAlertRenderer';
import { LineFields } from './ConfigTabs';
import type { SoundAlertsConfigState } from '../hooks/useSoundAlertsConfig';
import type { AlertContent, AlertDesign, PlacedLine } from '../types';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/defaults';
import { newLine } from '../model';

interface Props {
    cfg: SoundAlertsConfigState;
    /** Lo que se ve en el lienzo: la misma alerta elegida en la vista previa. */
    content: AlertContent;
}

const lineId = (i: number) => `line-${i}`;

export default function EditorTab({ cfg, content }: Props) {
    const { t } = useTranslation('overlays');
    const design = cfg.settings.design;
    // El arrastre manda muchos cambios seguidos: siempre se parte del último diseño
    const designRef = useRef(design);
    designRef.current = design;
    const hasPanel = design.styles.backgroundType !== 'transparent';

    const elements = useMemo<EditorElement[]>(() => [
        ...(hasPanel ? [{ id: 'panel', label: t('soundAlerts.editor.panel'), ...design.layout.panel, enabled: true, zIndex: 1, toggleable: false }] : []),
        { id: 'media', label: t('soundAlerts.editor.media'), ...design.layout.media, enabled: true, zIndex: 5, toggleable: false },
        ...design.textLines.map((l, i) => ({
            id: lineId(i),
            label: l.text.trim() ? `${i + 1}. ${l.text}` : t('soundAlerts.texts.line', { n: i + 1 }),
            x: l.x, y: l.y, width: l.width, height: l.height, enabled: l.enabled,
        })),
    ], [design, hasPanel, t]);

    const apply = useCallback((d: AlertDesign) => cfg.updateDesign(d), [cfg]);

    const onRectChange = useCallback((id: string, patch: Partial<Rect>) => {
        const d = designRef.current;
        if (id === 'panel') return apply({ ...d, layout: { ...d.layout, panel: { ...d.layout.panel, ...patch } } });
        if (id === 'media') return apply({ ...d, layout: { ...d.layout, media: { ...d.layout.media, ...patch } } });
        const i = Number(id.slice(5));
        apply({ ...d, textLines: d.textLines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
    }, [apply]);

    const onToggle = useCallback((id: string, enabled: boolean) => {
        if (!id.startsWith('line-')) return;
        const d = designRef.current;
        const i = Number(id.slice(5));
        apply({ ...d, textLines: d.textLines.map((l, j) => (j === i ? { ...l, enabled } : l)) });
    }, [apply]);

    const setLine = (i: number, patch: Partial<PlacedLine>) => {
        const d = designRef.current;
        apply({ ...d, textLines: d.textLines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
    };

    return (
        <SharedCanvasEditor
            canvas={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            elements={elements}
            onRectChange={onRectChange}
            onToggle={onToggle}
            initialSelected="media"
            title={t('soundAlerts.editor.title')}
            description={t('soundAlerts.editor.description')}
            layersActions={
                <button
                    onClick={() => apply({ ...designRef.current, textLines: [...designRef.current.textLines, newLine(designRef.current, t('soundAlerts.texts.newLine'))] })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shrink-0"
                >
                    <Plus className="w-4 h-4" /> {t('soundAlerts.texts.add')}
                </button>
            }
            selectedExtra={id => {
                if (id === 'media') return <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('soundAlerts.editor.mediaHint')}</p>;
                if (id === 'panel') return <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('soundAlerts.editor.panelHint')}</p>;
                const i = Number(id.slice(5));
                const line = design.textLines[i];
                return line ? <LineFields line={line} onChange={patch => setLine(i, patch)} /> : null;
            }}
        >
            {/* Siempre se ven todos los elementos: la caja de la imagen aunque la alerta no la use */}
            <SoundAlertRenderer design={design} content={{ ...content, showImage: content.fileType === 'sound' ? true : content.showImage }} scale={1} previewMedia />
        </SharedCanvasEditor>
    );
}
