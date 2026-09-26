import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import * as Shared from '../../../../../components/music-overlay/DesignTabs';
import type { OverlayLabels } from '../../../../../components/music-overlay/MusicOverlayRenderer';
import { ELEMENT_ORDER, LAYOUT_PRESETS, SAMPLE_SONGS } from '../../constants/defaults';
import type { ElementId, OverlayKind } from '../../types';
import type { SongRequestConfigState } from '../../hooks/useSongRequestConfig';

// Song Request usa las pestañas de diseño del motor compartido (components/music-overlay) con lo suyo:
// dos overlays (reproductor y "sonando ahora"), plantillas guardadas y la cola de ejemplo.

interface DesignProps {
    cfg: SongRequestConfigState;
    kind: OverlayKind;
    onKindChange: (k: OverlayKind) => void;
}

/** Song Request no muestra el álbum; el "sonando ahora" no tiene video. */
const elementIdsFor = (kind: OverlayKind): ElementId[] =>
    ELEMENT_ORDER.filter(id => id !== 'album' && (kind === 'player' || id !== 'video'));

function shared(props: DesignProps): Shared.DesignProps {
    const { cfg, kind } = props;
    return {
        layout: cfg.overlay[kind],
        onChange: next => cfg.updateLayout(kind, next),
        elementIds: elementIdsFor(kind),
        header: <KindSwitch {...props} />,
    };
}

/** Qué overlay se está editando + copiar el diseño al otro. */
export function KindSwitch({ cfg, kind, onKindChange }: DesignProps) {
    const { t } = useTranslation('overlays');
    const other: OverlayKind = kind === 'player' ? 'nowPlaying' : 'player';
    const seg = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs 3xl:text-sm font-bold transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'}`;
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm 3xl:text-base font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('songRequest.kinds.editing')}</span>
                <div className="flex gap-1 p-1 rounded-xl bg-[#f8fafc] dark:bg-[#111]">
                    <button className={seg(kind === 'player')} onClick={() => onKindChange('player')}>{t('songRequest.kinds.player')}</button>
                    <button className={seg(kind === 'nowPlaying')} onClick={() => onKindChange('nowPlaying')}>{t('songRequest.kinds.nowPlaying')}</button>
                </div>
            </div>
            <button
                onClick={() => {
                    if (!window.confirm(t('songRequest.kinds.copyConfirm', { to: t(`songRequest.kinds.${other}`) }))) return;
                    cfg.updateLayout(other, Shared.onlyOffered(structuredClone(cfg.overlay[kind]), elementIdsFor(other)));
                }}
                className="flex items-center gap-1.5 text-xs 3xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-white"
            >
                <Copy className="w-4 h-4" /> {t('songRequest.kinds.copyTo', { to: t(`songRequest.kinds.${other}`) })}
            </button>
        </div>
    );
}

export function ThemeTab(props: DesignProps) {
    const { cfg } = props;
    return <Shared.ThemeTab {...shared(props)} templates={{ list: cfg.overlay.templates, onChange: list => cfg.updateOverlay({ ...cfg.overlay, templates: list }) }} />;
}

export function ElementsTab(props: DesignProps & { labels?: OverlayLabels }) {
    return <Shared.ElementsTab {...shared(props)} labels={props.labels} />;
}

export function TypographyTab(props: DesignProps) {
    return <Shared.TypographyTab {...shared(props)} />;
}

export function AnimationsTab(props: DesignProps) {
    return <Shared.AnimationsTab {...shared(props)} />;
}

export function EditorTab(props: DesignProps & { labels: OverlayLabels }) {
    return (
        <Shared.EditorTab
            {...shared(props)}
            labels={props.labels}
            presets={LAYOUT_PRESETS.filter(p => props.kind === 'player' || !p.playerOnly)}
            sample={{
                current: SAMPLE_SONGS[0],
                queue: SAMPLE_SONGS.slice(1),
                progress: { itemId: SAMPLE_SONGS[0].id, position: 80, duration: SAMPLE_SONGS[0].durationSeconds ?? 200, playing: false },
            }}
        />
    );
}
