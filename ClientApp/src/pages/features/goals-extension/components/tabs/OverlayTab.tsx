// OverlayTab - Full flexible overlay editor for goals
// Each goal can be positioned, sized, and rotated independently

import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Grid3x3, RotateCcw, ChevronDown, ChevronUp, Move, RotateCw } from 'lucide-react';
import type { GoalsDesignConfig, Goal, GoalPosition } from '../../types';

interface OverlayTabProps {
    design: GoalsDesignConfig;
    goals: Goal[];
    activeGoalIds: string[];
    canvasWidth: number;
    canvasHeight: number;
    onUpdateDesign: (updates: Partial<GoalsDesignConfig>) => void;
    onSetCanvasWidth: (width: number) => void;
    onSetCanvasHeight: (height: number) => void;
    // Goal positions stored in config
    goalPositions?: Record<string, GoalPosition>;
    onUpdateGoalPositions?: (positions: Record<string, GoalPosition>) => void;
}

type DragElement = string | null; // goal ID or null
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

export const OverlayTab: React.FC<OverlayTabProps> = ({
    design,
    goals,
    activeGoalIds,
    canvasWidth,
    canvasHeight,
    onUpdateDesign,
    onSetCanvasWidth,
    onSetCanvasHeight,
    goalPositions: propGoalPositions,
    onUpdateGoalPositions
}) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // Drag state
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Resize state
    const [resizeElement, setResizeElement] = useState<DragElement>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // Selected element for controls
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

    // Grid snap
    const [snapToGrid, setSnapToGrid] = useState(true);

    // Controls collapsed
    const [controlsCollapsed, setControlsCollapsed] = useState(false);

    // Local goal positions (if not passed from parent)
    const [localGoalPositions, setLocalGoalPositions] = useState<Record<string, GoalPosition>>({});

    const goalPositions = propGoalPositions || localGoalPositions;
    const setGoalPositions = onUpdateGoalPositions || setLocalGoalPositions;

    // Get active goals
    const activeGoals = activeGoalIds
        .map(id => goals.find(g => g.id === id))
        .filter((g): g is Goal => g !== undefined);

    // Initialize positions for new goals
    useEffect(() => {
        const newPositions = { ...goalPositions };
        let needsUpdate = false;

        activeGoals.forEach((goal, index) => {
            if (!newPositions[goal.id]) {
                // Default position - stack vertically
                newPositions[goal.id] = {
                    x: 50,
                    y: 50 + (index * 80),
                    width: 300,
                    height: 60,
                    rotation: 0
                };
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            setGoalPositions(newPositions);
        }
    }, [activeGoalIds]);

    // Calculate scale
    useEffect(() => {
        const updateScale = () => {
            if (canvasRef.current) {
                const containerWidth = canvasRef.current.clientWidth;
                const newScale = containerWidth / canvasWidth;
                setScale(newScale);
            }
        };
        updateScale();
        const resizeObserver = new ResizeObserver(updateScale);
        if (canvasRef.current) resizeObserver.observe(canvasRef.current);
        return () => resizeObserver.disconnect();
    }, [canvasWidth, canvasHeight]);

    // Snap value to grid
    const snapValue = (value: number): number => {
        if (!snapToGrid) return value;
        return Math.round(value / 10) * 10;
    };

    // Get position for a goal
    const getGoalPosition = (goalId: string): GoalPosition => {
        return goalPositions[goalId] || { x: 50, y: 50, width: 300, height: 60, rotation: 0 };
    };

    // Update position for a goal
    const updateGoalPosition = (goalId: string, updates: Partial<GoalPosition>) => {
        setGoalPositions({
            ...goalPositions,
            [goalId]: { ...getGoalPosition(goalId), ...updates }
        });
    };

    // Handle mouse down on goal
    const handleMouseDown = (goalId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDragElement(goalId);
        setSelectedGoal(goalId);

        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    // Handle resize mouse down
    const handleResizeMouseDown = (goalId: string, handle: ResizeHandle, e: React.MouseEvent) => {
        e.stopPropagation();
        const pos = getGoalPosition(goalId);

        setResizeElement(goalId);
        setResizeHandle(handle);
        setResizeStart({
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height
        });
    };

    // Handle mouse move
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();

        // Handle drag
        if (dragElement) {
            const pos = getGoalPosition(dragElement);
            let newX = ((e.clientX - canvasRect.left - dragOffset.x) / canvasRect.width) * canvasWidth;
            let newY = ((e.clientY - canvasRect.top - dragOffset.y) / canvasRect.height) * canvasHeight;

            newX = snapValue(newX);
            newY = snapValue(newY);

            // Bounds
            newX = Math.max(0, Math.min(newX, canvasWidth - pos.width));
            newY = Math.max(0, Math.min(newY, canvasHeight - pos.height));

            updateGoalPosition(dragElement, { x: Math.round(newX), y: Math.round(newY) });
        }

        // Handle resize
        if (resizeElement && resizeHandle) {
            const mouseX = ((e.clientX - canvasRect.left) / canvasRect.width) * canvasWidth;
            const mouseY = ((e.clientY - canvasRect.top) / canvasRect.height) * canvasHeight;

            let newX = resizeStart.x;
            let newY = resizeStart.y;
            let newWidth = resizeStart.width;
            let newHeight = resizeStart.height;

            if (resizeHandle.includes('w')) {
                newWidth = resizeStart.width + (resizeStart.x - mouseX);
                newX = mouseX;
            }
            if (resizeHandle.includes('e')) {
                newWidth = mouseX - resizeStart.x;
            }
            if (resizeHandle.includes('n')) {
                newHeight = resizeStart.height + (resizeStart.y - mouseY);
                newY = mouseY;
            }
            if (resizeHandle.includes('s')) {
                newHeight = mouseY - resizeStart.y;
            }

            // Min size
            newWidth = Math.max(100, snapValue(newWidth));
            newHeight = Math.max(40, snapValue(newHeight));

            updateGoalPosition(resizeElement, {
                x: Math.round(newX),
                y: Math.round(newY),
                width: Math.round(newWidth),
                height: Math.round(newHeight)
            });
        }
    };

    // Handle mouse up
    const handleMouseUp = () => {
        setDragElement(null);
        setResizeElement(null);
        setResizeHandle(null);
    };

    // Reset all positions
    const resetAllPositions = () => {
        const newPositions: Record<string, GoalPosition> = {};
        activeGoals.forEach((goal, index) => {
            newPositions[goal.id] = {
                x: 50,
                y: 50 + (index * 80),
                width: 300,
                height: 60,
                rotation: 0
            };
        });
        setGoalPositions(newPositions);
    };

    // Render a goal element on canvas
    const renderGoalElement = (goal: Goal) => {
        const pos = getGoalPosition(goal.id);
        const isSelected = selectedGoal === goal.id;
        const isDragging = dragElement === goal.id;
        const isResizing = resizeElement === goal.id;
        const percentage = Math.min(100, (goal.currentValue / goal.targetValue) * 100);

        return (
            <div
                key={goal.id}
                onMouseDown={(e) => handleMouseDown(goal.id, e)}
                className={`absolute cursor-move transition-shadow ${
                    isSelected || isDragging || isResizing
                        ? 'ring-2 ring-[#667eea] ring-offset-2 ring-offset-black z-20'
                        : 'hover:ring-2 hover:ring-[#667eea]/50 z-10'
                }`}
                style={{
                    left: `${(pos.x / canvasWidth) * 100}%`,
                    top: `${(pos.y / canvasHeight) * 100}%`,
                    width: `${(pos.width / canvasWidth) * 100}%`,
                    height: `${(pos.height / canvasHeight) * 100}%`,
                    transform: `rotate(${pos.rotation}deg)`,
                    transformOrigin: 'center center'
                }}
            >
                {/* Label */}
                <div className="absolute -top-5 left-0 text-xs font-bold px-2 py-0.5 rounded-t bg-[#667eea] text-white whitespace-nowrap z-30">
                    {goal.name} ({pos.x}, {pos.y})
                </div>

                {/* Goal Content */}
                <div
                    className="w-full h-full flex flex-col justify-center p-2 overflow-hidden"
                    style={{
                        backgroundColor: `${design.container.backgroundColor}${Math.round(design.container.backgroundOpacity * 2.55).toString(16).padStart(2, '0')}`,
                        borderRadius: design.container.borderRadius,
                        border: design.container.borderWidth > 0
                            ? `${design.container.borderWidth}px solid ${design.container.borderColor}`
                            : 'none'
                    }}
                >
                    {/* Goal Name */}
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-semibold text-sm truncate">
                            {goal.icon} {goal.name}
                        </span>
                        <span className="text-white/70 text-xs">
                            {Math.round(percentage)}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                        className="w-full rounded overflow-hidden"
                        style={{
                            height: Math.max(8, pos.height * 0.2),
                            backgroundColor: design.progressBar.backgroundColor
                        }}
                    >
                        <div
                            style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: design.progressBar.useGradient
                                    ? `linear-gradient(90deg, ${design.progressBar.gradientFrom}, ${design.progressBar.gradientTo})`
                                    : goal.color,
                                borderRadius: design.progressBar.borderRadius
                            }}
                        />
                    </div>

                    {/* Values */}
                    <div className="text-center text-white/60 text-xs mt-1">
                        {goal.currentValue} / {goal.targetValue}
                    </div>
                </div>

                {/* Resize Handles */}
                {isSelected && (
                    <>
                        {['nw', 'ne', 'sw', 'se'].map((handle) => (
                            <div
                                key={handle}
                                onMouseDown={(e) => handleResizeMouseDown(goal.id, handle as ResizeHandle, e)}
                                className="absolute w-3 h-3 bg-white border-2 border-[#667eea] rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-40"
                                style={{
                                    top: handle.includes('n') ? '-6px' : 'auto',
                                    bottom: handle.includes('s') ? '-6px' : 'auto',
                                    left: handle.includes('w') ? '-6px' : 'auto',
                                    right: handle.includes('e') ? '-6px' : 'auto'
                                }}
                            />
                        ))}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Canvas Editor */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Editor de Overlay
                            </h3>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Arrastra y redimensiona cada meta independientemente
                            </p>
                        </div>
                    </div>

                    {/* Canvas Size Controls */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-[#64748b]">Ancho:</label>
                        <input
                            type="number"
                            value={canvasWidth}
                            onChange={(e) => onSetCanvasWidth(Number(e.target.value) || 1000)}
                            className="w-20 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm text-center"
                            min="400"
                            max="3840"
                        />
                        <span className="text-[#64748b]">x</span>
                        <label className="text-xs font-bold text-[#64748b]">Alto:</label>
                        <input
                            type="number"
                            value={canvasHeight}
                            onChange={(e) => onSetCanvasHeight(Number(e.target.value) || 300)}
                            className="w-20 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm text-center"
                            min="200"
                            max="2160"
                        />
                    </div>

                    {/* Tools */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSnapToGrid(!snapToGrid)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                snapToGrid
                                    ? 'bg-[#667eea] text-white'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] border border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            <Grid3x3 className="w-4 h-4" />
                            Grid {snapToGrid ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={resetAllPositions}
                            className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs font-semibold transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                {/* Canvas */}
                <div className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-2xl">
                    {/* Canvas Header */}
                    <div className="bg-[#0f172a] border-b border-[#334155] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Monitor className="w-3 h-3" />
                                Editor Visual
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono bg-[#1e293b] px-2 py-0.5 rounded">
                            {canvasWidth}x{canvasHeight} • {(scale * 100).toFixed(1)}%
                        </span>
                    </div>

                    {/* Canvas Area */}
                    <div
                        ref={canvasRef}
                        className="w-full relative overflow-hidden"
                        style={{
                            height: canvasHeight * scale,
                            backgroundImage: snapToGrid
                                ? 'radial-gradient(circle, #374151 1px, transparent 1px)'
                                : 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
                            backgroundSize: snapToGrid ? '20px 20px' : '20px 20px',
                            backgroundPosition: snapToGrid ? '0 0' : '0 0, 0 10px, 10px -10px, -10px 0px'
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={() => setSelectedGoal(null)}
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
                            {activeGoals.length > 0 ? (
                                activeGoals.map(goal => renderGoalElement(goal))
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🎯</div>
                                        <p className="text-sm">No hay metas activas</p>
                                        <p className="text-xs mt-1">Activa metas en la pestaña "Metas"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Position Controls */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                <button
                    onClick={() => setControlsCollapsed(!controlsCollapsed)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                >
                    <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        Controles de Posición y Tamaño
                    </span>
                    {controlsCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>

                {!controlsCollapsed && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeGoals.map((goal) => {
                            const pos = getGoalPosition(goal.id);
                            const isSelected = selectedGoal === goal.id;

                            return (
                                <div
                                    key={goal.id}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        isSelected
                                            ? 'border-[#667eea] bg-[#667eea]/5'
                                            : 'border-[#e2e8f0] dark:border-[#374151]'
                                    }`}
                                    onClick={() => setSelectedGoal(goal.id)}
                                >
                                    <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-3 flex items-center gap-2">
                                        <span>{goal.icon}</span>
                                        {goal.name}
                                    </h4>

                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Position X */}
                                        <div>
                                            <label className="text-xs text-[#64748b] flex items-center gap-1">
                                                <Move className="w-3 h-3" /> X
                                            </label>
                                            <input
                                                type="number"
                                                value={pos.x}
                                                onChange={(e) => updateGoalPosition(goal.id, { x: Number(e.target.value) })}
                                                className="w-full px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm"
                                            />
                                        </div>

                                        {/* Position Y */}
                                        <div>
                                            <label className="text-xs text-[#64748b] flex items-center gap-1">
                                                <Move className="w-3 h-3" /> Y
                                            </label>
                                            <input
                                                type="number"
                                                value={pos.y}
                                                onChange={(e) => updateGoalPosition(goal.id, { y: Number(e.target.value) })}
                                                className="w-full px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm"
                                            />
                                        </div>

                                        {/* Width */}
                                        <div>
                                            <label className="text-xs text-[#64748b]">Ancho</label>
                                            <input
                                                type="number"
                                                value={pos.width}
                                                onChange={(e) => updateGoalPosition(goal.id, { width: Number(e.target.value) })}
                                                className="w-full px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm"
                                                min="100"
                                            />
                                        </div>

                                        {/* Height */}
                                        <div>
                                            <label className="text-xs text-[#64748b]">Alto</label>
                                            <input
                                                type="number"
                                                value={pos.height}
                                                onChange={(e) => updateGoalPosition(goal.id, { height: Number(e.target.value) })}
                                                className="w-full px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-sm"
                                                min="40"
                                            />
                                        </div>

                                        {/* Rotation */}
                                        <div className="col-span-2">
                                            <label className="text-xs text-[#64748b] flex items-center gap-1">
                                                <RotateCw className="w-3 h-3" /> Rotación: {pos.rotation}°
                                            </label>
                                            <input
                                                type="range"
                                                min="-180"
                                                max="180"
                                                value={pos.rotation}
                                                onChange={(e) => updateGoalPosition(goal.id, { rotation: Number(e.target.value) })}
                                                className="w-full h-2 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#667eea]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {activeGoals.length === 0 && (
                            <div className="col-span-full text-center py-8 text-[#64748b]">
                                No hay metas activas para configurar
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OverlayTab;
