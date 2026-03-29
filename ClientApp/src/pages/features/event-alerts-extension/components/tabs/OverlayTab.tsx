/**
 * Event Alerts Extension - Overlay Tab Component
 * Canvas editor con elementos independientes: CARD, MEDIA, TEXTO
 */
import React, { useState, useRef } from 'react';
import { Copy, Check, Grid3x3, RotateCcw, ChevronDown, ChevronUp, Eye, EyeOff, Monitor } from 'lucide-react';
import type { GlobalAlertsConfig, AnimationType, AnimationDirection } from '../../types/index';

interface OverlayTabProps {
  overlayUrl?: string;
  globalConfig: GlobalAlertsConfig;
  onGlobalConfigChange: (updates: Partial<GlobalAlertsConfig>) => void;
}

type DragElement = 'card' | 'media' | 'text' | null;
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

const CANVAS_PRESETS = [
  { label: '1920×1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280×720 (HD)', width: 1280, height: 720 },
  { label: '1600×900', width: 1600, height: 900 },
  { label: '2560×1440 (2K)', width: 2560, height: 1440 },
  { label: '3840×2160 (4K)', width: 3840, height: 2160 },
];

const ANIMATION_TYPES: { value: AnimationType; label: string }[] = [
  { value: 'fade', label: 'Desvanecer' },
  { value: 'slide', label: 'Deslizar' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'bounce', label: 'Rebote' },
  { value: 'rotate', label: 'Rotar' },
  { value: 'none', label: 'Ninguna' },
];

const ANIMATION_DIRECTIONS: { value: AnimationDirection; label: string }[] = [
  { value: 'top', label: 'Arriba' },
  { value: 'bottom', label: 'Abajo' },
  { value: 'left', label: 'Izquierda' },
  { value: 'right', label: 'Derecha' },
  { value: 'center', label: 'Centro' },
];

