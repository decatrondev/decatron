import {
    Save, ArrowLeft, Clock, Type, Palette, Layout as LayoutIcon,
    AlertCircle, CheckCircle,
    RotateCcw, Bug, Zap, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import type { TextLine, StyleConfig, LayoutConfig, TabType, DragElement } from './shoutout-extension/types';
import {
    DEFAULT_DURATION, DEFAULT_COOLDOWN, DEFAULT_TEXT_LINES, DEFAULT_STYLES, DEFAULT_LAYOUT,
    DEFAULT_ANIMATION_TYPE, DEFAULT_ANIMATION_SPEED,
    DEFAULT_TEXT_OUTLINE_ENABLED, DEFAULT_TEXT_OUTLINE_COLOR, DEFAULT_TEXT_OUTLINE_WIDTH,
    DEFAULT_CONTAINER_BORDER_ENABLED, DEFAULT_CONTAINER_BORDER_COLOR, DEFAULT_CONTAINER_BORDER_WIDTH
} from './shoutout-extension/constants/defaults';
import { BasicTab, TypographyTab, BackgroundTab, LayoutTab, AnimationsTab, ManagementTab, DebugTab } from './shoutout-extension/components/tabs';
import { PreviewPanel } from './shoutout-extension/components/PreviewPanel';

export default function ShoutoutConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('basic');
    const previewRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Drag & Drop state
    const [isDragging, setIsDragging] = useState(false);
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Configuration state
    const [duration, setDuration] = useState(DEFAULT_DURATION);
    const [cooldown, setCooldown] = useState(DEFAULT_COOLDOWN);
    const [showDebugTimer, setShowDebugTimer] = useState(false);
    const [testing, setTesting] = useState(false);

    // Animation & Effects state
    const [animationType, setAnimationType] = useState(DEFAULT_ANIMATION_TYPE);
    const [animationSpeed, setAnimationSpeed] = useState(DEFAULT_ANIMATION_SPEED);
    const [textOutlineEnabled, setTextOutlineEnabled] = useState(DEFAULT_TEXT_OUTLINE_ENABLED);
    const [textOutlineColor, setTextOutlineColor] = useState(DEFAULT_TEXT_OUTLINE_COLOR);
    const [textOutlineWidth, setTextOutlineWidth] = useState(DEFAULT_TEXT_OUTLINE_WIDTH);
    const [containerBorderEnabled, setContainerBorderEnabled] = useState(DEFAULT_CONTAINER_BORDER_ENABLED);
    const [containerBorderColor, setContainerBorderColor] = useState(DEFAULT_CONTAINER_BORDER_COLOR);
    const [containerBorderWidth, setContainerBorderWidth] = useState(DEFAULT_CONTAINER_BORDER_WIDTH);

    // Lists state
    const [blacklist, setBlacklist] = useState<string[]>([]);
    const [whitelist, setWhitelist] = useState<string[]>([]);
    const [textLines, setTextLines] = useState<TextLine[]>([...DEFAULT_TEXT_LINES]);
    const [styles, setStyles] = useState<StyleConfig>({ ...DEFAULT_STYLES });
    const [layout, setLayout] = useState<LayoutConfig>(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));

    const [overlayUrl, setOverlayUrl] = useState('');

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            loadConfiguration();
            loadFrontendInfo();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            const res = await api.get('/shoutout/config');
            if (res.data.success && res.data.config) {
                const config = res.data.config;
                setDuration(config.duration || DEFAULT_DURATION);
                setCooldown(config.cooldown || DEFAULT_COOLDOWN);
                setShowDebugTimer(config.showDebugTimer || false);

                // Animation & Effects
                setAnimationType(config.animationType || DEFAULT_ANIMATION_TYPE);
                setAnimationSpeed(config.animationSpeed || DEFAULT_ANIMATION_SPEED);
                setTextOutlineEnabled(config.textOutlineEnabled || DEFAULT_TEXT_OUTLINE_ENABLED);
                setTextOutlineColor(config.textOutlineColor || DEFAULT_TEXT_OUTLINE_COLOR);
                setTextOutlineWidth(config.textOutlineWidth || DEFAULT_TEXT_OUTLINE_WIDTH);
                setContainerBorderEnabled(config.containerBorderEnabled || DEFAULT_CONTAINER_BORDER_ENABLED);
                setContainerBorderColor(config.containerBorderColor || DEFAULT_CONTAINER_BORDER_COLOR);
                setContainerBorderWidth(config.containerBorderWidth || DEFAULT_CONTAINER_BORDER_WIDTH);

                // Lists
                setBlacklist(config.blacklist || []);
                setWhitelist(config.whitelist || []);

                if (config.textLines && Array.isArray(config.textLines)) {
                    setTextLines(config.textLines);
                }
                if (config.styles) {
                    setStyles({ ...styles, ...config.styles });
                }
                if (config.layout) {
                    setLayout({ ...layout, ...config.layout });
                }
            }
        } catch (error) {
            console.error('Error loading shoutout configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFrontendInfo = async () => {
        try {
            const res = await api.get('/settings/frontend-info');
            if (res.data.success) {
                const { frontendUrl, channel } = res.data;
                setOverlayUrl(`${frontendUrl}/overlay/shoutout?channel=${channel.login}`);
            }
        } catch (error) {
            console.error('Error loading frontend info:', error);
            // Fallback to default
            setOverlayUrl(`${window.location.origin}/overlay/shoutout?channel=channel`);
        }
    };

    const handleSave = async () => {
        if (duration < 5 || duration > 30) {
            setSaveMessage({ type: 'error', text: 'La duración debe estar entre 5 y 30 segundos' });
            return;
        }

        if (cooldown < 10 || cooldown > 300) {
            setSaveMessage({ type: 'error', text: 'El cooldown debe estar entre 10 y 300 segundos' });
            return;
        }

        try {
            setSaving(true);
            setSaveMessage(null);

            await api.post('/shoutout/config', {
                duration,
                cooldown,
                showDebugTimer,
                textLines,
                styles,
                layout,
                animationType,
                animationSpeed,
                textOutlineEnabled,
                textOutlineColor,
                textOutlineWidth,
                containerBorderEnabled,
                containerBorderColor,
                containerBorderWidth,
                blacklist,
                whitelist
            });

            setSaveMessage({ type: 'success', text: 'Configuración guardada exitosamente' });

            setTimeout(() => {
                setSaveMessage(null);
            }, 3000);
        } catch (error) {
            const message = error instanceof Error && 'response' in error
                ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al guardar la configuración'
                : 'Error al guardar la configuración';
            setSaveMessage({ type: 'error', text: message });
        } finally {
            setSaving(false);
        }
    };

    // Helper para guardar solo las listas (auto-guardado)
    const saveListsOnly = async (newBlacklist: string[], newWhitelist: string[]) => {
        try {
            await api.post('/shoutout/config', {
                duration,
                cooldown,
                showDebugTimer,
                textLines,
                styles,
                layout,
                animationType,
                animationSpeed,
                textOutlineEnabled,
                textOutlineColor,
                textOutlineWidth,
                containerBorderEnabled,
                containerBorderColor,
                containerBorderWidth,
                blacklist: newBlacklist,
                whitelist: newWhitelist
            });
        } catch (error) {
            console.error('Error al auto-guardar listas:', error);
            setSaveMessage({ type: 'error', text: 'Error al guardar la lista' });
            setTimeout(() => setSaveMessage(null), 3000);
        }
    };

    // Funciones para manejar blacklist con auto-guardado
    const addToBlacklist = async (username: string) => {
        const newBlacklist = [...blacklist, username];
        setBlacklist(newBlacklist);
        await saveListsOnly(newBlacklist, whitelist);
    };

    const removeFromBlacklist = async (index: number) => {
        const newBlacklist = blacklist.filter((_, i) => i !== index);
        setBlacklist(newBlacklist);
        await saveListsOnly(newBlacklist, whitelist);
    };

    // Funciones para manejar whitelist con auto-guardado
    const addToWhitelist = async (username: string) => {
        const newWhitelist = [...whitelist, username];
        setWhitelist(newWhitelist);
        await saveListsOnly(blacklist, newWhitelist);
    };

    const removeFromWhitelist = async (index: number) => {
        const newWhitelist = whitelist.filter((_, i) => i !== index);
        setWhitelist(newWhitelist);
        await saveListsOnly(blacklist, newWhitelist);
    };

    const handleTestShoutout = async () => {
        try {
            setTesting(true);
            await api.post('/shoutout/test');
            setSaveMessage({ type: 'success', text: '🧪 Shoutout de prueba enviado al overlay' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            const message = error instanceof Error && 'response' in error
                ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al enviar shoutout de prueba'
                : 'Error al enviar shoutout de prueba';
            setSaveMessage({ type: 'error', text: message });
        } finally {
            setTesting(false);
        }
    };

    const handleReset = () => {
        if (!confirm('¿Estás seguro de restaurar la configuración por defecto?')) return;

        setDuration(DEFAULT_DURATION);
        setCooldown(DEFAULT_COOLDOWN);
        setShowDebugTimer(false);
        setAnimationType(DEFAULT_ANIMATION_TYPE);
        setAnimationSpeed(DEFAULT_ANIMATION_SPEED);
        setTextOutlineEnabled(DEFAULT_TEXT_OUTLINE_ENABLED);
        setTextOutlineColor(DEFAULT_TEXT_OUTLINE_COLOR);
        setTextOutlineWidth(DEFAULT_TEXT_OUTLINE_WIDTH);
        setContainerBorderEnabled(DEFAULT_CONTAINER_BORDER_ENABLED);
        setContainerBorderColor(DEFAULT_CONTAINER_BORDER_COLOR);
        setContainerBorderWidth(DEFAULT_CONTAINER_BORDER_WIDTH);
        setBlacklist([]);
        setWhitelist([]);
        setTextLines([...DEFAULT_TEXT_LINES]);
        setStyles({ ...DEFAULT_STYLES });
        setLayout(JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
    };

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(overlayUrl);
            setSaveMessage({ type: 'success', text: 'URL copiada al portapapeles' });
            setTimeout(() => setSaveMessage(null), 2000);
        } catch {
            setSaveMessage({ type: 'error', text: 'Error al copiar URL' });
        }
    };

    const handleOpenBrowser = () => {
        window.open(overlayUrl, '_blank');
    };

    const addTextLine = () => {
        setTextLines([...textLines, { text: 'Nueva línea de texto', fontSize: 24, fontWeight: '600', enabled: true }]);
    };

    const updateTextLine = (index: number, field: keyof TextLine, value: TextLine[keyof TextLine]) => {
        const newTextLines = [...textLines];
        newTextLines[index] = { ...newTextLines[index], [field]: value };
        setTextLines(newTextLines);
    };

    const removeTextLine = (index: number) => {
        if (textLines.length <= 1) {
            setSaveMessage({ type: 'error', text: 'Debe haber al menos una línea de texto' });
            setTimeout(() => setSaveMessage(null), 2000);
            return;
        }
        setTextLines(textLines.filter((_, i) => i !== index));
    };

    const toggleTextLine = (index: number) => {
        updateTextLine(index, 'enabled', !textLines[index].enabled);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">Cargando...</div>;
    }

    if (!hasMinimumLevel('moderation')) {
        navigate('/dashboard');
        return null;
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f1419] py-4 sm:py-6 lg:py-8">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
                {/* Header - Responsive */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/overlays')}
                            className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                                Configuración de Shoutouts
                            </h1>
                            <p className="text-sm sm:text-base text-[#64748b] dark:text-[#94a3b8] mt-1">
                                Personaliza tu overlay de shoutouts con control visual completo
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={handleReset}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Resetear
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {saveMessage && (
                    <div className={`rounded-xl border p-4 ${
                        saveMessage.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                        <div className="flex items-start gap-3">
                            {saveMessage.type === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <p className={`font-bold ${
                                saveMessage.type === 'success'
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-red-700 dark:text-red-300'
                            }`}>
                                {saveMessage.text}
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Content Grid - Responsive mejorado */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                    {/* Left Column: Configuration - 2/3 en XL+, full en mobile/tablet */}
                    <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                        {/* Tabs Navigation */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-2 shadow-lg">
                            <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveTab('basic')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'basic'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Clock className="w-4 h-4" />
                                Básico
                            </button>
                            <button
                                onClick={() => setActiveTab('typography')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'typography'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Type className="w-4 h-4" />
                                Tipografía
                            </button>
                            <button
                                onClick={() => setActiveTab('background')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'background'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Palette className="w-4 h-4" />
                                Fondo
                            </button>
                            <button
                                onClick={() => setActiveTab('layout')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'layout'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <LayoutIcon className="w-4 h-4" />
                                Layout
                            </button>
                            <button
                                onClick={() => setActiveTab('animations')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'animations'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Zap className="w-4 h-4" />
                                Animaciones
                            </button>
                            <button
                                onClick={() => setActiveTab('management')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'management'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Shield className="w-4 h-4" />
                                Gestión
                            </button>
                            <button
                                onClick={() => setActiveTab('debug')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'debug'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Bug className="w-4 h-4" />
                                Debug
                            </button>
                        </div>
                    </div>

                    {activeTab === 'basic' && (
                        <BasicTab
                            duration={duration}
                            setDuration={setDuration}
                            cooldown={cooldown}
                            setCooldown={setCooldown}
                            textLines={textLines}
                            addTextLine={addTextLine}
                            updateTextLine={updateTextLine}
                            removeTextLine={removeTextLine}
                            toggleTextLine={toggleTextLine}
                        />
                    )}

                    {activeTab === 'typography' && (
                        <TypographyTab styles={styles} setStyles={setStyles} />
                    )}

                    {activeTab === 'background' && (
                        <BackgroundTab styles={styles} setStyles={setStyles} />
                    )}

                    {activeTab === 'layout' && (
                        <LayoutTab
                            layout={layout}
                            setLayout={setLayout}
                            canvasRef={canvasRef}
                            isDragging={isDragging}
                            setIsDragging={setIsDragging}
                            dragElement={dragElement}
                            setDragElement={setDragElement}
                            dragOffset={dragOffset}
                            setDragOffset={setDragOffset}
                        />
                    )}

                    {activeTab === 'animations' && (
                        <AnimationsTab
                            animationType={animationType}
                            setAnimationType={setAnimationType}
                            animationSpeed={animationSpeed}
                            setAnimationSpeed={setAnimationSpeed}
                            textOutlineEnabled={textOutlineEnabled}
                            setTextOutlineEnabled={setTextOutlineEnabled}
                            textOutlineColor={textOutlineColor}
                            setTextOutlineColor={setTextOutlineColor}
                            textOutlineWidth={textOutlineWidth}
                            setTextOutlineWidth={setTextOutlineWidth}
                            containerBorderEnabled={containerBorderEnabled}
                            setContainerBorderEnabled={setContainerBorderEnabled}
                            containerBorderColor={containerBorderColor}
                            setContainerBorderColor={setContainerBorderColor}
                            containerBorderWidth={containerBorderWidth}
                            setContainerBorderWidth={setContainerBorderWidth}
                            testing={testing}
                            handleTestShoutout={handleTestShoutout}
                        />
                    )}

                    {activeTab === 'management' && (
                        <ManagementTab
                            blacklist={blacklist}
                            whitelist={whitelist}
                            addToBlacklist={addToBlacklist}
                            removeFromBlacklist={removeFromBlacklist}
                            addToWhitelist={addToWhitelist}
                            removeFromWhitelist={removeFromWhitelist}
                        />
                    )}

                    {activeTab === 'debug' && (
                        <DebugTab
                            showDebugTimer={showDebugTimer}
                            setShowDebugTimer={setShowDebugTimer}
                            testing={testing}
                            handleTestShoutout={handleTestShoutout}
                        />
                    )}
                </div>

                {/* Right Column: Preview & Info */}
                <PreviewPanel
                    previewRef={previewRef}
                    styles={styles}
                    layout={layout}
                    textLines={textLines}
                    duration={duration}
                    cooldown={cooldown}
                    showDebugTimer={showDebugTimer}
                    textOutlineEnabled={textOutlineEnabled}
                    textOutlineColor={textOutlineColor}
                    textOutlineWidth={textOutlineWidth}
                    containerBorderEnabled={containerBorderEnabled}
                    containerBorderColor={containerBorderColor}
                    containerBorderWidth={containerBorderWidth}
                    overlayUrl={overlayUrl}
                    handleCopyUrl={handleCopyUrl}
                    handleOpenBrowser={handleOpenBrowser}
                />
            </div>
            </div>
        </div>
    );
}
