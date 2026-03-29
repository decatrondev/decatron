// GoalsPreview - Live preview component for goals overlay

import React, { useRef, useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import type { Goal, GoalsDesignConfig } from '../../types';

interface GoalsPreviewProps {
    goals: Goal[];
    activeGoalIds: string[];
    design: GoalsDesignConfig;
    overlayUrl: string;
    onCopyOverlayUrl: () => void;
    canvasWidth?: number;
    canvasHeight?: number;
}

export const GoalsPreview: React.FC<GoalsPreviewProps> = ({
    goals,
    activeGoalIds,
    design,
    overlayUrl,
    onCopyOverlayUrl,
    canvasWidth = 1000,
    canvasHeight = 300
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // Responsive scaling like TimerPreview
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const newScale = containerWidth / canvasWidth;
                setScale(newScale);
            }
        };
        updateScale();
        const resizeObserver = new ResizeObserver(updateScale);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [canvasWidth, canvasHeight]);
    // Get active goals in order
    const activeGoals = activeGoalIds
        .map(id => goals.find(g => g.id === id))
        .filter((g): g is Goal => g !== undefined)
        .slice(0, design.maxVisibleGoals);

    // Calculate container background with opacity
    const containerBgColor = design.container.backgroundColor;
    const containerOpacity = design.container.backgroundOpacity / 100;
    const containerBg = containerBgColor.startsWith('#')
        ? `${containerBgColor}${Math.round(containerOpacity * 255).toString(16).padStart(2, '0')}`
        : containerBgColor;

    const renderProgressBar = (goal: Goal) => {
        const percentage = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
        const { progressBar } = design;

        const fillStyle: React.CSSProperties = {
            width: `${percentage}%`,
            height: '100%',
            borderRadius: progressBar.borderRadius,
            transition: progressBar.animated ? 'width 0.5s ease-out' : 'none',
            background: progressBar.useGradient
                ? `linear-gradient(90deg, ${progressBar.gradientFrom || goal.color}, ${progressBar.gradientTo || goal.color})`
                : goal.color
        };

        return (
            <div
                style={{
                    width: progressBar.width,
                    height: progressBar.height,
                    backgroundColor: progressBar.backgroundColor,
                    borderRadius: progressBar.borderRadius,
                    overflow: 'hidden'
                }}
            >
                <div style={fillStyle} />
            </div>
        );
    };

    const renderGoal = (goal: Goal) => {
        const percentage = Math.round((goal.currentValue / goal.targetValue) * 100);

        return (
            <div
                key={goal.id}
                style={{
                    fontFamily: design.text.fontFamily
                }}
                className="space-y-2"
            >
                {/* Goal Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span style={{ fontSize: design.text.goalNameSize * 0.8 }}>
                            {goal.icon}
                        </span>
                        <span
                            style={{
                                fontSize: design.text.goalNameSize,
                                color: design.text.goalNameColor,
                                fontWeight: 600
                            }}
                        >
                            {goal.name}
                        </span>
                    </div>
                    {design.progressBar.showPercentage && (
                        <span
                            style={{
                                fontSize: design.text.valuesSize,
                                color: design.text.valuesColor
                            }}
                        >
                            {percentage}%
                        </span>
                    )}
                </div>

                {/* Progress Bar */}
                {renderProgressBar(goal)}

                {/* Values */}
                {design.progressBar.showValues && (
                    <div
                        style={{
                            fontSize: design.text.valuesSize,
                            color: design.text.valuesColor,
                            textAlign: 'center'
                        }}
                    >
                        {goal.currentValue} / {goal.targetValue}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-2xl sticky top-4">
            {/* Header - Same style as TimerPreview */}
            <div className="bg-[#0f172a] border-b border-[#334155] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <Monitor className="w-3 h-3" />
                        OBS Preview
                    </span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono bg-[#1e293b] px-2 py-0.5 rounded">
                    {canvasWidth}x{canvasHeight} • {(scale * 100).toFixed(1)}%
                </span>
            </div>

            {/* Preview Area - Scaled Canvas */}
            <div
                ref={containerRef}
                className="relative w-full overflow-hidden"
                style={{
                    height: canvasHeight * scale,
                    backgroundImage: 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                }}
            >
                {/* Scaled Content */}
                <div
                    style={{
                        width: canvasWidth,
                        height: canvasHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0
                    }}
                >
                    {/* Goals Container */}
                    {activeGoals.length > 0 ? (
                        <div
                            style={{
                                position: 'absolute',
                                left: 20,
                                top: 20,
                                backgroundColor: containerBg,
                                borderRadius: design.container.borderRadius,
                                border: design.container.borderWidth > 0
                                    ? `${design.container.borderWidth}px solid ${design.container.borderColor}`
                                    : 'none',
                                padding: design.container.padding,
                                boxShadow: design.container.shadow
                                    ? '0 10px 25px rgba(0,0,0,0.3)'
                                    : 'none',
                                display: 'flex',
                                flexDirection: design.layout === 'horizontal' ? 'row' : 'column',
                                gap: design.spacing,
                                flexWrap: design.layout === 'grid' ? 'wrap' : 'nowrap'
                            }}
                        >
                            {activeGoals.map(goal => renderGoal(goal))}
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-center text-white/50">
                            <div>
                                <div className="text-4xl mb-2">🎯</div>
                                <p className="text-sm">No hay metas activas</p>
                                <p className="text-xs mt-1">Crea y activa metas para verlas aquí</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay URL */}
            {overlayUrl && (
                <div className="bg-[#1e293b] border-t border-[#334155] px-4 py-3">
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                        URL para OBS
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={overlayUrl}
                            readOnly
                            className="flex-1 px-3 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-xs text-gray-400 font-mono"
                        />
                        <button
                            onClick={onCopyOverlayUrl}
                            className="px-3 py-2 bg-[#667eea] hover:bg-[#5a6fd6] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                            Copiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalsPreview;
