import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Save, Volume2, AlertCircle, CheckCircle, Gift,
    Type, Palette, LayoutIcon as Layout, Zap, Clock, Plus, Eye, EyeOff,
    Trash2, Upload, Monitor, Copy, ExternalLink, Play, RotateCcw,
    Music, Video, Image as ImageIcon
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../services/api';
import type {
    ChannelPointsReward, SoundFile, TextLine, Styles,
    Layout as LayoutType, TabType, DragElement
} from './sound-alerts-extension/types';
import {
    BasicTab,
    TypographyTab,
    BackgroundTab,
    LayoutTab,
    AnimationsTab,
    RewardsTab,
    PreviewPanel,
    FileSelectionModal,
} from './sound-alerts-extension/components/tabs';

export default function SoundAlerts() {
    const navigate = useNavigate();
    const { t } = useTranslation('features');
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const previewRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // Estados
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Datos
    const [rewards, setRewards] = useState<ChannelPointsReward[]>([]);
    const [files, setFiles] = useState<SoundFile[]>([]);
    const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
    const [systemFiles, setSystemFiles] = useState<any[]>([]);
    const [showFileDialog, setShowFileDialog] = useState(false);
    const [selectedRewardForFile, setSelectedRewardForFile] = useState<ChannelPointsReward | null>(null);

    // Modal para subir audio + imagen
    const [showAudioImageModal, setShowAudioImageModal] = useState(false);
    const [pendingAudioUpload, setPendingAudioUpload] = useState<{
        rewardId: string;
        rewardTitle: string;
        audioFile: File;
    } | null>(null);
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

    // Configuración
    const [globalVolume, setGlobalVolume] = useState(70);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [duration, setDuration] = useState(10);
    const [textLines, setTextLines] = useState<TextLine[]>([
        { text: '@redeemer canjeó @reward', fontSize: 24, fontWeight: 'bold', enabled: false },
        { text: '¡Gracias por el apoyo!', fontSize: 18, fontWeight: '600', enabled: false }
    ]);
    const [styles, setStyles] = useState<Styles>({
        fontFamily: 'Inter',
        fontSize: 24,
        textColor: '#ffffff',
        textShadow: 'normal',
        backgroundType: 'transparent',
        gradientColor1: '#667eea',
        gradientColor2: '#764ba2',
        gradientAngle: 135,
        solidColor: '#8b5cf6',
        backgroundOpacity: 100
    });
    const [layout, setLayout] = useState<LayoutType>({
        media: { x: 0, y: 0, width: 400, height: 400 },
        text: { x: 200, y: 420, align: 'center' }
    });
    const [animationType, setAnimationType] = useState('fade');
    const [animationSpeed, setAnimationSpeed] = useState('normal');
    const [textOutlineEnabled, setTextOutlineEnabled] = useState(false);
    const [textOutlineColor, setTextOutlineColor] = useState('#000000');
    const [textOutlineWidth, setTextOutlineWidth] = useState(2);
    const [cooldownMs, setCooldownMs] = useState(500);

    // Drag & Drop state
    const [isDragging, setIsDragging] = useState(false);
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // URL del overlay
    const [channelName, setChannelName] = useState('tu_canal');
    const overlayUrl = `${window.location.origin}/overlay/soundalerts?channel=${channelName}`;

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            loadAll();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    const loadAll = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadRewards(),
                loadConfiguration(),
                loadFiles(),
                loadSystemFiles()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRewards = async () => {
        try {
            const res = await api.get('/soundalerts/channel-points-rewards');
            if (res.data.success) {
                setRewards(res.data.rewards || []);
                if (res.data.channelName) {
                    setChannelName(res.data.channelName);
                }
            }
        } catch (error) {
            console.error('Error loading rewards:', error);
        }
    };

    const loadConfiguration = async () => {
        try {
            const res = await api.get('/soundalerts/config');
            console.log('🔍 [DEBUG] Respuesta completa del backend:', res.data);

            if (res.data.success && res.data.config) {
                const cfg = res.data.config;
                console.log('🔍 [DEBUG] Layout recibido del backend:', cfg.layout);
                console.log('🔍 [DEBUG] Tipo de layout:', typeof cfg.layout);

                setGlobalVolume(cfg.globalVolume);
                setGlobalEnabled(cfg.globalEnabled);
                setDuration(cfg.duration);
                setTextLines(cfg.textLines);
                setStyles(cfg.styles);

                // Parse layout if it's a string and validate structure
                let parsedLayout = cfg.layout;
                if (typeof cfg.layout === 'string') {
                    try {
                        parsedLayout = JSON.parse(cfg.layout);
                        console.log('🔍 [DEBUG] Layout parseado de string:', parsedLayout);
                    } catch (e) {
                        console.error('Error parsing layout:', e);
                        parsedLayout = null;
                    }
                } else {
                    console.log('🔍 [DEBUG] Layout ya es objeto:', parsedLayout);
                }

                // Validate layout structure and provide defaults if needed
                if (parsedLayout &&
                    typeof parsedLayout === 'object' &&
                    parsedLayout.media &&
                    typeof parsedLayout.media.x === 'number' &&
                    typeof parsedLayout.media.y === 'number' &&
                    parsedLayout.text &&
                    typeof parsedLayout.text.x === 'number' &&
                    typeof parsedLayout.text.y === 'number') {

                    // Asegurar que width y height existen, sino usar defaults
                    const completeLayout = {
                        media: {
                            x: parsedLayout.media.x,
                            y: parsedLayout.media.y,
                            width: parsedLayout.media.width ?? 200,
                            height: parsedLayout.media.height ?? 200
                        },
                        text: {
                            x: parsedLayout.text.x,
                            y: parsedLayout.text.y,
                            align: parsedLayout.text.align ?? 'center'
                        }
                    };
                    setLayout(completeLayout);
                } else {
                    console.warn('❌ Invalid layout structure, using defaults. Received:', parsedLayout);
                    console.warn('❌ parsedLayout.media:', parsedLayout?.media);
                    console.warn('❌ parsedLayout.text:', parsedLayout?.text);
                    // Keep the default layout initialized in useState
                }

                setAnimationType(cfg.animationType);
                setAnimationSpeed(cfg.animationSpeed);
                setTextOutlineEnabled(cfg.textOutlineEnabled);
                setTextOutlineColor(cfg.textOutlineColor);
                setTextOutlineWidth(cfg.textOutlineWidth);
                setCooldownMs(cfg.cooldownMs);
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    };

    const loadFiles = async () => {
        try {
            const res = await api.get('/soundalerts/files');
            if (res.data.success) {
                setFiles(res.data.files || []);
            }
        } catch (error) {
            console.error('Error loading files:', error);
        }
    };

    const handleSave = async () => {
        if (duration < 3 || duration > 30) {
            setSaveMessage({ type: 'error', text: t('soundAlerts.durationError') });
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        try {
            setSaving(true);

            const configData = {
                globalVolume,
                globalEnabled,
                duration,
                textLines,
                styles,
                layout,
                animationType,
                animationSpeed,
                textOutlineEnabled,
                textOutlineColor,
                textOutlineWidth,
                cooldownMs
            };

            await api.post('/soundalerts/config', configData);

            setSaveMessage({ type: 'success', text: t('soundAlerts.saveSuccess') });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error: any) {
            const message = error.response?.data?.message || t('soundAlerts.saveError');
            setSaveMessage({ type: 'error', text: message });
            console.error('🎵 [ERROR] Error guardando configuración:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (!confirm(t('soundAlerts.resetConfirm'))) return;

        setGlobalVolume(70);
        setGlobalEnabled(true);
        setDuration(10);
        setAnimationType('fade');
        setAnimationSpeed('normal');
        setTextOutlineEnabled(false);
        setTextOutlineColor('#000000');
        setTextOutlineWidth(2);
        setCooldownMs(500);
        setTextLines([
            { text: '@redeemer canjeó @reward', fontSize: 24, fontWeight: 'bold', enabled: true },
            { text: '¡Gracias por el apoyo!', fontSize: 18, fontWeight: '600', enabled: true }
        ]);
        setStyles({
            fontFamily: 'Inter',
            fontSize: 24,
            textColor: '#ffffff',
            textShadow: 'normal',
            backgroundType: 'transparent',
            gradientColor1: '#667eea',
            gradientColor2: '#764ba2',
            gradientAngle: 135,
            solidColor: '#8b5cf6',
            backgroundOpacity: 100
        });
        setLayout({
            media: { x: 100, y: 20, width: 200, height: 200 },
            text: { x: 200, y: 300, align: 'center' }
        });
    };

    const loadSystemFiles = async () => {
        try {
            const res = await api.get('/soundalerts/system-files');
            if (res.data.success) {
                setSystemFiles(res.data.files || []);
            }
        } catch (error) {
            console.error('Error loading system files:', error);
        }
    };

    const handleTestAlert = async () => {
        try {
            setTesting(true);
            const res = await api.post('/soundalerts/test');
            if (res.data.success) {
                setSaveMessage({ type: 'success', text: t('soundAlerts.testSuccess') });
                setTimeout(() => setSaveMessage(null), 3000);
            }
        } catch (error: any) {
            const message = error.response?.data?.message || t('soundAlerts.testError');
            setSaveMessage({ type: 'error', text: message });
            setTimeout(() => setSaveMessage(null), 3000);
        } finally {
            setTesting(false);
        }
    };

    const handleAssignSystemFile = async (systemFile: any) => {
        if (!selectedRewardForFile) return;

        try {
            setUploading({ ...uploading, [selectedRewardForFile.id]: true });

            await api.post('/soundalerts/assign-system-file', {
                rewardId: selectedRewardForFile.id,
                rewardTitle: selectedRewardForFile.title,
                systemFilePath: systemFile.path,
                systemFileName: systemFile.name,
                fileType: systemFile.type
            });

            setSaveMessage({ type: 'success', text: t('soundAlerts.systemFileAssigned', { name: systemFile.name }) });
            setTimeout(() => setSaveMessage(null), 3000);
            await loadFiles();
            setShowFileDialog(false);
            setSelectedRewardForFile(null);
        } catch (error: any) {
            const message = error.response?.data?.message || t('soundAlerts.systemFileError');
            setSaveMessage({ type: 'error', text: message });
        } finally {
            setUploading({ ...uploading, [selectedRewardForFile.id]: false });
        }
    };

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(overlayUrl);
            setSaveMessage({ type: 'success', text: t('soundAlerts.urlCopied') });
            setTimeout(() => setSaveMessage(null), 2000);
        } catch {
            setSaveMessage({ type: 'error', text: t('soundAlerts.urlCopyError') });
        }
    };

    const handleOpenBrowser = () => {
        window.open(overlayUrl, '_blank');
    };

    const addTextLine = () => {
        setTextLines([...textLines, { text: t('soundAlerts.newTextLine'), fontSize: 24, fontWeight: '600', enabled: true }]);
    };

    const updateTextLine = (index: number, field: keyof TextLine, value: TextLine[keyof TextLine]) => {
        if (!textLines || index < 0 || index >= textLines.length) {
            console.error('Invalid textLines index:', index);
            return;
        }
        const newTextLines = [...textLines];
        newTextLines[index] = { ...newTextLines[index], [field]: value };
        setTextLines(newTextLines);
    };

    const removeTextLine = (index: number) => {
        if (textLines.length <= 1) {
            setSaveMessage({ type: 'error', text: t('soundAlerts.minTextLine') });
            setTimeout(() => setSaveMessage(null), 2000);
            return;
        }
        setTextLines(textLines.filter((_, i) => i !== index));
    };

    const toggleTextLine = (index: number) => {
        if (!textLines || index < 0 || index >= textLines.length) {
            console.error('Invalid textLines index in toggleTextLine:', index);
            return;
        }
        updateTextLine(index, 'enabled', !textLines[index].enabled);
    };

    const getPreviewBackground = () => {
        if (styles.backgroundType === 'transparent') {
            return 'transparent';
        } else if (styles.backgroundType === 'solid') {
            return `rgba(${hexToRgb(styles.solidColor)}, ${styles.backgroundOpacity / 100})`;
        } else {
            return `linear-gradient(${styles.gradientAngle}deg, ${styles.gradientColor1}, ${styles.gradientColor2})`;
        }
    };

    const hexToRgb = (hex: string): string => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '139, 92, 246';
    };

    const getTextShadowStyle = (shadow: string): string => {
        switch (shadow) {
            case 'normal': return '2px 2px 4px rgba(0,0,0,0.5)';
            case 'strong': return '3px 3px 6px rgba(0,0,0,0.8)';
            case 'glow': return '0 0 10px rgba(255,255,255,0.8)';
            default: return 'none';
        }
    };

    // Drag & Drop Functions
    const handleMouseDown = (element: DragElement, e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragElement(element);

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const canvas = canvasRef.current?.getBoundingClientRect();

        if (canvas) {
            const scale = canvas.width / 400;

            // Para ambos elementos, calcular el offset desde la esquina superior izquierda
            setDragOffset({
                x: (e.clientX - rect.left) / scale,
                y: (e.clientY - rect.top) / scale
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragElement || !canvasRef.current) return;

        const canvas = canvasRef.current.getBoundingClientRect();
        const scale = canvas.width / 400;

        // Calcular posición relativa al canvas
        const canvasX = (e.clientX - canvas.left) / scale;
        const canvasY = (e.clientY - canvas.top) / scale;

        if (dragElement === 'media') {
            const x = Math.max(0, Math.min(400 - layout.media.width, canvasX - dragOffset.x));
            const y = Math.max(0, Math.min(450 - layout.media.height, canvasY - dragOffset.y));

            setLayout(prev => ({
                ...prev,
                media: { ...prev.media, x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'text') {
            // Para texto, simplemente usar la posición directa (sin límites de ancho/alto)
            const x = Math.max(0, Math.min(400, canvasX - dragOffset.x));
            const y = Math.max(0, Math.min(450, canvasY - dragOffset.y));

            setLayout(prev => ({
                ...prev,
                text: { ...prev.text, x: Math.round(x), y: Math.round(y) }
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragElement(null);
    };

    const handleFileUpload = async (rewardId: string, rewardTitle: string, file: File, fileType: string, imageFile?: File) => {
        try {
            setUploading({ ...uploading, [rewardId]: true });

            // Obtener duración del archivo (simplificado, en producción usar library como MediaInfo)
            let duration = 0;
            if (fileType === 'sound' || fileType === 'video') {
                const mediaElement = document.createElement(fileType === 'sound' ? 'audio' : 'video');
                const fileUrl = URL.createObjectURL(file);

                await new Promise<void>((resolve) => {
                    mediaElement.onloadedmetadata = () => {
                        duration = mediaElement.duration;
                        URL.revokeObjectURL(fileUrl);
                        resolve();
                    };
                    mediaElement.src = fileUrl;
                });
            }

            const formData = new FormData();
            formData.append('File', file);
            formData.append('RewardId', rewardId);
            formData.append('RewardTitle', rewardTitle);
            formData.append('FileType', fileType);
            formData.append('DurationSeconds', duration.toString());

            // Agregar imagen si se proporcionó (para archivos de audio)
            if (imageFile) {
                formData.append('ImageFile', imageFile);
            }

            await api.post('/soundalerts/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSaveMessage({ type: 'success', text: t('soundAlerts.fileUploaded', { name: file.name }) });
            setTimeout(() => setSaveMessage(null), 3000);
            await loadFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || t('soundAlerts.fileUploadError');
            setSaveMessage({ type: 'error', text: message });
        } finally {
            setUploading({ ...uploading, [rewardId]: false });
        }
    };

    const handleDeleteFile = async (rewardId: string) => {
        if (!confirm(t('soundAlerts.deleteConfirm'))) return;

        try {
            await api.delete(`/soundalerts/file/${rewardId}`);
            setSaveMessage({ type: 'success', text: t('soundAlerts.fileDeleted') });
            setTimeout(() => setSaveMessage(null), 3000);
            await loadFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || t('soundAlerts.fileDeleteError');
            setSaveMessage({ type: 'error', text: message });
        }
    };

    const handleToggleFile = async (rewardId: string) => {
        try {
            await api.patch(`/soundalerts/file/${rewardId}/toggle`);
            await loadFiles();
        } catch (error) {
            console.error('Error toggling file:', error);
        }
    };

    const getRewardFile = (rewardId: string) => {
        return files.find(f => f.rewardId === rewardId);
    };

    if (permissionsLoading || loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">{t('soundAlerts.loading')}</div>;
    }

    if (!hasMinimumLevel('moderation')) {
        navigate('/dashboard');
        return null;
    }

    return (
        <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {t('soundAlerts.title')}
                        </h1>
                        <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {t('soundAlerts.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                    >
                        <RotateCcw className="w-4 h-4" />
                        {t('soundAlerts.reset')}
                    </button>
                    <button
                        onClick={handleTestAlert}
                        disabled={testing}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-all"
                        title="Envía una alerta de prueba al overlay"
                    >
                        <Play className="w-4 h-4" />
                        {testing ? t('soundAlerts.sending') : t('soundAlerts.test')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-[#2563eb] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? t('soundAlerts.saving') : t('soundAlerts.save')}
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

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Configuration (2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs Navigation */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-2 shadow-lg">
                        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                            <button
                                onClick={() => setActiveTab('basic')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'basic'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Clock className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.basic')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('typography')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'typography'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Type className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.text')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('background')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'background'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Palette className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.background')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('layout')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'layout'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Layout className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.layout')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('animations')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'animations'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Zap className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.animation')}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('rewards')}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'rewards'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Gift className="w-4 h-4" />
                                <span className="hidden lg:inline">{t('soundAlerts.tabs.files')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab: Básico */}
                    {activeTab === 'basic' && (
                        <BasicTab
                            globalVolume={globalVolume}
                            setGlobalVolume={setGlobalVolume}
                            globalEnabled={globalEnabled}
                            setGlobalEnabled={setGlobalEnabled}
                            duration={duration}
                            setDuration={setDuration}
                            textLines={textLines}
                            addTextLine={addTextLine}
                            updateTextLine={updateTextLine}
                            removeTextLine={removeTextLine}
                            toggleTextLine={toggleTextLine}
                        />
                    )}

                    {/* Tab: Tipografía */}
                    {activeTab === 'typography' && (
                        <TypographyTab
                            styles={styles}
                            setStyles={setStyles}
                            textOutlineEnabled={textOutlineEnabled}
                            setTextOutlineEnabled={setTextOutlineEnabled}
                            textOutlineColor={textOutlineColor}
                            setTextOutlineColor={setTextOutlineColor}
                            textOutlineWidth={textOutlineWidth}
                            setTextOutlineWidth={setTextOutlineWidth}
                        />
                    )}

                    {/* Tab: Fondo */}
                    {activeTab === 'background' && (
                        <BackgroundTab
                            styles={styles}
                            setStyles={setStyles}
                        />
                    )}

                    {/* Tab: Layout */}
                    {activeTab === 'layout' && (
                        <LayoutTab
                            layout={layout}
                            setLayout={setLayout}
                            canvasRef={canvasRef as React.RefObject<HTMLDivElement>}
                            dragElement={dragElement}
                            handleMouseDown={handleMouseDown}
                            handleMouseMove={handleMouseMove}
                            handleMouseUp={handleMouseUp}
                        />
                    )}

                    {/* Tab: Animaciones */}
                    {activeTab === 'animations' && (
                        <AnimationsTab
                            animationType={animationType}
                            setAnimationType={setAnimationType}
                            animationSpeed={animationSpeed}
                            setAnimationSpeed={setAnimationSpeed}
                            cooldownMs={cooldownMs}
                            setCooldownMs={setCooldownMs}
                            testing={testing}
                            setSaveMessage={setSaveMessage}
                        />
                    )}

                    {/* Tab: Recompensas y Archivos */}
                    {activeTab === 'rewards' && (
                        <RewardsTab
                            rewards={rewards}
                            files={files}
                            uploading={uploading}
                            getRewardFile={getRewardFile}
                            setSelectedRewardForFile={setSelectedRewardForFile}
                            setShowFileDialog={setShowFileDialog}
                            handleFileUpload={handleFileUpload}
                            handleDeleteFile={handleDeleteFile}
                            handleToggleFile={handleToggleFile}
                            setPendingAudioUpload={setPendingAudioUpload}
                            setSelectedImageFile={setSelectedImageFile}
                            setShowAudioImageModal={setShowAudioImageModal}
                        />
                    )}
                </div>

                {/* Right Column: Preview & URL */}
                <PreviewPanel
                    previewRef={previewRef as React.RefObject<HTMLDivElement>}
                    styles={styles}
                    layout={layout}
                    textLines={textLines}
                    textOutlineEnabled={textOutlineEnabled}
                    textOutlineColor={textOutlineColor}
                    textOutlineWidth={textOutlineWidth}
                    getPreviewBackground={getPreviewBackground}
                    getTextShadowStyle={getTextShadowStyle}
                    overlayUrl={overlayUrl}
                    handleCopyUrl={handleCopyUrl}
                    handleOpenBrowser={handleOpenBrowser}
                />
            </div>

            {/* Modals */}
            <FileSelectionModal
                showFileDialog={showFileDialog}
                selectedRewardForFile={selectedRewardForFile}
                setShowFileDialog={setShowFileDialog}
                setSelectedRewardForFile={setSelectedRewardForFile}
                systemFiles={systemFiles}
                uploading={uploading}
                handleAssignSystemFile={handleAssignSystemFile}
                showAudioImageModal={showAudioImageModal}
                pendingAudioUpload={pendingAudioUpload}
                selectedImageFile={selectedImageFile}
                setShowAudioImageModal={setShowAudioImageModal}
                setPendingAudioUpload={setPendingAudioUpload}
                setSelectedImageFile={setSelectedImageFile}
                handleFileUpload={handleFileUpload}
            />
        </div>
    );
}
