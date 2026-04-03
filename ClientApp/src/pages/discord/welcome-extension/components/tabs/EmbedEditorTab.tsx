/**
 * Discord Welcome - Visual Editor con Canvas 2D
 * Lo que ves es lo que sale en Discord — la imagen se genera aquí y se sube al server.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Eye, EyeOff, Hash, X, RotateCcw,
  Shield, MessageSquare
} from 'lucide-react';
import type { WelcomeSettings, GoodbyeSettings, ImageMode, DiscordChannel, DiscordRole, EditorLayout } from '../../types';
import { WELCOME_COLOR_PRESETS, GOODBYE_COLOR_PRESETS, MESSAGE_VARIABLES, WELCOME_MESSAGE_TEMPLATES, GOODBYE_MESSAGE_TEMPLATES } from '../../constants/defaults';
import MediaGallery from '../../../../../components/timer/MediaGallery';
import api from '../../../../../services/api';

// ============================================
// TYPES
// ============================================

type EditMode = 'welcome' | 'goodbye';

interface CanvasElement {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  textColor: string;
  fontSize?: number; // Custom font size (0 = auto from height)
}

interface EmbedEditorTabProps {
  welcomeConfig: WelcomeSettings;
  goodbyeConfig: GoodbyeSettings;
  onWelcomeChange: (updates: Partial<WelcomeSettings>) => void;
  onGoodbyeChange: (updates: Partial<GoodbyeSettings>) => void;
  editorLayout: EditorLayout | null;
  onEditorLayoutChange: (layout: EditorLayout) => void;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  guildName: string;
  guildId?: string;
  onGeneratedImageChange?: (type: 'welcome' | 'goodbye', url: string) => void;
  exportRef?: React.MutableRefObject<(() => Promise<{ type: string; url: string } | null>) | null>;
}

// ============================================
// CANVAS CONFIG — Resoluciones disponibles
// ============================================

type CanvasResolution = '1024x500' | '1200x600' | '1920x1080';

const RESOLUTIONS: { id: CanvasResolution; label: string; w: number; h: number }[] = [
  { id: '1024x500',  label: 'Estandar (1024x500)',  w: 1024, h: 500 },
  { id: '1200x600',  label: 'Grande (1200x600)',     w: 1200, h: 600 },
  { id: '1920x1080', label: 'Full HD (1920x1080)',   w: 1920, h: 1080 },
];

// Base de diseño: 800x450 — se escala a la resolución elegida
const BASE_W = 800;
const BASE_H = 450;

function getDefaultElements(w: number, h: number): Record<string, Omit<CanvasElement, 'enabled'>> {
  const sx = w / BASE_W;
  const sy = h / BASE_H;
  return {
    'background': { id: 'background', label: 'Fondo',    x: 0,                        y: 0,                        width: w,                      height: h,                     textColor: '#ffffff' },
    'avatar':     { id: 'avatar',     label: 'Avatar',   x: Math.round(325 * sx),     y: Math.round(35 * sy),      width: Math.round(160 * sx),   height: Math.round(160 * sy),  textColor: '#ffffff' },
    'text':       { id: 'text',       label: 'Texto',    x: 0,                        y: Math.round(230 * sy),     width: Math.round(797 * sx),   height: Math.round(90 * sy),   textColor: '#ffffff' },
    'subtext':    { id: 'subtext',    label: 'Subtexto', x: Math.round(150 * sx),     y: Math.round(340 * sy),     width: Math.round(500 * sx),   height: Math.round(40 * sy),   textColor: '#ffffff' },
    'footer':     { id: 'footer',     label: 'Footer',   x: Math.round(200 * sx),     y: Math.round(410 * sy),     width: Math.round(400 * sx),   height: Math.round(30 * sy),   textColor: '#ffffff' },
  };
}

// ============================================
// HELPERS
// ============================================

const SAMPLE = {
  welcome: { user: 'NuevoUser', username: 'nuevouser', memberCount: '1,234' },
  goodbye: { user: 'ExUser', username: 'exuser', memberCount: '1,233' },
};

function fmt(msg: string, mode: EditMode, guild: string): string {
  const d = SAMPLE[mode];
  return msg.replace(/\{user\}/g, d.user).replace(/\{username\}/g, d.username)
    .replace(/\{server\}/g, guild).replace(/\{memberCount\}/g, d.memberCount);
}

// ============================================
// COMPONENT
// ============================================

export default function EmbedEditorTab({
  welcomeConfig, goodbyeConfig,
  onWelcomeChange, onGoodbyeChange,
  editorLayout, onEditorLayoutChange,
  channels, roles, guildName, guildId,
  onGeneratedImageChange, exportRef,
}: EmbedEditorTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState<EditMode>('welcome');
  const [selectedId, setSelectedId] = useState<string | null>('text');
  const [showGallery, setShowGallery] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Resolución — cargar de layout guardado o default 1920x1080
  const [resolution, setResolution] = useState<CanvasResolution>(() => {
    const saved = (editorLayout as any)?.resolution;
    if (saved && RESOLUTIONS.find(r => r.id === saved)) return saved;
    return '1920x1080';
  });
  const res = RESOLUTIONS.find(r => r.id === resolution)!;
  const CW = res.w;
  const CH = res.h;

  // Elements state
  const [elements, setElements] = useState<Record<string, CanvasElement>>(() => {
    const defaults = getDefaultElements(CW, CH);
    const els: Record<string, CanvasElement> = {};
    Object.entries(defaults).forEach(([key, el]) => {
      const saved = editorLayout?.elements?.[key] as any;
      els[key] = saved
        ? { ...el, x: saved.x, y: saved.y, width: saved.width, height: saved.height, enabled: saved.enabled, textColor: saved.textColor || el.textColor, fontSize: saved.fontSize || 0 }
        : { ...el, enabled: true };
    });
    return els;
  });

  // Loaded images
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [avatarImage, setAvatarImage] = useState<HTMLImageElement | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 });

  const config = editMode === 'welcome' ? welcomeConfig : goodbyeConfig;
  const updateConfig = useCallback((u: Partial<WelcomeSettings> | Partial<GoodbyeSettings>) => {
    if (editMode === 'welcome') onWelcomeChange(u as Partial<WelcomeSettings>);
    else onGoodbyeChange(u as Partial<GoodbyeSettings>);
  }, [editMode, onWelcomeChange, onGoodbyeChange]);

  const colorPresets = editMode === 'welcome' ? WELCOME_COLOR_PRESETS : GOODBYE_COLOR_PRESETS;
  const msgTemplates = editMode === 'welcome' ? WELCOME_MESSAGE_TEMPLATES : GOODBYE_MESSAGE_TEMPLATES;
  const sample = SAMPLE[editMode];
  const inputCls = "w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]";
  const selectCls = `${inputCls} appearance-none [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]`;

  // ============================================
  // LOAD IMAGES
  // ============================================

  useEffect(() => {
    if (config.imageMode === 'custom' && config.imageUrl) {
      // Use relative URL to avoid CORS issues (same domain)
      const imgUrl = config.imageUrl.startsWith('http') ? config.imageUrl : config.imageUrl;
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgImage(img);
      img.onerror = () => setBgImage(null);
      img.src = imgUrl;
    } else {
      setBgImage(null);
    }
  }, [config.imageUrl, config.imageMode]);

  useEffect(() => {
    // Load a sample avatar for preview
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setAvatarImage(img);
    img.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
  }, []);

  // ============================================
  // DRAW CANVAS
  // ============================================

  const drawCanvas = useCallback((forExport = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CW, CH);

    // 1. Background
    const bg = elements['background'];
    if (bg.enabled) {
      ctx.fillStyle = '#2b2d31';
      ctx.fillRect(0, 0, CW, CH);
      if (bgImage) {
        const imgRatio = bgImage.width / bgImage.height;
        const elRatio = bg.width / bg.height;
        let sx = 0, sy = 0, sw = bgImage.width, sh = bgImage.height;
        if (imgRatio > elRatio) { sw = bgImage.height * elRatio; sx = (bgImage.width - sw) / 2; }
        else { sh = bgImage.width / elRatio; sy = (bgImage.height - sh) / 2; }
        ctx.drawImage(bgImage, sx, sy, sw, sh, bg.x, bg.y, bg.width, bg.height);
      }
    }

    // 2. Semi-transparent overlay for readability
    if (bgImage && bg.enabled) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, CW, CH);
    }

    // 3. Color bar accent at top
    ctx.fillStyle = config.embedColor;
    ctx.fillRect(0, 0, CW, 4);

    // 4. Avatar in circle
    const av = elements['avatar'];
    if (av.enabled && config.showAvatar) {
      const cx = av.x + av.width / 2;
      const cy = av.y + av.height / 2;
      const r = Math.min(av.width, av.height) / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      if (avatarImage) {
        ctx.drawImage(avatarImage, av.x, av.y, av.width, av.height);
      } else {
        ctx.fillStyle = '#5865f2';
        ctx.fillRect(av.x, av.y, av.width, av.height);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${r}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sample.user.charAt(0).toUpperCase(), cx, cy);
      }
      ctx.restore();
    }

    // 5. Main text — usa textColor del elemento, clip dentro del area
    const txt = elements['text'];
    if (txt.enabled) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(txt.x, txt.y, txt.width, txt.height);
      ctx.clip();

      const message = fmt(config.message, editMode, guildName);
      const fontSize = txt.fontSize && txt.fontSize > 0 ? txt.fontSize : Math.max(12, txt.height * 0.45);
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = txt.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const words = message.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > txt.width - 40) {
          if (line) lines.push(line);
          line = word;
        } else { line = test; }
      }
      if (line) lines.push(line);

      const lineHeight = fontSize * 1.3;
      const totalHeight = lines.length * lineHeight;
      const startY = txt.y + (txt.height - totalHeight) / 2 + lineHeight / 2;
      lines.forEach((l, i) => { ctx.fillText(l, txt.x + txt.width / 2, startY + i * lineHeight); });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.restore();
    }

    // 6. Subtext — clip dentro del area
    const sub = elements['subtext'];
    if (sub.enabled) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sub.x, sub.y, sub.width, sub.height);
      ctx.clip();

      const subSize = sub.fontSize && sub.fontSize > 0 ? sub.fontSize : Math.max(10, sub.height * 0.5);
      ctx.font = `${subSize}px Inter, sans-serif`;
      ctx.fillStyle = sub.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(guildName, sub.x + sub.width / 2, sub.y + sub.height / 2);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 7. Footer — clip dentro del area
    const ft = elements['footer'];
    if (ft.enabled) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ft.x, ft.y, ft.width, ft.height);
      ctx.clip();

      const ftSize = ft.fontSize && ft.fontSize > 0 ? ft.fontSize : Math.max(8, ft.height * 0.5);
      ctx.font = `${ftSize}px Inter, sans-serif`;
      ctx.fillStyle = ft.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${guildName} • Decatron Bot`, ft.x + ft.width / 2, ft.y + ft.height / 2);
      ctx.restore();
    }

    // 8. Selection outline — SOLO en modo editor, NO al exportar
    if (!forExport && selectedId && elements[selectedId]) {
      const sel = elements[selectedId];
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sel.x - 1, sel.y - 1, sel.width + 2, sel.height + 2);
      ctx.setLineDash([]);

      if (sel.id !== 'background') {
        const hs = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        [[sel.x - hs / 2, sel.y - hs / 2], [sel.x + sel.width - hs / 2, sel.y - hs / 2],
         [sel.x - hs / 2, sel.y + sel.height - hs / 2], [sel.x + sel.width - hs / 2, sel.y + sel.height - hs / 2]
        ].forEach(([cx, cy]) => { ctx.fillRect(cx, cy, hs, hs); ctx.strokeRect(cx, cy, hs, hs); });
      }

      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 11px Inter, sans-serif';
      const lw = ctx.measureText(sel.label).width + 12;
      ctx.fillRect(sel.x, sel.y - 20, lw, 18);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(sel.label, sel.x + 6, sel.y - 11);
    }
  }, [elements, selectedId, config, editMode, guildName, sample, bgImage, avatarImage, CW, CH]);

  // Redraw on any change
  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  // ============================================
  // MOUSE HANDLERS
  // ============================================

  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top) * (CH / rect.height),
    };
  }, [CW, CH]);

  const getHandleAt = useCallback((mx: number, my: number, el: CanvasElement): string | null => {
    const hs = 12;
    const corners: [number, number, string][] = [
      [el.x, el.y, 'nw'], [el.x + el.width, el.y, 'ne'],
      [el.x, el.y + el.height, 'sw'], [el.x + el.width, el.y + el.height, 'se'],
    ];
    for (const [cx, cy, h] of corners) {
      if (Math.abs(mx - cx) < hs && Math.abs(my - cy) < hs) return h;
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x: mx, y: my } = getCanvasCoords(e);

    // Check resize handles first
    if (selectedId && elements[selectedId] && selectedId !== 'background') {
      const handle = getHandleAt(mx, my, elements[selectedId]);
      if (handle) {
        const el = elements[selectedId];
        setResizeStart({ x: el.x, y: el.y, w: el.width, h: el.height, mx, my });
        setResizeHandle(handle);
        setIsResizing(true);
        return;
      }
    }

    // Find clicked element (reverse order = top elements first)
    const ids = Object.keys(elements).reverse();
    for (const id of ids) {
      const el = elements[id];
      if (!el.enabled) continue;
      if (mx >= el.x && mx <= el.x + el.width && my >= el.y && my <= el.y + el.height) {
        setSelectedId(id);
        if (id !== 'background') {
          setDragOffset({ x: mx - el.x, y: my - el.y });
          setIsDragging(true);
        }
        return;
      }
    }
    setSelectedId(null);
  }, [elements, selectedId, getCanvasCoords, getHandleAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedId) return;
    const { x: mx, y: my } = getCanvasCoords(e);

    if (isDragging) {
      const el = elements[selectedId];
      const nx = Math.max(0, Math.min(Math.round(mx - dragOffset.x), CW - el.width));
      const ny = Math.max(0, Math.min(Math.round(my - dragOffset.y), CH - el.height));
      setElements(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], x: nx, y: ny } }));
    }

    if (isResizing && resizeHandle) {
      const dx = mx - resizeStart.mx, dy = my - resizeStart.my;
      let nx = resizeStart.x, ny = resizeStart.y, nw = resizeStart.w, nh = resizeStart.h;
      if (resizeHandle.includes('e')) nw = Math.max(40, resizeStart.w + dx);
      if (resizeHandle.includes('w')) { nw = Math.max(40, resizeStart.w - dx); nx = resizeStart.x + resizeStart.w - nw; }
      if (resizeHandle.includes('s')) nh = Math.max(20, resizeStart.h + dy);
      if (resizeHandle.includes('n')) { nh = Math.max(20, resizeStart.h - dy); ny = resizeStart.y + resizeStart.h - nh; }
      setElements(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) } }));
    }
  }, [isDragging, isResizing, selectedId, dragOffset, resizeHandle, resizeStart, elements, getCanvasCoords, CW, CH]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // ============================================
  // SYNC LAYOUT TO PARENT (debounced)
  // ============================================

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const layoutEls: Record<string, any> = {};
      Object.entries(elements).forEach(([k, el]) => {
        layoutEls[k] = { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, enabled: el.enabled, textColor: el.textColor, fontSize: el.fontSize || 0 };
      });
      onEditorLayoutChange({ elements: layoutEls, resolution } as any);
    }, 300);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [elements, resolution, onEditorLayoutChange]);

  // ============================================
  // EXPORT IMAGE
  // ============================================

  // Retorna { type, url } para que handleSave lo use directamente
  const exportImage = useCallback(async (): Promise<{ type: string; url: string } | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !guildId) return null;

    setExporting(true);
    try {
      drawCanvas(true);
      await new Promise(r => requestAnimationFrame(r));

      const blob = await new Promise<Blob | null>((resolve, reject) => {
        try { canvas.toBlob(resolve, 'image/png'); }
        catch (e) { reject(e); }
      });

      if (!blob) throw new Error('Failed to create image blob');

      const formData = new FormData();
      formData.append('file', blob, `${editMode}_welcome.png`);
      formData.append('type', editMode);

      const res = await api.post(`/discord/welcome/${guildId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        onGeneratedImageChange?.(editMode, res.data.fileUrl);
        drawCanvas(false);
        return { type: editMode, url: res.data.fileUrl };
      }

      drawCanvas(false);
      return null;
    } catch (err: any) {
      console.error('Export error:', err);
      // Restaurar canvas con selección
      drawCanvas(false);
      if (err.message?.includes('tainted') || err.name === 'SecurityError') {
        alert('Error CORS: La imagen de fondo no permite exportar. Usa una imagen de la galeria en vez de URL externa.');
      } else {
        alert(`Error al exportar: ${err.message || 'Unknown error'}`);
      }
      return null;
    } finally {
      setExporting(false);
    }
  }, [guildId, editMode, drawCanvas, onGeneratedImageChange]);

  // Registrar export en el ref del padre (para que Guardar lo llame automaticamente)
  useEffect(() => {
    if (exportRef) exportRef.current = exportImage;
    return () => { if (exportRef) exportRef.current = null; };
  }, [exportRef, exportImage]);

  // ============================================
  // ELEMENT HELPERS
  // ============================================

  const updateEl = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, []);

  const resetLayout = useCallback(() => {
    const defaults = getDefaultElements(CW, CH);
    const els: Record<string, CanvasElement> = {};
    Object.entries(defaults).forEach(([k, el]) => { els[k] = { ...el, enabled: true }; });
    setElements(els);
  }, [CW, CH]);

  const changeResolution = useCallback((newRes: CanvasResolution) => {
    const oldRes = RESOLUTIONS.find(r => r.id === resolution)!;
    const newResObj = RESOLUTIONS.find(r => r.id === newRes)!;
    const sx = newResObj.w / oldRes.w;
    const sy = newResObj.h / oldRes.h;

    // Escalar todos los elementos proporcionalmente
    setElements(prev => {
      const next: Record<string, CanvasElement> = {};
      Object.entries(prev).forEach(([k, el]) => {
        next[k] = {
          ...el,
          x: Math.round(el.x * sx),
          y: Math.round(el.y * sy),
          width: k === 'background' ? newResObj.w : Math.round(el.width * sx),
          height: k === 'background' ? newResObj.h : Math.round(el.height * sy),
        };
      });
      return next;
    });
    setResolution(newRes);
  }, [resolution]);

  // ============================================
  // RENDER PROPERTIES
  // ============================================

  const renderProperties = () => {
    if (!selectedId || !elements[selectedId]) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-[#64748b]">Selecciona un elemento en el canvas</p>
        </div>
      );
    }

    const el = elements[selectedId];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-gray-900 dark:text-white">{el.label}</span>
          {el.id !== 'background' && (
            <button onClick={() => updateEl(el.id, { enabled: !el.enabled })}
              className={`p-1.5 rounded-lg ${el.enabled ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-[#64748b] bg-gray-100 dark:bg-gray-800'}`}>
              {el.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Position */}
        {el.id !== 'background' && (
          <div>
            <p className="text-[10px] font-bold text-[#94a3b8] mb-1">POSICION / TAMAÑO</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['x', 'y', 'width', 'height'] as const).map(k => (
                <div key={k}>
                  <label className="text-[9px] text-[#94a3b8]">{k === 'width' ? 'W' : k === 'height' ? 'H' : k.toUpperCase()}</label>
                  <input type="number" value={el[k]} onChange={(e) => updateEl(el.id, { [k]: parseInt(e.target.value) || 0 })}
                    className="w-full px-1.5 py-1 text-[11px] border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Background */}
        {selectedId === 'background' && (
          <div>
            <p className="text-[10px] font-bold text-[#94a3b8] mb-1">IMAGEN DE FONDO</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {([{ v: 'custom' as ImageMode, l: 'Imagen' }, { v: 'none' as ImageMode, l: 'Color' }]).map(o => (
                <button key={o.v} onClick={() => updateConfig({ imageMode: o.v })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border-2 ${config.imageMode === o.v ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'border-[#e2e8f0] dark:border-[#374151] text-[#64748b]'}`}>
                  {o.l}
                </button>
              ))}
            </div>

            {/* Templates prediseñados */}
            <p className="text-[10px] font-bold text-[#94a3b8] mb-1.5">TEMPLATES</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { id: 'gaming-neon', label: 'Gaming' },
                { id: 'anime-sky', label: 'Anime' },
                { id: 'minimal-dark', label: 'Minimal' },
                { id: 'gradient-vibrant', label: 'Gradiente' },
                { id: 'nature-night', label: 'Naturaleza' },
              ].map(t => {
                const tUrl = `/system-files/images/welcome-templates/${t.id}.png`;
                const isActive = config.imageUrl === tUrl;
                return (
                  <button key={t.id} onClick={() => updateConfig({ imageMode: 'custom', imageUrl: tUrl })}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${isActive ? 'border-[#2563eb] ring-1 ring-[#2563eb]' : 'border-[#374151] hover:border-[#64748b]'}`}>
                    <img src={tUrl} alt={t.label} className="w-full h-12 object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5 font-bold">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {config.imageMode === 'custom' && (
              <div className="space-y-1.5">
                <input type="url" value={config.imageUrl || ''} onChange={(e) => updateConfig({ imageUrl: e.target.value || null })} placeholder="URL de imagen o selecciona template" className={`${inputCls} text-xs`} />
                <button onClick={() => setShowGallery(true)} className="w-full px-2 py-1.5 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[10px] text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb]">Mi Galeria</button>
              </div>
            )}
            <div className="mt-2">
              <p className="text-[10px] font-bold text-[#94a3b8] mb-1">COLOR ACCENT</p>
              <div className="flex items-center gap-2">
                <input type="color" value={config.embedColor} onChange={(e) => updateConfig({ embedColor: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
                <div className="flex gap-1 flex-wrap">
                  {colorPresets.map(({ color }) => (
                    <button key={color} onClick={() => updateConfig({ embedColor: color })}
                      className={`w-5 h-5 rounded-full border-2 ${config.embedColor === color ? 'border-white scale-110' : 'border-[#374151]'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Text */}
        {selectedId === 'text' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[#94a3b8]">TAMAÑO DE FUENTE</p>
            <div className="flex items-center gap-2">
              <input type="number" value={el.fontSize || Math.round(el.height * 0.45)} min={8} max={200}
                onChange={(e) => updateEl('text', { fontSize: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-[11px] border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
              <span className="text-[10px] text-[#94a3b8]">px</span>
              <button onClick={() => updateEl('text', { fontSize: 0 })} className="text-[10px] text-[#2563eb] hover:underline">Auto</button>
            </div>

            <p className="text-[10px] font-bold text-[#94a3b8]">COLOR DEL TEXTO</p>
            <div className="flex items-center gap-2 mb-2">
              <input type="color" value={el.textColor.startsWith('rgba') ? '#ffffff' : el.textColor} onChange={(e) => updateEl('text', { textColor: e.target.value })} className="w-7 h-7 rounded border cursor-pointer" />
              <input type="text" value={el.textColor} onChange={(e) => updateEl('text', { textColor: e.target.value })} className="flex-1 px-2 py-1 text-[11px] font-mono border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
              <div className="flex gap-1">
                {['#ffffff', '#ffff00', '#00ff00', '#ff6b6b', '#00d4ff', '#ff69b4'].map(c => (
                  <button key={c} onClick={() => updateEl('text', { textColor: c })} className={`w-5 h-5 rounded-full border ${el.textColor === c ? 'border-white scale-110' : 'border-[#374151]'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <p className="text-[10px] font-bold text-[#94a3b8]">MENSAJE</p>
            <textarea value={config.message} onChange={(e) => updateConfig({ message: e.target.value })} rows={3} className={`${inputCls} resize-none text-xs`} />
            <div className="flex flex-wrap gap-1">
              {MESSAGE_VARIABLES.map(v => (
                <button key={v.key} onClick={() => updateConfig({ message: config.message + v.key })}
                  className="text-[9px] font-mono text-[#2563eb] bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded hover:bg-blue-100">{v.key}</button>
              ))}
            </div>
            <div className="space-y-1">
              {msgTemplates.slice(0, 3).map((t, i) => (
                <button key={i} onClick={() => updateConfig({ message: t })}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] ${config.message === t ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]' : 'text-[#64748b] hover:bg-[#f8fafc]'}`}>
                  {t.length > 50 ? t.slice(0, 50) + '...' : t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Avatar */}
        {selectedId === 'avatar' && (
          <div>
            <p className="text-[10px] font-bold text-[#94a3b8] mb-1">AVATAR</p>
            <Toggle checked={config.showAvatar} onChange={(v) => updateConfig({ showAvatar: v })} label="Mostrar avatar del miembro" />
            <p className="text-[10px] text-[#94a3b8] mt-2">Se muestra en circulo con borde blanco. En Discord real se usa el avatar del usuario que entra.</p>
          </div>
        )}

        {selectedId === 'subtext' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[#94a3b8]">SUBTEXTO</p>
            <p className="text-xs text-[#64748b]">Muestra el nombre del servidor: <strong>{guildName}</strong></p>
            <p className="text-[10px] font-bold text-[#94a3b8] mt-2">TAMAÑO DE FUENTE</p>
            <div className="flex items-center gap-2">
              <input type="number" value={el.fontSize || Math.round(el.height * 0.5)} min={8} max={200}
                onChange={(e) => updateEl('subtext', { fontSize: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-[11px] border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
              <span className="text-[10px] text-[#94a3b8]">px</span>
              <button onClick={() => updateEl('subtext', { fontSize: 0 })} className="text-[10px] text-[#2563eb] hover:underline">Auto</button>
            </div>
            <p className="text-[10px] font-bold text-[#94a3b8] mt-2">COLOR DEL TEXTO</p>
            <div className="flex items-center gap-2">
              <input type="color" value={el.textColor.startsWith('rgba') ? '#b3b3b3' : el.textColor} onChange={(e) => updateEl('subtext', { textColor: e.target.value })} className="w-7 h-7 rounded border cursor-pointer" />
              <input type="text" value={el.textColor} onChange={(e) => updateEl('subtext', { textColor: e.target.value })} className="flex-1 px-2 py-1 text-[11px] font-mono border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
            </div>
          </div>
        )}

        {selectedId === 'footer' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[#94a3b8]">FOOTER</p>
            <p className="text-xs text-[#64748b]">Automatico: {guildName} • Decatron Bot</p>
            <p className="text-[10px] font-bold text-[#94a3b8] mt-2">TAMAÑO DE FUENTE</p>
            <div className="flex items-center gap-2">
              <input type="number" value={el.fontSize || Math.round(el.height * 0.5)} min={8} max={200}
                onChange={(e) => updateEl('footer', { fontSize: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-[11px] border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
              <span className="text-[10px] text-[#94a3b8]">px</span>
              <button onClick={() => updateEl('footer', { fontSize: 0 })} className="text-[10px] text-[#2563eb] hover:underline">Auto</button>
            </div>
            <p className="text-[10px] font-bold text-[#94a3b8] mt-2">COLOR DEL TEXTO</p>
            <div className="flex items-center gap-2">
              <input type="color" value={el.textColor.startsWith('rgba') ? '#949ba4' : el.textColor} onChange={(e) => updateEl('footer', { textColor: e.target.value })} className="w-7 h-7 rounded border cursor-pointer" />
              <input type="text" value={el.textColor} onChange={(e) => updateEl('footer', { textColor: e.target.value })} className="flex-1 px-2 py-1 text-[11px] font-mono border border-[#e2e8f0] dark:border-[#374151] rounded bg-[#f8fafc] dark:bg-[#374151]/50 text-gray-900 dark:text-white" />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-[#64748b]">EDITANDO:</span>
          {(['welcome', 'goodbye'] as EditMode[]).map(m => (
            <button key={m} onClick={() => { setEditMode(m); setSelectedId('text'); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${editMode === m ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg' : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b]'}`}>
              {m === 'welcome' ? '👋 Bienvenida' : '💨 Despedida'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`relative w-12 h-6 rounded-full transition-all ${config.enabled ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        {config.enabled && (
          <div className="mt-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#64748b]" />
            <select value={config.channelId || ''} onChange={(e) => updateConfig({ channelId: e.target.value || null })} className={`flex-1 ${selectCls}`}>
              <option value="">Seleccionar canal...</option>
              {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {config.enabled && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Canvas (2/3) */}
          <div className="xl:col-span-2">
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/30 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#374151]">
                <span className="text-xs font-bold text-[#64748b]">CANVAS — Lo que ves es lo que sale en Discord</span>
                <div className="flex items-center gap-2">
                  <select
                    value={resolution}
                    onChange={(e) => changeResolution(e.target.value as CanvasResolution)}
                    className="px-2 py-1 text-[10px] font-bold bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-gray-700 dark:text-gray-300 [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D]"
                  >
                    {RESOLUTIONS.map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  <button onClick={resetLayout} className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#64748b] hover:text-[#2563eb] rounded-lg hover:bg-blue-50">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
              </div>

              <div ref={containerRef} className="p-4 bg-[#1e1f22]">
                <canvas
                  ref={canvasRef}
                  width={CW}
                  height={CH}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="w-full rounded-lg cursor-crosshair"
                  style={{ maxWidth: '100%', aspectRatio: `${CW}/${CH}` }}
                />
              </div>

              {/* Element buttons */}
              <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/30 border-t border-[#e2e8f0] dark:border-[#374151]">
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(elements).map(el => (
                    <button key={el.id} onClick={() => setSelectedId(el.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        selectedId === el.id ? 'bg-[#2563eb] text-white border-[#2563eb]' : el.enabled ? 'bg-white dark:bg-[#1B1C1D] border-[#e2e8f0] dark:border-[#374151] text-gray-600 dark:text-gray-400' : 'bg-gray-100 dark:bg-gray-800 border-transparent text-[#94a3b8] opacity-50'
                      }`}>
                      {el.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Properties (1/3) */}
          <div className="xl:col-span-1 space-y-4">
            <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-lg sticky top-6 overflow-hidden">
              <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#374151]/30 border-b border-[#e2e8f0] dark:border-[#374151]">
                <span className="text-xs font-bold text-[#64748b]">PROPIEDADES</span>
              </div>
              <div className="p-4">{renderProperties()}</div>
            </div>

            {/* Welcome extras */}
            {editMode === 'welcome' && (
              <>
                <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-[#f97316]" />
                    <span className="text-xs font-bold text-[#64748b]">MENCION / DM</span>
                  </div>
                  <Toggle checked={welcomeConfig.mentionUser} onChange={(v) => onWelcomeChange({ mentionUser: v })} label="Mencionar @usuario" />
                  <div className="mt-2">
                    <Toggle checked={welcomeConfig.dmEnabled} onChange={(v) => {
                      const updates: any = { dmEnabled: v };
                      if (v && !welcomeConfig.dmMessage) updates.dmMessage = 'Bienvenido a {server}! Esperamos que disfrutes tu estadia.';
                      onWelcomeChange(updates);
                    }} label="Enviar DM privado" />
                  </div>
                  {welcomeConfig.dmEnabled && (
                    <textarea value={welcomeConfig.dmMessage || ''} onChange={(e) => onWelcomeChange({ dmMessage: e.target.value || null })} rows={2} placeholder="Bienvenido a {server}!" className={`${inputCls} resize-none text-xs mt-2`} />
                  )}
                </div>
                <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] shadow-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-[#8b5cf6]" />
                    <span className="text-xs font-bold text-[#64748b]">ROL AUTOMATICO</span>
                  </div>
                  <select value={welcomeConfig.autoRoleId || ''} onChange={(e) => onWelcomeChange({ autoRoleId: e.target.value || null })} className={selectCls}>
                    <option value="">Ninguno</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Seleccionar imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-[#64748b] hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <MediaGallery selectedFileType="image" onFileSelect={(file) => { updateConfig({ imageUrl: file.fileUrl }); setShowGallery(false); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className={`w-9 h-5 rounded-full transition-all ${checked ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <span className="text-xs font-medium text-gray-900 dark:text-white">{label}</span>
    </label>
  );
}
