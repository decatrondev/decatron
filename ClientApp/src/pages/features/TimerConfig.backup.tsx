import {
    Save, ArrowLeft, Clock, Type, Palette, Layout as LayoutIcon,
    AlertCircle, CheckCircle, Copy, Eye, EyeOff, Play, Pause, StopCircle, Zap, RotateCcw, Monitor, Move,
    Gift, Terminal, Bell, Target, Settings, BarChart3, Volume2, Sparkles, Upload, Music, Image as ImageIcon, Film, Trash2,
    PlusCircle, MinusCircle, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import ProgressBarHorizontal from '../../components/timer/ProgressBarHorizontal';
import ProgressBarVertical from '../../components/timer/ProgressBarVertical';
import ProgressBarCircular from '../../components/timer/ProgressBarCircular';
import EventAlertPreview from '../../components/timer/EventAlertPreview';
import MediaInputWithSelector from '../../components/timer/MediaInputWithSelector';
import MediaGallery from '../../components/timer/MediaGallery';
import OverlayEditor from '../../components/timer/OverlayEditor';
import { MINIMAL_TEMPLATE, ALERT_TEMPLATES, getTemplateConfig } from '../../config/alert-templates';

// Separar imports: valores vs tipos
import { DEFAULT_ALERTS_CONFIG } from '../../types/timer-alerts';
import type { AlertsConfig, AlertTemplate, TimerEventType } from '../../types/timer-alerts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DisplayConfig {
    showYears: boolean;
    showMonths: boolean;
    showWeeks: boolean;
    showDays: boolean;
    showHours: boolean;
    showMinutes: boolean;
    showSeconds: boolean;
    showTitle: boolean;
    title: string;
    showPercentage: boolean;
    showElapsedTime: boolean;
}

interface ProgressBarConfig {
    type: 'horizontal' | 'vertical' | 'circular';
    orientation: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top' | 'clockwise' | 'counterclockwise';
    position: { x: number; y: number };
    size: { width: number; height: number };
    backgroundType: 'color' | 'gradient' | 'image' | 'gif';
    backgroundColor: string;
    backgroundGradient: { color1: string; color2: string; angle: number };
    backgroundImage: string;
    fillType: 'color' | 'gradient' | 'image' | 'gif';
    fillColor: string;
    fillGradient: { color1: string; color2: string; angle: number };
    fillImage: string;
    indicatorEnabled: boolean;
    indicatorType: 'circle' | 'image' | 'gif';
    indicatorSize: number;
    indicatorColor: string;
    indicatorImage: string;
    indicatorRotate: boolean;
    borderEnabled: boolean;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
}

interface StyleConfig {
    fontFamily: string;
    textColor: string;
    textShadow: 'none' | 'normal' | 'strong' | 'glow';
    titleFontSize: number;
    timeFontSize: number;
    percentageFontSize: number;
    titlePosition: { x: number; y: number };
    timePosition: { x: number; y: number };
    percentagePosition: { x: number; y: number };
}

interface AnimationConfig {
    entranceType: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate';
    entranceSpeed: 'slow' | 'normal' | 'fast';
    exitType: 'none' | 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate';
    exitSpeed: 'slow' | 'normal' | 'fast';
    runningEffect: 'none' | 'pulse' | 'glow' | 'shake';
    pulseOnZero: boolean;
    pulseOnZeroTime: number; // Cantidad de tiempo para activar el pulso
    pulseOnZeroTimeUnit: 'seconds' | 'minutes' | 'hours'; // Unidad de tiempo
    pulseOnZeroDuration: number;
    pulseOnZeroSpeed: 'slow' | 'normal' | 'fast';
}

interface ThemeConfig {
    mode: 'light' | 'dark' | 'transparent';
    containerBackground: string;
    containerOpacity: number;
}

type TabType = 'basic' | 'display' | 'typography' | 'progressbar' | 'visual' | 'layout' | 'animations' | 'events' | 'commands' | 'alerts' | 'goal' | 'advanced' | 'history' | 'media' | 'overlay';

type DragElement = 'title' | 'time' | 'percentage' | 'progressbar' | null;

interface EventConfig {
    enabled: boolean;
    time: number; // en segundos
}

interface EventsConfig {
    bits: EventConfig & { perBits: number }; // cada X bits
    follow: EventConfig;
    subPrime: EventConfig; // Prime Gaming subs (Tier 1)
    subTier1: EventConfig; // Tier 1 pagadas
    subTier2: EventConfig;
    subTier3: EventConfig;
    giftSub: EventConfig;
    raid: EventConfig & { timePerParticipant: number };
    hypeTrain: EventConfig;
}

// ============================================================================
// TIME CONVERSION HELPERS
// ============================================================================

type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const TIME_UNITS = {
    seconds: { label: 'Segundos', multiplier: 1 },
    minutes: { label: 'Minutos', multiplier: 60 },
    hours: { label: 'Horas', multiplier: 3600 },
    days: { label: 'Días', multiplier: 86400 }
};

// Convierte segundos a la unidad especificada
const convertSecondsToUnit = (seconds: number, unit: TimeUnit): number => {
    return Math.round(seconds / TIME_UNITS[unit].multiplier);
};

// Convierte de la unidad especificada a segundos
const convertUnitToSeconds = (value: number, unit: TimeUnit): number => {
    return value * TIME_UNITS[unit].multiplier;
};

// Determina la mejor unidad para mostrar un valor en segundos
const getBestUnit = (seconds: number): TimeUnit => {
    if (seconds >= 86400 && seconds % 86400 === 0) return 'days';
    if (seconds >= 3600 && seconds % 3600 === 0) return 'hours';
    if (seconds >= 60 && seconds % 60 === 0) return 'minutes';
    return 'seconds';
};

// Formatea segundos a texto legible
const formatTime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
};

interface CommandConfig {
    enabled: boolean;
    blacklist: string[]; // usernames
    whitelist: string[]; // usernames
}

interface CommandsConfig {
    play: CommandConfig;
    pause: CommandConfig;
    reset: CommandConfig;
    stop: CommandConfig;
    addTime: CommandConfig;
    removeTime: CommandConfig;
}

interface SoundConfig {
    enabled: boolean;
    soundType: 'default' | 'custom' | 'none';
    soundUrl: string;
    volume: number; // 0-100
}

interface AlertsConfig {
    // Sonidos
    sounds: {
        timeAdded: SoundConfig;
        fiveMinWarning: SoundConfig;
        timerZero: SoundConfig;
    };
    // Overlay Alerts
    overlayAlerts: {
        enabled: boolean;
        showOnTimeAdded: boolean;
        position: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
        duration: number; // segundos
        animationType: 'fade' | 'slide' | 'bounce' | 'zoom';
        textColor: string;
        backgroundColor: string;
        fontSize: number;
        customTemplate: string; // ej: "+{time} por {event}!"
    };
}

interface GoalConfig {
    enabled: boolean;
    goalTime: number; // segundos
    showProgress: boolean;
    showPercentage: boolean;
    goalText: string; // ej: "Meta: 24 horas"
    position: { x: number; y: number };
    fontSize: number;
    textColor: string;
    progressBarColor: string;
    // Stats en vivo
    showLiveStats: boolean;
    statsPosition: 'overlay' | 'separate-panel';
    statsConfig: {
        showBitsTotal: boolean;
        showSubsTotal: boolean;
        showRaidsTotal: boolean;
        showFollowsTotal: boolean;
        showOthersTotal: boolean;
    };
}

interface Template {
    name: string;
    description: string;
    config: {
        defaultDuration: number;
        displayConfig: Partial<DisplayConfig>;
        progressBarConfig: Partial<ProgressBarConfig>;
        styleConfig: Partial<StyleConfig>;
    };
}

interface HappyHourConfig {
    enabled: boolean;
    startTime: string; // HH:MM formato 24h
    endTime: string; // HH:MM formato 24h
    multiplier: number; // ej: 2 = 2x tiempo
    daysOfWeek: boolean[]; // [dom, lun, mar, mie, jue, vie, sab]
}

interface AdvancedConfig {
    // Plantillas
    templates: {
        speedrun: Template;
        subathon: Template;
        gamingMarathon: Template;
        custom: Template[];
    };
    activeTemplate: string | null;
    // Auto-pause
    autoPause: {
        enabled: boolean;
        schedules: Array<{
            id: string;
            startTime: string; // HH:MM
            endTime: string; // HH:MM
            daysOfWeek: boolean[]; // [dom, lun, mar, mie, jue, vie, sab]
            reason: string;
        }>;
    };
    // Happy Hour
    happyHour: HappyHourConfig;
}

interface EventLogEntry {
    id: string;
    timestamp: string;
    eventType: 'bits' | 'follow' | 'sub' | 'gift' | 'raid' | 'hypetrain' | 'command';
    username: string;
    timeAdded: number; // segundos (puede ser negativo)
    details: string;
}

interface HistoryConfig {
    enabled: boolean;
    maxEntries: number;
    showInOverlay: boolean;
    logPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    // Analytics
    analytics: {
        totalTimeAdded: number;
        byEventType: {
            bits: number;
            follows: number;
            subs: number;
            raids: number;
            hypeTrain: number;
            commands: number;
        };
    };
    logs: EventLogEntry[];
}

