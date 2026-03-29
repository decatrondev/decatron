/**
 * Timer Extension - Alerts Tab Component
 *
 * Configuración de alertas visuales y de audio para eventos de Twitch.
 * Diseño consistente con EventsTab y basado estrictamente en el modelo AlertsConfig.
 */

import { useState, useRef, useEffect } from 'react';
import { Volume2, Play, ChevronDown, ChevronUp, Check, AlertCircle, Layers } from 'lucide-react';
import { MediaEditor } from '../MediaEditor';
import { VariantManager } from '../VariantManager';
import { TtsSection } from '../../../../features/event-alerts-extension/components/TtsSection';
import type { AlertsConfig, TimerEventType } from '../../types';
import { DEFAULT_TTS_CONFIG } from '../../../../../types/timer-alerts';
import api from '../../../../../services/api';

interface AlertsTabProps {
    alertsConfig: AlertsConfig;
    onAlertsConfigChange: (updates: Partial<AlertsConfig>) => void;
    canvasWidth?: number;
    canvasHeight?: number;
}

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#94a3b8] dark:peer-focus:ring-[#64748b] rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#64748b]"></div>
    </label>
);

const AlertGlobalPreview: React.FC<{ 
    config: any; 
    eventConfig: any; // Configuración del evento seleccionado (para sacar el mensaje real)
    canvasWidth: number; 
    canvasHeight: number;
    onUpdate: (updates: any) => void;
}> = ({ config, eventConfig, canvasWidth, canvasHeight, onUpdate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);
    
    // Estados para Drag & Drop
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialRect, setInitialRect] = useState({ x: 0, y: 0, w: 0, h: 0 });

    useEffect(() => {
        if (containerRef.current) {
            const parentWidth = containerRef.current.parentElement?.clientWidth || 500;
            setScale(parentWidth / canvasWidth);
        }
    }, [canvasWidth, config]);

    // Smart Preview Logic
    const getPreviewMessage = () => {
        // Prioridad: Mensaje del evento > Mensaje global > Fallback
        const template = eventConfig?.message || config.message || "¡{userName} ha donado {amount}!";
        return template
            .replace(/{userName}/g, "DonadorPro")
            .replace(/{amount}/g, "100")
            .replace(/{time}/g, "5m")
            .replace(/{tier}/g, "Tier 1")
            .replace(/{message}/g, "¡Gracias por el stream!");
    };

    const getFlexDirection = () => config.style?.layout || 'column';
    const getAlignItems = () => {
        const align = config.style?.align || 'center';
        if (align === 'start') return 'flex-start';
        if (align === 'end') return 'flex-end';
        return 'center';
    };
    const getGap = () => config.style?.gap || 10;
    
    // Icon Logic
    const showIcon = config.style?.showIcon !== false; // Default true
    const iconSize = config.style?.iconSize || 50;
    const iconShapeRadius = config.style?.iconShape === 'circle' ? '50%' : config.style?.iconShape === 'square' ? '0px' : '12px';

    // Handlers (Drag & Resize) - Sin cambios, solo lógica visual
    const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize', handle?: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialRect({ x: config.position.x, y: config.position.y, w: config.size.width, h: config.size.height });
        if (type === 'drag') setIsDragging(true);
        if (type === 'resize' && handle) setIsResizing(handle);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging && !isResizing) return;
        const deltaX = (e.clientX - dragStart.x) / scale;
        const deltaY = (e.clientY - dragStart.y) / scale;

        if (isDragging) {
            const newX = Math.round(initialRect.x + deltaX);
            const newY = Math.round(initialRect.y + deltaY);
            const snappedX = Math.round(newX / 10) * 10;
            const snappedY = Math.round(newY / 10) * 10;
            onUpdate({ position: { x: snappedX, y: snappedY } });
        }

        if (isResizing) {
            let newX = initialRect.x;
            let newY = initialRect.y;
            let newW = initialRect.w;
            let newH = initialRect.h;

            if (isResizing.includes('e')) newW = initialRect.w + deltaX;
            if (isResizing.includes('w')) { newW = initialRect.w - deltaX; newX = initialRect.x + deltaX; }
            if (isResizing.includes('s')) newH = initialRect.h + deltaY;
            if (isResizing.includes('n')) { newH = initialRect.h - deltaY; newY = initialRect.y + deltaY; }

            if (newW < 50) newW = 50;
            if (newH < 50) newH = 50;

            onUpdate({ position: { x: Math.round(newX), y: Math.round(newY) }, size: { width: Math.round(newW), height: Math.round(newH) } });
        }
    };

    const handleMouseUp = () => { setIsDragging(false); setIsResizing(null); };

    return (
        <div className="space-y-4">
            {/* Canvas Interactivo */}
            <div className="w-full bg-[#0f172a] rounded-xl border border-[#334155] overflow-hidden relative select-none">
                <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/50 rounded text-[10px] font-mono text-gray-400 pointer-events-none">
                    Arrastra para mover • Esquinas para tamaño
                </div>
                <div 
                    ref={containerRef}
                    className="w-full flex justify-center items-center bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/5d/Checker-16x16.png')] bg-repeat cursor-crosshair"
                    style={{ height: canvasHeight * scale }}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div 
                        style={{
                            width: canvasWidth,
                            height: canvasHeight,
                            transform: `scale(${scale})`,
                            transformOrigin: 'center center',
                            position: 'relative',
                            backgroundColor: 'rgba(0,0,0,0.1)'
                        }}
                    >
                        {/* Caja de Alerta Draggable */}
                        <div
                            onMouseDown={(e) => handleMouseDown(e, 'drag')}
                            style={{
                                position: 'absolute',
                                left: config.position.x,
                                top: config.position.y,
                                width: config.size.width,
                                height: config.size.height,
                                backgroundColor: config.style.backgroundColor || '#64748b',
                                color: config.style.textColor || 'white',
                                fontFamily: config.style.fontFamily,
                                fontSize: `${config.style.fontSize || 24}px`, // Usar tamaño real si existe
                                display: 'flex',
                                flexDirection: getFlexDirection(),
                                alignItems: getAlignItems(),
                                justifyContent: 'center', // Centrado vertical/horizontal según eje principal
                                gap: `${getGap()}px`,
                                borderRadius: `${config.style.borderRadius || 12}px`,
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                border: isDragging ? '2px solid #3b82f6' : (config.style.borderEnabled ? `${config.style.borderWidth}px solid ${config.style.borderColor}` : '2px solid rgba(255,255,255,0.2)'),
                                cursor: isDragging ? 'grabbing' : 'grab',
                                overflow: 'hidden',
                                padding: '10px'
                            }}
                        >
                            {/* Icono */}
                            {showIcon && (
                                <div 
                                    className="flex-shrink-0 flex items-center justify-center bg-black/20"
                                    style={{ 
                                        fontSize: `${iconSize * 0.6}px`, // Emoji scale relative to box
                                        width: `${iconSize}px`,
                                        height: `${iconSize}px`,
                                        borderRadius: iconShapeRadius
                                    }}
                                >
                                    {eventConfig?.customIcon ? (
                                        <img src={eventConfig.customIcon} alt="icon" className="w-full h-full object-cover" style={{ borderRadius: iconShapeRadius }} />
                                    ) : (
                                        <span>{eventConfig?.icon || '💎'}</span>
                                    )}
                                </div>
                            )}
                            
                            {/* Texto */}
                            <div className="w-full break-words" style={{ textAlign: config.style?.align === 'start' ? 'left' : config.style?.align === 'end' ? 'right' : 'center' }}>
                                <p className="leading-tight" style={{ 
                                    textShadow: config.style.textShadow === 'none' ? 'none' : '2px 2px 4px rgba(0,0,0,0.5)' 
                                }}>
                                    {getPreviewMessage()}
                                </p>
                            </div>
                            
                            {/* Resize Handles */}
                            {['nw', 'ne', 'sw', 'se'].map((h) => (
                                <div
                                    key={h}
                                    onMouseDown={(e) => handleMouseDown(e, 'resize', h)}
                                    className={`absolute w-4 h-4 bg-white border border-blue-500 rounded-full z-20 
                                        ${h === 'nw' ? '-top-2 -left-2 cursor-nw-resize' : ''}
                                        ${h === 'ne' ? '-top-2 -right-2 cursor-ne-resize' : ''}
                                        ${h === 'sw' ? '-bottom-2 -left-2 cursor-sw-resize' : ''}
                                        ${h === 'se' ? '-bottom-2 -right-2 cursor-se-resize' : ''}
                                    `}
                                />
                            ))}
                            
                            {/* Medidas Overlay */}
                            {(isDragging || isResizing) && (
                                <div className="absolute -top-6 left-0 bg-blue-600 text-white text-[10px] px-1 rounded font-mono whitespace-nowrap pointer-events-none">
                                    X:{config.position.x} Y:{config.position.y} | {config.size.width}x{config.size.height}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AlertsTab: React.FC<AlertsTabProps> = ({
    alertsConfig,
    onAlertsConfigChange,
    canvasWidth = 1000,
    canvasHeight = 300
}) => {
    // Estado local
    const [selectedEvent, setSelectedEvent] = useState<TimerEventType>('bits');
    const [expandedGlobal, setExpandedGlobal] = useState(false);
    
    // Estado para pruebas
    const [testUsername, setTestUsername] = useState('UsuarioPrueba');
    const [testAmount, setTestAmount] = useState(100);
    const [testTier, setTestTier] = useState<string>('1000'); // 1000=Tier1, 2000=Tier2, 3000=Tier3, Prime=Prime
    const [testMonths, setTestMonths] = useState(1);
    const [testAddTime, setTestAddTime] = useState(false); // Nuevo estado: Sumar tiempo real?
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Definición de eventos consistente con el modelo
    const eventTypes: { type: TimerEventType; label: string; icon: string }[] = [
        { type: 'bits', label: 'Bits', icon: '💎' },
        { type: 'follow', label: 'Follow', icon: '❤️' },
        { type: 'sub', label: 'Suscripción', icon: '⭐' },
        { type: 'gift', label: 'Gift Sub', icon: '🎁' },
        { type: 'raid', label: 'Raid', icon: '🚀' },
        { type: 'hypetrain', label: 'Hype Train', icon: '🔥' },
        { type: 'tips', label: 'Donaciones', icon: '💰' }
    ];

    // Helper para actualizar configuración global
    const updateGlobalConfig = (updates: any) => {
        onAlertsConfigChange({
            global: { ...alertsConfig.global, ...updates }
        });
    };

    // Helper para actualizar evento específico (DEFAULT CONFIG)
    const updateEventDefaultConfig = (event: TimerEventType, updates: any) => {
        const currentCategory = alertsConfig.events[event];
        onAlertsConfigChange({
            events: {
                ...alertsConfig.events,
                [event]: { 
                    ...currentCategory,
                    default: { ...currentCategory.default, ...updates }
                }
            }
        });
    };

    // Helper para actualizar variantes
    const updateEventVariants = (event: TimerEventType, variants: any[]) => {
        const currentCategory = alertsConfig.events[event];
        onAlertsConfigChange({
            events: {
                ...alertsConfig.events,
                [event]: { 
                    ...currentCategory,
                    variants: variants
                }
            }
        });
    };

    // Helper para activar/desactivar la categoría completa (Configuración Avanzada)
    const toggleEventCategory = (event: TimerEventType, enabled: boolean) => {
        const currentCategory = alertsConfig.events[event];
        onAlertsConfigChange({
            events: {
                ...alertsConfig.events,
                [event]: { ...currentCategory, enabled }
            }
        });
    };

    // Configuración actual del evento seleccionado (CATEGORY + DEFAULT)
    const currentCategory = alertsConfig.events?.[selectedEvent];
    const currentDefaultConfig = currentCategory?.default || {
        enabled: false,
        duration: null,
        message: '',
        icon: '',
        customIcon: null,
        media: { enabled: false, mode: 'simple' }, // Estructura mínima segura
        soundEnabled: false,
        soundUrl: null,
        soundVolume: 50
    };

    // Manejador de pruebas
    const handleTestEvent = async () => {
        if (isTesting) return;
        setIsTesting(true);
        setTestStatus(null);

        try {
            // Construir payload dinámico
            const payload: any = {
                eventType: selectedEvent,
                username: testUsername,
                amount: testAmount, // Default para bits/raid/gift
                addTime: testAddTime // Enviar flag al backend
            };

            if (selectedEvent === 'sub') {
                payload.tier = testTier;
                payload.months = testMonths;
                // Para subs, 'amount' suele ser meses en algunos sistemas, o 1. Lo dejamos en meses.
                payload.amount = testMonths;
            } else if (selectedEvent === 'hypetrain') {
                payload.level = testAmount;
            } else if (selectedEvent === 'tips') {
                payload.amount = testAmount;
                payload.message = 'Mensaje de prueba de donación';
                payload.currency = 'USD';
            }

            const response = await api.post('/timer/test/event', payload);

            if (response.data.success) {
                setTestStatus({ type: 'success', text: testAddTime ? 'Enviado (+Tiempo)' : 'Prueba Visual Enviada' });
            } else {
                setTestStatus({ type: 'error', text: 'Error al enviar' });
            }
        } catch (error) {
            setTestStatus({ type: 'error', text: 'Error de conexión' });
        } finally {
            setIsTesting(false);
            setTimeout(() => setTestStatus(null), 3000);
        }
    };

    return (
        <div className="space-y-6">
            
            {/* 1. SELECCIÓN DE EVENTO (Ahora es lo primero) */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                        🎯 Seleccionar Evento
                    </h3>
                    <div className="flex items-center gap-3 bg-[#f8fafc] dark:bg-[#262626] px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151]">
                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                            SISTEMA DE ALERTAS: {alertsConfig.enabled ? 'ACTIVADO' : 'APAGADO'}
                        </span>
                        <ToggleSwitch
                            checked={alertsConfig.enabled ?? false}
                            onChange={(checked) => onAlertsConfigChange({ enabled: checked })}
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {eventTypes.map((event) => (
                        <button
                            key={event.type}
                            onClick={() => setSelectedEvent(event.type)}
                            className={`p-3 rounded-xl text-xs font-bold transition-all border-2 flex flex-col items-center gap-2 ${
                                selectedEvent === event.type
                                    ? 'bg-[#64748b] text-white border-[#64748b] shadow-md'
                                    : 'bg-[#f8fafc] dark:bg-[#262626] border-transparent text-[#64748b] dark:text-[#94a3b8] hover:border-[#94a3b8]'
                            }`}
                        >
                            <span className="text-xl">{event.icon}</span>
                            <span>{event.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {alertsConfig.enabled && (
                <>
                    {/* 2. ESTILOS GLOBALES (Ahora en el medio) */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-sm overflow-hidden">
                        <button
                            onClick={() => setExpandedGlobal(!expandedGlobal)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#f8fafc] dark:hover:bg-[#262626] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg">🎨</span>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                        Estilos Globales
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                        Configuración visual base para todas las alertas
                                    </p>
                                </div>
                            </div>
                            {expandedGlobal ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        {expandedGlobal && (
                            <div className="p-6 pt-0 border-t border-[#e2e8f0] dark:border-[#374151] space-y-6">
                                {/* Visual Preview */}
                                <div className="mt-6">
                                    <AlertGlobalPreview 
                                        config={alertsConfig.global} 
                                        canvasWidth={canvasWidth} 
                                        canvasHeight={canvasHeight} 
                                        onUpdate={updateGlobalConfig}
                                    />
                                </div>

                                {/* Posición y Tamaño */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">POSICIÓN (X, Y)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="number"
                                                placeholder="X"
                                                value={alertsConfig.global.position.x}
                                                onChange={(e) => updateGlobalConfig({ position: { ...alertsConfig.global.position, x: Number(e.target.value) } })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Y"
                                                value={alertsConfig.global.position.y}
                                                onChange={(e) => updateGlobalConfig({ position: { ...alertsConfig.global.position, y: Number(e.target.value) } })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">TAMAÑO (Ancho, Alto)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="number"
                                                placeholder="W"
                                                value={alertsConfig.global.size.width}
                                                onChange={(e) => updateGlobalConfig({ size: { ...alertsConfig.global.size, width: Number(e.target.value) } })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                            />
                                            <input
                                                type="number"
                                                placeholder="H"
                                                value={alertsConfig.global.size.height}
                                                onChange={(e) => updateGlobalConfig({ size: { ...alertsConfig.global.size, height: Number(e.target.value) } })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Duración y Fuente */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">DURACIÓN BASE</label>
                                            <span className="text-xs font-mono text-[#1e293b] dark:text-[#f8fafc]">{alertsConfig.global.duration}ms</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1000"
                                            max="15000"
                                            step="500"
                                            value={alertsConfig.global.duration}
                                            onChange={(e) => updateGlobalConfig({ duration: Number(e.target.value) })}
                                            className="w-full accent-[#64748b]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">FUENTE</label>
                                        <select
                                            value={alertsConfig.global.style.fontFamily}
                                            onChange={(e) => updateGlobalConfig({ style: { ...alertsConfig.global.style, fontFamily: e.target.value } })}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            <option value="Inter">Inter</option>
                                            <option value="Poppins">Poppins</option>
                                            <option value="Montserrat">Montserrat</option>
                                            <option value="Roboto">Roboto</option>
                                            <option value="Arial">Arial</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Configuración de Icono Global */}
                                <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#374151]">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                                            Estilo de Icono
                                        </label>
                                        <ToggleSwitch
                                            checked={alertsConfig.global.style.showIcon !== false}
                                            onChange={(checked) => updateGlobalConfig({ style: { ...alertsConfig.global.style, showIcon: checked } })}
                                        />
                                    </div>
                                    
                                    {alertsConfig.global.style.showIcon !== false && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Tamaño */}
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-[10px] font-bold text-gray-500">TAMAÑO</p>
                                                    <span className="text-[10px] font-mono text-gray-400">{alertsConfig.global.style.iconSize || 50}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="20"
                                                    max="150"
                                                    value={alertsConfig.global.style.iconSize || 50}
                                                    onChange={(e) => updateGlobalConfig({ style: { ...alertsConfig.global.style, iconSize: Number(e.target.value) } })}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
                                                />
                                            </div>

                                            {/* Forma */}
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-500 mb-1">FORMA</p>
                                                <div className="flex bg-white dark:bg-[#1a1a1a] rounded-lg border border-[#e2e8f0] dark:border-[#374151] p-1">
                                                    {[
                                                        { val: 'square', icon: '⬛' },
                                                        { val: 'rounded', icon: '▢' },
                                                        { val: 'circle', icon: '⬤' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.val}
                                                            onClick={() => updateGlobalConfig({ style: { ...alertsConfig.global.style, iconShape: opt.val } })}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                                (alertsConfig.global.style.iconShape || 'rounded') === opt.val
                                                                    ? 'bg-blue-500 text-white shadow-sm'
                                                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'
                                                            }`}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Layout Interno */}
                                <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#374151]">
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider block mb-3">
                                        Diseño Interno
                                    </label>
                                    
                                    <div className="space-y-4">
                                        {/* Dirección */}
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 mb-1">DIRECCIÓN</p>
                                            <div className="flex bg-white dark:bg-[#1a1a1a] rounded-lg border border-[#e2e8f0] dark:border-[#374151] p-1">
                                                {[
                                                    { val: 'column', label: '⬇️ Vertical', title: 'Icono Arriba' },
                                                    { val: 'row', label: '➡️ Horiz.', title: 'Icono Izquierda' },
                                                    { val: 'row-reverse', label: '⬅️ Horiz. Inv.', title: 'Icono Derecha' },
                                                    { val: 'column-reverse', label: '⬆️ Vert. Inv.', title: 'Icono Abajo' }
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.val}
                                                        onClick={() => updateGlobalConfig({ style: { ...alertsConfig.global.style, layout: opt.val } })}
                                                        title={opt.title}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                            (alertsConfig.global.style.layout || 'column') === opt.val
                                                                ? 'bg-blue-500 text-white shadow-sm'
                                                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Alineación */}
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-500 mb-1">ALINEACIÓN</p>
                                                <div className="flex bg-white dark:bg-[#1a1a1a] rounded-lg border border-[#e2e8f0] dark:border-[#374151] p-1">
                                                    {[
                                                        { val: 'start', icon: '├' },
                                                        { val: 'center', icon: '┼' },
                                                        { val: 'end', icon: '┤' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.val}
                                                            onClick={() => updateGlobalConfig({ style: { ...alertsConfig.global.style, align: opt.val } })}
                                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                                (alertsConfig.global.style.align || 'center') === opt.val
                                                                    ? 'bg-blue-500 text-white shadow-sm'
                                                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]'
                                                            }`}
                                                        >
                                                            {opt.icon}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Espaciado */}
                                            <div>
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-[10px] font-bold text-gray-500">ESPACIADO (Gap)</p>
                                                    <span className="text-[10px] font-mono text-gray-400">{alertsConfig.global.style.gap || 10}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="50"
                                                    value={alertsConfig.global.style.gap || 10}
                                                    onChange={(e) => updateGlobalConfig({ style: { ...alertsConfig.global.style, gap: Number(e.target.value) } })}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Volumen Master */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
                                            <Volume2 className="w-3 h-3" /> VOLUMEN MASTER
                                        </label>
                                        <span className="text-xs font-mono text-[#1e293b] dark:text-[#f8fafc]">{alertsConfig.globalVolume ?? 100}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={alertsConfig.globalVolume ?? 100}
                                        onChange={(e) => onAlertsConfigChange({ globalVolume: Number(e.target.value) })}
                                        className="w-full accent-[#64748b]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. CONFIGURACIÓN AVANZADA DEL EVENTO (Lo específico va abajo) */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-sm space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                            <div>
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                    <span className="text-lg">{eventTypes.find(e => e.type === selectedEvent)?.icon}</span>
                                    Configuración Avanzada de {eventTypes.find(e => e.type === selectedEvent)?.label}
                                </h3>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    Si desactivas esto, se usará el estilo global sin multimedia específica.
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={currentCategory?.enabled ?? false}
                                onChange={(c) => toggleEventCategory(selectedEvent, c)}
                            />
                        </div>

                        {/* SOLO MOSTRAMOS SI ESTÁ HABILITADO */}
                        {currentCategory?.enabled && (
                            <div className="space-y-6">
                                {/* Fila 1: Mensaje y Duración */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            MENSAJE PERSONALIZADO
                                        </label>
                                        <input
                                            type="text"
                                            value={currentDefaultConfig.message || ''}
                                            onChange={(e) => updateEventDefaultConfig(selectedEvent, { message: e.target.value })}
                                            placeholder="Ej: ¡{userName} ha enviado {amount} bits!"
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm text-[#1e293b] dark:text-[#f8fafc]"
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-500 font-mono">{'{}'} userName</span>
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-500 font-mono">{'{}'} amount</span>
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-500 font-mono">{'{}'} time</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">DURACIÓN (Segundos)</label>
                                            <span className="text-xs font-mono text-[#1e293b] dark:text-[#f8fafc]">
                                                {currentDefaultConfig.duration ? `${currentDefaultConfig.duration / 1000}s` : 'Global'}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="30"
                                            value={currentDefaultConfig.duration ? currentDefaultConfig.duration / 1000 : 0}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                updateEventDefaultConfig(selectedEvent, { duration: val === 0 ? null : val * 1000 });
                                            }}
                                            className="w-full accent-[#64748b]"
                                        />
                                        <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8] mt-1 text-right">
                                            0 = Usar configuración global
                                        </p>
                                    </div>
                                </div>

                                {/* Fila 2: Icono Custom */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        ICONO / IMAGEN
                                    </label>
                                    <div className="flex gap-4">
                                        <div className="w-1/4">
                                            <input
                                                type="text"
                                                value={currentDefaultConfig.icon || ''}
                                                onChange={(e) => updateEventDefaultConfig(selectedEvent, { icon: e.target.value })}
                                                placeholder="Emoji"
                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-center text-lg"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={currentDefaultConfig.customIcon || ''}
                                                onChange={(e) => updateEventDefaultConfig(selectedEvent, { customIcon: e.target.value })}
                                                placeholder="URL de imagen o GIF"
                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fila 3: MEDIA PROFESIONAL (MediaEditor) */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
                                        CONFIGURACIÓN DE MEDIA (AUDIO/VIDEO)
                                    </label>
                                    <MediaEditor
                                        config={currentDefaultConfig.media}
                                        onChange={(mediaUpdates) => updateEventDefaultConfig(selectedEvent, { media: mediaUpdates })}
                                    />
                                </div>

                                {/* Fila 4: TTS (Text-to-Speech) */}
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
                                        TEXT-TO-SPEECH (TTS)
                                    </label>
                                    <TtsSection
                                        config={currentDefaultConfig.tts || DEFAULT_TTS_CONFIG}
                                        onChange={(ttsUpdates) => updateEventDefaultConfig(selectedEvent, {
                                            tts: { ...(currentDefaultConfig.tts || DEFAULT_TTS_CONFIG), ...ttsUpdates }
                                        })}
                                        messageVariables={
                                            selectedEvent === 'tips' ? '{userName}, {amount}, {message}' :
                                            selectedEvent === 'bits' ? '{userName}, {amount}' :
                                            selectedEvent === 'raid' ? '{userName}, {amount} (viewers)' :
                                            selectedEvent === 'gift' ? '{userName}, {amount} (subs)' :
                                            selectedEvent === 'hypetrain' ? '{amount} (nivel)' :
                                            '{userName}'
                                        }
                                        hasUserMessage={['bits', 'tips'].includes(selectedEvent)}
                                        suggestedTemplate={currentDefaultConfig.tts?.template || ''}
                                        eventType={selectedEvent}
                                    />
                                </div>

                                {/* Sección de Variantes (GESTOR COMPLETO) */}
                                <div className="mt-8 pt-6 border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            <Layers className="w-4 h-4" /> Reglas Avanzadas (Variantes)
                                        </h4>
                                    </div>
                                    
                                    <VariantManager 
                                        eventType={selectedEvent}
                                        variants={currentCategory?.variants || []}
                                        onChange={(newVariants) => updateEventVariants(selectedEvent, newVariants)}
                                    />
                                </div>

                            </div>
                        )}
                    </div>

                    {/* 5. Área de Pruebas (MEJORADA Y DINÁMICA) */}
                    <div className="border border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="p-2 bg-[#f1f5f9] dark:bg-[#334155] rounded-lg">
                                <Play className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Prueba Rápida</h4>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Simula este evento en el overlay</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                            <input
                                type="text"
                                value={testUsername}
                                onChange={(e) => setTestUsername(e.target.value)}
                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-28"
                                placeholder="Usuario"
                            />
                            
                            {/* Inputs Condicionales según el evento */}
                            {selectedEvent === 'sub' && (
                                <>
                                    <select
                                        value={testTier}
                                        onChange={(e) => setTestTier(e.target.value)}
                                        className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-24"
                                    >
                                        <option value="Prime">Prime</option>
                                        <option value="1000">Tier 1</option>
                                        <option value="2000">Tier 2</option>
                                        <option value="3000">Tier 3</option>
                                    </select>
                                    <input
                                        type="number"
                                        min="1"
                                        value={testMonths}
                                        onChange={(e) => setTestMonths(Number(e.target.value))}
                                        className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-16"
                                        placeholder="Meses"
                                    />
                                </>
                            )}

                            {['bits', 'gift', 'raid'].includes(selectedEvent) && (
                                <input
                                    type="number"
                                    value={testAmount}
                                    onChange={(e) => setTestAmount(Number(e.target.value))}
                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-20"
                                    placeholder={selectedEvent === 'gift' ? 'Subs' : 'Cant.'}
                                />
                            )}

                            {selectedEvent === 'hypetrain' && (
                                <input
                                    type="number"
                                    value={testAmount}
                                    onChange={(e) => setTestAmount(Number(e.target.value))}
                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-20"
                                    placeholder="Nivel"
                                />
                            )}

                            {selectedEvent === 'tips' && (
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    value={testAmount}
                                    onChange={(e) => setTestAmount(Number(e.target.value))}
                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-xs w-20"
                                    placeholder="$USD"
                                />
                            )}

                            <label 
                                title="¡Cuidado! Si activas esto, se sumará tiempo REAL al timer aunque no estés en directo."
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                                    testAddTime 
                                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
                                        : 'bg-[#f8fafc] dark:bg-[#262626] border-[#e2e8f0] dark:border-[#374151]'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={testAddTime}
                                    onChange={(e) => setTestAddTime(e.target.checked)}
                                    className="rounded text-orange-500 focus:ring-orange-500 w-3 h-3"
                                />
                                <span className={`text-[10px] font-bold ${testAddTime ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}`}>
                                    +Real
                                </span>
                            </label>

                            <button
                                onClick={handleTestEvent}
                                disabled={isTesting}
                                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-all flex items-center gap-2 ${
                                    testStatus?.type === 'success' ? 'bg-green-500' :
                                    testStatus?.type === 'error' ? 'bg-red-500' :
                                    testAddTime ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#64748b] hover:bg-[#475569]'
                                }`}
                            >
                                {testStatus ? (
                                    <>
                                        {testStatus.type === 'success' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {testStatus.text}
                                    </>
                                ) : (
                                    'Enviar'
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AlertsTab;