export const OverlayTab: React.FC<OverlayTabProps> = ({
  overlayUrl = '',
  globalConfig,
  onGlobalConfigChange
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Canvas dimensions
  const canvasWidth = globalConfig.canvas.width;
  const canvasHeight = globalConfig.canvas.height;

  // Drag state
  const [dragElement, setDragElement] = useState<DragElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizeElement, setResizeElement] = useState<DragElement>(null);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Grid snap
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Controls collapsed
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Get element config
  const getElementConfig = (element: DragElement) => {
    if (!element) return { x: 0, y: 0, width: 0, height: 0, enabled: false };
    return globalConfig.overlayElements[element];
  };

  // Update element position
  const updateElementPosition = (element: DragElement, x: number, y: number) => {
    if (!element) return;
    onGlobalConfigChange({
      overlayElements: {
        ...globalConfig.overlayElements,
        [element]: {
          ...globalConfig.overlayElements[element],
          x: Math.round(x),
          y: Math.round(y),
        },
      },
    });
  };

  // Update element size
  const updateElementSize = (element: DragElement, width: number, height: number) => {
    if (!element) return;
    onGlobalConfigChange({
      overlayElements: {
        ...globalConfig.overlayElements,
        [element]: {
          ...globalConfig.overlayElements[element],
          width: Math.round(width),
          height: Math.round(height),
        },
      },
    });
  };

  // Handle mouse down on element
  const handleMouseDown = (element: DragElement, e: React.MouseEvent) => {
    e.stopPropagation();
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
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height
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
      newX = Math.max(0, Math.min(newX, canvasWidth - config.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - config.height));

      updateElementPosition(dragElement, newX, newY);
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
      newWidth = Math.max(100, newWidth);
      newHeight = Math.max(80, newHeight);

      // Snap to grid
      if (snapToGrid) {
        newWidth = Math.round(newWidth / 10) * 10;
        newHeight = Math.round(newHeight / 10) * 10;
      }

      updateElementPosition(resizeElement, newX, newY);
      updateElementSize(resizeElement, newWidth, newHeight);
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setDragElement(null);
    setResizeElement(null);
    setResizeHandle(null);
  };

  // Reset positions a los defaults actuales
  const resetPositions = () => {
    onGlobalConfigChange({
      overlayElements: {
        card: {
          x: 660,
          y: 290,
          width: 600,
          height: 500,
          enabled: true,
        },
        media: {
          x: 690,
          y: 320,
          width: 540,
          height: 220,
          enabled: true,
        },
        text: {
          x: 690,
          y: 560,
          width: 540,
          height: 200,
          enabled: true,
        },
      },
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render element on canvas
  const renderElement = (element: DragElement, label: string, color: string, bgColor: string) => {
    if (!element) return null;
    const config = getElementConfig(element);
    if (!config.enabled) return null;

    const isDragging = dragElement === element;
    const isResizing = resizeElement === element;

    return (
      <div
        key={element}
        onMouseDown={(e) => handleMouseDown(element, e)}
        className={`absolute cursor-move border-2 transition-all ${
          isDragging || isResizing
            ? 'border-white ring-4 ring-white/50 ring-offset-2 ring-offset-black z-50'
            : 'border-gray-400 hover:border-white z-40'
        }`}
        style={{
          left: `${(config.x / canvasWidth) * 100}%`,
          top: `${(config.y / canvasHeight) * 100}%`,
          width: `${(config.width / canvasWidth) * 100}%`,
          height: `${(config.height / canvasHeight) * 100}%`,
        }}
      >
        {/* Label */}
        <div className={`absolute -top-6 left-0 text-xs font-bold px-2 py-1 rounded-t ${color} text-white whitespace-nowrap shadow-lg`}>
          {label} ({config.x}, {config.y})
        </div>

        {/* Content */}
        <div className={`w-full h-full flex items-center justify-center ${bgColor} backdrop-blur-sm`} style={{ opacity: 0.9 }}>
          <div className="text-center">
            <div className="text-sm font-bold text-white drop-shadow-lg">{label}</div>
            <div className="text-xs text-white/80 mt-1">{config.width} × {config.height}</div>
          </div>
        </div>

        {/* Resize handles */}
        {['nw', 'ne', 'sw', 'se'].map((handle) => (
          <div
            key={handle}
            onMouseDown={(e) => handleResizeMouseDown(element, handle as ResizeHandle, e)}
            className={`absolute w-4 h-4 bg-white border-2 ${color.replace('bg-', 'border-')} rounded-full cursor-${
              handle === 'nw' ? 'nwse' : handle === 'ne' ? 'nesw' : handle === 'sw' ? 'nesw' : 'nwse'
            }-resize hover:scale-125 transition-transform shadow-lg z-50`}
            style={{
              top: handle.includes('n') ? '-8px' : 'auto',
              bottom: handle.includes('s') ? '-8px' : 'auto',
              left: handle.includes('w') ? '-8px' : 'auto',
              right: handle.includes('e') ? '-8px' : 'auto'
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* URL del Overlay */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          🔗 URL del Overlay
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Agrega esta URL como fuente de navegador en OBS Studio
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={overlayUrl || 'Cargando...'}
            readOnly
            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleCopy}
            disabled={!overlayUrl}
            className="px-4 py-2 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-bold text-sm flex items-center gap-2 whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Canvas Editor */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">
              📺 Editor de Overlay - Elementos Independientes
            </h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Arrastra y redimensiona CARD, MEDIA y TEXTO por separado
            </p>
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
              onClick={resetPositions}
              className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] dark:bg-[#1B1C1D] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative bg-black rounded-lg overflow-hidden border-2 border-[#374151] select-none"
          style={{
            width: '100%',
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            maxHeight: '500px'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Elementos en orden de renderizado (z-index) */}
          {renderElement('card', 'CARD', 'bg-gradient-to-r from-blue-600 to-cyan-600', 'bg-blue-600/30')}
          {renderElement('media', 'MEDIA', 'bg-gradient-to-r from-purple-600 to-pink-600', 'bg-purple-600/30')}
          {renderElement('text', 'TEXTO', 'bg-gradient-to-r from-green-600 to-emerald-600', 'bg-green-600/30')}
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-[#1e293b] dark:text-blue-300">
            💡 <strong>Tip:</strong> CARD = contenedor principal, MEDIA = imagen/video, TEXTO = mensaje. Cada uno es independiente. Canvas: {canvasWidth}×{canvasHeight}px
          </p>
        </div>
      </div>

      {/* Tamaño del Canvas */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-5 h-5 text-blue-500" />
          <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
            Tamaño del Canvas
          </label>
        </div>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          El tamaño debe coincidir con la resolución de tu OBS/streaming
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {CANVAS_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => onGlobalConfigChange({ canvas: { width: preset.width, height: preset.height } })}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                canvasWidth === preset.width && canvasHeight === preset.height
                  ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg'
                  : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-blue-400'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Ancho (px)</label>
            <input
              type="number"
              value={canvasWidth}
              onChange={(e) => onGlobalConfigChange({ canvas: { ...globalConfig.canvas, width: parseInt(e.target.value) || 1920 } })}
              min={640}
              max={7680}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Alto (px)</label>
            <input
              type="number"
              value={canvasHeight}
              onChange={(e) => onGlobalConfigChange({ canvas: { ...globalConfig.canvas, height: parseInt(e.target.value) || 1080 } })}
              min={360}
              max={4320}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Elementos del Overlay */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          👁️ Visibilidad de Elementos
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Habilita o deshabilita cada elemento del overlay
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD Toggle */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            globalConfig.overlayElements.card.enabled
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟦</span>
                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">CARD</span>
              </div>
              <button
                onClick={() => onGlobalConfigChange({
                  overlayElements: {
                    ...globalConfig.overlayElements,
                    card: { ...globalConfig.overlayElements.card, enabled: !globalConfig.overlayElements.card.enabled }
                  }
                })}
                className={`p-2 rounded-lg transition-colors ${
                  globalConfig.overlayElements.card.enabled
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {globalConfig.overlayElements.card.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">Contenedor principal con fondo</p>
          </div>

          {/* MEDIA Toggle */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            globalConfig.overlayElements.media.enabled
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟪</span>
                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">MEDIA</span>
              </div>
              <button
                onClick={() => onGlobalConfigChange({
                  overlayElements: {
                    ...globalConfig.overlayElements,
                    media: { ...globalConfig.overlayElements.media, enabled: !globalConfig.overlayElements.media.enabled }
                  }
                })}
                className={`p-2 rounded-lg transition-colors ${
                  globalConfig.overlayElements.media.enabled
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {globalConfig.overlayElements.media.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">Imagen, video o GIF</p>
          </div>

          {/* TEXT Toggle */}
          <div className={`p-4 rounded-xl border-2 transition-all ${
            globalConfig.overlayElements.text.enabled
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟩</span>
                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">TEXTO</span>
              </div>
              <button
                onClick={() => onGlobalConfigChange({
                  overlayElements: {
                    ...globalConfig.overlayElements,
                    text: { ...globalConfig.overlayElements.text, enabled: !globalConfig.overlayElements.text.enabled }
                  }
                })}
                className={`p-2 rounded-lg transition-colors ${
                  globalConfig.overlayElements.text.enabled
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {globalConfig.overlayElements.text.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">Mensaje de la alerta</p>
          </div>
        </div>
      </div>

      {/* Animaciones por Defecto */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ✨ Animaciones por Defecto
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Animación que se usará para todas las alertas (cada evento puede sobrescribirla)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tipo de Animación</label>
            <div className="grid grid-cols-3 gap-2">
              {ANIMATION_TYPES.map((anim) => (
                <button
                  key={anim.value}
                  onClick={() => onGlobalConfigChange({ defaultAnimation: anim.value })}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    globalConfig.defaultAnimation === anim.value
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Dirección</label>
            <div className="grid grid-cols-3 gap-2">
              {ANIMATION_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  onClick={() => onGlobalConfigChange({ defaultAnimationDirection: dir.value })}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    globalConfig.defaultAnimationDirection === dir.value
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Duración por defecto (seg)</label>
            <input
              type="number"
              value={globalConfig.defaultDuration}
              onChange={(e) => onGlobalConfigChange({ defaultDuration: parseInt(e.target.value) || 5 })}
              min={1}
              max={60}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-purple-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Volumen por defecto (%)</label>
            <input
              type="number"
              value={globalConfig.defaultVolume}
              onChange={(e) => onGlobalConfigChange({ defaultVolume: parseInt(e.target.value) || 80 })}
              min={0}
              max={100}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-purple-500 outline-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Cola de Alertas */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
              📋 Cola de Alertas
            </label>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Configura cómo se manejan múltiples alertas simultáneas
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={globalConfig.queueSettings.enabled}
              onChange={(e) => onGlobalConfigChange({
                queueSettings: { ...globalConfig.queueSettings, enabled: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#2563eb] peer-checked:to-[#3b82f6]"></div>
            <span className="ml-3 text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              {globalConfig.queueSettings.enabled ? 'Activada' : 'Desactivada'}
            </span>
          </label>
        </div>

        {globalConfig.queueSettings.enabled && (
          <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151] space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Máximo en cola</label>
                <input
                  type="number"
                  value={globalConfig.queueSettings.maxQueueSize}
                  onChange={(e) => onGlobalConfigChange({
                    queueSettings: { ...globalConfig.queueSettings, maxQueueSize: parseInt(e.target.value) || 10 }
                  })}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Delay entre alertas (ms)</label>
                <input
                  type="number"
                  value={globalConfig.queueSettings.delayBetweenAlerts}
                  onChange={(e) => onGlobalConfigChange({
                    queueSettings: { ...globalConfig.queueSettings, delayBetweenAlerts: parseInt(e.target.value) || 500 }
                  })}
                  min={0}
                  max={10000}
                  step={100}
                  className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={globalConfig.queueSettings.showQueueCounter}
                onChange={(e) => onGlobalConfigChange({
                  queueSettings: { ...globalConfig.queueSettings, showQueueCounter: e.target.checked }
                })}
                className="rounded text-[#2563eb] w-5 h-5"
              />
              <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">Mostrar contador de cola en overlay</span>
            </label>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                💡 Si la cola está desactivada, una nueva alerta reemplazará inmediatamente la actual
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cooldowns Globales */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
          ⏱️ Cooldowns Globales
        </label>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
          Tiempo mínimo entre alertas (además del cooldown específico de cada evento)
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown Global (seg)</label>
            <input
              type="number"
              value={globalConfig.cooldownSettings.globalCooldown}
              onChange={(e) => onGlobalConfigChange({
                cooldownSettings: { ...globalConfig.cooldownSettings, globalCooldown: parseInt(e.target.value) || 0 }
              })}
              min={0}
              max={300}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Entre cualquier alerta</p>
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown por Evento (seg)</label>
            <input
              type="number"
              value={globalConfig.cooldownSettings.perEventCooldown}
              onChange={(e) => onGlobalConfigChange({
                cooldownSettings: { ...globalConfig.cooldownSettings, perEventCooldown: parseInt(e.target.value) || 0 }
              })}
              min={0}
              max={300}
              className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Entre alertas del mismo tipo</p>
          </div>
        </div>
      </div>

      {/* Pixel Controls */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-lg overflow-hidden">
        <button
          onClick={() => setControlsCollapsed(!controlsCollapsed)}
          className="w-full flex items-center justify-between p-6 hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
              🎯 Controles de Píxeles
            </span>
          </div>
          {controlsCollapsed ? (
            <ChevronDown className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
          ) : (
            <ChevronUp className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
          )}
        </button>

        {!controlsCollapsed && (
          <div className="px-6 pb-6 pt-2 border-t border-[#e2e8f0] dark:border-[#374151] space-y-6">
            {/* CARD Controls */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-3">🟦 CARD (Contenedor)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['x', 'y', 'width', 'height'].map((prop) => (
                  <div key={prop}>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1 capitalize">
                      {prop === 'x' ? 'Pos X' : prop === 'y' ? 'Pos Y' : prop === 'width' ? 'Ancho' : 'Alto'} (px)
                    </label>
                    <input
                      type="number"
                      value={globalConfig.overlayElements.card[prop as keyof typeof globalConfig.overlayElements.card]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        onGlobalConfigChange({
                          overlayElements: {
                            ...globalConfig.overlayElements,
                            card: {
                              ...globalConfig.overlayElements.card,
                              [prop]: value,
                            },
                          },
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none"
                      min="0"
                      max={prop === 'x' || prop === 'width' ? canvasWidth : canvasHeight}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* MEDIA Controls */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-3">🟪 MEDIA (Imagen/Video)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['x', 'y', 'width', 'height'].map((prop) => (
                  <div key={prop}>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1 capitalize">
                      {prop === 'x' ? 'Pos X' : prop === 'y' ? 'Pos Y' : prop === 'width' ? 'Ancho' : 'Alto'} (px)
                    </label>
                    <input
                      type="number"
                      value={globalConfig.overlayElements.media[prop as keyof typeof globalConfig.overlayElements.media]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        onGlobalConfigChange({
                          overlayElements: {
                            ...globalConfig.overlayElements,
                            media: {
                              ...globalConfig.overlayElements.media,
                              [prop]: value,
                            },
                          },
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-purple-500 outline-none"
                      min="0"
                      max={prop === 'x' || prop === 'width' ? canvasWidth : canvasHeight}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* TEXT Controls */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm font-bold text-green-700 dark:text-green-400 mb-3">🟩 TEXTO (Mensaje)</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['x', 'y', 'width', 'height'].map((prop) => (
                  <div key={prop}>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1 capitalize">
                      {prop === 'x' ? 'Pos X' : prop === 'y' ? 'Pos Y' : prop === 'width' ? 'Ancho' : 'Alto'} (px)
                    </label>
                    <input
                      type="number"
                      value={globalConfig.overlayElements.text[prop as keyof typeof globalConfig.overlayElements.text]}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        onGlobalConfigChange({
                          overlayElements: {
                            ...globalConfig.overlayElements,
                            text: {
                              ...globalConfig.overlayElements.text,
                              [prop]: value,
                            },
                          },
                        });
                      }}
                      className="w-full px-2 py-1 text-sm border border-[#e2e8f0] dark:border-[#374151] rounded bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-green-500 outline-none"
                      min="0"
                      max={prop === 'x' || prop === 'width' ? canvasWidth : canvasHeight}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
