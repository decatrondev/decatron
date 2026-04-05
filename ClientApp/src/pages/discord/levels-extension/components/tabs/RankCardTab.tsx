import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, RotateCcw, ZoomIn, ZoomOut, Eye, EyeOff, Loader2, CheckCircle, XCircle, Layers, Move, Type, Image, BarChart3 } from 'lucide-react';
import api from '../../../../../services/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface CardElement {
  id: string;
  type: 'avatar' | 'text' | 'progress_bar';
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
  // Text props
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  // Avatar props
  shape?: string;
  borderColor?: string;
  borderWidth?: number;
  // Progress bar props
  barBgColor?: string;
  barFillColor?: string;
  barBorderRadius?: number;
}

interface CardBackground {
  type: string;
  color: string;
  gradient?: string;
  imageUrl?: string;
}

interface CardConfig {
  elements: CardElement[];
  background: CardBackground;
}

interface RankCardTabProps {
  guildId: string;
}

interface SaveMessage {
  type: 'success' | 'error';
  text: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 400;

const SAMPLE_DATA: Record<string, string | number> = {
  username: 'StreamerName',
  discriminator: '#1234',
  level: 42,
  rank: 3,
  total_users: 350,
  current_xp: 45200,
  required_xp: 58000,
  total_xp: 892000,
  progress: 78,
  remaining_xp: 12800,
  tier: 'premium',
};

const cardClass = 'bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 border border-[#e2e8f0] dark:border-[#374151] shadow-lg';
const inputClass = 'w-full px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2563eb] focus:border-transparent';
const labelClass = 'text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider';
const btnClass = 'px-3 py-2 rounded-xl text-sm font-bold transition-all';

// ── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, { label: string; config: CardConfig }> = {
  classic: {
    label: 'Clasico',
    config: {
      background: { type: 'solid', color: '#1a1a2e' },
      elements: [
        { id: 'avatar', type: 'avatar', x: 40, y: 60, width: 280, height: 280, visible: true, zIndex: 10, shape: 'circle', borderColor: '#2563eb', borderWidth: 4 },
        { id: 'username', type: 'text', x: 360, y: 60, width: 600, height: 60, visible: true, zIndex: 10, text: '{username}', fontSize: 48, fontWeight: 'bold', color: '#ffffff', textAlign: 'left' },
        { id: 'level_label', type: 'text', x: 360, y: 130, width: 200, height: 36, visible: true, zIndex: 10, text: 'LEVEL {level}', fontSize: 28, fontWeight: 'bold', color: '#2563eb', textAlign: 'left' },
        { id: 'rank_label', type: 'text', x: 1100, y: 60, width: 260, height: 50, visible: true, zIndex: 10, text: 'RANK #{rank}', fontSize: 36, fontWeight: 'bold', color: '#94a3b8', textAlign: 'right' },
        { id: 'xp_text', type: 'text', x: 360, y: 290, width: 600, height: 30, visible: true, zIndex: 11, text: '{current_xp} / {required_xp} XP', fontSize: 20, fontWeight: 'normal', color: '#94a3b8', textAlign: 'left' },
        { id: 'progress', type: 'progress_bar', x: 360, y: 230, width: 1000, height: 40, visible: true, zIndex: 10, barBgColor: '#374151', barFillColor: '#2563eb', barBorderRadius: 20 },
      ],
    },
  },
  neon: {
    label: 'Neon',
    config: {
      background: { type: 'solid', color: '#0d0d0d' },
      elements: [
        { id: 'avatar', type: 'avatar', x: 50, y: 50, width: 300, height: 300, visible: true, zIndex: 10, shape: 'circle', borderColor: '#00ff88', borderWidth: 5 },
        { id: 'username', type: 'text', x: 400, y: 50, width: 600, height: 60, visible: true, zIndex: 10, text: '{username}', fontSize: 50, fontWeight: 'bold', color: '#00ff88', textAlign: 'left' },
        { id: 'level_label', type: 'text', x: 400, y: 120, width: 300, height: 40, visible: true, zIndex: 10, text: 'LVL {level}', fontSize: 32, fontWeight: 'bold', color: '#ff00ff', textAlign: 'left' },
        { id: 'rank_label', type: 'text', x: 1100, y: 50, width: 260, height: 50, visible: true, zIndex: 10, text: '#{rank}', fontSize: 42, fontWeight: 'bold', color: '#00ffff', textAlign: 'right' },
        { id: 'xp_text', type: 'text', x: 400, y: 300, width: 600, height: 30, visible: true, zIndex: 11, text: '{current_xp} / {required_xp} XP', fontSize: 20, fontWeight: 'normal', color: '#888888', textAlign: 'left' },
        { id: 'progress', type: 'progress_bar', x: 400, y: 240, width: 960, height: 35, visible: true, zIndex: 10, barBgColor: '#1a1a1a', barFillColor: '#00ff88', barBorderRadius: 18 },
      ],
    },
  },
  minimal: {
    label: 'Minimal',
    config: {
      background: { type: 'solid', color: '#f5f5f5' },
      elements: [
        { id: 'avatar', type: 'avatar', x: 60, y: 100, width: 200, height: 200, visible: true, zIndex: 10, shape: 'square', borderColor: '#e2e8f0', borderWidth: 2 },
        { id: 'username', type: 'text', x: 310, y: 100, width: 500, height: 50, visible: true, zIndex: 10, text: '{username}', fontSize: 40, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'left' },
        { id: 'level_label', type: 'text', x: 310, y: 160, width: 200, height: 30, visible: true, zIndex: 10, text: 'Nivel {level}', fontSize: 22, fontWeight: 'normal', color: '#64748b', textAlign: 'left' },
        { id: 'rank_label', type: 'text', x: 1100, y: 100, width: 260, height: 40, visible: true, zIndex: 10, text: '#{rank}', fontSize: 32, fontWeight: 'bold', color: '#94a3b8', textAlign: 'right' },
        { id: 'xp_text', type: 'text', x: 310, y: 270, width: 500, height: 26, visible: true, zIndex: 11, text: '{current_xp} / {required_xp}', fontSize: 16, fontWeight: 'normal', color: '#94a3b8', textAlign: 'left' },
        { id: 'progress', type: 'progress_bar', x: 310, y: 220, width: 1050, height: 30, visible: true, zIndex: 10, barBgColor: '#e2e8f0', barFillColor: '#2563eb', barBorderRadius: 6 },
      ],
    },
  },
  gaming: {
    label: 'Gaming',
    config: {
      background: { type: 'solid', color: '#12002e' },
      elements: [
        { id: 'avatar', type: 'avatar', x: 40, y: 40, width: 320, height: 320, visible: true, zIndex: 10, shape: 'hexagon', borderColor: '#f59e0b', borderWidth: 5 },
        { id: 'username', type: 'text', x: 410, y: 40, width: 600, height: 65, visible: true, zIndex: 10, text: '{username}', fontSize: 52, fontWeight: 'bold', color: '#f59e0b', textAlign: 'left' },
        { id: 'level_label', type: 'text', x: 410, y: 115, width: 300, height: 40, visible: true, zIndex: 10, text: 'LEVEL {level}', fontSize: 30, fontWeight: 'bold', color: '#a855f7', textAlign: 'left' },
        { id: 'rank_label', type: 'text', x: 1080, y: 40, width: 280, height: 55, visible: true, zIndex: 10, text: 'RANK #{rank}', fontSize: 38, fontWeight: 'bold', color: '#f59e0b', textAlign: 'right' },
        { id: 'xp_text', type: 'text', x: 410, y: 300, width: 600, height: 30, visible: true, zIndex: 11, text: '{current_xp} / {required_xp} XP', fontSize: 20, fontWeight: 'bold', color: '#c084fc', textAlign: 'left' },
        { id: 'progress', type: 'progress_bar', x: 410, y: 230, width: 950, height: 45, visible: true, zIndex: 10, barBgColor: '#1e0a3a', barFillColor: '#a855f7', barBorderRadius: 22 },
      ],
    },
  },
};

