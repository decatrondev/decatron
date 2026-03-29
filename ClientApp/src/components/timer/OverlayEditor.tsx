import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Grid3x3, RotateCcw } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type DragElement = 'title' | 'counter' | 'percentage' | 'progressbar' | 'alerts' | 'elapsed' | null;
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

interface OverlayEditorProps {
    // Timer config
    progressBarConfig: any;
    setProgressBarConfig: (config: any) => void;

    // Display config (for title, counter, percentage positions)
    displayConfig?: any;
    setDisplayConfig?: (config: any) => void;

    // Style config (contains positions for title, counter, percentage)
    styleConfig?: any;
    setStyleConfig?: (config: any) => void;

    // Alerts config
    alertsConfig: any;
    setAlertsConfig: (config: any) => void;

    // Goal config
    goalConfig: any;
    setGoalConfig: (config: any) => void;

    // Canvas dimensions
    canvasWidth?: number;
    canvasHeight?: number;
    setCanvasWidth?: (width: number) => void;
    setCanvasHeight?: (height: number) => void;

    // Save handler
    onSave?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function OverlayEditor({
    progressBarConfig,
    setProgressBarConfig,
    displayConfig,
    setDisplayConfig,
    styleConfig,
    setStyleConfig,
    alertsConfig,
    setAlertsConfig,
    goalConfig,
    setGoalConfig,
    canvasWidth: propCanvasWidth,
    canvasHeight: propCanvasHeight,
    setCanvasWidth: propSetCanvasWidth,
    setCanvasHeight: propSetCanvasHeight,
    onSave
}: OverlayEditorProps) {
    const canvasRef = useRef<HTMLDivElement>(null);

    // Canvas dimensions (from props or default)
    const canvasWidth = propCanvasWidth ?? 1000;
    const canvasHeight = propCanvasHeight ?? 300;

    // Drag state
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Resize state
    const [resizeElement, setResizeElement] = useState<DragElement>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // Grid snap
    const [snapToGrid, setSnapToGrid] = useState(true);

    // Controls collapsed state
    const [controlsCollapsed, setControlsCollapsed] = useState(false);

    // Get position and size for each element
    const getElementConfig = (element: DragElement) => {
        switch (element) {
            case 'title':
                return {
                    position: styleConfig?.titlePosition || { x: 50, y: 20 },
                    size: { width: 300, height: 40 },
                    enabled: displayConfig?.showTitle || false
                };
            case 'counter':
                return {
                    position: styleConfig?.timePosition || { x: 50, y: 80 },
                    size: { width: 400, height: 60 },
                    enabled: true
                };
            case 'percentage':
                return {
                    position: styleConfig?.percentagePosition || { x: 50, y: 160 },
                    size: { width: 150, height: 40 },
                    enabled: displayConfig?.showPercentage || false
                };
            case 'progressbar':
                return {
                    position: progressBarConfig.position,
                    size: progressBarConfig.size,
                    enabled: true
                };
            case 'alerts':
                return {
                    position: alertsConfig.global.position,
                    size: alertsConfig.global.size,
                    enabled: true
                };
            case 'elapsed':
                return {
                    position: styleConfig?.elapsedTimePosition || { x: 50, y: 120 },
                    size: { width: 250, height: 35 },
                    enabled: displayConfig?.showElapsedTime || false
                };
            default:
                return { position: { x: 0, y: 0 }, size: { width: 0, height: 0 }, enabled: false };
        }
    };

    // Update position for element
    const updatePosition = (element: DragElement, x: number, y: number) => {
        switch (element) {
            case 'title':
                if (setStyleConfig) {
                    setStyleConfig({ ...styleConfig, titlePosition: { x, y } });
                }
                break;
            case 'counter':
                if (setStyleConfig) {
                    setStyleConfig({ ...styleConfig, timePosition: { x, y } });
                }
                break;
            case 'percentage':
                if (setStyleConfig) {
                    setStyleConfig({ ...styleConfig, percentagePosition: { x, y } });
                }
                break;
            case 'progressbar':
                setProgressBarConfig({
                    ...progressBarConfig,
                    position: { x, y }
                });
                break;
            case 'elapsed':
                if (setStyleConfig) {
                    setStyleConfig({ ...styleConfig, elapsedTimePosition: { x, y } });
                }
                break;
            case 'alerts':
                setAlertsConfig({
                    ...alertsConfig,
                    global: { ...alertsConfig.global, position: { x, y } }
                });
                break;
        }
    };

    // Update size for element
    const updateSize = (element: DragElement, width: number, height: number) => {
        switch (element) {
            case 'title':
            case 'counter':
            case 'percentage':
                // Text elements don't have configurable size yet
                break;
            case 'progressbar':
                setProgressBarConfig({
                    ...progressBarConfig,
                    size: { width, height }
                });
                break;
            case 'elapsed':
                if (setStyleConfig) {
                    setStyleConfig({ ...styleConfig, elapsedTimePosition: { x, y } });
                }
                break;
            case 'alerts':
                setAlertsConfig({
                    ...alertsConfig,
                    global: { ...alertsConfig.global, size: { width, height } }
                });
                break;
        }
    };

    // Handle mouse down on element
    const handleMouseDown = (element: DragElement, e: React.MouseEvent) => {
        e.stopPropagation();
        const config = getElementConfig(element);

        setDragElement(element);
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    // Handle mouse down on resize handle
    const handleResizeMouseDown = (element: DragElement, handle: ResizeHandle, e: React.MouseEvent) => {
        e.stopPropagation();
        const config = getElementConfig(element);

        setResizeElement(element);
        setResizeHandle(handle);
        setResizeStart({
            x: config.position.x,
            y: config.position.y,
            width: config.size.width,
            height: config.size.height
        });
    };

    // Handle mouse move
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();

        // Handle drag
        if (dragElement) {
            const config = getElementConfig(dragElement);
            let newX = ((e.clientX - canvasRect.left - dragOffset.x) / canvasRect.width) * canvasWidth;
            let newY = ((e.clientY - canvasRect.top - dragOffset.y) / canvasRect.height) * canvasHeight;

            // Snap to grid
            if (snapToGrid) {
                newX = Math.round(newX / 10) * 10;
                newY = Math.round(newY / 10) * 10;
            }

            // Bounds checking
            newX = Math.max(0, Math.min(newX, canvasWidth - config.size.width));
            newY = Math.max(0, Math.min(newY, canvasHeight - config.size.height));

            updatePosition(dragElement, Math.round(newX), Math.round(newY));
        }

        // Handle resize
        if (resizeElement && resizeHandle) {
            const mouseX = ((e.clientX - canvasRect.left) / canvasRect.width) * canvasWidth;
            const mouseY = ((e.clientY - canvasRect.top) / canvasRect.height) * canvasHeight;

            let newX = resizeStart.x;
            let newY = resizeStart.y;
            let newWidth = resizeStart.width;
            let newHeight = resizeStart.height;

            // Calculate new dimensions based on handle
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
            newWidth = Math.max(50, newWidth);
            newHeight = Math.max(20, newHeight);

            // Snap to grid
            if (snapToGrid) {
                newWidth = Math.round(newWidth / 10) * 10;
                newHeight = Math.round(newHeight / 10) * 10;
            }

            updatePosition(resizeElement, Math.round(newX), Math.round(newY));
            updateSize(resizeElement, Math.round(newWidth), Math.round(newHeight));
        }
    };

    // Handle mouse up
    const handleMouseUp = () => {
        if ((dragElement || resizeElement) && onSave) {
            onSave();
        }
        setDragElement(null);
        setResizeElement(null);
        setResizeHandle(null);
    };

    // Reset all positions
    const resetAllPositions = () => {
        if (setStyleConfig) {
            setStyleConfig({
                ...styleConfig,
                titlePosition: { x: 50, y: 20 },
                timePosition: { x: 50, y: 80 },
                percentagePosition: { x: 50, y: 160 },
                elapsedTimePosition: { x: 50, y: 120 }
            });
        }
        setProgressBarConfig({
            ...progressBarConfig,
            position: { x: 50, y: 220 },
            size: { width: 900, height: 40 }
        });
        setAlertsConfig({
            ...alertsConfig,
            global: {
                ...alertsConfig.global,
                position: { x: 500, y: 50 },
                size: { width: 450, height: 100 }
            }
        });
    };

    // Render element on canvas
    const renderElement = (element: DragElement, label: string, color: string) => {
        const config = getElementConfig(element);
        if (!config.enabled && element !== 'counter' && element !== 'progressbar' && element !== 'alerts') return null;

        const isDragging = dragElement === element;
        const isResizing = resizeElement === element;

        return (
            <div
                onMouseDown={(e) => handleMouseDown(element, e)}
                className={`absolute cursor-move border-2 transition-all ${
                    isDragging || isResizing
                        ? 'border-[#64748b] ring-2 ring-[#64748b] ring-offset-1 ring-offset-black'
                        : 'border-[#cbd5e1] dark:border-[#475569] hover:border-[#94a3b8]'
                }`}
                style={{
                    left: `${(config.position.x / canvasWidth) * 100}%`,
                    top: `${(config.position.y / canvasHeight) * 100}%`,
                    width: `${(config.size.width / canvasWidth) * 100}%`,
                    height: `${(config.size.height / canvasHeight) * 100}%`
                }}
            >
                {/* Label */}
                <div className={`absolute -top-5 left-0 text-xs font-bold px-2 py-0.5 rounded-t ${color} text-white whitespace-nowrap`}>
                    {label} ({config.position.x}, {config.position.y})
                </div>

                {/* Content */}
                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    {element === 'title' && (
                        <div className="text-sm font-bold text-white">
                            {displayConfig?.title || 'Título'}
                        </div>
                    )}
                    {element === 'counter' && (
                        <div className="text-2xl font-bold text-white">
                            00:00:00
                        </div>
                    )}
                    {element === 'percentage' && (
                        <div className="text-sm font-bold text-white">
                            0%
                        </div>
                    )}
                    {element === 'progressbar' && (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-xs font-bold text-white bg-[#64748b]/50 px-2 py-1 rounded">
                                {progressBarConfig.type === 'horizontal' ? '━' : progressBarConfig.type === 'vertical' ? '┃' : '◉'} Barra
                            </div>
                        </div>
                    )}
                    {element === 'alerts' && (
                        <div
                            className="w-full h-full flex items-center justify-center text-white font-bold text-xs"
                            style={{
                                backgroundColor: alertsConfig.global.style.backgroundColor,
                                opacity: alertsConfig.global.style.opacity / 100
                            }}
                        >
                            Alertas
                        </div>
                    )}
                </div>

                {/* Resize handles (only for progressbar and alerts) */}
                {(element === 'progressbar' || element === 'alerts') && (
                    <>
                        {['nw', 'ne', 'sw', 'se'].map((handle) => (
                            <div
                                key={handle}
                                onMouseDown={(e) => handleResizeMouseDown(element, handle as ResizeHandle, e)}
                                className={`absolute w-3 h-3 bg-white border-2 border-[#64748b] rounded-full cursor-${
                                    handle === 'nw' ? 'nwse' : handle === 'ne' ? 'nesw' : handle === 'sw' ? 'nesw' : 'nwse'
                                }-resize hover:scale-125 transition-transform`}
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
            {/* Canvas */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                Vista del Overlay
                            </h3>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Arrastra los elementos para posicionarlos
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Ancho:</label>
                            <input
                                type="number"
                                value={canvasWidth}
                                onChange={(e) => {
                                    const newWidth = Number(e.target.value) || 1000;
                                    if (propSetCanvasWidth) {
                                        propSetCanvasWidth(newWidth);
                                    }
                                }}
                                className="w-20 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-xs"
                                min="500"
                                max="3840"
                            />
                            <span className="text-[#64748b] dark:text-[#94a3b8]">×</span>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Alto:</label>
                            <input
                                type="number"
                                value={canvasHeight}
                                onChange={(e) => {
                                    const newHeight = Number(e.target.value) || 300;
                                    if (propSetCanvasHeight) {
                                        propSetCanvasHeight(newHeight);
                                    }
                                }}
                                className="w-20 px-2 py-1 border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-xs"
                                min="200"
                                max="2160"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSnapToGrid(!snapToGrid)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                snapToGrid
                                    ? 'bg-[#e2e8f0] dark:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc]'
                                    : 'bg-[#f8fafc] dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            <Grid3x3 className="w-4 h-4" />
                            Grid {snapToGrid ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={resetAllPositions}
                            className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] dark:bg-[#1B1C1D] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs font-semibold transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    </div>
                </div>

                {/* Canvas Container - Centered */}
                <div className="w-full overflow-auto flex justify-center items-center bg-[#0a0a0a] rounded-xl border-2 border-dashed border-[#cbd5e1] dark:border-[#475569] p-4 min-h-[400px]">
                    <div
                        ref={canvasRef}
                        className="relative overflow-hidden shadow-2xl transition-all duration-300 ease-in-out"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{
                            width: `${canvasWidth}px`,
                            height: `${canvasHeight}px`,
                            // Scale down if canvas is larger than container (simple responsiveness)
                            maxWidth: '100%',
                            backgroundImage: snapToGrid ? 'radial-gradient(circle, #333 1px, transparent 1px)' : 'none',
                            backgroundSize: '20px 20px',
                            backgroundColor: '#000000' // Base black background
                        }}
                    >
                        {renderElement('title', 'Título', 'bg-[#64748b]')}
                        {renderElement('counter', 'Contador', 'bg-[#64748b]')}
                        {renderElement('percentage', 'Porcentaje', 'bg-[#64748b]')}
                        {renderElement('progressbar', 'Barra', 'bg-[#64748b]')}
                        {renderElement('alerts', 'Alertas', 'bg-[#64748b]')}
                        {renderElement('elapsed', 'Transcurrido', 'bg-[#64748b]')}
                    </div>
                </div>
            </div>

            {/* Controls */}
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
                        {/* Title Controls */}
                        {displayConfig?.showTitle && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Título</h4>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.titlePosition?.x || 50}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    titlePosition: { ...styleConfig.titlePosition, x: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.titlePosition?.y || 20}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    titlePosition: { ...styleConfig.titlePosition, y: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Counter Controls */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Contador</h4>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                <input
                                    type="number"
                                    value={styleConfig?.timePosition?.x || 50}
                                    onChange={(e) => {
                                        if (setStyleConfig) {
                                            setStyleConfig({
                                                ...styleConfig,
                                                timePosition: { ...styleConfig.timePosition, x: Number(e.target.value) }
                                            });
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                <input
                                    type="number"
                                    value={styleConfig?.timePosition?.y || 80}
                                    onChange={(e) => {
                                        if (setStyleConfig) {
                                            setStyleConfig({
                                                ...styleConfig,
                                                timePosition: { ...styleConfig.timePosition, y: Number(e.target.value) }
                                            });
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>

                        {displayConfig?.showElapsedTime && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Transcurrido</h4>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.elapsedTimePosition?.x || 50}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    elapsedTimePosition: { ...styleConfig.elapsedTimePosition, x: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.elapsedTimePosition?.y || 120}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    elapsedTimePosition: { ...styleConfig.elapsedTimePosition, y: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Percentage Controls */}
                        {displayConfig?.showPercentage && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Porcentaje</h4>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.percentagePosition?.x || 50}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    percentagePosition: { ...styleConfig.percentagePosition, x: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                    <input
                                        type="number"
                                        value={styleConfig?.percentagePosition?.y || 160}
                                        onChange={(e) => {
                                            if (setStyleConfig) {
                                                setStyleConfig({
                                                    ...styleConfig,
                                                    percentagePosition: { ...styleConfig.percentagePosition, y: Number(e.target.value) }
                                                });
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Progress Bar Controls */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Barra de Progreso</h4>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                <input
                                    type="number"
                                    value={progressBarConfig.position.x}
                                    onChange={(e) => {
                                        setProgressBarConfig({
                                            ...progressBarConfig,
                                            position: { ...progressBarConfig.position, x: Number(e.target.value) }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                <input
                                    type="number"
                                    value={progressBarConfig.position.y}
                                    onChange={(e) => {
                                        setProgressBarConfig({
                                            ...progressBarConfig,
                                            position: { ...progressBarConfig.position, y: Number(e.target.value) }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Ancho</label>
                                <input
                                    type="number"
                                    value={progressBarConfig.size.width}
                                    onChange={(e) => {
                                        setProgressBarConfig({
                                            ...progressBarConfig,
                                            size: { ...progressBarConfig.size, width: Number(e.target.value) }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Alto</label>
                                <input
                                    type="number"
                                    value={progressBarConfig.size.height}
                                    onChange={(e) => {
                                        setProgressBarConfig({
                                            ...progressBarConfig,
                                            size: { ...progressBarConfig.size, height: Number(e.target.value) }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>

                        {/* Alerts Controls */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-[#64748b] dark:text-[#94a3b8]">Alertas</h4>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición X</label>
                                <input
                                    type="number"
                                    value={alertsConfig.global.position.x}
                                    onChange={(e) => {
                                        setAlertsConfig({
                                            ...alertsConfig,
                                            global: {
                                                ...alertsConfig.global,
                                                position: { ...alertsConfig.global.position, x: Number(e.target.value) }
                                            }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Posición Y</label>
                                <input
                                    type="number"
                                    value={alertsConfig.global.position.y}
                                    onChange={(e) => {
                                        setAlertsConfig({
                                            ...alertsConfig,
                                            global: {
                                                ...alertsConfig.global,
                                                position: { ...alertsConfig.global.position, y: Number(e.target.value) }
                                            }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Ancho</label>
                                <input
                                    type="number"
                                    value={alertsConfig.global.size.width}
                                    onChange={(e) => {
                                        setAlertsConfig({
                                            ...alertsConfig,
                                            global: {
                                                ...alertsConfig.global,
                                                size: { ...alertsConfig.global.size, width: Number(e.target.value) }
                                            }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8]">Alto</label>
                                <input
                                    type="number"
                                    value={alertsConfig.global.size.height}
                                    onChange={(e) => {
                                        setAlertsConfig({
                                            ...alertsConfig,
                                            global: {
                                                ...alertsConfig.global,
                                                size: { ...alertsConfig.global.size, height: Number(e.target.value) }
                                            }
                                        });
                                    }}
                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
