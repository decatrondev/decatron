import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Send } from 'lucide-react';
import { ScaledCanvas, CHECKER_BG, inputClass } from '../../../../components/overlay-editor/ui';
import SoundAlertRenderer from './SoundAlertRenderer';
import { ALERT_KEYFRAMES, alertAnimation } from '../animations';
import type { AlertContent, AlertDesign, SoundFile } from '../types';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/defaults';

/** Lo que manda el backend en un canje real para ese archivo (misma regla de imagen). */
export function contentForFile(file: SoundFile | undefined, redeemer: string, sampleReward: string): AlertContent {
    if (!file) return { redeemer, reward: sampleReward, fileType: 'sound', showImage: true, imageUrl: null };
    const image = file.imageSource === 'url' && file.imageUrl ? file.imageUrl : file.imagePublicUrl || null;
    return {
        redeemer,
        reward: file.rewardTitle,
        fileType: file.fileType === 'gif' ? 'image' : file.fileType,
        fileUrl: file.fileUrl,
        imageUrl: file.showImage ? image : null,
        showImage: file.showImage,
    };
}

interface Props {
    design: AlertDesign;
    files: SoundFile[];
    selectedFileId: number | null;
    onSelectFile: (id: number | null) => void;
    content: AlertContent;
    dirty: boolean;
    testing: boolean;
    onTest: () => void;
}

/** Vista previa en vivo: la alerta con la configuración que se está editando, igual que en OBS. */
export default function SoundAlertPreview({ design, files, selectedFileId, onSelectFile, content, dirty, testing, onTest }: Props) {
    const { t } = useTranslation('overlays');
    // Cambiar la clave vuelve a montar la caja y repite la animación de entrada
    const [replay, setReplay] = useState(0);
    const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs 3xl:text-sm font-bold transition-colors disabled:opacity-50';

    return (
        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 3xl:p-5 shadow-lg xl:sticky xl:top-6 space-y-4">
            <style>{ALERT_KEYFRAMES}</style>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-base 3xl:text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">{t('soundAlerts.preview.title')}</h3>
                <button className={`${btn} bg-[#f1f5f9] dark:bg-[#262626] text-[#475569] dark:text-[#cbd5e1] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`} onClick={() => setReplay(r => r + 1)}>
                    <RotateCcw className="w-4 h-4" /> {t('soundAlerts.preview.replay')}
                </button>
            </div>

            <select className={inputClass} value={selectedFileId ?? ''} onChange={e => onSelectFile(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t('soundAlerts.preview.sample')}</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.rewardTitle}</option>)}
            </select>

            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#374151]" style={{ background: CHECKER_BG }}>
                <ScaledCanvas width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                    <div key={replay} style={{ position: 'absolute', inset: 0, animation: alertAnimation(design.animation.type, design.animation.speed, true) }}>
                        <SoundAlertRenderer design={design} content={content} scale={1} previewMedia />
                    </div>
                </ScaledCanvas>
            </div>

            <div className="space-y-2">
                <button className={`${btn} w-full justify-center bg-[#2563eb] hover:bg-[#1d4ed8] text-white`} onClick={onTest} disabled={testing}>
                    <Send className="w-4 h-4" /> {testing ? t('soundAlerts.preview.testing') : t('soundAlerts.preview.test')}
                </button>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">
                    {dirty ? t('soundAlerts.preview.testUnsaved') : t('soundAlerts.preview.testHint')}
                </p>
                <p className="text-xs 3xl:text-sm text-[#94a3b8]">{t('soundAlerts.preview.size')}</p>
            </div>
        </div>
    );
}