const DEFAULT_TEMPLATE = 'classic';

// ── Helper: replace {variable} placeholders ────────────────────────────────

function replaceVars(text: string): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const val = SAMPLE_DATA[key];
    if (val !== undefined) {
      if (typeof val === 'number') return val.toLocaleString();
      return String(val);
    }
    return `{${key}}`;
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RankCardTab({ guildId }: RankCardTabProps) {
  const [config, setConfig] = useState<CardConfig>(TEMPLATES[DEFAULT_TEMPLATE].config);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.55);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<any[]>([]);
  const [editingMode, setEditingMode] = useState<'base' | 'level'>('base');
  const [xpRoles, setXpRoles] = useState<any[]>([]);
  const [selectedLevelRange, setSelectedLevelRange] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Load from API ──

  useEffect(() => {
    loadRankCard();
    loadXpRoles();
  }, [guildId]);

  const loadXpRoles = async () => {
    try {
      const res = await api.get(`/discord/levels/${guildId}/roles`);
      const roles = res.data?.roles || res.data;
      if (Array.isArray(roles)) {
        setXpRoles(roles.sort((a: any, b: any) => a.levelRequired - b.levelRequired));
      }
    } catch { /* ignore */ }
  };

  const loadRankCard = async () => {
    setLoadingData(true);
    try {
      const res = await api.get(`/discord/levels/${guildId}/rankcard`);
      const cfg = res.data?.config;
      if (cfg && cfg.configJson) {
        const parsed: CardConfig = typeof cfg.configJson === 'string' ? JSON.parse(cfg.configJson) : cfg.configJson;
        if (parsed.elements && parsed.elements.length > 0) {
          setConfig(parsed);
          const tpl = cfg.templateId || DEFAULT_TEMPLATE;
          if (TEMPLATES[tpl]) setSelectedTemplate(tpl);
        }
      }
    } catch {
      // No saved config, use default template
    }
    setLoadingData(false);
  };

  const loadLevelCard = async (levelMin: number) => {
    setLoadingData(true);
    try {
      const res = await api.get(`/discord/levels/${guildId}/rankcard/level/${levelMin}`);
      const cfg = res.data?.config;
      if (cfg && cfg.configJson) {
        const parsed: CardConfig = typeof cfg.configJson === 'string' ? JSON.parse(cfg.configJson) : cfg.configJson;
        if (parsed.elements && parsed.elements.length > 0) {
          setConfig(parsed);
          const tpl = cfg.templateId || DEFAULT_TEMPLATE;
          if (TEMPLATES[tpl]) setSelectedTemplate(tpl);
        } else {
          // No custom config for this level, load base as starting point
          loadRankCard();
        }
      } else {
        loadRankCard();
      }
    } catch {
      loadRankCard();
    }
    setLoadingData(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      if (editingMode === 'level' && selectedLevelRange) {
        const [min, max] = selectedLevelRange.split('-').map(Number);
        await api.put(`/discord/levels/${guildId}/rankcard/level/${min}`, {
          configJson: JSON.stringify(config),
          backgroundUrl: config.background.imageUrl || null,
          templateId: selectedTemplate,
          levelMax: max < 999 ? max : null,
        });
      } else {
        await api.put(`/discord/levels/${guildId}/rankcard`, {
          templateId: selectedTemplate,
          configJson: JSON.stringify(config),
        });
      }
      setSaveMessage({ type: 'success', text: 'Rank card guardada correctamente' });
    } catch {
      setSaveMessage({ type: 'error', text: 'Error al guardar la rank card' });
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  // ── Element operations ──

  const updateElement = useCallback((id: string, updates: Partial<CardElement>) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el),
    }));
  }, []);

  const updateBackground = (updates: Partial<CardBackground>) => {
    setConfig(prev => ({ ...prev, background: { ...prev.background, ...updates } }));
  };

  const loadTemplate = (templateKey: string) => {
    const tpl = TEMPLATES[templateKey];
    if (!tpl) return;
    setSelectedTemplate(templateKey);
    setConfig(JSON.parse(JSON.stringify(tpl.config)));
    setSelectedElement(null);
  };

  // ── Drag & Drop ──

  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const element = config.elements.find(el => el.id === elementId);
    if (!element) return;
    setDragging(elementId);
    setSelectedElement(elementId);
    setDragOffset({ x: e.clientX - element.x * scale, y: e.clientY - element.y * scale });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const newX = Math.max(0, Math.min(CANVAS_WIDTH, Math.round((e.clientX - dragOffset.x) / scale)));
    const newY = Math.max(0, Math.min(CANVAS_HEIGHT, Math.round((e.clientY - dragOffset.y) / scale)));
    updateElement(dragging, { x: newX, y: newY });
  }, [dragging, dragOffset, scale, updateElement]);

  const handleMouseUp = useCallback(() => {
    setDragging(false as unknown as null);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedElement(null);
    }
  };

  // ── Selected element ──

  const selected = config.elements.find(el => el.id === selectedElement);

  // ── Render element on canvas ──

  const renderCanvasElement = (el: CardElement) => {
    if (!el.visible) return null;

    const isSelected = selectedElement === el.id;
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: el.x,
      top: el.y,
      width: el.width,
      height: el.height,
      zIndex: el.zIndex,
      cursor: dragging === el.id ? 'grabbing' : 'grab',
      outline: isSelected ? '3px dashed #3b82f6' : 'none',
      outlineOffset: 2,
      userSelect: 'none',
      boxSizing: 'border-box',
    };

    if (el.type === 'avatar') {
      const clipPath = el.shape === 'hexagon' ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : undefined;
      return (
        <div
          key={el.id}
          style={{
            ...baseStyle,
            borderRadius: el.shape === 'circle' ? '50%' : el.shape === 'square' ? 8 : 0,
            clipPath,
            border: `${el.borderWidth || 3}px solid ${el.borderColor || '#2563eb'}`,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
        >
          <span style={{ fontSize: el.width * 0.35, color: '#fff', fontWeight: 'bold' }}>SN</span>
        </div>
      );
    }

    if (el.type === 'text') {
      return (
        <div
          key={el.id}
          style={{
            ...baseStyle,
            fontSize: el.fontSize || 16,
            fontWeight: el.fontWeight || 'normal',
            color: el.color || '#ffffff',
            textAlign: (el.textAlign as React.CSSProperties['textAlign']) || 'left',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: el.textAlign === 'right' ? 'flex-start' : 'flex-start',
            justifyContent: el.textAlign === 'right' ? 'flex-end' : el.textAlign === 'center' ? 'center' : 'flex-start',
          }}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
        >
          {replaceVars(el.text || '')}
        </div>
      );
    }

    if (el.type === 'progress_bar') {
      const progress = Number(SAMPLE_DATA.progress) || 0;
      return (
        <div
          key={el.id}
          style={{
            ...baseStyle,
            backgroundColor: el.barBgColor || '#374151',
            borderRadius: el.barBorderRadius ?? 10,
            overflow: 'hidden',
          }}
          onMouseDown={(e) => handleMouseDown(e, el.id)}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: el.barFillColor || '#2563eb',
              borderRadius: el.barBorderRadius ?? 10,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      );
    }

    return null;
  };

  // ── Render properties panel ──

  const renderProperties = () => {
    if (!selected) {
      return (
        <div className="text-center py-12">
          <Layers className="w-10 h-10 text-[#374151] mx-auto mb-3" />
          <p className="text-sm text-[#64748b] font-medium">Selecciona un elemento en el canvas para editar sus propiedades</p>
          <div className="mt-6 space-y-2">
            {config.elements.map(el => (
              <button
                key={el.id}
                onClick={() => setSelectedElement(el.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                  'bg-[#f8fafc] dark:bg-[#374151]/30 hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/60'
                }`}
              >
                {el.type === 'avatar' && <Image className="w-4 h-4 text-[#64748b]" />}
                {el.type === 'text' && <Type className="w-4 h-4 text-[#64748b]" />}
                {el.type === 'progress_bar' && <BarChart3 className="w-4 h-4 text-[#64748b]" />}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{el.id}</span>
                {!el.visible && <EyeOff className="w-3 h-3 text-[#64748b] ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* Element header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selected.type === 'avatar' && <Image className="w-4 h-4 text-[#2563eb]" />}
            {selected.type === 'text' && <Type className="w-4 h-4 text-[#2563eb]" />}
            {selected.type === 'progress_bar' && <BarChart3 className="w-4 h-4 text-[#2563eb]" />}
            <span className="text-sm font-black text-gray-900 dark:text-white">{selected.id}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#2563eb]/10 text-[#2563eb] font-bold uppercase">{selected.type}</span>
          </div>
          <button
            onClick={() => setSelectedElement(null)}
            className="text-xs text-[#64748b] hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>

        {/* Visibility & Z-Index */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Visible</label>
            <button
              onClick={() => updateElement(selected.id, { visible: !selected.visible })}
              className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold w-full ${
                selected.visible
                  ? 'bg-green-500/10 text-green-500 border border-green-500/30'
                  : 'bg-red-500/10 text-red-500 border border-red-500/30'
              }`}
            >
              {selected.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {selected.visible ? 'Si' : 'No'}
            </button>
          </div>
          <div>
            <label className={labelClass}>Z-Index</label>
            <input
              type="number"
              value={selected.zIndex}
              onChange={(e) => updateElement(selected.id, { zIndex: parseInt(e.target.value) || 0 })}
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>

        {/* Position */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Move className="w-3.5 h-3.5 text-[#64748b]" />
            <span className={labelClass}>Posicion</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#64748b]">X</label>
              <input
                type="number"
                value={selected.x}
                onChange={(e) => updateElement(selected.id, { x: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#64748b]">Y</label>
              <input
                type="number"
                value={selected.y}
                onChange={(e) => updateElement(selected.id, { y: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <span className={labelClass}>Tamano</span>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[10px] text-[#64748b]">Ancho</label>
              <input
                type="number"
                value={selected.width}
                onChange={(e) => updateElement(selected.id, { width: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#64748b]">Alto</label>
              <input
                type="number"
                value={selected.height}
                onChange={(e) => updateElement(selected.id, { height: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Text-specific props */}
        {selected.type === 'text' && (
          <>
            <div>
              <label className={labelClass}>Texto</label>
              <input
                type="text"
                value={selected.text || ''}
                onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                className={`mt-1 ${inputClass}`}
                placeholder="{username}, {level}, {rank}..."
              />
              <p className="text-[10px] text-[#64748b] mt-1">Usa &#123;variable&#125; para datos dinamicos</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tamano fuente</label>
                <input
                  type="number"
                  value={selected.fontSize || 16}
                  onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) || 16 })}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>Peso</label>
                <select
                  value={selected.fontWeight || 'normal'}
                  onChange={(e) => updateElement(selected.id, { fontWeight: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.color || '#ffffff'}
                    onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-[#374151] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.color || '#ffffff'}
                    onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Alineacion</label>
                <div className="mt-1 flex gap-1">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => updateElement(selected.id, { textAlign: align })}
                      className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                        (selected.textAlign || 'left') === align
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                      }`}
                    >
                      {align === 'left' ? 'Izq' : align === 'center' ? 'Centro' : 'Der'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Avatar-specific props */}
        {selected.type === 'avatar' && (
          <>
            <div>
              <label className={labelClass}>Forma</label>
              <select
                value={selected.shape || 'circle'}
                onChange={(e) => updateElement(selected.id, { shape: e.target.value })}
                className={`mt-1 ${inputClass}`}
              >
                <option value="circle">Circulo</option>
                <option value="square">Cuadrado</option>
                <option value="hexagon">Hexagono</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Color borde</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.borderColor || '#2563eb'}
                    onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-[#374151] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.borderColor || '#2563eb'}
                    onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Grosor borde</label>
                <input
                  type="number"
                  value={selected.borderWidth ?? 3}
                  onChange={(e) => updateElement(selected.id, { borderWidth: parseInt(e.target.value) || 0 })}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>
          </>
        )}

        {/* Progress bar-specific props */}
        {selected.type === 'progress_bar' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Color fondo</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.barBgColor || '#374151'}
                    onChange={(e) => updateElement(selected.id, { barBgColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-[#374151] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.barBgColor || '#374151'}
                    onChange={(e) => updateElement(selected.id, { barBgColor: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Color relleno</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={selected.barFillColor || '#2563eb'}
                    onChange={(e) => updateElement(selected.id, { barFillColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-[#374151] cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.barFillColor || '#2563eb'}
                    onChange={(e) => updateElement(selected.id, { barFillColor: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Border Radius</label>
              <input
                type="number"
                value={selected.barBorderRadius ?? 10}
                onChange={(e) => updateElement(selected.id, { barBorderRadius: parseInt(e.target.value) || 0 })}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  // ── Loading state ──

  if (loadingData) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mr-3" />
          <span className="text-sm text-[#64748b]">Cargando rank card...</span>
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className="flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Toolbar */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Template selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#64748b]">Plantilla:</label>
            <select
              value={selectedTemplate}
              onChange={(e) => {
                if (window.confirm('Cargar esta plantilla? Se perderan los cambios actuales.')) {
                  loadTemplate(e.target.value);
                }
              }}
              className={`${inputClass} w-40`}
            >
              {Object.entries(TEMPLATES).map(([key, tpl]) => (
                <option key={key} value={key}>{tpl.label}</option>
              ))}
            </select>
          </div>

          {/* Background controls */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#64748b]">Color:</label>
            <input
              type="color"
              value={config.background.color}
              onChange={(e) => updateBackground({ color: e.target.value, type: config.background.imageUrl ? 'image' : 'solid' })}
              className="w-8 h-8 rounded-lg border border-[#374151] cursor-pointer bg-transparent"
            />
          </div>
          <button
            onClick={() => setShowBgPanel(!showBgPanel)}
            className={`${btnClass} ${showBgPanel ? 'bg-[#2563eb] text-white' : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'} flex items-center gap-1`}
          >
            <Image className="w-4 h-4" />
            Fondo
            {config.background.imageUrl && <span className="w-2 h-2 rounded-full bg-green-400" />}
          </button>

          {/* Zoom */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setScale(s => Math.max(0.25, s - 0.1))}
              className={`${btnClass} bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#64748b] w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(1.0, s + 0.1))}
              className={`${btnClass} bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]`}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              if (window.confirm('Restaurar la plantilla por defecto?')) {
                loadTemplate(selectedTemplate);
              }
            }}
            className={`${btnClass} bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] flex items-center gap-2`}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${btnClass} bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>

        {saveMessage && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Mode Selector: Base vs Level */}
      <div className={cardClass}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setEditingMode('base'); setSelectedLevelRange(null); loadRankCard(); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editingMode === 'base' ? 'bg-[#2563eb] text-white' : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b]'}`}
          >
            Card Base (todos)
          </button>
          <button
            onClick={() => setEditingMode('level')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editingMode === 'level' ? 'bg-[#2563eb] text-white' : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b]'}`}
          >
            Card por Nivel
          </button>

          {editingMode === 'level' && xpRoles.length > 0 && (
            <select
              value={selectedLevelRange || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                setSelectedLevelRange(val);
                if (val) {
                  const levelMin = parseInt(val.split('-')[0]);
                  loadLevelCard(levelMin);
                }
              }}
              className="px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
            >
              <option value="">Seleccionar rango...</option>
              {xpRoles.map((role: any, idx: number) => {
                const nextRole = xpRoles[idx + 1];
                const levelMax = nextRole ? nextRole.levelRequired - 1 : '∞';
                return (
                  <option key={role.id} value={`${role.levelRequired}-${nextRole?.levelRequired ?? 999}`}>
                    {role.roleName} (Nivel {role.levelRequired} - {levelMax})
                  </option>
                );
              })}
            </select>
          )}

          {editingMode === 'level' && xpRoles.length === 0 && (
            <span className="text-xs text-[#94a3b8]">No hay roles de XP configurados. Crea roles en el tab Roles primero.</span>
          )}
        </div>
      </div>

      {/* Background Panel */}
      {showBgPanel && (
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white">Fondo de la Card</h3>
            <button onClick={() => setShowBgPanel(false)} className="text-[#64748b] hover:text-white text-xs">Cerrar</button>
          </div>

          {/* Predefined templates */}
          <div className="mb-4">
            <p className="text-xs font-bold text-[#64748b] mb-2 uppercase">Templates</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: 'gaming-neon', label: 'Gaming' },
                { id: 'anime-sky', label: 'Anime' },
                { id: 'minimal-dark', label: 'Minimal' },
                { id: 'gradient-vibrant', label: 'Gradiente' },
                { id: 'nature-night', label: 'Naturaleza' },
              ].map(t => {
                const tUrl = `/system-files/images/welcome-templates/${t.id}.png`;
                const isActive = config.background.imageUrl === tUrl;
                return (
                  <button
                    key={t.id}
                    onClick={() => updateBackground({ imageUrl: tUrl, type: 'image' })}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${isActive ? 'border-[#2563eb] shadow-lg shadow-blue-500/20' : 'border-[#374151] hover:border-[#64748b]'}`}
                  >
                    <img src={tUrl} alt={t.label} className="w-full h-12 object-cover" />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white font-bold text-center py-0.5">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL input */}
          <div className="mb-4">
            <p className="text-xs font-bold text-[#64748b] mb-2 uppercase">URL personalizada</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={bgUrlInput || config.background.imageUrl || ''}
                onChange={(e) => setBgUrlInput(e.target.value)}
                placeholder="https://ejemplo.com/imagen.png"
                className="flex-1 px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-[#1e293b] dark:text-[#f8fafc]"
              />
              <button
                onClick={() => {
                  if (bgUrlInput) {
                    updateBackground({ imageUrl: bgUrlInput, type: 'image' });
                  }
                }}
                className={`${btnClass} bg-[#2563eb] text-white text-xs`}
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Gallery button */}
          <div className="mb-3">
            <p className="text-xs font-bold text-[#64748b] mb-2 uppercase">Mi Galeria</p>
            <button
              onClick={async () => {
                try {
                  const res = await api.get('/timer/media');
                  if (res.data?.success && res.data.files) {
                    setGalleryFiles(res.data.files.filter((f: any) => f.fileType === 'image'));
                    setShowGallery(true);
                  }
                } catch { /* ignore */ }
              }}
              className={`${btnClass} bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] w-full flex items-center justify-center gap-2`}
            >
              <Image className="w-4 h-4" />
              Abrir galeria de imagenes
            </button>
          </div>

          {/* Remove background */}
          {config.background.imageUrl && (
            <button
              onClick={() => { updateBackground({ imageUrl: undefined, type: 'solid' }); setBgUrlInput(''); }}
              className="text-xs text-red-400 hover:text-red-300 font-bold"
            >
              Quitar imagen de fondo
            </button>
          )}

          {/* Current background preview */}
          {config.background.imageUrl && (
            <div className="mt-3 rounded-lg overflow-hidden border border-[#374151]">
              <img src={config.background.imageUrl} alt="Fondo actual" className="w-full h-20 object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-3xl w-full border border-[#e2e8f0] dark:border-[#374151] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Selecciona una imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-[#64748b] hover:text-white">✕</button>
            </div>
            {galleryFiles.length === 0 ? (
              <p className="text-center text-[#64748b] py-8">No hay imagenes en tu galeria</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {galleryFiles.map((f: any) => (
                  <button
                    key={f.id || f.fileUrl}
                    onClick={() => {
                      updateBackground({ imageUrl: f.fileUrl, type: 'image' });
                      setBgUrlInput(f.fileUrl);
                      setShowGallery(false);
                    }}
                    className="rounded-lg overflow-hidden border-2 border-[#374151] hover:border-[#2563eb] transition-all"
                  >
                    <img src={f.fileUrl} alt={f.fileName || 'image'} className="w-full h-24 object-cover" />
                    {f.fileName && <p className="text-[10px] text-[#64748b] p-1 truncate">{f.fileName}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor: Canvas full width + Properties below */}
      <div className="space-y-4">
        {/* Canvas */}
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold text-[#64748b]">PREVIEW</span>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[#374151]/30 text-[#94a3b8] font-medium">{CANVAS_WIDTH} x {CANVAS_HEIGHT}</span>
          </div>

            {/* Canvas container */}
            <div
              className="rounded-xl border border-[#374151]/50"
              style={{
                background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #151525 0% 50%) 0 0 / 20px 20px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: 16 }}>
                <div
                  ref={canvasRef}
                  style={{
                    width: CANVAS_WIDTH * scale,
                    height: CANVAS_HEIGHT * scale,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 12,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  }}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={handleCanvasClick}
                >
                  {/* Inner scaled content */}
                  <div
                    style={{
                      width: CANVAS_WIDTH,
                      height: CANVAS_HEIGHT,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      position: 'relative',
                      backgroundColor: config.background.color,
                      backgroundImage: config.background.imageUrl ? `url(${config.background.imageUrl})` : config.background.gradient || undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {config.elements
                      .slice()
                      .sort((a, b) => a.zIndex - b.zIndex)
                      .map(el => renderCanvasElement(el))}
                  </div>
                </div>
              </div>
            </div>

            {/* Element list under canvas */}
            <div className="mt-4 flex flex-wrap gap-2">
              {config.elements.map(el => (
                <button
                  key={el.id}
                  onClick={() => setSelectedElement(el.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedElement === el.id
                      ? 'bg-[#2563eb] text-white'
                      : 'bg-[#f8fafc] dark:bg-[#374151]/30 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/60'
                  }`}
                >
                  {el.type === 'avatar' && <Image className="w-3 h-3" />}
                  {el.type === 'text' && <Type className="w-3 h-3" />}
                  {el.type === 'progress_bar' && <BarChart3 className="w-3 h-3" />}
                  {el.id}
                  {!el.visible && <EyeOff className="w-3 h-3 opacity-50" />}
                </button>
              ))}
            </div>
          </div>

        {/* Properties panel (below canvas) */}
        <div className={cardClass}>
          <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4">Propiedades</h3>
          {renderProperties()}
        </div>
      </div>
    </div>
  );
}
