/**
 * Event Alerts - Per-Event Overlay Editor
 * Editor drag-and-drop con canvas 1920x1080 por evento
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Copy, Check, RotateCcw, Eye, Plus, Trash2, Save, X,
  Play, Type, Image, Move, ChevronDown
} from 'lucide-react';
import type {
  GlobalAlertsConfig,
  EventOverlayConfig,
  OverlayMediaElement,
  OverlayTextElement,
  OverlayAnimationType,
  PerEventOverlayConfig,
  FollowAlertConfig,
  BitsAlertConfig,
  SubsAlertConfig,
  GiftSubsAlertConfig,
  RaidsAlertConfig,
  ResubsAlertConfig,
  BaseAlertConfig,
  AlertMediaConfig,
} from '../../types/index';
import { EVENT_VARIABLES, EVENT_PREVIEW_DATA } from '../../types/index';
import { DEFAULT_PER_EVENT_OVERLAY, DEFAULT_OVERLAY_TEXT, DEFAULT_OVERLAY_MEDIA } from '../../constants/defaults';

// ============================================
// TYPES
// ============================================

type EventTabType = 'follow' | 'subscription' | 'giftSub' | 'raid' | 'bits';
type SelectedElement = { type: 'card' | 'media' | 'text'; id: string } | null;

interface OverlayEditorTabProps {
  overlayUrl?: string;
  globalConfig: GlobalAlertsConfig;
  onGlobalConfigChange: (updates: Partial<GlobalAlertsConfig>) => void;
  onSave?: () => void;
  // Event configs
  followConfig?: FollowAlertConfig;
  bitsConfig?: BitsAlertConfig;
  subsConfig?: SubsAlertConfig;
  giftSubsConfig?: GiftSubsAlertConfig;
  raidsConfig?: RaidsAlertConfig;
  resubsConfig?: ResubsAlertConfig;
  // Funciones para actualizar cada config (escribir cambios de vuelta)
  onFollowConfigChange?: (updates: Partial<FollowAlertConfig>) => void;
  onBitsConfigChange?: (updates: Partial<BitsAlertConfig>) => void;
  onSubsConfigChange?: (updates: Partial<SubsAlertConfig>) => void;
  onGiftSubsConfigChange?: (updates: Partial<GiftSubsAlertConfig>) => void;
  onRaidsConfigChange?: (updates: Partial<RaidsAlertConfig>) => void;
  onResubsConfigChange?: (updates: Partial<ResubsAlertConfig>) => void;
  // Tab activo del padre para sincronizar
  parentActiveTab?: string;
}

// ============================================
// CONSTANTS
// ============================================

const EVENT_TABS: { id: EventTabType; label: string; icon: string }[] = [
  { id: 'follow', label: 'Follow', icon: '❤️' },
  { id: 'subscription', label: 'Sub', icon: '⭐' },
  { id: 'giftSub', label: 'Gift', icon: '🎁' },
  { id: 'raid', label: 'Raid', icon: '🚀' },
  { id: 'bits', label: 'Bits', icon: '💎' },
];

const ANIMATIONS_IN: { value: OverlayAnimationType; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeIn', label: 'Fade In' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'zoomIn', label: 'Zoom In' },
  { value: 'bounceIn', label: 'Bounce In' },
  { value: 'rotateIn', label: 'Rotate In' },
];

const ANIMATIONS_OUT: { value: OverlayAnimationType; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'fadeOut', label: 'Fade Out' },
  { value: 'slideUp', label: 'Slide Up' },
  { value: 'slideDown', label: 'Slide Down' },
  { value: 'slideLeft', label: 'Slide Left' },
  { value: 'slideRight', label: 'Slide Right' },
  { value: 'zoomOut', label: 'Zoom Out' },
  { value: 'bounceOut', label: 'Bounce Out' },
  { value: 'rotateOut', label: 'Rotate Out' },
];

const FONT_FAMILIES = [
  'Inter, sans-serif',
  'Roboto, sans-serif',
  'Montserrat, sans-serif',
  'Poppins, sans-serif',
  'Open Sans, sans-serif',
  'Lato, sans-serif',
  'Oswald, sans-serif',
  'Bebas Neue, sans-serif',
];

// ============================================
// COMPONENT
// ============================================

// Helper para extraer URL de media de un BaseAlertConfig o similar
const extractMediaUrl = (alert?: BaseAlertConfig | null): string => {
  if (!alert?.media) return '';
  const media = alert.media;
  if (media.mode === 'simple' && media.simple?.url) {
    return media.simple.url;
  }
  if (media.mode === 'advanced' && media.advanced) {
    // Priorizar video, luego imagen
    if (media.advanced.video?.url) return media.advanced.video.url;
    if (media.advanced.image?.url) return media.advanced.image.url;
  }
  return '';
};

// Helper para extraer URL de audio de un BaseAlertConfig
const extractAudioUrl = (alert?: BaseAlertConfig | null): string => {
  if (!alert) return '';
  return alert.sound || '';
};

// Helper para extraer volumen de audio
const extractAudioVolume = (alert?: BaseAlertConfig | null): number => {
  if (!alert) return 80;
  return alert.volume ?? 80;
};

// Mapeo de tabs del padre a eventos del editor
const TAB_TO_EVENT: Record<string, EventTabType> = {
  'follow': 'follow',
  'bits': 'bits',
  'subs': 'subscription',
  'giftSubs': 'giftSub',
  'raids': 'raid',
  'resubs': 'subscription', // Resubs usa la misma config de subscription
  'hypeTrain': 'bits', // HypeTrain no tiene equivalente directo
};

export const OverlayEditorTab: React.FC<OverlayEditorTabProps> = ({
  overlayUrl = '',
  globalConfig,
  onGlobalConfigChange,
  onSave,
  followConfig,
  bitsConfig,
  subsConfig,
  giftSubsConfig,
  raidsConfig,
  resubsConfig,
  onFollowConfigChange,
  onBitsConfigChange,
  onSubsConfigChange,
  onGiftSubsConfigChange,
  onRaidsConfigChange,
  onResubsConfigChange,
  parentActiveTab,
}) => {
  // Canvas ref
  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [copied, setCopied] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventTabType>('follow');
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);

  // Sincronizar con el tab del padre
  useEffect(() => {
    if (parentActiveTab && TAB_TO_EVENT[parentActiveTab]) {
      setActiveEvent(TAB_TO_EVENT[parentActiveTab]);
      setSelectedElement(null); // Limpiar selección al cambiar
    }
  }, [parentActiveTab]);

  // ============================================
  // LEER CONFIG DEL EVENTO ACTUAL
  // ============================================

  // Obtener el BaseAlertConfig actual según el evento seleccionado
  const getCurrentAlertConfig = useCallback((): BaseAlertConfig | null => {
    switch (activeEvent) {
      case 'follow':
        return followConfig?.alert || null;
      case 'subscription':
        return subsConfig?.subTypes?.tier1 || null;
      case 'giftSub':
        return giftSubsConfig?.baseAlert || null;
      case 'raid':
        return raidsConfig?.baseAlert || null;
      case 'bits':
        return bitsConfig?.baseAlert || null;
      default:
        return null;
    }
  }, [activeEvent, followConfig, subsConfig, giftSubsConfig, raidsConfig, bitsConfig]);

  // Obtener valores actuales del evento
  const currentAlert = getCurrentAlertConfig();
  const currentMediaUrl = extractMediaUrl(currentAlert);
  const currentAudioUrl = extractAudioUrl(currentAlert);
  const currentAudioVolume = extractAudioVolume(currentAlert);
  const currentMessage = currentAlert?.message || '';

  // ============================================
  // ESCRIBIR CAMBIOS A LA CONFIG DEL EVENTO
  // ============================================

  const updateCurrentEventAlert = useCallback((alertUpdates: Partial<BaseAlertConfig>) => {
    setHasChanges(true);

    switch (activeEvent) {
      case 'follow':
        if (onFollowConfigChange && followConfig) {
          onFollowConfigChange({
            alert: { ...followConfig.alert, ...alertUpdates },
          });
        }
        break;
      case 'subscription':
        if (onSubsConfigChange && subsConfig) {
          onSubsConfigChange({
            subTypes: {
              ...subsConfig.subTypes,
              tier1: { ...subsConfig.subTypes.tier1, ...alertUpdates },
            },
          });
        }
        break;
      case 'giftSub':
        if (onGiftSubsConfigChange && giftSubsConfig) {
          onGiftSubsConfigChange({
            baseAlert: { ...giftSubsConfig.baseAlert, ...alertUpdates },
          });
        }
        break;
      case 'raid':
        if (onRaidsConfigChange && raidsConfig) {
          onRaidsConfigChange({
            baseAlert: { ...raidsConfig.baseAlert, ...alertUpdates },
          });
        }
        break;
      case 'bits':
        if (onBitsConfigChange && bitsConfig) {
          onBitsConfigChange({
            baseAlert: { ...bitsConfig.baseAlert, ...alertUpdates },
          });
        }
        break;
    }
  }, [
    activeEvent, followConfig, subsConfig, giftSubsConfig, raidsConfig, bitsConfig,
    onFollowConfigChange, onSubsConfigChange, onGiftSubsConfigChange, onRaidsConfigChange, onBitsConfigChange
  ]);

  // Actualizar solo el audio
  const updateCurrentEventAudio = useCallback((sound: string, volume?: number) => {
    const updates: Partial<BaseAlertConfig> = { sound };
    if (volume !== undefined) {
      updates.volume = volume;
    }
    updateCurrentEventAlert(updates);
  }, [updateCurrentEventAlert]);

  // Actualizar solo el mensaje
  const updateCurrentEventMessage = useCallback((message: string) => {
    updateCurrentEventAlert({ message });
  }, [updateCurrentEventAlert]);

  // Actualizar media URL
  const updateCurrentEventMedia = useCallback((url: string) => {
    const currentMedia = currentAlert?.media || { enabled: false, mode: 'simple' as const };
    const newMedia: AlertMediaConfig = {
      ...currentMedia,
      enabled: !!url,
      mode: 'simple',
      simple: { url },
    };
    updateCurrentEventAlert({ media: newMedia });
  }, [currentAlert, updateCurrentEventAlert]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, ex: 0, ey: 0 });

  // Canvas dimensions
  const canvasWidth = globalConfig.canvas?.width || 1920;
  const canvasHeight = globalConfig.canvas?.height || 1080;

  // Helper para crear config de evento desde config existente
  const createEventConfigFromLegacy = useCallback((eventType: EventTabType): EventOverlayConfig => {
    const defaults = DEFAULT_PER_EVENT_OVERLAY[eventType];
    let mediaUrl = '';
    let audioUrl = '';
    let audioVolume = 80;
    let message = defaults.texts[0]?.template || '';

    // Extraer media URL y audio de la config existente
    switch (eventType) {
      case 'follow':
        mediaUrl = extractMediaUrl(followConfig?.alert);
        audioUrl = extractAudioUrl(followConfig?.alert);
        audioVolume = extractAudioVolume(followConfig?.alert);
        message = followConfig?.alert?.message || message;
        break;
      case 'subscription':
        mediaUrl = extractMediaUrl(subsConfig?.subTypes?.tier1);
        audioUrl = extractAudioUrl(subsConfig?.subTypes?.tier1);
        audioVolume = extractAudioVolume(subsConfig?.subTypes?.tier1);
        message = subsConfig?.subTypes?.tier1?.message || message;
        break;
      case 'giftSub':
        mediaUrl = extractMediaUrl(giftSubsConfig?.baseAlert);
        audioUrl = extractAudioUrl(giftSubsConfig?.baseAlert);
        audioVolume = extractAudioVolume(giftSubsConfig?.baseAlert);
        message = giftSubsConfig?.baseAlert?.message || message;
        break;
      case 'raid':
        mediaUrl = extractMediaUrl(raidsConfig?.baseAlert);
        audioUrl = extractAudioUrl(raidsConfig?.baseAlert);
        audioVolume = extractAudioVolume(raidsConfig?.baseAlert);
        message = raidsConfig?.baseAlert?.message || message;
        break;
      case 'bits':
        mediaUrl = extractMediaUrl(bitsConfig?.baseAlert);
        audioUrl = extractAudioUrl(bitsConfig?.baseAlert);
        audioVolume = extractAudioVolume(bitsConfig?.baseAlert);
        message = bitsConfig?.baseAlert?.message || message;
        break;
    }

    return {
      ...defaults,
      media: {
        ...defaults.media,
        url: mediaUrl,
        enabled: !!mediaUrl,
      },
      texts: [
        {
          ...defaults.texts[0],
          template: message,
        },
      ],
      audio: {
        ...defaults.audio,
        url: audioUrl,
        volume: audioVolume,
        enabled: !!audioUrl,
      },
    };
  }, [followConfig, bitsConfig, subsConfig, giftSubsConfig, raidsConfig]);

  // Get per-event overlay config (with fallback to legacy config or defaults)
  // Usa las posiciones de globalConfig.overlayElements para sincronizar con el overlay de OBS
  const getPerEventOverlay = useCallback((): PerEventOverlayConfig => {
    // Obtener posiciones actuales del overlayElements (lo que usa el overlay de OBS)
    const elements = globalConfig.overlayElements || {
      card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
      media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
      text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
    };

    // Si ya existe perEventOverlay, actualizarlo con las posiciones correctas
    if (globalConfig.perEventOverlay) {
      // Actualizar las posiciones de media y text con las de overlayElements
      const updated = { ...globalConfig.perEventOverlay };
      Object.keys(updated).forEach(eventKey => {
        const event = updated[eventKey as keyof PerEventOverlayConfig];
        if (event && event.media) {
          event.media = {
            ...event.media,
            x: elements.media.x,
            y: elements.media.y,
            width: elements.media.width,
            height: elements.media.height,
            enabled: elements.media.enabled,
          };
        }
        if (event && event.texts && event.texts[0]) {
          event.texts[0] = {
            ...event.texts[0],
            x: elements.text.x,
            y: elements.text.y,
            width: elements.text.width,
            height: elements.text.height,
            enabled: elements.text.enabled,
          };
        }
      });
      return updated;
    }

    // Crear desde configs legacy con posiciones de overlayElements
    const createWithPositions = (eventType: EventTabType): EventOverlayConfig => {
      const config = createEventConfigFromLegacy(eventType);
      return {
        ...config,
        media: {
          ...config.media,
          x: elements.media.x,
          y: elements.media.y,
          width: elements.media.width,
          height: elements.media.height,
          enabled: elements.media.enabled,
        },
        texts: config.texts.map((text, idx) => idx === 0 ? {
          ...text,
          x: elements.text.x,
          y: elements.text.y,
          width: elements.text.width,
          height: elements.text.height,
          enabled: elements.text.enabled,
        } : text),
      };
    };

    return {
      follow: createWithPositions('follow'),
      subscription: createWithPositions('subscription'),
      giftSub: createWithPositions('giftSub'),
      raid: createWithPositions('raid'),
      bits: createWithPositions('bits'),
    } as PerEventOverlayConfig;
  }, [globalConfig.perEventOverlay, globalConfig.overlayElements, createEventConfigFromLegacy]);

  const perEventOverlay: PerEventOverlayConfig = getPerEventOverlay();
  const currentEventConfig: EventOverlayConfig = perEventOverlay[activeEvent] || DEFAULT_PER_EVENT_OVERLAY[activeEvent];

  // ============================================
  // HELPERS
  // ============================================

  const updatePerEventOverlay = useCallback((eventType: EventTabType, updates: Partial<EventOverlayConfig>) => {
    const newPerEventOverlay = {
      ...perEventOverlay,
      [eventType]: {
        ...perEventOverlay[eventType],
        ...updates,
      },
    };
    onGlobalConfigChange({ perEventOverlay: newPerEventOverlay });
    setHasChanges(true);
  }, [perEventOverlay, onGlobalConfigChange]);

  const updateMedia = useCallback((updates: Partial<OverlayMediaElement>) => {
    // Actualizar perEventOverlay para el editor
    updatePerEventOverlay(activeEvent, {
      media: { ...currentEventConfig.media, ...updates },
    });
    // También actualizar globalConfig.overlayElements para el overlay de OBS
    if (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined || updates.enabled !== undefined) {
      const currentElements = globalConfig.overlayElements || {
        card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
        media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
        text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
      };
      onGlobalConfigChange({
        overlayElements: {
          ...currentElements,
          media: {
            ...currentElements.media,
            ...(updates.x !== undefined && { x: updates.x }),
            ...(updates.y !== undefined && { y: updates.y }),
            ...(updates.width !== undefined && { width: updates.width }),
            ...(updates.height !== undefined && { height: updates.height }),
            ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          },
        },
      });
    }
  }, [activeEvent, currentEventConfig.media, updatePerEventOverlay, globalConfig.overlayElements, onGlobalConfigChange]);

  const updateText = useCallback((textId: string, updates: Partial<OverlayTextElement>) => {
    const newTexts = currentEventConfig.texts.map(t =>
      t.id === textId ? { ...t, ...updates } : t
    );
    updatePerEventOverlay(activeEvent, { texts: newTexts });

    // Para el primer texto (text-1), sincronizar con globalConfig para que afecte el overlay de OBS
    if (textId === 'text-1') {
      const currentElements = globalConfig.overlayElements || {
        card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
        media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
        text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
      };

      // Actualizar posiciones en overlayElements
      if (updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined || updates.enabled !== undefined) {
        onGlobalConfigChange({
          overlayElements: {
            ...currentElements,
            text: {
              ...currentElements.text,
              ...(updates.x !== undefined && { x: updates.x }),
              ...(updates.y !== undefined && { y: updates.y }),
              ...(updates.width !== undefined && { width: updates.width }),
              ...(updates.height !== undefined && { height: updates.height }),
              ...(updates.enabled !== undefined && { enabled: updates.enabled }),
            },
          },
        });
      }

      // Sincronizar estilos de texto con globalConfig.defaultStyle para el overlay de OBS
      const styleUpdates: Partial<typeof globalConfig.defaultStyle> = {};
      if (updates.fontFamily !== undefined) styleUpdates.fontFamily = updates.fontFamily;
      if (updates.fontSize !== undefined) styleUpdates.fontSize = updates.fontSize;
      if (updates.fontWeight !== undefined) styleUpdates.fontWeight = updates.fontWeight;
      if (updates.color !== undefined) styleUpdates.textColor = updates.color;
      if (updates.textAlign !== undefined) styleUpdates.textAlign = updates.textAlign;
      if (updates.textShadow !== undefined) styleUpdates.textShadow = updates.textShadow ? 'normal' : 'none';

      if (Object.keys(styleUpdates).length > 0) {
        onGlobalConfigChange({
          defaultStyle: {
            ...globalConfig.defaultStyle,
            ...styleUpdates,
          },
        });
      }
    }
  }, [activeEvent, currentEventConfig.texts, updatePerEventOverlay, globalConfig.overlayElements, globalConfig.defaultStyle, onGlobalConfigChange]);

  const updateAudio = useCallback((updates: Partial<typeof currentEventConfig.audio>) => {
    updatePerEventOverlay(activeEvent, {
      audio: { ...currentEventConfig.audio, ...updates },
    });
  }, [activeEvent, currentEventConfig.audio, updatePerEventOverlay]);

  // Card element from overlayElements
  const cardElement = globalConfig.overlayElements?.card || { x: 660, y: 290, width: 600, height: 500, enabled: true };

  const updateCard = useCallback((updates: Partial<typeof cardElement>) => {
    const currentElements = globalConfig.overlayElements || {
      card: { x: 660, y: 290, width: 600, height: 500, enabled: true },
      media: { x: 690, y: 320, width: 540, height: 220, enabled: true },
      text: { x: 690, y: 560, width: 540, height: 200, enabled: true },
    };
    onGlobalConfigChange({
      overlayElements: {
        ...currentElements,
        card: {
          ...currentElements.card,
          ...updates,
        },
      },
    });
    setHasChanges(true);
  }, [globalConfig.overlayElements, onGlobalConfigChange]);

  const addText = useCallback(() => {
    const newId = `text-${Date.now()}`;
    const newText: OverlayTextElement = {
      ...DEFAULT_OVERLAY_TEXT,
      id: newId,
      y: 760, // Below existing text
      template: 'Nuevo texto',
    };
    updatePerEventOverlay(activeEvent, {
      texts: [...currentEventConfig.texts, newText],
    });
    setSelectedElement({ type: 'text', id: newId });
  }, [activeEvent, currentEventConfig.texts, updatePerEventOverlay]);

  const removeText = useCallback((textId: string) => {
    if (currentEventConfig.texts.length <= 1) return; // Keep at least one
    const newTexts = currentEventConfig.texts.filter(t => t.id !== textId);
    updatePerEventOverlay(activeEvent, { texts: newTexts });
    setSelectedElement(null);
  }, [activeEvent, currentEventConfig.texts, updatePerEventOverlay]);

  const copyToEvent = useCallback((targetEvent: EventTabType) => {
    if (targetEvent === activeEvent) return;
    const newPerEventOverlay = {
      ...perEventOverlay,
      [targetEvent]: { ...currentEventConfig },
    };
    onGlobalConfigChange({ perEventOverlay: newPerEventOverlay });
    setHasChanges(true);
  }, [activeEvent, currentEventConfig, perEventOverlay, onGlobalConfigChange]);

  const resetEvent = useCallback(() => {
    updatePerEventOverlay(activeEvent, DEFAULT_PER_EVENT_OVERLAY[activeEvent]);
    setSelectedElement(null);
  }, [activeEvent, updatePerEventOverlay]);

  // ============================================
  // DRAG & DROP HANDLERS
  // ============================================

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    elementType: 'card' | 'media' | 'text',
    elementId: string
  ) => {
    e.stopPropagation();
    setSelectedElement({ type: elementType, id: elementId });

    const element = elementType === 'card'
      ? cardElement
      : elementType === 'media'
        ? currentEventConfig.media
        : currentEventConfig.texts.find(t => t.id === elementId);

    if (!element || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / canvasRect.width;
    const scaleY = canvasHeight / canvasRect.height;

    const mouseX = (e.clientX - canvasRect.left) * scaleX;
    const mouseY = (e.clientY - canvasRect.top) * scaleY;

    setDragOffset({
      x: mouseX - element.x,
      y: mouseY - element.y,
    });
    setIsDragging(true);
  }, [currentEventConfig, canvasWidth, canvasHeight]);

  const handleResizeMouseDown = useCallback((
    e: React.MouseEvent,
    elementType: 'card' | 'media' | 'text',
    elementId: string,
    handle: string
  ) => {
    e.stopPropagation();
    setSelectedElement({ type: elementType, id: elementId });

    const element = elementType === 'card'
      ? cardElement
      : elementType === 'media'
        ? currentEventConfig.media
        : currentEventConfig.texts.find(t => t.id === elementId);

    if (!element || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / canvasRect.width;
    const scaleY = canvasHeight / canvasRect.height;

    setResizeStart({
      x: element.x,
      y: element.y,
      w: element.width,
      h: element.height,
      ex: (e.clientX - canvasRect.left) * scaleX,
      ey: (e.clientY - canvasRect.top) * scaleY,
    });
    setResizeHandle(handle);
    setIsResizing(true);
  }, [currentEventConfig, canvasWidth, canvasHeight]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !selectedElement) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / canvasRect.width;
    const scaleY = canvasHeight / canvasRect.height;

    const mouseX = (e.clientX - canvasRect.left) * scaleX;
    const mouseY = (e.clientY - canvasRect.top) * scaleY;

    if (isDragging) {
      let newX = Math.round((mouseX - dragOffset.x) / 10) * 10;
      let newY = Math.round((mouseY - dragOffset.y) / 10) * 10;

      // Bounds
      const element = selectedElement.type === 'card'
        ? cardElement
        : selectedElement.type === 'media'
          ? currentEventConfig.media
          : currentEventConfig.texts.find(t => t.id === selectedElement.id);

      if (element) {
        newX = Math.max(0, Math.min(newX, canvasWidth - element.width));
        newY = Math.max(0, Math.min(newY, canvasHeight - element.height));

        if (selectedElement.type === 'card') {
          updateCard({ x: newX, y: newY });
        } else if (selectedElement.type === 'media') {
          updateMedia({ x: newX, y: newY });
        } else {
          updateText(selectedElement.id, { x: newX, y: newY });
        }
      }
    }

    if (isResizing && resizeHandle) {
      const dx = mouseX - resizeStart.ex;
      const dy = mouseY - resizeStart.ey;

      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newW = resizeStart.w;
      let newH = resizeStart.h;

      if (resizeHandle.includes('e')) newW = Math.max(100, resizeStart.w + dx);
      if (resizeHandle.includes('w')) {
        newW = Math.max(100, resizeStart.w - dx);
        newX = resizeStart.x + (resizeStart.w - newW);
      }
      if (resizeHandle.includes('s')) newH = Math.max(50, resizeStart.h + dy);
      if (resizeHandle.includes('n')) {
        newH = Math.max(50, resizeStart.h - dy);
        newY = resizeStart.y + (resizeStart.h - newH);
      }

      // Snap to grid
      newX = Math.round(newX / 10) * 10;
      newY = Math.round(newY / 10) * 10;
      newW = Math.round(newW / 10) * 10;
      newH = Math.round(newH / 10) * 10;

      if (selectedElement.type === 'card') {
        updateCard({ x: newX, y: newY, width: newW, height: newH });
      } else if (selectedElement.type === 'media') {
        updateMedia({ x: newX, y: newY, width: newW, height: newH });
      } else {
        updateText(selectedElement.id, { x: newX, y: newY, width: newW, height: newH });
      }
    }
  }, [
    isDragging, isResizing, selectedElement, dragOffset, resizeHandle, resizeStart,
    canvasWidth, canvasHeight, currentEventConfig, cardElement, updateCard, updateMedia, updateText
  ]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // ============================================
  // COPY URL
  // ============================================

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(overlayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [overlayUrl]);

  // ============================================
  // RENDER ELEMENT ON CANVAS
  // ============================================

  const renderCanvasElement = useCallback((
    element: OverlayMediaElement | OverlayTextElement,
    type: 'media' | 'text',
    color: string
  ) => {
    if (!element.enabled) return null;

    const isSelected = selectedElement?.type === type && selectedElement?.id === element.id;
    const isMediaElement = type === 'media';

    // Usar el media URL real de la config del evento, no del perEventOverlay
    const actualMediaUrl = isMediaElement ? currentMediaUrl : '';
    const hasMediaUrl = isMediaElement && actualMediaUrl && actualMediaUrl.trim() !== '';
    const isVideo = hasMediaUrl && /\.(mp4|webm|mov)$/i.test(actualMediaUrl);
    const mediaEl = element as OverlayMediaElement;

    // Usar el mensaje real de la config del evento
    let displayText = '';
    if (!isMediaElement) {
      // Usar el mensaje de la config del evento, no el template del perEventOverlay
      displayText = currentMessage || (element as OverlayTextElement).template;
      const previewData = EVENT_PREVIEW_DATA[activeEvent] || {};
      Object.entries(previewData).forEach(([key, value]) => {
        displayText = displayText.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
      });
    }

    return (
      <div
        key={element.id}
        onMouseDown={(e) => handleMouseDown(e, type, element.id)}
        onClick={(e) => e.stopPropagation()}
        className={`absolute cursor-move transition-all ${
          isSelected
            ? 'ring-4 ring-white ring-offset-2 ring-offset-black z-50'
            : 'hover:ring-2 hover:ring-white/50 z-40'
        }`}
        style={{
          left: `${(element.x / canvasWidth) * 100}%`,
          top: `${(element.y / canvasHeight) * 100}%`,
          width: `${(element.width / canvasWidth) * 100}%`,
          height: `${(element.height / canvasHeight) * 100}%`,
          border: `2px solid ${color}`,
          backgroundColor: isMediaElement && !hasMediaUrl ? 'rgba(147, 51, 234, 0.1)' :
                          isMediaElement ? 'transparent' : 'rgba(34, 197, 94, 0.2)',
          zIndex: element.zIndex,
        }}
      >
        {/* Label */}
        <div
          className="absolute -top-6 left-0 text-xs font-bold px-2 py-1 rounded-t text-white whitespace-nowrap"
          style={{ backgroundColor: color }}
        >
          {isMediaElement ? '🎬 MEDIA' : `📝 ${(element as OverlayTextElement).template.slice(0, 20)}...`}
        </div>

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          {isMediaElement ? (
            hasMediaUrl ? (
              // Preview del media - Video muestra silueta, imagen se muestra
              isVideo ? (
                // Video: mostrar silueta con icono
                <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex flex-col items-center justify-center text-white/80">
                  <Play className="w-12 h-12 mb-2" />
                  <div className="text-xs font-medium">VIDEO</div>
                  <div className="text-[10px] opacity-60 mt-1 truncate max-w-full px-2">
                    {actualMediaUrl.split('/').pop()}
                  </div>
                </div>
              ) : (
                <img
                  src={actualMediaUrl}
                  alt="Media preview"
                  className="w-full h-full pointer-events-none"
                  style={{ objectFit: mediaEl.fit }}
                />
              )
            ) : (
              // Placeholder cuando no hay media
              <div className="text-center text-white/60 p-4">
                <Image className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <div className="text-xs font-medium">Sin media</div>
                <div className="text-[10px] opacity-60 mt-1">Configura en la pestaña del evento</div>
              </div>
            )
          ) : (
            <div
              className="text-center truncate w-full"
              style={{
                fontFamily: (element as OverlayTextElement).fontFamily,
                fontSize: `${Math.min((element as OverlayTextElement).fontSize * 0.5, 24)}px`,
                fontWeight: (element as OverlayTextElement).fontWeight,
                color: (element as OverlayTextElement).color,
              }}
            >
              {displayText}
            </div>
          )}
        </div>

        {/* Resize handles */}
        {isSelected && ['nw', 'ne', 'sw', 'se'].map((handle) => (
          <div
            key={handle}
            onMouseDown={(e) => handleResizeMouseDown(e, type, element.id, handle)}
            className="absolute w-4 h-4 bg-white border-2 rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-50"
            style={{
              borderColor: color,
              top: handle.includes('n') ? '-8px' : 'auto',
              bottom: handle.includes('s') ? '-8px' : 'auto',
              left: handle.includes('w') ? '-8px' : 'auto',
              right: handle.includes('e') ? '-8px' : 'auto',
            }}
          />
        ))}
      </div>
    );
  }, [selectedElement, activeEvent, canvasWidth, canvasHeight, handleMouseDown, handleResizeMouseDown]);

  // ============================================
  // RENDER PROPERTIES PANEL
  // ============================================

  const renderPropertiesPanel = () => {
    if (!selectedElement) {
      return (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          <Move className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecciona un elemento en el canvas para editar sus propiedades</p>
        </div>
      );
    }

    const isCard = selectedElement.type === 'card';
    const isMedia = selectedElement.type === 'media';

    // Si es Card, mostrar propiedades del card
    if (isCard) {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎴</span>
            <span className="font-bold text-[#1e293b] dark:text-white">Fondo (Card)</span>
          </div>
          <p className="text-xs text-gray-500">El fondo es el contenedor visual de la alerta</p>
          {/* Position */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">X</label>
              <input
                type="number"
                value={cardElement.x}
                onChange={(e) => updateCard({ x: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Y</label>
              <input
                type="number"
                value={cardElement.y}
                onChange={(e) => updateCard({ y: parseInt(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Ancho</label>
              <input
                type="number"
                value={cardElement.width}
                onChange={(e) => updateCard({ width: parseInt(e.target.value) || 100 })}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Alto</label>
              <input
                type="number"
                value={cardElement.height}
                onChange={(e) => updateCard({ height: parseInt(e.target.value) || 100 })}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            💡 Los estilos del fondo (color, borde, transparencia) se configuran en la pestaña "Avanzado"
          </p>
        </div>
      );
    }

    const element = isMedia
      ? currentEventConfig.media
      : currentEventConfig.texts.find(t => t.id === selectedElement.id);

    if (!element) return null;

    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMedia ? <Image className="w-5 h-5 text-purple-500" /> : <Type className="w-5 h-5 text-green-500" />}
            <span className="font-bold text-[#1e293b] dark:text-white">
              {isMedia ? 'Media (Video/Imagen)' : 'Texto'}
            </span>
          </div>
          {!isMedia && currentEventConfig.texts.length > 1 && (
            <button
              onClick={() => removeText(selectedElement.id)}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Position */}
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">X</label>
            <input
              type="number"
              value={element.x}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                isMedia ? updateMedia({ x: val }) : updateText(selectedElement.id, { x: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Y</label>
            <input
              type="number"
              value={element.y}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                isMedia ? updateMedia({ y: val }) : updateText(selectedElement.id, { y: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ancho</label>
            <input
              type="number"
              value={element.width}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 100;
                isMedia ? updateMedia({ width: val }) : updateText(selectedElement.id, { width: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Alto</label>
            <input
              type="number"
              value={element.height}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 50;
                isMedia ? updateMedia({ height: val }) : updateText(selectedElement.id, { height: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Animations */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Animación Entrada</label>
            <select
              value={element.animationIn}
              onChange={(e) => {
                const val = e.target.value as OverlayAnimationType;
                isMedia ? updateMedia({ animationIn: val }) : updateText(selectedElement.id, { animationIn: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {ANIMATIONS_IN.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Animación Salida</label>
            <select
              value={element.animationOut}
              onChange={(e) => {
                const val = e.target.value as OverlayAnimationType;
                isMedia ? updateMedia({ animationOut: val }) : updateText(selectedElement.id, { animationOut: val });
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {ANIMATIONS_OUT.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>

        {/* Media-specific properties */}
        {isMedia && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">URL del Media (video, imagen o GIF)</label>
              <input
                type="text"
                value={(element as OverlayMediaElement).url}
                onChange={(e) => {
                  const url = e.target.value;
                  // Auto-enable when URL is added
                  if (url && url.trim() !== '' && !currentEventConfig.media.enabled) {
                    updateMedia({ url, enabled: true });
                  } else {
                    updateMedia({ url });
                  }
                }}
                placeholder="/timerextensible/canal/carpeta/video.mp4"
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-[10px] text-gray-400 mt-1">Formatos: .mp4, .webm, .mov, .gif, .png, .jpg</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ajuste</label>
                <select
                  value={(element as OverlayMediaElement).fit}
                  onChange={(e) => updateMedia({ fit: e.target.value as 'cover' | 'contain' | 'fill' })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="fill">Fill</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Volumen Video</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={(element as OverlayMediaElement).videoVolume}
                  onChange={(e) => updateMedia({ videoVolume: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(element as OverlayMediaElement).playVideoAudio}
                onChange={(e) => updateMedia({ playVideoAudio: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Reproducir audio del video</span>
            </label>
          </>
        )}

        {/* Text-specific properties */}
        {!isMedia && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Plantilla de texto
                <span className="ml-2 text-purple-500">
                  Variables: {EVENT_VARIABLES[activeEvent]?.join(', ')}
                </span>
              </label>
              <input
                type="text"
                value={(element as OverlayTextElement).template}
                onChange={(e) => updateText(selectedElement.id, { template: e.target.value })}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Fuente</label>
                <select
                  value={(element as OverlayTextElement).fontFamily}
                  onChange={(e) => updateText(selectedElement.id, { fontFamily: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {FONT_FAMILIES.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tamaño</label>
                <input
                  type="number"
                  min={8}
                  max={200}
                  value={(element as OverlayTextElement).fontSize}
                  onChange={(e) => updateText(selectedElement.id, { fontSize: parseInt(e.target.value) || 24 })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Color</label>
                <input
                  type="color"
                  value={(element as OverlayTextElement).color}
                  onChange={(e) => updateText(selectedElement.id, { color: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Alineación</label>
                <select
                  value={(element as OverlayTextElement).textAlign}
                  onChange={(e) => updateText(selectedElement.id, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Peso</label>
                <select
                  value={(element as OverlayTextElement).fontWeight}
                  onChange={(e) => updateText(selectedElement.id, { fontWeight: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="600">Semi-Bold</option>
                  <option value="800">Extra-Bold</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-1">
                  <input
                    type="checkbox"
                    checked={(element as OverlayTextElement).textShadow}
                    onChange={(e) => updateText(selectedElement.id, { textShadow: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Sombra</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Z-Index */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Capa (Z-Index)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={element.zIndex}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              isMedia ? updateMedia({ zIndex: val }) : updateText(selectedElement.id, { zIndex: val });
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* URL del Overlay */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          🔗 URL del Overlay
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={overlayUrl || 'Cargando...'}
            readOnly
            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
          />
          <button
            onClick={handleCopy}
            disabled={!overlayUrl}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Event Tabs */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1C1D] p-6 shadow-lg">
        <div className="flex flex-wrap gap-2 mb-6">
          {EVENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveEvent(tab.id);
                setSelectedElement(null);
              }}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                activeEvent === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Elements Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Card toggle - Fondo/Background */}
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${
              cardElement.enabled ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <input
                type="checkbox"
                checked={cardElement.enabled}
                onChange={(e) => updateCard({ enabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                🎴 Fondo
                {cardElement.enabled && <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">✓</span>}
              </span>
            </label>
            {/* Media toggle - Controla si se muestra en el canvas */}
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${
              currentEventConfig.media.enabled
                ? currentMediaUrl
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-yellow-100 dark:bg-yellow-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <input
                type="checkbox"
                checked={currentEventConfig.media.enabled}
                onChange={(e) => updateMedia({ enabled: e.target.checked })}
                className="rounded text-purple-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                🎬 Media
                {currentEventConfig.media.enabled && currentMediaUrl && (
                  <span className="ml-1 text-xs text-purple-600 dark:text-purple-400">✓</span>
                )}
                {currentEventConfig.media.enabled && !currentMediaUrl && (
                  <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400">(sin URL)</span>
                )}
              </span>
            </label>
            {/* Text toggles */}
            {currentEventConfig.texts.map((text, idx) => (
              <label key={text.id} className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-colors ${
                text.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <input
                  type="checkbox"
                  checked={text.enabled}
                  onChange={(e) => updateText(text.id, { enabled: e.target.checked })}
                  className="rounded text-green-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">📝 Texto {idx + 1}</span>
              </label>
            ))}
          </div>
          <button
            onClick={addText}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Texto
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                📋 Copiar a...
                <ChevronDown className={`w-4 h-4 transition-transform ${showCopyDropdown ? 'rotate-180' : ''}`} />
              </button>
              {/* Dropdown */}
              {showCopyDropdown && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                  {EVENT_TABS.filter(t => t.id !== activeEvent).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        copyToEvent(tab.id);
                        setShowCopyDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <span>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={resetEvent}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative bg-black rounded-xl overflow-hidden select-none cursor-crosshair"
          style={{
            width: '100%',
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
            // Solo deseleccionar si el click fue directamente en el canvas (no en un elemento)
            if (e.target === e.currentTarget) {
              setSelectedElement(null);
            }
          }}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: `${100 / 19.2}% ${100 / 10.8}%`,
            }}
          />

          {/* Render Card (fondo) */}
          {cardElement.enabled && (
            <div
              onMouseDown={(e) => handleMouseDown(e, 'card', 'card-1')}
              onClick={(e) => e.stopPropagation()}
              className={`absolute cursor-move transition-all ${
                selectedElement?.type === 'card'
                  ? 'ring-4 ring-white ring-offset-2 ring-offset-black z-30'
                  : 'hover:ring-2 hover:ring-white/50 z-20'
              }`}
              style={{
                left: `${(cardElement.x / canvasWidth) * 100}%`,
                top: `${(cardElement.y / canvasHeight) * 100}%`,
                width: `${(cardElement.width / canvasWidth) * 100}%`,
                height: `${(cardElement.height / canvasHeight) * 100}%`,
                border: '2px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: '16px',
              }}
            >
              {/* Label */}
              <div className="absolute -top-6 left-0 text-xs font-bold px-2 py-1 rounded-t text-white whitespace-nowrap bg-blue-500">
                🎴 FONDO
              </div>
              {/* Content preview */}
              <div className="w-full h-full flex items-center justify-center text-blue-400/50">
                <div className="text-center">
                  <div className="text-2xl mb-1">🎴</div>
                  <div className="text-xs font-medium">Card/Fondo</div>
                  <div className="text-[10px] opacity-60">{cardElement.width} × {cardElement.height}</div>
                </div>
              </div>
              {/* Resize handles */}
              {selectedElement?.type === 'card' && ['nw', 'ne', 'sw', 'se'].map((handle) => (
                <div
                  key={handle}
                  onMouseDown={(e) => handleResizeMouseDown(e, 'card', 'card-1', handle)}
                  className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize hover:scale-125 transition-transform z-50"
                  style={{
                    top: handle.includes('n') ? '-8px' : 'auto',
                    bottom: handle.includes('s') ? '-8px' : 'auto',
                    left: handle.includes('w') ? '-8px' : 'auto',
                    right: handle.includes('e') ? '-8px' : 'auto',
                  }}
                />
              ))}
            </div>
          )}

          {/* Render Media and Texts */}
          {renderCanvasElement(currentEventConfig.media, 'media', '#9333ea')}
          {currentEventConfig.texts.map(text => renderCanvasElement(text, 'text', '#22c55e'))}

          {/* Canvas info */}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 rounded text-xs text-white/70">
            {canvasWidth} × {canvasHeight}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1C1D] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🎯 Propiedades
          </h3>
        </div>
        {renderPropertiesPanel()}
      </div>

      {/* Config del Evento - Lee y escribe directamente a la config del evento */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1B1C1D] shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            📋 Configuración — {EVENT_TABS.find(t => t.id === activeEvent)?.label}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Estos valores se guardan en la pestaña del evento correspondiente
          </p>
        </div>
        <div className="p-4 space-y-4">
          {/* Mensaje */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mensaje de Alerta</label>
            <input
              type="text"
              value={currentMessage}
              onChange={(e) => updateCurrentEventMessage(e.target.value)}
              placeholder="¡Gracias {username}!"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Variables: {'{username}'}, {'{amount}'}, {'{viewers}'}, {'{months}'}, {'{tier}'}
            </p>
          </div>
          {/* Media URL */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">URL del Media (Video/Imagen)</label>
            <input
              type="text"
              value={currentMediaUrl}
              onChange={(e) => updateCurrentEventMedia(e.target.value)}
              placeholder="/timerextensible/canal/carpeta/video.mp4"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {currentMediaUrl && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-green-600 dark:text-green-400">✓ Configurado:</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  {currentMediaUrl}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <button
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
        >
          <Eye className="w-5 h-5" />
          Preview
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHasChanges(false)}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Descartar
          </button>
          <button
            onClick={onSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
          >
            <Save className="w-5 h-5" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverlayEditorTab;