interface MediaFile {
    id: string;
    fileName: string;
    fileType: 'sound' | 'image' | 'gif' | 'video';
    fileUrl: string;
    fileSize: number; // bytes
    uploadedAt: string;
    duration?: number; // para audio/video en segundos
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TimerConfig() {
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('basic');

    // Basic configuration
    const [defaultDuration, setDefaultDuration] = useState(300); // 5 minutes in seconds
    const [autoStart, setAutoStart] = useState(false);

    // Display configuration
    const [displayConfig, setDisplayConfig] = useState<DisplayConfig>({
        showYears: false,
        showMonths: false,
        showWeeks: false,
        showDays: false,
        showHours: true,
        showMinutes: true,
        showSeconds: true,
        showTitle: true,
        title: 'Próximo juego en:',
        showPercentage: true,
        showElapsedTime: false
    });

    // Progress Bar configuration
    const [progressBarConfig, setProgressBarConfig] = useState<ProgressBarConfig>({
        type: 'horizontal',
        orientation: 'left-to-right',
        position: { x: 50, y: 150 },
        size: { width: 900, height: 40 },
        backgroundType: 'color',
        backgroundColor: 'rgba(255,255,255,0.1)',
        backgroundGradient: { color1: '#667eea', color2: '#764ba2', angle: 135 },
        backgroundImage: '',
        fillType: 'gradient',
        fillColor: '#667eea',
        fillGradient: { color1: '#667eea', color2: '#764ba2', angle: 135 },
        fillImage: '',
        indicatorEnabled: true,
        indicatorType: 'circle',
        indicatorSize: 24,
        indicatorColor: '#ffffff',
        indicatorImage: '',
        indicatorRotate: false,
        borderEnabled: true,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 2,
        borderRadius: 20
    });

    // Style configuration
    const [styleConfig, setStyleConfig] = useState<StyleConfig>({
        fontFamily: 'Inter',
        textColor: '#ffffff',
        textShadow: 'normal',
        titleFontSize: 32,
        timeFontSize: 48,
        percentageFontSize: 24,
        titlePosition: { x: 500, y: 50 },
        timePosition: { x: 500, y: 100 },
        percentagePosition: { x: 500, y: 220 }
    });

    // Animation configuration
    const [animationConfig, setAnimationConfig] = useState<AnimationConfig>({
        entranceType: 'fade',
        entranceSpeed: 'normal',
        exitType: 'fade',
        exitSpeed: 'normal',
        runningEffect: 'pulse',
        pulseOnZero: true,
        pulseOnZeroTime: 0,
        pulseOnZeroTimeUnit: 'seconds', // Unidad por defecto: segundos
        pulseOnZeroDuration: 10,
        pulseOnZeroSpeed: 'normal'
    });

    // Theme configuration
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
        mode: 'transparent',
        containerBackground: 'transparent',
        containerOpacity: 0
    });

    // Events configuration
    const [eventsConfig, setEventsConfig] = useState<EventsConfig>({
        bits: { enabled: false, time: 60, perBits: 100 }, // 1min cada 100 bits
        follow: { enabled: false, time: 30 }, // 30 segundos
        subPrime: { enabled: false, time: 300 }, // 5 minutos (Prime Gaming)
        subTier1: { enabled: false, time: 300 }, // 5 minutos (Tier 1 pagada)
        subTier2: { enabled: false, time: 600 }, // 10 minutos
        subTier3: { enabled: false, time: 900 }, // 15 minutos
        giftSub: { enabled: false, time: 300 }, // 5 minutos
        raid: { enabled: false, time: 60, timePerParticipant: 1 }, // 1min base + 1seg por persona
        hypeTrain: { enabled: false, time: 600 } // 10 minutos
    });

    // Time units for each event field
    const [eventTimeUnits, setEventTimeUnits] = useState<{
        bits: TimeUnit;
        follow: TimeUnit;
        subPrime: TimeUnit;
        subTier1: TimeUnit;
        subTier2: TimeUnit;
        subTier3: TimeUnit;
        giftSub: TimeUnit;
        raidBase: TimeUnit;
        raidPerParticipant: TimeUnit;
        hypeTrain: TimeUnit;
    }>({
        bits: 'minutes',
        follow: 'seconds',
        subPrime: 'minutes',
        subTier1: 'minutes',
        subTier2: 'minutes',
        subTier3: 'minutes',
        giftSub: 'minutes',
        raidBase: 'minutes',
        raidPerParticipant: 'seconds',
        hypeTrain: 'minutes'
    });

    // Commands configuration
    const [commandsConfig, setCommandsConfig] = useState<CommandsConfig>({
        play: { enabled: true, blacklist: [], whitelist: [] },
        pause: { enabled: true, blacklist: [], whitelist: [] },
        reset: { enabled: true, blacklist: [], whitelist: [] },
        stop: { enabled: true, blacklist: [], whitelist: [] },
        addTime: { enabled: true, blacklist: [], whitelist: [] },
        removeTime: { enabled: true, blacklist: [], whitelist: [] }
    });

    // Alerts configuration (Customizable Event Alerts)
    const [alertsConfig, setAlertsConfig] = useState<AlertsConfig>(DEFAULT_ALERTS_CONFIG);
    const [alertsSubTab, setAlertsSubTab] = useState<'template' | 'style' | 'events' | 'sounds'>('template');
    const [showAlertPreview, setShowAlertPreview] = useState(false);
    const [previewAlertType, setPreviewAlertType] = useState<TimerEventType>('follow');

    // Goal configuration (Objetivo Visual + Stats en Vivo)
    const [goalConfig, setGoalConfig] = useState<GoalConfig>({
        enabled: false,
        goalTime: 86400, // 24 horas por defecto
        showProgress: true,
        showPercentage: true,
        goalText: 'Meta: 24 horas',
        position: { x: 500, y: 270 },
        fontSize: 20,
        textColor: '#ffffff',
        progressBarColor: '#667eea',
        showLiveStats: true,
        statsPosition: 'overlay',
        statsConfig: {
            showBitsTotal: true,
            showSubsTotal: true,
            showRaidsTotal: true,
            showFollowsTotal: true,
            showOthersTotal: true
        }
    });

    // Advanced configuration (Plantillas + Auto-pause + Happy Hour)
    const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>({
        templates: {
            speedrun: {
                name: 'Speedrun',
                description: 'Timer simple para speedruns',
                config: {
                    defaultDuration: 0,
                    displayConfig: { showTitle: false, showPercentage: false },
                    progressBarConfig: { type: 'horizontal' },
                    styleConfig: { timeFontSize: 64 }
                }
            },
            subathon: {
                name: 'Subathon',
                description: 'Timer con objetivo de tiempo largo',
                config: {
                    defaultDuration: 86400, // 24h
                    displayConfig: { showDays: true, showHours: true, showMinutes: true },
                    progressBarConfig: { type: 'horizontal' },
                    styleConfig: { timeFontSize: 48 }
                }
            },
            gamingMarathon: {
                name: 'Gaming Marathon',
                description: 'Timer para maratones de gaming',
                config: {
                    defaultDuration: 43200, // 12h
                    displayConfig: { showHours: true, showMinutes: true, showSeconds: true },
                    progressBarConfig: { type: 'horizontal' },
                    styleConfig: { timeFontSize: 56 }
                }
            },
            custom: []
        },
        activeTemplate: null,
        autoPause: {
            enabled: false,
            schedules: []
        },
        happyHour: {
            enabled: false,
            startTime: '20:00',
            endTime: '22:00',
            multiplier: 2,
            daysOfWeek: [false, false, false, false, false, true, true] // Solo fin de semana por defecto
        }
    });

    // History configuration (Analytics + Logs)
    const [historyConfig, setHistoryConfig] = useState<HistoryConfig>({
        enabled: false,
        maxEntries: 100,
        showInOverlay: false,
        logPosition: 'bottom-right',
        analytics: {
            totalTimeAdded: 0,
            byEventType: {
                bits: 0,
                follows: 0,
                subs: 0,
                raids: 0,
                hypeTrain: 0,
                commands: 0
            }
        },
        logs: []
    });

    const [overlayUrl, setOverlayUrl] = useState('');

    // Media files states
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Preview timer state
    const [previewTimeRemaining, setPreviewTimeRemaining] = useState(150); // 2:30 default
    const [previewTotalDuration, setPreviewTotalDuration] = useState(150); // Track total for progress calculation
    const [previewIsRunning, setPreviewIsRunning] = useState(true);

    const previewRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Sync preview timer with defaultDuration changes - DINÁMICO CON TIMER REAL
    useEffect(() => {
        // Si hay un timer activo, la vista previa NO usa sample data
        // En su lugar, debe cargar el estado real del timer
        const loadPreviewState = async () => {
            try {
                const stateRes = await api.get('/timer/state/current');
                if (stateRes.data.success && stateRes.data.state) {
                    const state = stateRes.data.state;

                    if (state.status === 'running' || state.status === 'paused') {
                        // Hay timer activo - usar su tiempo
                        let remainingSeconds = state.currentTime;

                        if (state.status === 'running' && state.startedAt) {
                            const startDate = new Date(state.startedAt);
                            const now = new Date();
                            const elapsedMs = now.getTime() - startDate.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000) - (state.elapsedPausedTime || 0);
                            remainingSeconds = Math.max(0, state.totalTime - elapsedSeconds);
                        }

                        setPreviewTimeRemaining(remainingSeconds);
                        setPreviewTotalDuration(state.totalTime);
                        setPreviewIsRunning(state.status === 'running');
                        return;
                    }
                }
            } catch (err) {
                // No hay timer activo
            }

            // Si no hay timer activo, usar sample data (max 5 min para demo)
            const previewDuration = Math.min(defaultDuration, 300);
            setPreviewTimeRemaining(previewDuration);
            setPreviewTotalDuration(previewDuration);
            setPreviewIsRunning(true);
        };

        loadPreviewState();
    }, [defaultDuration]);

    // Drag & Drop states
    const [isDragging, setIsDragging] = useState(false);
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Preview timer countdown effect
    useEffect(() => {
        if (!previewIsRunning || previewTimeRemaining <= 0) {
            return;
        }

        const interval = setInterval(() => {
            setPreviewTimeRemaining((prev) => {
                const newTime = prev - 1;
                if (newTime <= 0) {
                    setPreviewIsRunning(false);
                    return 0;
                }
                return newTime;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [previewIsRunning, previewTimeRemaining]);

    // Format time for preview
    const formatPreviewTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${String(minutes).padStart(2, '0')}m`);
        parts.push(`${String(secs).padStart(2, '0')}s`);

        return parts.join(' ');
    };

    // ========================================================================
    // DRAG & DROP HANDLERS
    // ========================================================================

    const handleMouseDown = (element: DragElement, e: React.MouseEvent) => {
        setIsDragging(true);
        setDragElement(element);

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const canvas = canvasRef.current?.getBoundingClientRect();

        if (canvas) {
            const scale = canvas.width / 1000;
            setDragOffset({
                x: (e.clientX - rect.left) / scale,
                y: (e.clientY - rect.top) / scale
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !dragElement || !canvasRef.current) return;

        const canvas = canvasRef.current.getBoundingClientRect();
        const scale = canvas.width / 1000;

        const x = Math.max(0, Math.min(1000, ((e.clientX - canvas.left) / scale) - dragOffset.x));
        const y = Math.max(0, Math.min(300, ((e.clientY - canvas.top) / scale) - dragOffset.y));

        if (dragElement === 'title') {
            setStyleConfig(prev => ({
                ...prev,
                titlePosition: { x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'time') {
            setStyleConfig(prev => ({
                ...prev,
                timePosition: { x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'percentage') {
            setStyleConfig(prev => ({
                ...prev,
                percentagePosition: { x: Math.round(x), y: Math.round(y) }
            }));
        } else if (dragElement === 'progressbar') {
            setProgressBarConfig(prev => ({
                ...prev,
                position: { x: Math.round(x), y: Math.round(y) }
            }));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragElement(null);
    };

    // ========================================================================
    // MEDIA FILES HANDLERS
    // ========================================================================

    const loadMediaFiles = async () => {
        try {
            const res = await api.get('/timer/media');
            if (res.data.success && res.data.files) {
                setMediaFiles(res.data.files);
            }
        } catch (error) {
            console.error('Error loading media files:', error);
        }
    };

    const handleFileUpload = async (file: File) => {
        try {
            setUploading(true);
            setUploadProgress(0);

            // Determinar tipo de archivo
            const ext = file.name.split('.').pop()?.toLowerCase();
            let fileType: 'sound' | 'image' | 'gif' | 'video' = 'image';

            if (['mp3', 'wav', 'ogg'].includes(ext || '')) fileType = 'sound';
            else if (['gif'].includes(ext || '')) fileType = 'gif';
            else if (['mp4', 'webm'].includes(ext || '')) fileType = 'video';

            // Obtener duración si es audio/video
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
            formData.append('FileType', fileType);
            formData.append('DurationSeconds', duration.toString());

            await api.post('/timer/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percent);
                    }
                }
            });

            setSaveMessage({ type: 'success', text: `Archivo subido: ${file.name}` });
            setTimeout(() => setSaveMessage(null), 3000);
            await loadMediaFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || 'Error al subir archivo';
            setSaveMessage({ type: 'error', text: message });
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteMediaFile = async (fileId: string) => {
        if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

        try {
            await api.delete(`/timer/media/${fileId}`);
            setSaveMessage({ type: 'success', text: 'Archivo eliminado' });
            setTimeout(() => setSaveMessage(null), 3000);
            await loadMediaFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || 'Error al eliminar archivo';
            setSaveMessage({ type: 'error', text: message });
        }
    };

    // ========================================================================
    // EFFECTS
    // ========================================================================

    useEffect(() => {
        if (!permissionsLoading && hasMinimumLevel('moderation')) {
            loadConfiguration();
            loadFrontendInfo();
            loadMediaFiles();
            // Iniciar actualización en tiempo real del timer activo
            startTimerSync();
        } else if (!permissionsLoading) {
            navigate('/dashboard');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permissionsLoading]);

    // Sincronización en tiempo real del timer activo
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const stateRes = await api.get('/timer/state/current');
                if (stateRes.data.success && stateRes.data.state) {
                    const state = stateRes.data.state;

                    // Si hay timer activo (running o paused), actualizar defaultDuration con tiempo restante
                    if (state.status === 'running' || state.status === 'paused') {
                        let remainingSeconds = state.currentTime;

                        // Si está corriendo, calcular tiempo restante en tiempo real
                        if (state.status === 'running' && state.startedAt) {
                            const startDate = new Date(state.startedAt);
                            const now = new Date();
                            const elapsedMs = now.getTime() - startDate.getTime();
                            const elapsedSeconds = Math.floor(elapsedMs / 1000) - (state.elapsedPausedTime || 0);
                            remainingSeconds = Math.max(0, state.totalTime - elapsedSeconds);
                        }

                        // Actualizar campo con tiempo restante en tiempo real
                        setDefaultDuration(remainingSeconds);
                    }
                }
            } catch (err) {
                // Si no hay timer o error, no hacer nada
            }
        }, 1000); // Actualizar cada segundo

        return () => clearInterval(interval);
    }, []);

    const startTimerSync = () => {
        // Este método se llama al cargar para iniciar la sincronización
    };

    // ========================================================================
    // LOAD & SAVE
    // ========================================================================

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            const res = await api.get('/timer/config');
            if (res.data.success && res.data.config) {
                const config = res.data.config;

                // SEPARAR: defaultDuration es solo configuración, NO estado activo
                setDefaultDuration(config.defaultDuration || 300);
                setAutoStart(config.autoStart || false);

                // Merge con valores por defecto para evitar undefined
                if (config.displayConfig) {
                    setDisplayConfig(prev => ({ ...prev, ...config.displayConfig }));
                }
                if (config.progressBarConfig) {
                    setProgressBarConfig(prev => ({ ...prev, ...config.progressBarConfig }));
                }
                if (config.styleConfig) {
                    setStyleConfig(prev => ({ ...prev, ...config.styleConfig }));
                }
                if (config.animationConfig) {
                    setAnimationConfig(prev => ({ ...prev, ...config.animationConfig }));
                }
                if (config.themeConfig) {
                    setThemeConfig(prev => ({ ...prev, ...config.themeConfig }));
                }
                if (config.eventsConfig) {
                    setEventsConfig(prev => ({ ...prev, ...config.eventsConfig }));
                }
                if (config.commandsConfig) {
                    setCommandsConfig(prev => ({ ...prev, ...config.commandsConfig }));
                }
                if (config.alertsConfig) {
                    setAlertsConfig(prev => ({ ...prev, ...config.alertsConfig }));
                }
                if (config.goalConfig) {
                    setGoalConfig(prev => ({ ...prev, ...config.goalConfig }));
                }
            }
        } catch (error) {
            console.error('Error loading timer configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFrontendInfo = async () => {
        try {
            const res = await api.get('/settings/frontend-info');
            if (res.data.success) {
                const { frontendUrl, channel } = res.data;
                setOverlayUrl(`${frontendUrl}/overlay/timer?channel=${channel.login}`);
            }
        } catch (error) {
            console.error('Error loading frontend info:', error);
            setOverlayUrl(`${window.location.origin}/overlay/timer?channel=channel`);
        }
    };

    const handleDebugConfig = async () => {
        console.log('=== DEBUG: CONFIGURACIÓN ACTUAL EN MEMORIA ===');
        const currentConfig = {
            defaultDuration,
            autoStart,
            displayConfig,
            progressBarConfig,
            styleConfig,
            animationConfig,
            themeConfig,
            eventsConfig,
            commandsConfig,
            alertsConfig,
            goalConfig
        };
        console.log('Estado actual (lo que se enviaría al guardar):', JSON.stringify(currentConfig, null, 2));

        try {
            console.log('\n=== DEBUG: CONFIGURACIÓN EN BASE DE DATOS ===');
            const res = await api.get('/timer/config');
            console.log('Configuración guardada en BD:', JSON.stringify(res.data.config, null, 2));

            console.log('\n=== DEBUG: ESTADO DEL TIMER ===');
            const stateRes = await api.get('/timer/state/current');
            console.log('Estado actual del timer:', JSON.stringify(stateRes.data, null, 2));

            console.log('\n=== DEBUG: COMPARACIÓN ===');
            console.log('¿displayConfig.showElapsedTime en memoria?', displayConfig.showElapsedTime);
            console.log('¿displayConfig.showElapsedTime en BD?', res.data.config?.displayConfig?.showElapsedTime);
            console.log('¿eventsConfig.bits.enabled en memoria?', eventsConfig.bits.enabled);
            console.log('¿eventsConfig.bits.enabled en BD?', res.data.config?.eventsConfig?.bits?.enabled);
            console.log('Estado del timer:', stateRes.data?.state?.status);
            console.log('Timer puede procesar eventos?', stateRes.data?.state?.status === 'running' || stateRes.data?.state?.status === 'paused');

            setSaveMessage({ type: 'success', text: '✅ Revisa la consola del navegador (F12)' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Error obteniendo config de BD:', error);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveMessage(null);

            const configToSave = {
                defaultDuration,
                autoStart,
                displayConfig,
                progressBarConfig,
                styleConfig,
                animationConfig,
                themeConfig,
                eventsConfig,
                commandsConfig,
                alertsConfig,
                goalConfig
            };

            await api.post('/timer/config', configToSave);

            setSaveMessage({ type: 'success', text: 'Configuración guardada exitosamente' });

            setTimeout(() => {
                setSaveMessage(null);
            }, 3000);
        } catch (error) {
            console.error('Error saving timer configuration:', error);
            setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' });
        } finally {
            setSaving(false);
        }
    };

    const copyOverlayUrl = () => {
        navigator.clipboard.writeText(overlayUrl);
        setSaveMessage({ type: 'success', text: 'URL copiada al portapapeles' });
        setTimeout(() => setSaveMessage(null), 2000);
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    const hexToRgba = (hex: string, alpha: number): string => {
        // Validar que hex sea un string válido
        if (!hex || typeof hex !== 'string' || hex === 'transparent') {
            return `rgba(0, 0, 0, ${alpha})`;
        }

        // Asegurar que empiece con #
        const cleanHex = hex.startsWith('#') ? hex : `#${hex}`;

        // Validar formato hexadecimal
        if (cleanHex.length !== 7 && cleanHex.length !== 4) {
            return `rgba(0, 0, 0, ${alpha})`;
        }

        const r = parseInt(cleanHex.slice(1, 3), 16);
        const g = parseInt(cleanHex.slice(3, 5), 16);
        const b = parseInt(cleanHex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    if (loading || permissionsLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f1419] py-4 sm:py-6 lg:py-8">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header - Responsive */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                                Configuración de Timer
                            </h1>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                                Personaliza tu overlay de timer para streams
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleDebugConfig}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                            title="Ver configuración en consola del navegador"
                        >
                            <Terminal className="w-5 h-5" />
                            Debug
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>

                {/* Save Message */}
                {saveMessage && (
                    <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
                        saveMessage.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                    }`}>
                        {saveMessage.type === 'success' ? (
                            <CheckCircle className="w-5 h-5" />
                        ) : (
                            <AlertCircle className="w-5 h-5" />
                        )}
                        <span>{saveMessage.text}</span>
                    </div>
                )}


                {/* Tab Content + Preview - Grid responsive mejorado */}
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
                                onClick={() => setActiveTab('display')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'display'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Eye className="w-4 h-4" />
                                Display
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
                                onClick={() => setActiveTab('progressbar')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'progressbar'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <LayoutIcon className="w-4 h-4" />
                                Barra de Progreso
                            </button>
                            <button
                                onClick={() => setActiveTab('layout')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'layout'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Move className="w-4 h-4" />
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
                                onClick={() => setActiveTab('events')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'events'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Gift className="w-4 h-4" />
                                Eventos
                            </button>
                            <button
                                onClick={() => setActiveTab('commands')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'commands'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Terminal className="w-4 h-4" />
                                Comandos
                            </button>
                            <button
                                onClick={() => setActiveTab('alerts')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'alerts'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Bell className="w-4 h-4" />
                                Alertas
                            </button>
                            <button
                                onClick={() => setActiveTab('goal')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'goal'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Target className="w-4 h-4" />
                                Objetivo
                            </button>
                            <button
                                onClick={() => setActiveTab('advanced')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'advanced'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Settings className="w-4 h-4" />
                                Avanzado
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'history'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <BarChart3 className="w-4 h-4" />
                                Historial
                            </button>
                            <button
                                onClick={() => setActiveTab('media')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'media'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Upload className="w-4 h-4" />
                                Medios
                            </button>
                            <button
                                onClick={() => setActiveTab('overlay')}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                                    activeTab === 'overlay'
                                        ? 'bg-[#2563eb] text-white shadow-md'
                                        : 'bg-transparent text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#262626]'
                                }`}
                            >
                                <Monitor className="w-4 h-4" />
                                Vista de Overlay
                            </button>
                        </div>
                    </div>
                    {/* BASIC TAB */}
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            {/* Tiempo Inicial del Timer */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block">
                                            ⏱️ Tiempo Inicial del Timer
                                        </label>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Duración que tendrá el timer al iniciarse
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                                            💡 Para cambiar el tiempo de un timer activo, primero deténlo con el botón "Detener" o el comando !dstop
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-[#2563eb]">
                                            {Math.floor(defaultDuration / 86400) > 0 && `${Math.floor(defaultDuration / 86400)}d `}
                                            {Math.floor((defaultDuration % 86400) / 3600) > 0 && `${Math.floor((defaultDuration % 86400) / 3600)}h `}
                                            {Math.floor((defaultDuration % 3600) / 60) > 0 && `${Math.floor((defaultDuration % 3600) / 60)}m `}
                                            {defaultDuration % 60 > 0 && `${defaultDuration % 60}s`}
                                        </div>
                                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Total: {defaultDuration} segundos
                                        </div>
                                    </div>
                                </div>

                                {/* Inputs personalizados por unidad */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                            Días
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="365"
                                            value={Math.floor(defaultDuration / 86400)}
                                            onChange={(e) => {
                                                const days = Number(e.target.value) || 0;
                                                const hours = Math.floor((defaultDuration % 86400) / 3600);
                                                const minutes = Math.floor((defaultDuration % 3600) / 60);
                                                const seconds = defaultDuration % 60;
                                                setDefaultDuration(days * 86400 + hours * 3600 + minutes * 60 + seconds);
                                            }}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                            Horas
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            value={Math.floor((defaultDuration % 86400) / 3600)}
                                            onChange={(e) => {
                                                const days = Math.floor(defaultDuration / 86400);
                                                const hours = Number(e.target.value) || 0;
                                                const minutes = Math.floor((defaultDuration % 3600) / 60);
                                                const seconds = defaultDuration % 60;
                                                setDefaultDuration(days * 86400 + hours * 3600 + minutes * 60 + seconds);
                                            }}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                            Minutos
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={Math.floor((defaultDuration % 3600) / 60)}
                                            onChange={(e) => {
                                                const days = Math.floor(defaultDuration / 86400);
                                                const hours = Math.floor((defaultDuration % 86400) / 3600);
                                                const minutes = Number(e.target.value) || 0;
                                                const seconds = defaultDuration % 60;
                                                setDefaultDuration(days * 86400 + hours * 3600 + minutes * 60 + seconds);
                                            }}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-1">
                                            Segundos
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={defaultDuration % 60}
                                            onChange={(e) => {
                                                const days = Math.floor(defaultDuration / 86400);
                                                const hours = Math.floor((defaultDuration % 86400) / 3600);
                                                const minutes = Math.floor((defaultDuration % 3600) / 60);
                                                const seconds = Number(e.target.value) || 0;
                                                setDefaultDuration(days * 86400 + hours * 3600 + minutes * 60 + seconds);
                                            }}
                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-center"
                                        />
                                    </div>
                                </div>

                                {/* Slider */}
                                <input
                                    type="range"
                                    min="1"
                                    max="3600"
                                    value={Math.min(defaultDuration, 3600)}
                                    onChange={(e) => setDefaultDuration(Number(e.target.value))}
                                    className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                                />
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2 text-center">
                                    Arrastra el slider para tiempos rápidos (máx 1 hora) o usa los campos arriba para tiempos más largos
                                </p>

                                {/* Botones rápidos */}
                                <div className="grid grid-cols-4 gap-2 mt-3">
                                    <button
                                        onClick={() => setDefaultDuration(60)}
                                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                                            defaultDuration === 60
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        1 min
                                    </button>
                                    <button
                                        onClick={() => setDefaultDuration(300)}
                                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                                            defaultDuration === 300
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        5 min
                                    </button>
                                    <button
                                        onClick={() => setDefaultDuration(600)}
                                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                                            defaultDuration === 600
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        10 min
                                    </button>
                                    <button
                                        onClick={() => setDefaultDuration(1800)}
                                        className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                                            defaultDuration === 1800
                                                ? 'bg-[#2563eb] text-white'
                                                : 'bg-[#f1f5f9] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                        }`}
                                    >
                                        30 min
                                    </button>
                                </div>
                            </div>

                            {/* Auto-iniciar */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <label htmlFor="autoStart" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-1">
                                            🚀 Auto-iniciar Timer
                                        </label>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            El timer comenzará automáticamente cuando se cargue el overlay. Ideal para eventos programados.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        id="autoStart"
                                        checked={autoStart}
                                        onChange={(e) => setAutoStart(e.target.checked)}
                                        className="w-6 h-6 text-[#2563eb] rounded ml-4 flex-shrink-0"
                                    />
                                </div>
                            </div>

                            {/* Controles del Timer */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-4">
                                    🎮 Controles del Timer
                                </label>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                                    Controla el timer directamente desde aquí. También puedes usar comandos en chat.
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/timer/control', {
                                                    action: 'start',
                                                    duration: defaultDuration
                                                });
                                                console.log('Timer iniciado');
                                            } catch (error) {
                                                console.error('Error al iniciar timer:', error);
                                            }
                                        }}
                                        className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                                    >
                                        <Play className="w-4 h-4" />
                                        Iniciar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/timer/control', { action: 'pause' });
                                                console.log('Timer pausado');
                                            } catch (error) {
                                                console.error('Error al pausar timer:', error);
                                            }
                                        }}
                                        className="px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                                    >
                                        <Pause className="w-4 h-4" />
                                        Pausar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/timer/control', { action: 'resume' });
                                                console.log('Timer reanudado');
                                            } catch (error) {
                                                console.error('Error al reanudar timer:', error);
                                            }
                                        }}
                                        className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                                    >
                                        <Play className="w-4 h-4" />
                                        Reanudar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/timer/control', { action: 'reset' });
                                                console.log('Timer reiniciado');
                                            } catch (error) {
                                                console.error('Error al reiniciar timer:', error);
                                            }
                                        }}
                                        className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Reiniciar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.post('/timer/control', { action: 'stop' });
                                                console.log('Timer detenido');
                                            } catch (error) {
                                                console.error('Error al detener timer:', error);
                                            }
                                        }}
                                        className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                                    >
                                        <StopCircle className="w-4 h-4" />
                                        Detener
                                    </button>
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Comandos en chat:</strong> !dstart 5m, !dpause, !dplay, !dreset, !dstop
                                    </p>
                                </div>
                            </div>

                            {/* URL del Overlay */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2 mb-3">
                                    🔗 URL del Overlay para OBS
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={overlayUrl}
                                        readOnly
                                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm font-mono"
                                    />
                                    <button
                                        onClick={copyOverlayUrl}
                                        className="px-6 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-bold whitespace-nowrap"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copiar URL
                                    </button>
                                </div>
                                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                                        📺 Cómo usar en OBS Studio:
                                    </p>
                                    <ol className="text-xs text-purple-600 dark:text-purple-400 space-y-1 list-decimal list-inside">
                                        <li>Copia la URL usando el botón de arriba</li>
                                        <li>En OBS, agrega una fuente "Navegador"</li>
                                        <li>Pega la URL copiada</li>
                                        <li>Configura el tamaño: 1000x300 px</li>
                                        <li>¡Listo! El timer aparecerá en tu stream</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    )}

                {/* DISPLAY TAB */}
                {activeTab === 'display' && (
                    <div className="space-y-6">
                        {/* Unidades de Tiempo Visibles */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Unidades de Tiempo Visibles
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { key: 'showYears', label: 'Años' },
                                    { key: 'showMonths', label: 'Meses' },
                                    { key: 'showWeeks', label: 'Semanas' },
                                    { key: 'showDays', label: 'Días' },
                                    { key: 'showHours', label: 'Horas' },
                                    { key: 'showMinutes', label: 'Minutos' },
                                    { key: 'showSeconds', label: 'Segundos' }
                                ].map(({ key, label }) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id={key}
                                            checked={displayConfig[key as keyof DisplayConfig] as boolean}
                                            onChange={(e) => setDisplayConfig({ ...displayConfig, [key]: e.target.checked })}
                                            className="w-4 h-4 text-[#2563eb] rounded"
                                        />
                                        <label htmlFor={key} className="text-sm text-[#1e293b] dark:text-[#f8fafc]">{label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Mostrar Título */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-3">
                                <label htmlFor="showTitle" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Mostrar Título
                                </label>
                                <input
                                    type="checkbox"
                                    id="showTitle"
                                    checked={displayConfig.showTitle}
                                    onChange={(e) => setDisplayConfig({ ...displayConfig, showTitle: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] rounded"
                                />
                            </div>
                            {displayConfig.showTitle && (
                                <>
                                    <input
                                        type="text"
                                        value={displayConfig.title}
                                        onChange={(e) => setDisplayConfig({ ...displayConfig, title: e.target.value })}
                                        placeholder="Ej: Próximo juego en:"
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    />
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                                        Texto que se mostrará como título del timer
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Mostrar Porcentaje */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between">
                                <label htmlFor="showPercentage" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Mostrar Porcentaje
                                </label>
                                <input
                                    type="checkbox"
                                    id="showPercentage"
                                    checked={displayConfig.showPercentage}
                                    onChange={(e) => setDisplayConfig({ ...displayConfig, showPercentage: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] rounded"
                                />
                            </div>
                        </div>

                        {/* Mostrar Tiempo Transcurrido */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between">
                                <label htmlFor="showElapsedTime" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Mostrar Tiempo Transcurrido
                                </label>
                                <input
                                    type="checkbox"
                                    id="showElapsedTime"
                                    checked={displayConfig.showElapsedTime}
                                    onChange={(e) => setDisplayConfig({ ...displayConfig, showElapsedTime: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] rounded"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* TYPOGRAPHY TAB */}
                {activeTab === 'typography' && (
                    <div className="space-y-6">
                        {/* Familia de Fuente */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block mb-3">
                                Familia de Fuente
                            </label>
                            <select
                                value={styleConfig.fontFamily}
                                onChange={(e) => setStyleConfig({ ...styleConfig, fontFamily: e.target.value })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="Inter">Inter</option>
                                <option value="Roboto">Roboto</option>
                                <option value="Open Sans">Open Sans</option>
                                <option value="Montserrat">Montserrat</option>
                                <option value="Poppins">Poppins</option>
                                <option value="Arial">Arial</option>
                                <option value="monospace">Monospace</option>
                            </select>
                        </div>

                        {/* Color de Texto */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block mb-3">
                                Color de Texto
                            </label>
                            <input
                                type="color"
                                value={styleConfig.textColor}
                                onChange={(e) => setStyleConfig({ ...styleConfig, textColor: e.target.value })}
                                className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                            />
                        </div>

                        {/* Sombra de Texto */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block mb-3">
                                Sombra de Texto
                            </label>
                            <select
                                value={styleConfig.textShadow}
                                onChange={(e) => setStyleConfig({ ...styleConfig, textShadow: e.target.value as any })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="none">Sin sombra</option>
                                <option value="normal">Normal</option>
                                <option value="strong">Fuerte</option>
                                <option value="glow">Brillo</option>
                            </select>
                        </div>

                        {/* Tamaños de Fuente */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Tamaños de Fuente
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Título (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={styleConfig.titleFontSize}
                                        onChange={(e) => setStyleConfig({ ...styleConfig, titleFontSize: Number(e.target.value) })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        min="12"
                                        max="100"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tiempo (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={styleConfig.timeFontSize}
                                        onChange={(e) => setStyleConfig({ ...styleConfig, timeFontSize: Number(e.target.value) })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        min="12"
                                        max="100"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Porcentaje (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={styleConfig.percentageFontSize}
                                        onChange={(e) => setStyleConfig({ ...styleConfig, percentageFontSize: Number(e.target.value) })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        min="12"
                                        max="100"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PROGRESS BAR TAB - Unified with Visual */}
                {activeTab === 'progressbar' && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
                            <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                                ⚙️ Configuración y Estructura de la Barra
                            </p>
                        </div>

                        {/* Tipo de Barra */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block mb-3">
                                Tipo de Barra
                            </label>
                            <select
                                value={progressBarConfig.type}
                                onChange={(e) => {
                                    const type = e.target.value as 'horizontal' | 'vertical' | 'circular';
                                    let orientation = progressBarConfig.orientation;
                                    let size = progressBarConfig.size;
                                    let position = progressBarConfig.position;

                                    if (type === 'horizontal') {
                                        orientation = 'left-to-right';
                                        size = { width: 900, height: 40 };
                                        position = { x: 50, y: 150 };
                                    } else if (type === 'vertical') {
                                        orientation = 'bottom-to-top';
                                        size = { width: 40, height: 260 };
                                        position = { x: 50, y: 20 };
                                    } else if (type === 'circular') {
                                        orientation = 'clockwise';
                                        size = { width: 260, height: 260 };
                                        position = { x: 370, y: 20 };
                                    }

                                    setProgressBarConfig({ ...progressBarConfig, type, orientation, size, position });
                                }}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="horizontal">Horizontal</option>
                                <option value="vertical">Vertical</option>
                                <option value="circular">Circular (Reloj)</option>
                            </select>
                        </div>

                        {/* Orientación */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] block mb-3">
                                Orientación
                            </label>
                            <select
                                value={progressBarConfig.orientation}
                                onChange={(e) => setProgressBarConfig({ ...progressBarConfig, orientation: e.target.value as any })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                {progressBarConfig.type === 'horizontal' && (
                                    <>
                                        <option value="left-to-right">Izquierda a Derecha</option>
                                        <option value="right-to-left">Derecha a Izquierda</option>
                                    </>
                                )}
                                {progressBarConfig.type === 'vertical' && (
                                    <>
                                        <option value="bottom-to-top">Abajo a Arriba</option>
                                        <option value="top-to-bottom">Arriba a Abajo</option>
                                    </>
                                )}
                                {progressBarConfig.type === 'circular' && (
                                    <>
                                        <option value="clockwise">Sentido Horario</option>
                                        <option value="counterclockwise">Sentido Antihorario</option>
                                    </>
                                )}
                            </select>
                        </div>

                        {/* Tamaño */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Tamaño
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Ancho (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.width}
                                        onChange={(e) => setProgressBarConfig({
                                            ...progressBarConfig,
                                            size: { ...progressBarConfig.size, width: Number(e.target.value) }
                                        })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        min="50"
                                        max="1000"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Alto (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={progressBarConfig.size.height}
                                        onChange={(e) => setProgressBarConfig({
                                            ...progressBarConfig,
                                            size: { ...progressBarConfig.size, height: Number(e.target.value) }
                                        })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        min="20"
                                        max="300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Indicador (Bolita) */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <label htmlFor="indicatorEnabled" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Indicador (Bolita)
                                </label>
                                <input
                                    type="checkbox"
                                    id="indicatorEnabled"
                                    checked={progressBarConfig.indicatorEnabled}
                                    onChange={(e) => setProgressBarConfig({ ...progressBarConfig, indicatorEnabled: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] rounded"
                                />
                            </div>

                            {progressBarConfig.indicatorEnabled && (
                                <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Tipo de Indicador
                                        </label>
                                        <select
                                            value={progressBarConfig.indicatorType}
                                            onChange={(e) => setProgressBarConfig({ ...progressBarConfig, indicatorType: e.target.value as any })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            <option value="circle">Círculo</option>
                                            <option value="image">Imagen</option>
                                            <option value="gif">GIF</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Tamaño (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={progressBarConfig.indicatorSize}
                                            onChange={(e) => setProgressBarConfig({ ...progressBarConfig, indicatorSize: Number(e.target.value) })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="10"
                                            max="100"
                                        />
                                    </div>

                                    {progressBarConfig.indicatorType === 'circle' && (
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Color
                                            </label>
                                            <input
                                                type="color"
                                                value={progressBarConfig.indicatorColor}
                                                onChange={(e) => setProgressBarConfig({ ...progressBarConfig, indicatorColor: e.target.value })}
                                                className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                            />
                                        </div>
                                    )}

                                    {(progressBarConfig.indicatorType === 'image' || progressBarConfig.indicatorType === 'gif') && (
                                        <>
                                            <MediaInputWithSelector
                                                value={progressBarConfig.indicatorImage}
                                                onChange={(value) => setProgressBarConfig({ ...progressBarConfig, indicatorImage: value })}
                                                label={`${progressBarConfig.indicatorType === 'gif' ? 'GIF' : 'Imagen'} del Indicador`}
                                                placeholder="URL o selecciona de tu galería..."
                                                allowedTypes={['image', 'gif']}
                                            />
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="indicatorRotate" className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                    Rotar indicador
                                                </label>
                                                <input
                                                    type="checkbox"
                                                    id="indicatorRotate"
                                                    checked={progressBarConfig.indicatorRotate}
                                                    onChange={(e) => setProgressBarConfig({ ...progressBarConfig, indicatorRotate: e.target.checked })}
                                                    className="w-5 h-5 text-[#2563eb] rounded"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VISUAL TAB - Now part of Progress Bar */}
                {activeTab === 'progressbar' && (
                    <>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                            🎨 Estilos Visuales de la Barra
                        </p>
                    </div>
                    <div className="space-y-6">
                        {/* Fondo de la Barra */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Fondo de la Barra
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tipo
                                    </label>
                                    <select
                                        value={progressBarConfig.backgroundType}
                                        onChange={(e) => setProgressBarConfig({ ...progressBarConfig, backgroundType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="color">Color Sólido</option>
                                        <option value="gradient">Gradiente</option>
                                        <option value="image">Imagen</option>
                                        <option value="gif">GIF</option>
                                    </select>
                                </div>

                                {progressBarConfig.backgroundType === 'color' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Color
                                        </label>
                                        <input
                                            type="color"
                                            value={progressBarConfig.backgroundColor}
                                            onChange={(e) => setProgressBarConfig({ ...progressBarConfig, backgroundColor: e.target.value })}
                                            className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                        />
                                    </div>
                                )}

                                {progressBarConfig.backgroundType === 'gradient' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 1
                                                </label>
                                                <input
                                                    type="color"
                                                    value={progressBarConfig.backgroundGradient.color1}
                                                    onChange={(e) => setProgressBarConfig({
                                                        ...progressBarConfig,
                                                        backgroundGradient: { ...progressBarConfig.backgroundGradient, color1: e.target.value }
                                                    })}
                                                    className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 2
                                                </label>
                                                <input
                                                    type="color"
                                                    value={progressBarConfig.backgroundGradient.color2}
                                                    onChange={(e) => setProgressBarConfig({
                                                        ...progressBarConfig,
                                                        backgroundGradient: { ...progressBarConfig.backgroundGradient, color2: e.target.value }
                                                    })}
                                                    className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Ángulo: {progressBarConfig.backgroundGradient.angle}°
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.backgroundGradient.angle}
                                                onChange={(e) => setProgressBarConfig({
                                                    ...progressBarConfig,
                                                    backgroundGradient: { ...progressBarConfig.backgroundGradient, angle: Number(e.target.value) }
                                                })}
                                                className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(progressBarConfig.backgroundType === 'image' || progressBarConfig.backgroundType === 'gif') && (
                                    <MediaInputWithSelector
                                        value={progressBarConfig.backgroundImage}
                                        onChange={(value) => setProgressBarConfig({ ...progressBarConfig, backgroundImage: value })}
                                        label="Imagen/GIF de Fondo"
                                        placeholder="URL o selecciona de tu galería..."
                                        allowedTypes={['image', 'gif']}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Relleno de la Barra */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Relleno de la Barra
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tipo
                                    </label>
                                    <select
                                        value={progressBarConfig.fillType}
                                        onChange={(e) => setProgressBarConfig({ ...progressBarConfig, fillType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="color">Color Sólido</option>
                                        <option value="gradient">Gradiente</option>
                                        <option value="image">Imagen</option>
                                        <option value="gif">GIF</option>
                                    </select>
                                </div>

                                {progressBarConfig.fillType === 'color' && (
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Color
                                        </label>
                                        <input
                                            type="color"
                                            value={progressBarConfig.fillColor}
                                            onChange={(e) => setProgressBarConfig({ ...progressBarConfig, fillColor: e.target.value })}
                                            className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                        />
                                    </div>
                                )}

                                {progressBarConfig.fillType === 'gradient' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 1
                                                </label>
                                                <input
                                                    type="color"
                                                    value={progressBarConfig.fillGradient.color1}
                                                    onChange={(e) => setProgressBarConfig({
                                                        ...progressBarConfig,
                                                        fillGradient: { ...progressBarConfig.fillGradient, color1: e.target.value }
                                                    })}
                                                    className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 2
                                                </label>
                                                <input
                                                    type="color"
                                                    value={progressBarConfig.fillGradient.color2}
                                                    onChange={(e) => setProgressBarConfig({
                                                        ...progressBarConfig,
                                                        fillGradient: { ...progressBarConfig.fillGradient, color2: e.target.value }
                                                    })}
                                                    className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Ángulo: {progressBarConfig.fillGradient.angle}°
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                value={progressBarConfig.fillGradient.angle}
                                                onChange={(e) => setProgressBarConfig({
                                                    ...progressBarConfig,
                                                    fillGradient: { ...progressBarConfig.fillGradient, angle: Number(e.target.value) }
                                                })}
                                                className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {(progressBarConfig.fillType === 'image' || progressBarConfig.fillType === 'gif') && (
                                    <MediaInputWithSelector
                                        value={progressBarConfig.fillImage}
                                        onChange={(value) => setProgressBarConfig({ ...progressBarConfig, fillImage: value })}
                                        label="Imagen/GIF de Relleno"
                                        placeholder="URL o selecciona de tu galería..."
                                        allowedTypes={['image', 'gif']}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Tema del Contenedor */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Tema del Contenedor
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Modo
                                    </label>
                                    <select
                                        value={themeConfig.mode}
                                        onChange={(e) => {
                                            const mode = e.target.value as 'light' | 'dark' | 'transparent';
                                            const newConfig = { ...themeConfig, mode };

                                            // Actualizar valores según el modo seleccionado
                                            if (mode === 'transparent') {
                                                newConfig.containerBackground = 'transparent';
                                                newConfig.containerOpacity = 0;
                                            } else if (mode === 'dark') {
                                                newConfig.containerBackground = '#1a1a1a';
                                                newConfig.containerOpacity = 85;
                                            } else if (mode === 'light') {
                                                newConfig.containerBackground = '#ffffff';
                                                newConfig.containerOpacity = 85;
                                            }

                                            setThemeConfig(newConfig);
                                        }}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="transparent">Transparente</option>
                                        <option value="dark">Oscuro</option>
                                        <option value="light">Claro</option>
                                    </select>
                                </div>
                                {themeConfig.mode !== 'transparent' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Color de Fondo
                                            </label>
                                            <input
                                                type="color"
                                                value={themeConfig.containerBackground}
                                                onChange={(e) => setThemeConfig({ ...themeConfig, containerBackground: e.target.value })}
                                                className="w-full h-12 rounded-lg cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Opacidad: {themeConfig.containerOpacity}%
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={themeConfig.containerOpacity}
                                                onChange={(e) => setThemeConfig({ ...themeConfig, containerOpacity: Number(e.target.value) })}
                                                className="w-full h-3 bg-[#e2e8f0] dark:bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                                            />
                                        </div>
                                    </>
                                )}
                                {themeConfig.mode === 'transparent' && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            ℹ️ Modo transparente activado. El fondo del overlay será completamente transparente, perfecto para integrarlo con tu stream sin fondo visible.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* LAYOUT TAB */}
                {activeTab === 'layout' && (
                    <div className="space-y-6">
                        {/* Visual Editor */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                <Move className="w-5 h-5 text-blue-600" />
                                Editor Visual de Posiciones
                            </h3>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                                Arrastra los elementos para posicionarlos. Los cambios se reflejan en tiempo real.
                            </p>

                            {/* Canvas */}
                            <div
                                ref={canvasRef}
                                className="relative w-full aspect-[10/3] border-2 border-dashed border-[#cbd5e1] dark:border-[#475569] rounded-xl bg-[#f8fafc] dark:bg-[#1a1a1a] overflow-hidden"
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                style={{
                                    backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0, 10px 10px'
                                }}
                            >
                                {/* Progress Bar - Draggable Box */}
                                <div
                                    onMouseDown={(e) => handleMouseDown('progressbar', e)}
                                    className={`absolute bg-purple-500/30 border-2 border-purple-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                                        dragElement === 'progressbar' ? 'ring-4 ring-purple-300' : ''
                                    }`}
                                    style={{
                                        left: `${(progressBarConfig.position.x / 1000) * 100}%`,
                                        top: `${(progressBarConfig.position.y / 300) * 100}%`,
                                        width: `${(progressBarConfig.size.width / 1000) * 100}%`,
                                        height: `${(progressBarConfig.size.height / 300) * 100}%`
                                    }}
                                >
                                    <div className="text-center text-xs">
                                        <div>Barra de Progreso</div>
                                        <div className="text-[10px] opacity-75">Arrastra para mover</div>
                                    </div>
                                </div>

                                {/* Title - Draggable Box */}
                                {displayConfig.showTitle && (
                                    <div
                                        onMouseDown={(e) => handleMouseDown('title', e)}
                                        className={`absolute bg-blue-500/30 border-2 border-blue-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                                            dragElement === 'title' ? 'ring-4 ring-blue-300' : ''
                                        }`}
                                        style={{
                                            left: `${(styleConfig.titlePosition.x / 1000) * 100}%`,
                                            top: `${(styleConfig.titlePosition.y / 300) * 100}%`,
                                            width: '150px',
                                            height: '40px',
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    >
                                        <div className="text-center text-xs">
                                            <div>Título</div>
                                            <div className="text-[10px] opacity-75">Arrastra</div>
                                        </div>
                                    </div>
                                )}

                                {/* Time - Draggable Box */}
                                <div
                                    onMouseDown={(e) => handleMouseDown('time', e)}
                                    className={`absolute bg-green-500/30 border-2 border-green-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                                        dragElement === 'time' ? 'ring-4 ring-green-300' : ''
                                    }`}
                                    style={{
                                        left: `${(styleConfig.timePosition.x / 1000) * 100}%`,
                                        top: `${(styleConfig.timePosition.y / 300) * 100}%`,
                                        width: '120px',
                                        height: '50px',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    <div className="text-center text-xs">
                                        <div>Tiempo</div>
                                        <div className="text-[10px] opacity-75">Arrastra</div>
                                    </div>
                                </div>

                                {/* Percentage - Draggable Box */}
                                {displayConfig.showPercentage && (
                                    <div
                                        onMouseDown={(e) => handleMouseDown('percentage', e)}
                                        className={`absolute bg-yellow-500/30 border-2 border-yellow-500 rounded-lg flex items-center justify-center text-white font-bold cursor-move ${
                                            dragElement === 'percentage' ? 'ring-4 ring-yellow-300' : ''
                                        }`}
                                        style={{
                                            left: `${(styleConfig.percentagePosition.x / 1000) * 100}%`,
                                            top: `${(styleConfig.percentagePosition.y / 300) * 100}%`,
                                            width: '80px',
                                            height: '30px',
                                            transform: 'translate(-50%, -50%)'
                                        }}
                                    >
                                        <div className="text-center text-xs">
                                            <div>%</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Manual Position Controls */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Title Positions */}
                                {displayConfig.showTitle && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                                            Posición del Título
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-blue-600 dark:text-blue-400 mb-1 block">X</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.titlePosition.x}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, titlePosition: { ...styleConfig.titlePosition, x: parseInt(e.target.value) || 0 } })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-blue-300 dark:border-blue-700 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-blue-600 dark:text-blue-400 mb-1 block">Y</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.titlePosition.y}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, titlePosition: { ...styleConfig.titlePosition, y: parseInt(e.target.value) || 0 } })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-blue-300 dark:border-blue-700 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Time Positions */}
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <h4 className="text-sm font-bold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                                        Posición del Tiempo
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-green-600 dark:text-green-400 mb-1 block">X</label>
                                            <input
                                                type="number"
                                                value={styleConfig.timePosition.x}
                                                onChange={(e) => setStyleConfig({ ...styleConfig, timePosition: { ...styleConfig.timePosition, x: parseInt(e.target.value) || 0 } })}
                                                className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-green-300 dark:border-green-700 rounded text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-green-600 dark:text-green-400 mb-1 block">Y</label>
                                            <input
                                                type="number"
                                                value={styleConfig.timePosition.y}
                                                onChange={(e) => setStyleConfig({ ...styleConfig, timePosition: { ...styleConfig.timePosition, y: parseInt(e.target.value) || 0 } })}
                                                className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-green-300 dark:border-green-700 rounded text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Percentage Positions */}
                                {displayConfig.showPercentage && (
                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                        <h4 className="text-sm font-bold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2">
                                            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                                            Posición del Porcentaje
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 block">X</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.percentagePosition.x}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, percentagePosition: { ...styleConfig.percentagePosition, x: parseInt(e.target.value) || 0 } })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-yellow-300 dark:border-yellow-700 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 block">Y</label>
                                                <input
                                                    type="number"
                                                    value={styleConfig.percentagePosition.y}
                                                    onChange={(e) => setStyleConfig({ ...styleConfig, percentagePosition: { ...styleConfig.percentagePosition, y: parseInt(e.target.value) || 0 } })}
                                                    className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-yellow-300 dark:border-yellow-700 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Progress Bar Positions */}
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                    <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-500 rounded"></div>
                                        Posición de la Barra
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-purple-600 dark:text-purple-400 mb-1 block">X</label>
                                            <input
                                                type="number"
                                                value={progressBarConfig.position.x}
                                                onChange={(e) => setProgressBarConfig({ ...progressBarConfig, position: { ...progressBarConfig.position, x: parseInt(e.target.value) || 0 } })}
                                                className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-purple-300 dark:border-purple-700 rounded text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-purple-600 dark:text-purple-400 mb-1 block">Y</label>
                                            <input
                                                type="number"
                                                value={progressBarConfig.position.y}
                                                onChange={(e) => setProgressBarConfig({ ...progressBarConfig, position: { ...progressBarConfig.position, y: parseInt(e.target.value) || 0 } })}
                                                className="w-full px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-purple-300 dark:border-purple-700 rounded text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ANIMATIONS TAB */}
                {activeTab === 'animations' && (
                    <div className="space-y-6">
                        {/* Animación de Entrada */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Animación de Entrada
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tipo
                                    </label>
                                    <select
                                        value={animationConfig.entranceType}
                                        onChange={(e) => setAnimationConfig({ ...animationConfig, entranceType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="none">Ninguna</option>
                                        <option value="fade">Fade</option>
                                        <option value="slide">Slide</option>
                                        <option value="bounce">Bounce</option>
                                        <option value="zoom">Zoom</option>
                                        <option value="rotate">Rotate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Velocidad
                                    </label>
                                    <select
                                        value={animationConfig.entranceSpeed}
                                        onChange={(e) => setAnimationConfig({ ...animationConfig, entranceSpeed: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="slow">Lenta</option>
                                        <option value="normal">Normal</option>
                                        <option value="fast">Rápida</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Animación de Salida */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Animación de Salida
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tipo
                                    </label>
                                    <select
                                        value={animationConfig.exitType}
                                        onChange={(e) => setAnimationConfig({ ...animationConfig, exitType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="none">Ninguna</option>
                                        <option value="fade">Fade</option>
                                        <option value="slide">Slide</option>
                                        <option value="bounce">Bounce</option>
                                        <option value="zoom">Zoom</option>
                                        <option value="rotate">Rotate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Velocidad
                                    </label>
                                    <select
                                        value={animationConfig.exitSpeed}
                                        onChange={(e) => setAnimationConfig({ ...animationConfig, exitSpeed: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                    >
                                        <option value="slow">Lenta</option>
                                        <option value="normal">Normal</option>
                                        <option value="fast">Rápida</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Efecto Durante Ejecución */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                Efecto Durante Ejecución
                            </h3>
                            <select
                                value={animationConfig.runningEffect}
                                onChange={(e) => setAnimationConfig({ ...animationConfig, runningEffect: e.target.value as any })}
                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                            >
                                <option value="none">Ninguno</option>
                                <option value="pulse">Pulso</option>
                                <option value="glow">Brillo</option>
                                <option value="shake">Temblor</option>
                            </select>
                        </div>

                        {/* Palpitaciones al Llegar a Tiempo X */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <label htmlFor="pulseOnZero" className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                    Efecto de Palpitación por Tiempo
                                </label>
                                <input
                                    type="checkbox"
                                    id="pulseOnZero"
                                    checked={animationConfig.pulseOnZero}
                                    onChange={(e) => setAnimationConfig({ ...animationConfig, pulseOnZero: e.target.checked })}
                                    className="w-5 h-5 text-[#2563eb] rounded"
                                />
                            </div>

                            {animationConfig.pulseOnZero && (
                                <div className="space-y-4 pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                    {/* Tiempo de activación */}
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Activar cuando queden
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                value={animationConfig.pulseOnZeroTime}
                                                onChange={(e) => setAnimationConfig({ ...animationConfig, pulseOnZeroTime: Number(e.target.value) })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                                placeholder="0"
                                            />
                                            <select
                                                value={animationConfig.pulseOnZeroTimeUnit}
                                                onChange={(e) => setAnimationConfig({ ...animationConfig, pulseOnZeroTimeUnit: e.target.value as any })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                <option value="seconds">Segundos</option>
                                                <option value="minutes">Minutos</option>
                                                <option value="hours">Horas</option>
                                            </select>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Ejemplo: 0 segundos = al llegar a cero, 5 minutos = cuando queden 5 minutos
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Duración del efecto (segundos)
                                            </label>
                                            <input
                                                type="number"
                                                value={animationConfig.pulseOnZeroDuration}
                                                onChange={(e) => setAnimationConfig({ ...animationConfig, pulseOnZeroDuration: Number(e.target.value) })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                                max="60"
                                            />
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                0 = hasta que termine el timer
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Velocidad del pulso
                                            </label>
                                            <select
                                                value={animationConfig.pulseOnZeroSpeed}
                                                onChange={(e) => setAnimationConfig({ ...animationConfig, pulseOnZeroSpeed: e.target.value as any })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                <option value="slow">Lenta</option>
                                                <option value="normal">Normal</option>
                                                <option value="fast">Rápida</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* EVENTS TAB */}
                {activeTab === 'events' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ Configura cuánto tiempo se agregará automáticamente al timer cuando ocurran eventos de Twitch.
                            </p>
                        </div>

                        {/* Bits */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">💎 Bits / Cheers</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.bits.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, bits: { ...eventsConfig.bits, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.bits.enabled && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Cada X Bits
                                            </label>
                                            <input
                                                type="number"
                                                value={eventsConfig.bits.perBits}
                                                onChange={(e) => setEventsConfig({ ...eventsConfig, bits: { ...eventsConfig.bits, perBits: Number(e.target.value) || 1 } })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="1"
                                            />
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Por cada {eventsConfig.bits.perBits} bits</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Agregar Tiempo
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={convertSecondsToUnit(eventsConfig.bits.time, eventTimeUnits.bits)}
                                                    onChange={(e) => {
                                                        const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.bits);
                                                        setEventsConfig({ ...eventsConfig, bits: { ...eventsConfig.bits, time: newTime } });
                                                    }}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                    min="0"
                                                />
                                                <select
                                                    value={eventTimeUnits.bits}
                                                    onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, bits: e.target.value as TimeUnit })}
                                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                = {formatTime(eventsConfig.bits.time)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Follow */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">❤️ Follow</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.follow.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, follow: { ...eventsConfig.follow, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.follow.enabled && (
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tiempo Agregado
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={convertSecondsToUnit(eventsConfig.follow.time, eventTimeUnits.follow)}
                                            onChange={(e) => {
                                                const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.follow);
                                                setEventsConfig({ ...eventsConfig, follow: { ...eventsConfig.follow, time: newTime } });
                                            }}
                                            className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="0"
                                        />
                                        <select
                                            value={eventTimeUnits.follow}
                                            onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, follow: e.target.value as TimeUnit })}
                                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        = {formatTime(eventsConfig.follow.time)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Prime Subs */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">👑 Prime Gaming Sub</h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Suscripciones con Amazon Prime (Tier 1)</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.subPrime.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, subPrime: { ...eventsConfig.subPrime, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.subPrime.enabled && (
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tiempo Agregado
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={convertSecondsToUnit(eventsConfig.subPrime.time, eventTimeUnits.subPrime)}
                                            onChange={(e) => {
                                                const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.subPrime);
                                                setEventsConfig({ ...eventsConfig, subPrime: { ...eventsConfig.subPrime, time: newTime } });
                                            }}
                                            className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="0"
                                        />
                                        <select
                                            value={eventTimeUnits.subPrime}
                                            onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, subPrime: e.target.value as TimeUnit })}
                                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        = {formatTime(eventsConfig.subPrime.time)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Subs Pagadas */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-4">⭐ Suscripciones Pagadas</h3>
                            <div className="space-y-4">
                                {/* Tier 1 Pagada */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tier 1 Pagada ($4.99)</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={eventsConfig.subTier1.enabled}
                                                onChange={(e) => setEventsConfig({ ...eventsConfig, subTier1: { ...eventsConfig.subTier1, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {eventsConfig.subTier1.enabled && (
                                        <div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={convertSecondsToUnit(eventsConfig.subTier1.time, eventTimeUnits.subTier1)}
                                                    onChange={(e) => {
                                                        const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.subTier1);
                                                        setEventsConfig({ ...eventsConfig, subTier1: { ...eventsConfig.subTier1, time: newTime } });
                                                    }}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                />
                                                <select
                                                    value={eventTimeUnits.subTier1}
                                                    onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, subTier1: e.target.value as TimeUnit })}
                                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">= {formatTime(eventsConfig.subTier1.time)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Tier 2 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tier 2 ($9.99)</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={eventsConfig.subTier2.enabled}
                                                onChange={(e) => setEventsConfig({ ...eventsConfig, subTier2: { ...eventsConfig.subTier2, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {eventsConfig.subTier2.enabled && (
                                        <div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={convertSecondsToUnit(eventsConfig.subTier2.time, eventTimeUnits.subTier2)}
                                                    onChange={(e) => {
                                                        const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.subTier2);
                                                        setEventsConfig({ ...eventsConfig, subTier2: { ...eventsConfig.subTier2, time: newTime } });
                                                    }}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                />
                                                <select
                                                    value={eventTimeUnits.subTier2}
                                                    onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, subTier2: e.target.value as TimeUnit })}
                                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">= {formatTime(eventsConfig.subTier2.time)}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Tier 3 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tier 3 ($24.99)</span>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={eventsConfig.subTier3.enabled}
                                                onChange={(e) => setEventsConfig({ ...eventsConfig, subTier3: { ...eventsConfig.subTier3, enabled: e.target.checked } })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {eventsConfig.subTier3.enabled && (
                                        <div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={convertSecondsToUnit(eventsConfig.subTier3.time, eventTimeUnits.subTier3)}
                                                    onChange={(e) => {
                                                        const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.subTier3);
                                                        setEventsConfig({ ...eventsConfig, subTier3: { ...eventsConfig.subTier3, time: newTime } });
                                                    }}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                />
                                                <select
                                                    value={eventTimeUnits.subTier3}
                                                    onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, subTier3: e.target.value as TimeUnit })}
                                                    className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                >
                                                    {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                        <option key={key} value={key}>{label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">= {formatTime(eventsConfig.subTier3.time)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Gift Subs */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🎁 Gift Sub</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.giftSub.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, giftSub: { ...eventsConfig.giftSub, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.giftSub.enabled && (
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tiempo por Sub Regalada
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={convertSecondsToUnit(eventsConfig.giftSub.time, eventTimeUnits.giftSub)}
                                            onChange={(e) => {
                                                const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.giftSub);
                                                setEventsConfig({ ...eventsConfig, giftSub: { ...eventsConfig.giftSub, time: newTime } });
                                            }}
                                            className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="0"
                                        />
                                        <select
                                            value={eventTimeUnits.giftSub}
                                            onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, giftSub: e.target.value as TimeUnit })}
                                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        = {formatTime(eventsConfig.giftSub.time)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Raid */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🚀 Raid</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.raid.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, raid: { ...eventsConfig.raid, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.raid.enabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Tiempo Base
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={convertSecondsToUnit(eventsConfig.raid.time, eventTimeUnits.raidBase)}
                                                onChange={(e) => {
                                                    const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.raidBase);
                                                    setEventsConfig({ ...eventsConfig, raid: { ...eventsConfig.raid, time: newTime } });
                                                }}
                                                className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                            />
                                            <select
                                                value={eventTimeUnits.raidBase}
                                                onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, raidBase: e.target.value as TimeUnit })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            = {formatTime(eventsConfig.raid.time)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            + Por Participante
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={convertSecondsToUnit(eventsConfig.raid.timePerParticipant, eventTimeUnits.raidPerParticipant)}
                                                onChange={(e) => {
                                                    const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.raidPerParticipant);
                                                    setEventsConfig({ ...eventsConfig, raid: { ...eventsConfig.raid, timePerParticipant: newTime } });
                                                }}
                                                className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                                min="0"
                                            />
                                            <select
                                                value={eventTimeUnits.raidPerParticipant}
                                                onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, raidPerParticipant: e.target.value as TimeUnit })}
                                                className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            >
                                                {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Por cada raider
                                        </p>
                                    </div>
                                    <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                                        <p className="text-xs text-purple-700 dark:text-purple-300">
                                            💡 Ejemplo: Raid de 50 personas = {formatTime(eventsConfig.raid.time + (50 * eventsConfig.raid.timePerParticipant))}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hype Train */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">🔥 Hype Train</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={eventsConfig.hypeTrain.enabled}
                                        onChange={(e) => setEventsConfig({ ...eventsConfig, hypeTrain: { ...eventsConfig.hypeTrain, enabled: e.target.checked } })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            {eventsConfig.hypeTrain.enabled && (
                                <div>
                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                        Tiempo Agregado
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={convertSecondsToUnit(eventsConfig.hypeTrain.time, eventTimeUnits.hypeTrain)}
                                            onChange={(e) => {
                                                const newTime = convertUnitToSeconds(Number(e.target.value) || 0, eventTimeUnits.hypeTrain);
                                                setEventsConfig({ ...eventsConfig, hypeTrain: { ...eventsConfig.hypeTrain, time: newTime } });
                                            }}
                                            className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                            min="0"
                                        />
                                        <select
                                            value={eventTimeUnits.hypeTrain}
                                            onChange={(e) => setEventTimeUnits({ ...eventTimeUnits, hypeTrain: e.target.value as TimeUnit })}
                                            className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc]"
                                        >
                                            {Object.entries(TIME_UNITS).map(([key, { label }]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                        = {formatTime(eventsConfig.hypeTrain.time)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Testing de Eventos */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl border-2 border-purple-300 dark:border-purple-700 p-6 shadow-lg">
                            <div className="mb-4">
                                <h3 className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">🧪 Testear Eventos</h3>
                                <p className="text-xs text-purple-600 dark:text-purple-400">
                                    Simula eventos para probar tu configuración. Asegúrate de tener el timer iniciado.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { type: 'bits', label: '💎 100 Bits', icon: '💎' },
                                    { type: 'follow', label: '❤️ Follow', icon: '❤️' },
                                    { type: 'sub', label: '⭐ Sub T1', icon: '⭐' },
                                    { type: 'prime', label: '👑 Prime Sub', icon: '👑' },
                                    { type: 'giftsub', label: '🎁 Gift Sub', icon: '🎁' },
                                    { type: 'raid', label: '🚀 Raid 50', icon: '🚀' },
                                    { type: 'hypetrain', label: '🔥 Hype Train', icon: '🔥' }
                                ].map(event => (
                                    <button
                                        key={event.type}
                                        onClick={async () => {
                                            try {
                                                const response = await api.post('/timer/test/event', {
                                                    eventType: event.type,
                                                    username: 'TestUser',
                                                    amount: event.type === 'bits' ? 100 : event.type === 'raid' ? 50 : 1,
                                                    tier: '1000',
                                                    level: 1
                                                });

                                                if (response.data.success) {
                                                    alert(`✅ ${response.data.message}`);
                                                } else {
                                                    alert(`⚠️ ${response.data.message}`);
                                                }
                                            } catch (err: any) {
                                                const errorMsg = err.response?.data?.message || err.message;
                                                alert(`❌ Error: ${errorMsg}`);
                                            }
                                        }}
                                        className="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 rounded-lg text-sm font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-400 dark:hover:border-purple-500 transition-all shadow-sm hover:shadow-md"
                                    >
                                        <div className="text-xl mb-1">{event.icon}</div>
                                        <div className="text-xs">{event.label}</div>
                                    </button>
                                ))}
                            </div>

                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-4 text-center">
                                💡 Los eventos aparecerán en el overlay si el timer está corriendo
                            </p>
                        </div>
                    </div>
                )}

                {/* COMMANDS TAB */}
                {activeTab === 'commands' && (
                    <div className="space-y-6">
                        {/* Info Banner */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                        Control del Timer por Chat
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        Solo el streamer y moderadores pueden usar estos comandos. Configura blacklist para bloquear usuarios específicos o whitelist para permitir solo ciertos usuarios.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Control Commands Section */}
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                                <p className="text-sm font-bold text-green-700 dark:text-green-300 flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    Comandos de Control del Timer
                                </p>
                            </div>

                            {/* !dplay */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-green-300 dark:hover:border-green-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                        <Play className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dplay
                                            <span className="text-xs font-normal px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">
                                                Control
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Iniciar o resumir el timer</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.play.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, play: { ...commandsConfig.play, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.play.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist (usuarios bloqueados, separados por comas)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.play.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, play: { ...commandsConfig.play, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2, usuario3"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist (solo estos usuarios, separados por comas)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.play.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, play: { ...commandsConfig.play, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2, usuario3"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* !dpause */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-yellow-300 dark:hover:border-yellow-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                                        <Pause className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dpause
                                            <span className="text-xs font-normal px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-md">
                                                Control
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Pausar el timer</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.pause.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, pause: { ...commandsConfig.pause, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.pause.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.pause.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, pause: { ...commandsConfig.pause, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.pause.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, pause: { ...commandsConfig.pause, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* !dreset */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                        <RotateCcw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dreset
                                            <span className="text-xs font-normal px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
                                                Control
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Reiniciar el timer desde cero</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.reset.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, reset: { ...commandsConfig.reset, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.reset.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.reset.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, reset: { ...commandsConfig.reset, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.reset.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, reset: { ...commandsConfig.reset, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* !dstop */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-red-300 dark:hover:border-red-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                        <StopCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dstop
                                            <span className="text-xs font-normal px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md">
                                                Control
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Detener y ocultar el timer completamente</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.stop.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, stop: { ...commandsConfig.stop, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.stop.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.stop.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, stop: { ...commandsConfig.stop, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.stop.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, stop: { ...commandsConfig.stop, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Time Adjustment Commands Section */}
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4">
                                <p className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Comandos de Ajuste de Tiempo
                                </p>
                            </div>

                            {/* !dtimer + */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-purple-300 dark:hover:border-purple-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                        <PlusCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dtimer +{'{tiempo}'}
                                            <span className="text-xs font-normal px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md">
                                                Tiempo
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Añadir tiempo al timer (ej: !dtimer +5m)</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.addTime.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, addTime: { ...commandsConfig.addTime, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.addTime.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.addTime.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, addTime: { ...commandsConfig.addTime, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.addTime.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, addTime: { ...commandsConfig.addTime, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* !dtimer - */}
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border-2 border-[#e2e8f0] dark:border-[#374151] hover:border-pink-300 dark:hover:border-pink-700 transition-all p-6 shadow-lg">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                                        <MinusCircle className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                            !dtimer -{'{tiempo}'}
                                            <span className="text-xs font-normal px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-md">
                                                Tiempo
                                            </span>
                                        </h3>
                                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Restar tiempo al timer (ej: !dtimer -5m)</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={commandsConfig.removeTime.enabled}
                                            onChange={(e) => setCommandsConfig({ ...commandsConfig, removeTime: { ...commandsConfig.removeTime, enabled: e.target.checked } })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 dark:peer-focus:ring-pink-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-pink-600"></div>
                                    </label>
                                </div>
                                {commandsConfig.removeTime.enabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-red-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Blacklist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.removeTime.blacklist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, removeTime: { ...commandsConfig.removeTime, blacklist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-red-400 dark:focus:border-red-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-green-500 mt-2.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Whitelist
                                                </label>
                                                <input
                                                    type="text"
                                                    value={commandsConfig.removeTime.whitelist.join(', ')}
                                                    onChange={(e) => setCommandsConfig({ ...commandsConfig, removeTime: { ...commandsConfig.removeTime, whitelist: e.target.value.split(',').map(u => u.trim()).filter(u => u) } })}
                                                    className="w-full px-4 py-2 border-2 border-[#e2e8f0] dark:border-[#374151] focus:border-green-400 dark:focus:border-green-600 rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm transition-colors"
                                                    placeholder="usuario1, usuario2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ALERTS TAB - Sonidos + Overlay Alerts */}
                {activeTab === 'alerts' && (
                    <div className="space-y-6">
                        {/* Preview Section */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    Vista Previa en Vivo
                                </h3>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={previewAlertType}
                                        onChange={(e) => setPreviewAlertType(e.target.value as TimerEventType)}
                                        className="px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                    >
                                        <option value="follow">Follow</option>
                                        <option value="bits">Bits</option>
                                        <option value="subPrime">Sub Prime</option>
                                        <option value="subTier1">Sub Tier 1</option>
                                        <option value="subTier2">Sub Tier 2</option>
                                        <option value="subTier3">Sub Tier 3</option>
                                        <option value="giftSub">Gift Sub</option>
                                        <option value="raid">Raid</option>
                                        <option value="hypeTrain">Hype Train</option>
                                    </select>
                                    <button
                                        onClick={() => setShowAlertPreview(!showAlertPreview)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                    >
                                        {showAlertPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        {showAlertPreview ? 'Ocultar' : 'Mostrar'} Preview
                                    </button>
                                </div>
                            </div>

                            {showAlertPreview && (
                                <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg" style={{ width: '1920px', height: '400px', maxWidth: '100%' }}>
                                    <EventAlertPreview
                                        eventType={previewAlertType}
                                        userName="TestUser"
                                        amount={previewAlertType === 'bits' ? 100 : previewAlertType === 'raid' ? 50 : previewAlertType === 'giftSub' ? 5 : previewAlertType === 'hypeTrain' ? 3 : undefined}
                                        secondsAdded={alertsConfig.events[previewAlertType].useGlobalStyle ? 300 : 300}
                                        message={alertsConfig.events[previewAlertType].message}
                                        icon={alertsConfig.events[previewAlertType].icon}
                                        customIcon={alertsConfig.events[previewAlertType].customIcon}
                                        style={alertsConfig.events[previewAlertType].useGlobalStyle
                                            ? alertsConfig.global.style
                                            : { ...alertsConfig.global.style, ...alertsConfig.events[previewAlertType].customStyle }
                                        }
                                        animation={alertsConfig.global.animation}
                                        isVisible={showAlertPreview}
                                        position={alertsConfig.global.position}
                                        size={alertsConfig.global.size}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Sub-tabs Navigation */}
                        <div className="flex gap-2 border-b border-[#e2e8f0] dark:border-[#374151]">
                            <button
                                onClick={() => setAlertsSubTab('template')}
                                className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                    alertsSubTab === 'template'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                                }`}
                            >
                                Plantilla
                            </button>
                            <button
                                onClick={() => setAlertsSubTab('style')}
                                className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                    alertsSubTab === 'style'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                                }`}
                            >
                                Estilo Global
                            </button>
                            <button
                                onClick={() => setAlertsSubTab('events')}
                                className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                    alertsSubTab === 'events'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                                }`}
                            >
                                Eventos
                            </button>
                            <button
                                onClick={() => setAlertsSubTab('sounds')}
                                className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                    alertsSubTab === 'sounds'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-[#64748b] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                                }`}
                            >
                                Sonidos
                            </button>
                        </div>

                        {/* Template Sub-tab */}
                        {alertsSubTab === 'template' && (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                    Seleccionar Plantilla
                                </h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
                                    Elige una plantilla predefinida o crea tu propia configuración personalizada
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Minimal Template */}
                                    <div
                                        onClick={() => {
                                            setAlertsConfig({ ...alertsConfig, template: 'minimal', global: { ...alertsConfig.global, ...ALERT_TEMPLATES.minimal.global } });
                                        }}
                                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                                            alertsConfig.template === 'minimal'
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                alertsConfig.template === 'minimal' ? 'border-purple-600' : 'border-[#cbd5e1]'
                                            }`}>
                                                {alertsConfig.template === 'minimal' && (
                                                    <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Minimal</h4>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            Diseño simple y limpio. Perfecto para overlays minimalistas.
                                        </p>
                                    </div>

                                    {/* Colorful Template */}
                                    <div
                                        onClick={() => {
                                            setAlertsConfig({ ...alertsConfig, template: 'colorful', global: { ...alertsConfig.global, ...ALERT_TEMPLATES.colorful.global } });
                                        }}
                                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                                            alertsConfig.template === 'colorful'
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                alertsConfig.template === 'colorful' ? 'border-purple-600' : 'border-[#cbd5e1]'
                                            }`}>
                                                {alertsConfig.template === 'colorful' && (
                                                    <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Colorful</h4>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            Diseño vibrante y llamativo. Gradientes dinámicos y animaciones suaves.
                                        </p>
                                    </div>

                                    {/* Gaming Template */}
                                    <div
                                        onClick={() => {
                                            setAlertsConfig({ ...alertsConfig, template: 'gaming', global: { ...alertsConfig.global, ...ALERT_TEMPLATES.gaming.global } });
                                        }}
                                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                                            alertsConfig.template === 'gaming'
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                alertsConfig.template === 'gaming' ? 'border-purple-600' : 'border-[#cbd5e1]'
                                            }`}>
                                                {alertsConfig.template === 'gaming' && (
                                                    <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Gaming</h4>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            Estilo gamer con bordes neón y fuente monospace. Para streams retro/gaming.
                                        </p>
                                    </div>

                                    {/* Custom Template */}
                                    <div
                                        onClick={() => {
                                            setAlertsConfig({ ...alertsConfig, template: 'custom' });
                                        }}
                                        className={`cursor-pointer border-2 rounded-lg p-4 transition-all ${
                                            alertsConfig.template === 'custom'
                                                ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                                : 'border-[#e2e8f0] dark:border-[#374151] hover:border-purple-400'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                alertsConfig.template === 'custom' ? 'border-purple-600' : 'border-[#cbd5e1]'
                                            }`}>
                                                {alertsConfig.template === 'custom' && (
                                                    <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                                                )}
                                            </div>
                                            <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc]">Custom</h4>
                                        </div>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                            Personaliza todo manualmente según tus preferencias.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Style Global Sub-tab */}
                        {alertsSubTab === 'style' && (
                            <div className="space-y-6">
                                {/* Position & Size */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                        <Move className="w-5 h-5 text-purple-600" />
                                        Posición y Tamaño
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Posición X (px)
                                            </label>
                                            <input
                                                type="number"
                                                value={alertsConfig.global.position.x}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, position: { ...alertsConfig.global.position, x: Number(e.target.value) } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Posición Y (px)
                                            </label>
                                            <input
                                                type="number"
                                                value={alertsConfig.global.position.y}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, position: { ...alertsConfig.global.position, y: Number(e.target.value) } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Ancho (px)
                                            </label>
                                            <input
                                                type="number"
                                                value={alertsConfig.global.size.width}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, size: { ...alertsConfig.global.size, width: Number(e.target.value) } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Alto (px)
                                            </label>
                                            <input
                                                type="number"
                                                value={alertsConfig.global.size.height}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, size: { ...alertsConfig.global.size, height: Number(e.target.value) } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Duración (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={alertsConfig.global.duration}
                                            onChange={(e) => setAlertsConfig({
                                                ...alertsConfig,
                                                global: { ...alertsConfig.global, duration: Number(e.target.value) }
                                            })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                        />
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Tiempo que la alerta permanece visible (5000 = 5 segundos)
                                        </p>
                                    </div>
                                </div>

                                {/* Background */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                        <Palette className="w-5 h-5 text-purple-600" />
                                        Fondo
                                    </h3>

                                    <div className="mb-4">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Tipo de Fondo
                                        </label>
                                        <select
                                            value={alertsConfig.global.style.backgroundType}
                                            onChange={(e) => setAlertsConfig({
                                                ...alertsConfig,
                                                global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, backgroundType: e.target.value as 'color' | 'gradient' | 'image' | 'gif' } }
                                            })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                        >
                                            <option value="color">Color Sólido</option>
                                            <option value="gradient">Gradiente</option>
                                            <option value="image">Imagen</option>
                                            <option value="gif">GIF Animado</option>
                                        </select>
                                    </div>

                                    {alertsConfig.global.style.backgroundType === 'color' && (
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Color de Fondo
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={alertsConfig.global.style.backgroundColor}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, backgroundColor: e.target.value } }
                                                    })}
                                                    className="w-16 h-10 rounded cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={alertsConfig.global.style.backgroundColor}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, backgroundColor: e.target.value } }
                                                    })}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    placeholder="#1a1a1a"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {alertsConfig.global.style.backgroundType === 'gradient' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 1
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        value={alertsConfig.global.style.gradient.color1}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, gradient: { ...alertsConfig.global.style.gradient, color1: e.target.value } } }
                                                        })}
                                                        className="w-16 h-10 rounded cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={alertsConfig.global.style.gradient.color1}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, gradient: { ...alertsConfig.global.style.gradient, color1: e.target.value } } }
                                                        })}
                                                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color 2
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        value={alertsConfig.global.style.gradient.color2}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, gradient: { ...alertsConfig.global.style.gradient, color2: e.target.value } } }
                                                        })}
                                                        className="w-16 h-10 rounded cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={alertsConfig.global.style.gradient.color2}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, gradient: { ...alertsConfig.global.style.gradient, color2: e.target.value } } }
                                                        })}
                                                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Ángulo: {alertsConfig.global.style.gradient.angle}°
                                                </label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    value={alertsConfig.global.style.gradient.angle}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, gradient: { ...alertsConfig.global.style.gradient, angle: Number(e.target.value) } } }
                                                    })}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(alertsConfig.global.style.backgroundType === 'image' || alertsConfig.global.style.backgroundType === 'gif') && (
                                        <MediaInputWithSelector
                                            value={alertsConfig.global.style.backgroundImage || ''}
                                            onChange={(value) => setAlertsConfig({
                                                ...alertsConfig,
                                                global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, backgroundImage: value } }
                                            })}
                                            label="Imagen/GIF de Fondo"
                                            placeholder="URL o selecciona de tu galería..."
                                            allowedTypes={alertsConfig.global.style.backgroundType === 'gif' ? ['gif'] : ['image', 'gif']}
                                        />
                                    )}

                                    <div className="mt-4">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Opacidad: {alertsConfig.global.style.opacity}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={alertsConfig.global.style.opacity}
                                            onChange={(e) => setAlertsConfig({
                                                ...alertsConfig,
                                                global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, opacity: Number(e.target.value) } }
                                            })}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                {/* Text */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                        <Type className="w-5 h-5 text-purple-600" />
                                        Texto
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Color del Texto
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="color"
                                                    value={alertsConfig.global.style.textColor}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, textColor: e.target.value } }
                                                    })}
                                                    className="w-16 h-10 rounded cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={alertsConfig.global.style.textColor}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, textColor: e.target.value } }
                                                    })}
                                                    className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Tamaño de Fuente (px)
                                            </label>
                                            <input
                                                type="number"
                                                value={alertsConfig.global.style.fontSize}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, fontSize: Number(e.target.value) } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Fuente
                                            </label>
                                            <select
                                                value={alertsConfig.global.style.fontFamily}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, fontFamily: e.target.value } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="Arial, sans-serif">Arial</option>
                                                <option value="'Poppins', Arial, sans-serif">Poppins</option>
                                                <option value="'Courier New', Consolas, monospace">Courier New</option>
                                                <option value="'Roboto', Arial, sans-serif">Roboto</option>
                                                <option value="'Inter', Arial, sans-serif">Inter</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Peso de Fuente
                                            </label>
                                            <select
                                                value={alertsConfig.global.style.fontWeight}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, fontWeight: e.target.value as 'normal' | 'bold' | 'bolder' | 'lighter' } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="normal">Normal</option>
                                                <option value="bold">Negrita</option>
                                                <option value="bolder">Más Negrita</option>
                                                <option value="lighter">Ligera</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Sombra de Texto
                                            </label>
                                            <select
                                                value={alertsConfig.global.style.textShadow}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, textShadow: e.target.value as 'none' | 'normal' | 'strong' | 'glow' } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="none">Sin Sombra</option>
                                                <option value="normal">Normal</option>
                                                <option value="strong">Fuerte</option>
                                                <option value="glow">Brillo (Glow)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Borders */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                        Bordes
                                    </h3>

                                    <div className="mb-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.global.style.borderEnabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, borderEnabled: e.target.checked } }
                                                })}
                                                className="w-4 h-4 text-purple-600 rounded"
                                            />
                                            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                                Habilitar Bordes
                                            </span>
                                        </label>
                                    </div>

                                    {alertsConfig.global.style.borderEnabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Color del Borde
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="color"
                                                        value={alertsConfig.global.style.borderColor}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, borderColor: e.target.value } }
                                                        })}
                                                        className="w-16 h-10 rounded cursor-pointer"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={alertsConfig.global.style.borderColor}
                                                        onChange={(e) => setAlertsConfig({
                                                            ...alertsConfig,
                                                            global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, borderColor: e.target.value } }
                                                        })}
                                                        className="flex-1 px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Ancho del Borde: {alertsConfig.global.style.borderWidth}px
                                                </label>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={alertsConfig.global.style.borderWidth}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, borderWidth: Number(e.target.value) } }
                                                    })}
                                                    className="w-full"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Radio del Borde: {alertsConfig.global.style.borderRadius}px
                                                </label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="50"
                                                    value={alertsConfig.global.style.borderRadius}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        global: { ...alertsConfig.global, style: { ...alertsConfig.global.style, borderRadius: Number(e.target.value) } }
                                                    })}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Animations */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                                        Animaciones
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Animación de Entrada
                                            </label>
                                            <select
                                                value={alertsConfig.global.animation.entrance}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, animation: { ...alertsConfig.global.animation, entrance: e.target.value as any } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="none">Ninguna</option>
                                                <option value="fade">Fade</option>
                                                <option value="slide">Slide</option>
                                                <option value="bounce">Bounce</option>
                                                <option value="zoom">Zoom</option>
                                                <option value="rotate">Rotate</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                Animación de Salida
                                            </label>
                                            <select
                                                value={alertsConfig.global.animation.exit}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    global: { ...alertsConfig.global, animation: { ...alertsConfig.global.animation, exit: e.target.value as any } }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="none">Ninguna</option>
                                                <option value="fade">Fade</option>
                                                <option value="slide">Slide</option>
                                                <option value="bounce">Bounce</option>
                                                <option value="zoom">Zoom</option>
                                                <option value="rotate">Rotate</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                            Velocidad de Animación
                                        </label>
                                        <select
                                            value={alertsConfig.global.animation.speed}
                                            onChange={(e) => setAlertsConfig({
                                                ...alertsConfig,
                                                global: { ...alertsConfig.global, animation: { ...alertsConfig.global.animation, speed: e.target.value as 'slow' | 'normal' | 'fast' } }
                                            })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                        >
                                            <option value="slow">Lenta (1.2s)</option>
                                            <option value="normal">Normal (0.8s)</option>
                                            <option value="fast">Rápida (0.5s)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Events Sub-tab */}
                        {alertsSubTab === 'events' && (
                            <div className="space-y-4">
                                {/* Follow */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            ❤️ Follow
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.follow.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    {alertsConfig.events.follow.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Mensaje
                                                </label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.follow.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    placeholder="+{time} por follow de {userName}!"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Variables: <code>{'{userName}'}</code>, <code>{'{time}'}</code>
                                                </p>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Icono (Emoji)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.follow.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    placeholder="❤️"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.follow.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.follow.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.follow.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.follow.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.follow.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.follow.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                    Cooldown (segundos)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.follow.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, follow: { ...alertsConfig.events.follow, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    86400 = 24 horas (anti-spam)
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bits */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            💎 Bits
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.bits.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.bits.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.bits.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Variables: <code>{'{userName}'}</code>, <code>{'{amount}'}</code>, <code>{'{time}'}</code>
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.bits.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.bits.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.bits.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.bits.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.bits.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.bits.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.bits.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.bits.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, bits: { ...alertsConfig.events.bits, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sub Prime */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            👑 Sub Prime
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.subPrime.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.subPrime.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subPrime.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subPrime.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.subPrime.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.subPrime.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.subPrime.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.subPrime.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.subPrime.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.subPrime.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.subPrime.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subPrime: { ...alertsConfig.events.subPrime, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sub Tier 1 */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            🎉 Sub Tier 1
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.subTier1.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.subTier1.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier1.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier1.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.subTier1.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.subTier1.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.subTier1.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.subTier1.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.subTier1.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.subTier1.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.subTier1.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier1: { ...alertsConfig.events.subTier1, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sub Tier 2 */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            ✨ Sub Tier 2
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.subTier2.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.subTier2.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier2.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier2.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.subTier2.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.subTier2.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.subTier2.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.subTier2.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.subTier2.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.subTier2.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.subTier2.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier2: { ...alertsConfig.events.subTier2, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Sub Tier 3 */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            ⭐ Sub Tier 3
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.subTier3.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.subTier3.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier3.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.subTier3.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.subTier3.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.subTier3.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.subTier3.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.subTier3.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.subTier3.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.subTier3.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.subTier3.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, subTier3: { ...alertsConfig.events.subTier3, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Gift Sub */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            🎁 Gift Sub
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.giftSub.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.giftSub.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.giftSub.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Variables: <code>{'{userName}'}</code>, <code>{'{amount}'}</code>, <code>{'{time}'}</code>
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.giftSub.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.giftSub.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.giftSub.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.giftSub.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.giftSub.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.giftSub.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.giftSub.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.giftSub.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, giftSub: { ...alertsConfig.events.giftSub, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Raid */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            👥 Raid
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.raid.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.raid.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.raid.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Variables: <code>{'{userName}'}</code>, <code>{'{amount}'}</code>, <code>{'{time}'}</code>
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.raid.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.raid.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.raid.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.raid.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.raid.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.raid.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.raid.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.raid.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, raid: { ...alertsConfig.events.raid, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Hype Train */}
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">
                                            🚂 Hype Train
                                        </h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={alertsConfig.events.hypeTrain.enabled}
                                                onChange={(e) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, enabled: e.target.checked } }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {alertsConfig.events.hypeTrain.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Mensaje</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.hypeTrain.message}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, message: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                                    Variables: <code>{'{amount}'}</code> (nivel), <code>{'{time}'}</code>
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Icono (Emoji)</label>
                                                <input
                                                    type="text"
                                                    value={alertsConfig.events.hypeTrain.icon}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, icon: e.target.value } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>

                                            <MediaInputWithSelector
                                                value={alertsConfig.events.hypeTrain.customIcon || ''}
                                                onChange={(value) => setAlertsConfig({
                                                    ...alertsConfig,
                                                    events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, customIcon: value || null } }
                                                })}
                                                label="Icono Personalizado (Imagen/GIF)"
                                                placeholder="Opcional: reemplaza el emoji con imagen..."
                                                allowedTypes={['image', 'gif']}
                                            />

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                                                        Sonido
                                                    </label>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={alertsConfig.events.hypeTrain.soundEnabled}
                                                            onChange={(e) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, soundEnabled: e.target.checked } }
                                                            })}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                    </label>
                                                </div>
                                                {alertsConfig.events.hypeTrain.soundEnabled && (
                                                    <div className="space-y-3">
                                                        <MediaInputWithSelector
                                                            value={alertsConfig.events.hypeTrain.soundUrl || ''}
                                                            onChange={(value) => setAlertsConfig({
                                                                ...alertsConfig,
                                                                events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, soundUrl: value || null } }
                                                            })}
                                                            label="Archivo de Audio"
                                                            placeholder="Selecciona un sonido..."
                                                            allowedTypes={['audio']}
                                                        />
                                                        <div>
                                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">
                                                                Volumen: {alertsConfig.events.hypeTrain.soundVolume}%
                                                            </label>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={alertsConfig.events.hypeTrain.soundVolume}
                                                                onChange={(e) => setAlertsConfig({
                                                                    ...alertsConfig,
                                                                    events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, soundVolume: Number(e.target.value) } }
                                                                })}
                                                                className="w-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Cooldown (segundos)</label>
                                                <input
                                                    type="number"
                                                    value={alertsConfig.events.hypeTrain.cooldown}
                                                    onChange={(e) => setAlertsConfig({
                                                        ...alertsConfig,
                                                        events: { ...alertsConfig.events, hypeTrain: { ...alertsConfig.events.hypeTrain, cooldown: Number(e.target.value) } }
                                                    })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sounds Sub-tab */}
                        {alertsSubTab === 'sounds' && (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-purple-600" />
                                    Sonidos por Evento
                                </h3>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-6">
                                    Configuración de sonidos personalizada por cada tipo de evento (próximamente)
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* GOAL TAB - Objetivo Visual + Stats en Vivo */}
                {activeTab === 'goal' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ Configura un objetivo visual de tiempo y estadísticas en vivo del timer
                            </p>
                        </div>

                        {/* Objetivo Visual */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        <Target className="w-5 h-5 text-green-600" />
                                        Objetivo Visual
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Muestra una meta de tiempo para motivar al chat</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={goalConfig.enabled}
                                        onChange={(e) => setGoalConfig({ ...goalConfig, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {goalConfig.enabled && (
                                <div className="space-y-4">
                                    {/* Tiempo de la Meta */}
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tiempo de la Meta (objetivo)</label>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Días</label>
                                                <input
                                                    type="number"
                                                    value={Math.floor(goalConfig.goalTime / 86400)}
                                                    onChange={(e) => {
                                                        const days = Number(e.target.value) || 0;
                                                        const remainder = goalConfig.goalTime % 86400;
                                                        setGoalConfig({ ...goalConfig, goalTime: days * 86400 + remainder });
                                                    }}
                                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Horas</label>
                                                <input
                                                    type="number"
                                                    value={Math.floor((goalConfig.goalTime % 86400) / 3600)}
                                                    onChange={(e) => {
                                                        const hours = Number(e.target.value) || 0;
                                                        const days = Math.floor(goalConfig.goalTime / 86400);
                                                        const remainder = goalConfig.goalTime % 3600;
                                                        setGoalConfig({ ...goalConfig, goalTime: days * 86400 + hours * 3600 + remainder });
                                                    }}
                                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                    max="23"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Minutos</label>
                                                <input
                                                    type="number"
                                                    value={Math.floor((goalConfig.goalTime % 3600) / 60)}
                                                    onChange={(e) => {
                                                        const minutes = Number(e.target.value) || 0;
                                                        const days = Math.floor(goalConfig.goalTime / 86400);
                                                        const hours = Math.floor((goalConfig.goalTime % 86400) / 3600);
                                                        const seconds = goalConfig.goalTime % 60;
                                                        setGoalConfig({ ...goalConfig, goalTime: days * 86400 + hours * 3600 + minutes * 60 + seconds });
                                                    }}
                                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                    max="59"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Segundos</label>
                                                <input
                                                    type="number"
                                                    value={goalConfig.goalTime % 60}
                                                    onChange={(e) => {
                                                        const seconds = Number(e.target.value) || 0;
                                                        const days = Math.floor(goalConfig.goalTime / 86400);
                                                        const hours = Math.floor((goalConfig.goalTime % 86400) / 3600);
                                                        const minutes = Math.floor((goalConfig.goalTime % 3600) / 60);
                                                        setGoalConfig({ ...goalConfig, goalTime: days * 86400 + hours * 3600 + minutes * 60 + seconds });
                                                    }}
                                                    className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                    max="59"
                                                />
                                            </div>
                                        </div>
                                        <div className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2">
                                            Meta: {Math.floor(goalConfig.goalTime / 86400) > 0 && `${Math.floor(goalConfig.goalTime / 86400)}d `}
                                            {Math.floor((goalConfig.goalTime % 86400) / 3600)}h {Math.floor((goalConfig.goalTime % 3600) / 60)}m {goalConfig.goalTime % 60}s
                                        </div>
                                    </div>

                                    {/* Texto de la Meta */}
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Texto de la Meta</label>
                                        <input
                                            type="text"
                                            value={goalConfig.goalText}
                                            onChange={(e) => setGoalConfig({ ...goalConfig, goalText: e.target.value })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            placeholder="Meta: 24 horas"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="flex items-center gap-2 mb-3">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.showProgress}
                                                    onChange={(e) => setGoalConfig({ ...goalConfig, showProgress: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Mostrar barra de progreso</span>
                                            </label>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 mb-3">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.showPercentage}
                                                    onChange={(e) => setGoalConfig({ ...goalConfig, showPercentage: e.target.checked })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Mostrar porcentaje</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Tamaño de Fuente (px)</label>
                                            <input
                                                type="number"
                                                value={goalConfig.fontSize}
                                                onChange={(e) => setGoalConfig({ ...goalConfig, fontSize: Number(e.target.value) || 20 })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                min="12"
                                                max="48"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Color de Texto</label>
                                            <input
                                                type="color"
                                                value={goalConfig.textColor}
                                                onChange={(e) => setGoalConfig({ ...goalConfig, textColor: e.target.value })}
                                                className="w-full h-10 border border-[#e2e8f0] dark:border-[#374151] rounded-lg cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Color de la Barra</label>
                                            <input
                                                type="color"
                                                value={goalConfig.progressBarColor}
                                                onChange={(e) => setGoalConfig({ ...goalConfig, progressBarColor: e.target.value })}
                                                className="w-full h-10 border border-[#e2e8f0] dark:border-[#374151] rounded-lg cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Posición en el Overlay</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">X (horizontal)</label>
                                                <input
                                                    type="number"
                                                    value={goalConfig.position.x}
                                                    onChange={(e) => setGoalConfig({ ...goalConfig, position: { ...goalConfig.position, x: Number(e.target.value) || 0 } })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                    max="1000"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Y (vertical)</label>
                                                <input
                                                    type="number"
                                                    value={goalConfig.position.y}
                                                    onChange={(e) => setGoalConfig({ ...goalConfig, position: { ...goalConfig.position, y: Number(e.target.value) || 0 } })}
                                                    className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                    min="0"
                                                    max="300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats en Vivo */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                        Estadísticas en Vivo
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Muestra el tiempo agregado por tipo de evento</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={goalConfig.showLiveStats}
                                        onChange={(e) => setGoalConfig({ ...goalConfig, showLiveStats: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {goalConfig.showLiveStats && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Posición de las Estadísticas</label>
                                        <select
                                            value={goalConfig.statsPosition}
                                            onChange={(e) => setGoalConfig({ ...goalConfig, statsPosition: e.target.value as 'overlay' | 'separate-panel' })}
                                            className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                        >
                                            <option value="overlay">En el Overlay</option>
                                            <option value="separate-panel">Panel Separado</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">Mostrar estadísticas de:</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.statsConfig.showBitsTotal}
                                                    onChange={(e) => setGoalConfig({
                                                        ...goalConfig,
                                                        statsConfig: { ...goalConfig.statsConfig, showBitsTotal: e.target.checked }
                                                    })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">💎 Bits</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.statsConfig.showSubsTotal}
                                                    onChange={(e) => setGoalConfig({
                                                        ...goalConfig,
                                                        statsConfig: { ...goalConfig.statsConfig, showSubsTotal: e.target.checked }
                                                    })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">⭐ Subs</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.statsConfig.showRaidsTotal}
                                                    onChange={(e) => setGoalConfig({
                                                        ...goalConfig,
                                                        statsConfig: { ...goalConfig.statsConfig, showRaidsTotal: e.target.checked }
                                                    })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">🚀 Raids</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.statsConfig.showFollowsTotal}
                                                    onChange={(e) => setGoalConfig({
                                                        ...goalConfig,
                                                        statsConfig: { ...goalConfig.statsConfig, showFollowsTotal: e.target.checked }
                                                    })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">❤️ Follows</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={goalConfig.statsConfig.showOthersTotal}
                                                    onChange={(e) => setGoalConfig({
                                                        ...goalConfig,
                                                        statsConfig: { ...goalConfig.statsConfig, showOthersTotal: e.target.checked }
                                                    })}
                                                    className="w-4 h-4"
                                                />
                                                <span className="text-sm text-[#1e293b] dark:text-[#f8fafc]">✨ Otros Eventos</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ADVANCED TAB - Plantillas + Auto-pause + Happy Hour */}
                {activeTab === 'advanced' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ Configuración avanzada: plantillas predefinidas, auto-pausa y happy hour
                            </p>
                        </div>

                        {/* Plantillas Predefinidas */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                Plantillas Predefinidas
                            </h3>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4">
                                Aplica configuraciones predefinidas según el tipo de stream
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Speedrun Template */}
                                <div
                                    onClick={() => {
                                        if (confirm('¿Aplicar plantilla Speedrun? Esto sobrescribirá la configuración actual.')) {
                                            const template = advancedConfig.templates.speedrun;
                                            setDefaultDuration(template.config.defaultDuration);
                                            if (template.config.displayConfig) {
                                                setDisplayConfig({ ...displayConfig, ...template.config.displayConfig });
                                            }
                                            if (template.config.styleConfig) {
                                                setStyleConfig({ ...styleConfig, ...template.config.styleConfig });
                                            }
                                            setAdvancedConfig({ ...advancedConfig, activeTemplate: 'speedrun' });
                                        }
                                    }}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${
                                        advancedConfig.activeTemplate === 'speedrun'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                                    }`}
                                >
                                    <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">🏃 Speedrun</h4>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{advancedConfig.templates.speedrun.description}</p>
                                </div>

                                {/* Subathon Template */}
                                <div
                                    onClick={() => {
                                        if (confirm('¿Aplicar plantilla Subathon? Esto sobrescribirá la configuración actual.')) {
                                            const template = advancedConfig.templates.subathon;
                                            setDefaultDuration(template.config.defaultDuration);
                                            if (template.config.displayConfig) {
                                                setDisplayConfig({ ...displayConfig, ...template.config.displayConfig });
                                            }
                                            if (template.config.styleConfig) {
                                                setStyleConfig({ ...styleConfig, ...template.config.styleConfig });
                                            }
                                            setAdvancedConfig({ ...advancedConfig, activeTemplate: 'subathon' });
                                        }
                                    }}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${
                                        advancedConfig.activeTemplate === 'subathon'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                                    }`}
                                >
                                    <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">🎯 Subathon</h4>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{advancedConfig.templates.subathon.description}</p>
                                </div>

                                {/* Gaming Marathon Template */}
                                <div
                                    onClick={() => {
                                        if (confirm('¿Aplicar plantilla Gaming Marathon? Esto sobrescribirá la configuración actual.')) {
                                            const template = advancedConfig.templates.gamingMarathon;
                                            setDefaultDuration(template.config.defaultDuration);
                                            if (template.config.displayConfig) {
                                                setDisplayConfig({ ...displayConfig, ...template.config.displayConfig });
                                            }
                                            if (template.config.styleConfig) {
                                                setStyleConfig({ ...styleConfig, ...template.config.styleConfig });
                                            }
                                            setAdvancedConfig({ ...advancedConfig, activeTemplate: 'gamingMarathon' });
                                        }
                                    }}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${
                                        advancedConfig.activeTemplate === 'gamingMarathon'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300'
                                    }`}
                                >
                                    <h4 className="font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">🎮 Gaming Marathon</h4>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{advancedConfig.templates.gamingMarathon.description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Auto-pause */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-orange-600" />
                                        Auto-pausa
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Pausar el timer automáticamente en horarios específicos</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={advancedConfig.autoPause.enabled}
                                        onChange={(e) => setAdvancedConfig({
                                            ...advancedConfig,
                                            autoPause: { ...advancedConfig.autoPause, enabled: e.target.checked }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {advancedConfig.autoPause.enabled && (
                                <div className="space-y-4">
                                    {advancedConfig.autoPause.schedules.length === 0 ? (
                                        <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8] text-sm">
                                            No hay horarios configurados. Haz clic en "Agregar Horario" para crear uno.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {advancedConfig.autoPause.schedules.map((schedule, index) => (
                                                <div key={schedule.id} className="p-4 border border-[#e2e8f0] dark:border-[#374151] rounded-lg">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc]">Horario #{index + 1}</h4>
                                                        <button
                                                            onClick={() => {
                                                                setAdvancedConfig({
                                                                    ...advancedConfig,
                                                                    autoPause: {
                                                                        ...advancedConfig.autoPause,
                                                                        schedules: advancedConfig.autoPause.schedules.filter(s => s.id !== schedule.id)
                                                                    }
                                                                });
                                                            }}
                                                            className="text-red-600 hover:text-red-700 text-xs"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                        <div>
                                                            <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Hora Inicio (HH:MM)</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.startTime}
                                                                onChange={(e) => {
                                                                    const updated = advancedConfig.autoPause.schedules.map(s =>
                                                                        s.id === schedule.id ? { ...s, startTime: e.target.value } : s
                                                                    );
                                                                    setAdvancedConfig({
                                                                        ...advancedConfig,
                                                                        autoPause: { ...advancedConfig.autoPause, schedules: updated }
                                                                    });
                                                                }}
                                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Hora Fin (HH:MM)</label>
                                                            <input
                                                                type="time"
                                                                value={schedule.endTime}
                                                                onChange={(e) => {
                                                                    const updated = advancedConfig.autoPause.schedules.map(s =>
                                                                        s.id === schedule.id ? { ...s, endTime: e.target.value } : s
                                                                    );
                                                                    setAdvancedConfig({
                                                                        ...advancedConfig,
                                                                        autoPause: { ...advancedConfig.autoPause, schedules: updated }
                                                                    });
                                                                }}
                                                                className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-1">Razón</label>
                                                        <input
                                                            type="text"
                                                            value={schedule.reason}
                                                            onChange={(e) => {
                                                                const updated = advancedConfig.autoPause.schedules.map(s =>
                                                                    s.id === schedule.id ? { ...s, reason: e.target.value } : s
                                                                );
                                                                setAdvancedConfig({
                                                                    ...advancedConfig,
                                                                    autoPause: { ...advancedConfig.autoPause, schedules: updated }
                                                                });
                                                            }}
                                                            className="w-full px-3 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                            placeholder="Ej: Hora de dormir"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-[#64748b] dark:text-[#94a3b8] block mb-2">Días de la semana</label>
                                                        <div className="flex gap-2">
                                                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => {
                                                                        const updated = advancedConfig.autoPause.schedules.map(s => {
                                                                            if (s.id === schedule.id) {
                                                                                const newDays = [...s.daysOfWeek];
                                                                                newDays[i] = !newDays[i];
                                                                                return { ...s, daysOfWeek: newDays };
                                                                            }
                                                                            return s;
                                                                        });
                                                                        setAdvancedConfig({
                                                                            ...advancedConfig,
                                                                            autoPause: { ...advancedConfig.autoPause, schedules: updated }
                                                                        });
                                                                    }}
                                                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                                                        schedule.daysOfWeek[i]
                                                                            ? 'bg-blue-600 text-white'
                                                                            : 'bg-gray-200 dark:bg-gray-700 text-[#64748b] dark:text-[#94a3b8]'
                                                                    }`}
                                                                >
                                                                    {day}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            const newSchedule = {
                                                id: Date.now().toString(),
                                                startTime: '22:00',
                                                endTime: '08:00',
                                                daysOfWeek: [true, true, true, true, true, true, true],
                                                reason: 'Horario de descanso'
                                            };
                                            setAdvancedConfig({
                                                ...advancedConfig,
                                                autoPause: {
                                                    ...advancedConfig.autoPause,
                                                    schedules: [...advancedConfig.autoPause.schedules, newSchedule]
                                                }
                                            });
                                        }}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        + Agregar Horario
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Happy Hour */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-yellow-600" />
                                        Happy Hour
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Multiplicar el tiempo agregado durante horarios específicos</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={advancedConfig.happyHour.enabled}
                                        onChange={(e) => setAdvancedConfig({
                                            ...advancedConfig,
                                            happyHour: { ...advancedConfig.happyHour, enabled: e.target.checked }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {advancedConfig.happyHour.enabled && (
                                <div className="space-y-4">
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                            ⚡ Durante el Happy Hour, todo el tiempo agregado se multiplicará por {advancedConfig.happyHour.multiplier}x
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Hora Inicio (HH:MM)</label>
                                            <input
                                                type="time"
                                                value={advancedConfig.happyHour.startTime}
                                                onChange={(e) => setAdvancedConfig({
                                                    ...advancedConfig,
                                                    happyHour: { ...advancedConfig.happyHour, startTime: e.target.value }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Hora Fin (HH:MM)</label>
                                            <input
                                                type="time"
                                                value={advancedConfig.happyHour.endTime}
                                                onChange={(e) => setAdvancedConfig({
                                                    ...advancedConfig,
                                                    happyHour: { ...advancedConfig.happyHour, endTime: e.target.value }
                                                })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Multiplicador: {advancedConfig.happyHour.multiplier}x</label>
                                        <input
                                            type="range"
                                            min="1.5"
                                            max="5"
                                            step="0.5"
                                            value={advancedConfig.happyHour.multiplier}
                                            onChange={(e) => setAdvancedConfig({
                                                ...advancedConfig,
                                                happyHour: { ...advancedConfig.happyHour, multiplier: parseFloat(e.target.value) }
                                            })}
                                            className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            <span>1.5x</span>
                                            <span>2x</span>
                                            <span>3x</span>
                                            <span>4x</span>
                                            <span>5x</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Días activos</label>
                                        <div className="flex gap-2">
                                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        const newDays = [...advancedConfig.happyHour.daysOfWeek];
                                                        newDays[i] = !newDays[i];
                                                        setAdvancedConfig({
                                                            ...advancedConfig,
                                                            happyHour: { ...advancedConfig.happyHour, daysOfWeek: newDays }
                                                        });
                                                    }}
                                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        advancedConfig.happyHour.daysOfWeek[i]
                                                            ? 'bg-yellow-500 text-white'
                                                            : 'bg-gray-200 dark:bg-gray-700 text-[#64748b] dark:text-[#94a3b8]'
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* HISTORY TAB - Analytics + Logs */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ Visualiza analíticas y registros históricos del timer
                            </p>
                        </div>

                        {/* Configuración del Historial */}
                        <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                                        Configuración del Historial
                                    </h3>
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Controla cómo se registran los eventos</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={historyConfig.enabled}
                                        onChange={(e) => setHistoryConfig({ ...historyConfig, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {historyConfig.enabled && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Máximo de Entradas</label>
                                            <input
                                                type="number"
                                                value={historyConfig.maxEntries}
                                                onChange={(e) => setHistoryConfig({ ...historyConfig, maxEntries: Number(e.target.value) || 100 })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                                min="10"
                                                max="1000"
                                            />
                                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">Número máximo de eventos a guardar</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2">Posición del Log en Overlay</label>
                                            <select
                                                value={historyConfig.logPosition}
                                                onChange={(e) => setHistoryConfig({ ...historyConfig, logPosition: e.target.value as any })}
                                                className="w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                            >
                                                <option value="top-left">Superior Izquierda</option>
                                                <option value="top-right">Superior Derecha</option>
                                                <option value="bottom-left">Inferior Izquierda</option>
                                                <option value="bottom-right">Inferior Derecha</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={historyConfig.showInOverlay}
                                                onChange={(e) => setHistoryConfig({ ...historyConfig, showInOverlay: e.target.checked })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Mostrar log en el overlay</span>
                                        </label>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] ml-6">Muestra los últimos eventos en tiempo real en el overlay</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Analytics */}
                        {historyConfig.enabled && (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                                    📊 Analíticas
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Total Time Added */}
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-700">
                                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">TOTAL AGREGADO</div>
                                        <div className="text-2xl font-black text-blue-900 dark:text-blue-200">
                                            {Math.floor(historyConfig.analytics.totalTimeAdded / 3600)}h {Math.floor((historyConfig.analytics.totalTimeAdded % 3600) / 60)}m
                                        </div>
                                    </div>

                                    {/* Bits */}
                                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl border border-purple-200 dark:border-purple-700">
                                        <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">💎 BITS</div>
                                        <div className="text-2xl font-black text-purple-900 dark:text-purple-200">
                                            {Math.floor(historyConfig.analytics.byEventType.bits / 60)}m
                                        </div>
                                    </div>

                                    {/* Subs */}
                                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-700">
                                        <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">⭐ SUBS</div>
                                        <div className="text-2xl font-black text-green-900 dark:text-green-200">
                                            {Math.floor(historyConfig.analytics.byEventType.subs / 60)}m
                                        </div>
                                    </div>

                                    {/* Raids */}
                                    <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-700">
                                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">🚀 RAIDS</div>
                                        <div className="text-2xl font-black text-orange-900 dark:text-orange-200">
                                            {Math.floor(historyConfig.analytics.byEventType.raids / 60)}m
                                        </div>
                                    </div>

                                    {/* Follows */}
                                    <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-xl border border-pink-200 dark:border-pink-700">
                                        <div className="text-xs font-bold text-pink-600 dark:text-pink-400 mb-1">❤️ FOLLOWS</div>
                                        <div className="text-2xl font-black text-pink-900 dark:text-pink-200">
                                            {Math.floor(historyConfig.analytics.byEventType.follows / 60)}m
                                        </div>
                                    </div>

                                    {/* Hype Train */}
                                    <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                        <div className="text-xs font-bold text-yellow-600 dark:text-yellow-400 mb-1">🔥 HYPE TRAIN</div>
                                        <div className="text-2xl font-black text-yellow-900 dark:text-yellow-200">
                                            {Math.floor(historyConfig.analytics.byEventType.hypeTrain / 60)}m
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Event Logs */}
                        {historyConfig.enabled && (
                            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                        📝 Registro de Eventos
                                    </h3>
                                    <button
                                        onClick={() => {
                                            if (confirm('¿Limpiar todo el historial de eventos?')) {
                                                setHistoryConfig({
                                                    ...historyConfig,
                                                    logs: [],
                                                    analytics: {
                                                        totalTimeAdded: 0,
                                                        byEventType: {
                                                            bits: 0,
                                                            follows: 0,
                                                            subs: 0,
                                                            raids: 0,
                                                            hypeTrain: 0,
                                                            commands: 0
                                                        }
                                                    }
                                                });
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white text-xs rounded-lg font-bold hover:bg-red-700 transition-colors"
                                    >
                                        Limpiar Historial
                                    </button>
                                </div>

                                {historyConfig.logs.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="text-6xl mb-4">📭</div>
                                        <p className="text-[#64748b] dark:text-[#94a3b8] text-sm">
                                            No hay eventos registrados aún
                                        </p>
                                        <p className="text-[#64748b] dark:text-[#94a3b8] text-xs mt-2">
                                            Los eventos aparecerán aquí cuando el timer esté activo
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b border-[#e2e8f0] dark:border-[#374151]">
                                                <tr>
                                                    <th className="text-left py-3 px-4 text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">FECHA/HORA</th>
                                                    <th className="text-left py-3 px-4 text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">EVENTO</th>
                                                    <th className="text-left py-3 px-4 text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">USUARIO</th>
                                                    <th className="text-left py-3 px-4 text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">TIEMPO</th>
                                                    <th className="text-left py-3 px-4 text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">DETALLES</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyConfig.logs.slice(0, 10).map((log) => (
                                                    <tr key={log.id} className="border-b border-[#e2e8f0] dark:border-[#374151] hover:bg-[#f8fafc] dark:hover:bg-[#262626]">
                                                        <td className="py-3 px-4 text-[#1e293b] dark:text-[#f8fafc]">
                                                            {new Date(log.timestamp).toLocaleString('es-ES', {
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                log.eventType === 'bits' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                                                log.eventType === 'sub' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                                log.eventType === 'raid' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                                                log.eventType === 'follow' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                                                                log.eventType === 'hypetrain' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                                                                'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                                                            }`}>
                                                                {log.eventType.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-[#1e293b] dark:text-[#f8fafc] font-semibold">{log.username}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`font-bold ${log.timeAdded >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {log.timeAdded >= 0 ? '+' : ''}{Math.floor(Math.abs(log.timeAdded) / 60)}m {Math.abs(log.timeAdded) % 60}s
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-[#64748b] dark:text-[#94a3b8] text-xs">{log.details}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {historyConfig.logs.length > 10 && (
                                            <div className="text-center py-4 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                                Mostrando los últimos 10 de {historyConfig.logs.length} eventos
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* MEDIA TAB - Archivos Multimedia */}
                {activeTab === 'media' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                ℹ️ Gestiona todos tus archivos multimedia con categorías profesionales. Sube imágenes, GIFs, videos y sonidos organizados por carpetas.
                            </p>
                        </div>

                        {/* MediaGallery Profesional con Upload, Rename, Delete y Categorías */}
                        <MediaGallery />
                    </div>
                )}

                {/* VISTA DE OVERLAY TAB */}
                {activeTab === 'overlay' && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <Monitor className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                                        Editor Visual de Posiciones
                                    </p>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                                        Arrastra y posiciona todos los elementos de tu overlay. Los cambios de posición y tamaño se guardan automáticamente. Para configurar estilos, colores y animaciones, usa las pestañas específicas de cada elemento.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <OverlayEditor
                            progressBarConfig={progressBarConfig}
                            setProgressBarConfig={setProgressBarConfig}
                            alertsConfig={alertsConfig}
                            setAlertsConfig={setAlertsConfig}
                            goalConfig={goalConfig}
                            setGoalConfig={setGoalConfig}
                            onSave={handleSave}
                        />
                    </div>
                )}
                </div>

                {/* Right Column: Preview - 1/3 en XL+, full en mobile/tablet */}
                <div className="xl:col-span-1 space-y-4 sm:space-y-6">
                    {/* Preview Box - Sticky solo en pantallas grandes */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 sm:p-6 shadow-lg xl:sticky xl:top-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc]">Vista Previa en Vivo</h3>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <Monitor className="w-5 h-5 text-[#2563eb]" />
                            </div>
                        </div>

                        {/* Preview Container */}
                        <div
                            ref={previewRef}
                            className="relative w-full aspect-[10/3] rounded-lg overflow-hidden border-2 border-[#e2e8f0] dark:border-[#374151]"
                            style={{
                                backgroundColor: themeConfig.containerBackground === 'transparent'
                                    ? 'transparent'
                                    : hexToRgba(themeConfig.containerBackground, themeConfig.containerOpacity / 100),
                                backgroundImage: themeConfig.containerBackground === 'transparent'
                                    ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                                    : undefined,
                                backgroundSize: themeConfig.containerBackground === 'transparent' ? '20px 20px' : undefined,
                                backgroundPosition: themeConfig.containerBackground === 'transparent' ? '0 0, 0 10px, 10px -10px, -10px 0px' : undefined
                            }}
                        >
                            {/* Title */}
                            {displayConfig.showTitle && (
                                <div
                                    className="absolute"
                                    style={{
                                        left: `${(styleConfig.titlePosition.x / 1000) * 100}%`,
                                        top: `${(styleConfig.titlePosition.y / 300) * 100}%`,
                                        fontSize: `${styleConfig.titleFontSize * 0.35}px`,
                                        fontWeight: 'bold',
                                        color: styleConfig.textColor,
                                        fontFamily: styleConfig.fontFamily,
                                        transform: 'translateX(-50%)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {displayConfig.title}
                                </div>
                            )}

                            {/* Time Display */}
                            <div
                                className="absolute"
                                style={{
                                    left: `${(styleConfig.timePosition.x / 1000) * 100}%`,
                                    top: `${(styleConfig.timePosition.y / 300) * 100}%`,
                                    transform: 'translateX(-50%)',
                                    textAlign: 'center'
                                }}
                            >
                                {/* Tiempo Restante */}
                                <div
                                    style={{
                                        fontSize: `${styleConfig.timeFontSize * 0.35}px`,
                                        fontWeight: 'bold',
                                        color: styleConfig.textColor,
                                        fontFamily: 'monospace',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {formatPreviewTime(previewTimeRemaining)}
                                </div>
                                {/* Tiempo Transcurrido (debajo) */}
                                {displayConfig.showElapsedTime && (
                                    <div
                                        style={{
                                            fontSize: `${styleConfig.timeFontSize * 0.2}px`,
                                            fontWeight: '600',
                                            color: styleConfig.textColor,
                                            fontFamily: 'monospace',
                                            opacity: 0.7,
                                            marginTop: '2px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Transcurrido: {formatPreviewTime(previewTotalDuration - previewTimeRemaining)}
                                    </div>
                                )}
                            </div>

                            {/* Percentage */}
                            {displayConfig.showPercentage && (
                                <div
                                    className="absolute"
                                    style={{
                                        left: `${(styleConfig.percentagePosition.x / 1000) * 100}%`,
                                        top: `${(styleConfig.percentagePosition.y / 300) * 100}%`,
                                        fontSize: `${styleConfig.percentageFontSize * 0.35}px`,
                                        fontWeight: '600',
                                        color: styleConfig.textColor,
                                        transform: 'translateX(-50%)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {Math.round(((previewTotalDuration - previewTimeRemaining) / previewTotalDuration) * 100)}%
                                </div>
                            )}

                            {/* Progress Bar - Scaled */}
                            <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
                                {progressBarConfig.type === 'horizontal' && (
                                    <ProgressBarHorizontal
                                        progress={((previewTotalDuration - previewTimeRemaining) / previewTotalDuration) * 100}
                                        orientation={progressBarConfig.orientation as 'left-to-right' | 'right-to-left'}
                                        position={{
                                            x: (progressBarConfig.position.x / 1000) * 100,
                                            y: (progressBarConfig.position.y / 300) * 100
                                        }}
                                        size={{
                                            width: (progressBarConfig.size.width / 1000) * 100,
                                            height: (progressBarConfig.size.height / 300) * 100
                                        }}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize * 0.35}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth * 0.35}
                                        borderRadius={progressBarConfig.borderRadius * 0.35}
                                        isPulsing={false}
                                        pulseSpeed="normal"
                                        usePercentage={true}
                                    />
                                )}

                                {progressBarConfig.type === 'vertical' && (
                                    <ProgressBarVertical
                                        progress={((previewTotalDuration - previewTimeRemaining) / previewTotalDuration) * 100}
                                        orientation={progressBarConfig.orientation as 'top-to-bottom' | 'bottom-to-top'}
                                        position={{
                                            x: (progressBarConfig.position.x / 1000) * 100,
                                            y: (progressBarConfig.position.y / 300) * 100
                                        }}
                                        size={{
                                            width: (progressBarConfig.size.width / 1000) * 100,
                                            height: (progressBarConfig.size.height / 300) * 100
                                        }}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize * 0.35}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth * 0.35}
                                        borderRadius={progressBarConfig.borderRadius * 0.35}
                                        isPulsing={false}
                                        pulseSpeed="normal"
                                        usePercentage={true}
                                    />
                                )}

                                {progressBarConfig.type === 'circular' && (
                                    <ProgressBarCircular
                                        progress={((previewTotalDuration - previewTimeRemaining) / previewTotalDuration) * 100}
                                        orientation={progressBarConfig.orientation as 'clockwise' | 'counterclockwise'}
                                        position={{
                                            x: (progressBarConfig.position.x / 1000) * 100,
                                            y: (progressBarConfig.position.y / 300) * 100
                                        }}
                                        size={{
                                            width: (progressBarConfig.size.width / 1000) * 100,
                                            height: (progressBarConfig.size.height / 300) * 100
                                        }}
                                        backgroundType={progressBarConfig.backgroundType}
                                        backgroundColor={progressBarConfig.backgroundColor}
                                        backgroundGradient={progressBarConfig.backgroundGradient}
                                        backgroundImage={progressBarConfig.backgroundImage}
                                        fillType={progressBarConfig.fillType}
                                        fillColor={progressBarConfig.fillColor}
                                        fillGradient={progressBarConfig.fillGradient}
                                        fillImage={progressBarConfig.fillImage}
                                        indicatorEnabled={progressBarConfig.indicatorEnabled}
                                        indicatorType={progressBarConfig.indicatorType}
                                        indicatorSize={progressBarConfig.indicatorSize * 0.35}
                                        indicatorColor={progressBarConfig.indicatorColor}
                                        indicatorImage={progressBarConfig.indicatorImage}
                                        indicatorRotate={progressBarConfig.indicatorRotate}
                                        borderEnabled={progressBarConfig.borderEnabled}
                                        borderColor={progressBarConfig.borderColor}
                                        borderWidth={progressBarConfig.borderWidth * 0.35}
                                        borderRadius={progressBarConfig.borderRadius * 0.35}
                                        isPulsing={false}
                                        pulseSpeed="normal"
                                        usePercentage={true}
                                    />
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3 text-center">
                            Vista previa en escala 1:10 (1000x300px)
                        </p>

                        {/* Panel de Información Dinámica */}
                        <div className="mt-4 space-y-3">
                            {/* Estado y Controles */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${previewIsRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                        <span className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">
                                            {previewIsRunning ? 'En Ejecución' : 'Pausado'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPreviewIsRunning(!previewIsRunning)}
                                            className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                            title={previewIsRunning ? 'Pausar' : 'Reproducir'}
                                        >
                                            {previewIsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setPreviewTimeRemaining(previewTotalDuration);
                                                setPreviewIsRunning(true);
                                            }}
                                            className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                                            title="Reiniciar"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1">Tiempo Restante</div>
                                        <div className="text-lg font-bold text-[#2563eb] dark:text-[#60a5fa]">
                                            {formatPreviewTime(previewTimeRemaining)}
                                        </div>
                                    </div>
                                    <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
                                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1">Progreso</div>
                                        <div className="text-lg font-bold text-[#8b5cf6] dark:text-[#a78bfa]">
                                            {Math.round(((previewTotalDuration - previewTimeRemaining) / previewTotalDuration) * 100)}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Configuración Actual */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                <div className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2 uppercase tracking-wide">
                                    Configuración Actual
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-[#64748b] dark:text-[#94a3b8]">Tipo de Barra:</span>
                                        <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {progressBarConfig.type === 'horizontal' ? 'Horizontal' :
                                             progressBarConfig.type === 'vertical' ? 'Vertical' : 'Circular'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#64748b] dark:text-[#94a3b8]">Orientación:</span>
                                        <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {progressBarConfig.orientation.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#64748b] dark:text-[#94a3b8]">Tamaño:</span>
                                        <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {progressBarConfig.size.width}x{progressBarConfig.size.height}px
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[#64748b] dark:text-[#94a3b8]">Duración Total:</span>
                                        <span className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                            {formatPreviewTime(previewTotalDuration)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}

