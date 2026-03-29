/**
 * Timer Extension - Overlay Tab Component
 *
 * Editor visual drag-and-drop para posicionar elementos del overlay.
 */

import { Monitor } from 'lucide-react';
import OverlayEditor from '../../../../../components/timer/OverlayEditor';
import type { ProgressBarConfig, AlertsConfig, GoalConfig, DisplayConfig, StyleConfig } from '../../types';

interface OverlayTabProps {
    progressBarConfig: ProgressBarConfig;
    alertsConfig: AlertsConfig;
    goalConfig: GoalConfig;
    displayConfig?: DisplayConfig;
    styleConfig?: StyleConfig;
    canvasWidth?: number;
    canvasHeight?: number;
    onProgressBarConfigChange: (config: ProgressBarConfig) => void;
    onAlertsConfigChange: (config: AlertsConfig) => void;
    onGoalConfigChange: (config: GoalConfig) => void;
    onDisplayConfigChange?: (config: DisplayConfig) => void;
    onStyleConfigChange?: (config: StyleConfig) => void;
    onCanvasWidthChange?: (width: number) => void;
    onCanvasHeightChange?: (height: number) => void;
    onSave: () => void;
}

export const OverlayTab: React.FC<OverlayTabProps> = ({
    progressBarConfig,
    alertsConfig,
    goalConfig,
    displayConfig,
    styleConfig,
    canvasWidth,
    canvasHeight,
    onProgressBarConfigChange,
    onAlertsConfigChange,
    onGoalConfigChange,
    onDisplayConfigChange,
    onStyleConfigChange,
    onCanvasWidthChange,
    onCanvasHeightChange,
    onSave
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4">
                <div className="flex items-start gap-3">
                    <Monitor className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8] mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                            Editor Visual de Posiciones
                        </p>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            Arrastra y posiciona todos los elementos de tu overlay. Usa los corners para redimensionar. Los cambios se guardan automáticamente.
                        </p>
                    </div>
                </div>
            </div>

            <OverlayEditor
                progressBarConfig={progressBarConfig}
                setProgressBarConfig={onProgressBarConfigChange}
                alertsConfig={alertsConfig}
                setAlertsConfig={onAlertsConfigChange}
                goalConfig={goalConfig}
                setGoalConfig={onGoalConfigChange}
                displayConfig={displayConfig}
                setDisplayConfig={onDisplayConfigChange}
                styleConfig={styleConfig}
                setStyleConfig={onStyleConfigChange}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
                setCanvasWidth={onCanvasWidthChange}
                setCanvasHeight={onCanvasHeightChange}
                onSave={onSave}
            />
        </div>
    );
};

export default OverlayTab;
