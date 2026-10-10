import { useState } from 'react';
import { Hash, UserMinus, Image, ImageOff, X } from 'lucide-react';
import type { GoodbyeTabProps, ImageMode } from '../../types';
import { GOODBYE_COLOR_PRESETS, GOODBYE_MESSAGE_TEMPLATES } from '../../constants/defaults';
import VariableHelper from '../VariableHelper';
import MediaGallery from '../../../../../components/timer/MediaGallery';

export default function GoodbyeTab({ config, onConfigChange, channels, guildName }: GoodbyeTabProps) {
  const [showGallery, setShowGallery] = useState(false);

  const selectCls = "w-full pl-9 pr-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text focus:outline-none focus:ring-2 focus:ring-ds-accent appearance-none [&>option]:bg-ds-surface [&>option]:text-ds-text ";
  const inputCls = "w-full px-4 py-3 bg-ds-bg border border-ds-border rounded-lg text-ds-text text-sm focus:outline-none focus:ring-2 focus:ring-ds-accent";
  const cardCls = "rounded-lg border border-ds-border bg-ds-surface p-6 ";

  const imageModes: { value: ImageMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'avatar', label: 'Avatar', icon: <UserMinus className="w-4 h-4" />, desc: 'Avatar del miembro' },
    { value: 'custom', label: 'Custom', icon: <Image className="w-4 h-4" />, desc: 'Imagen personalizada' },
    { value: 'none', label: 'Ninguna', icon: <ImageOff className="w-4 h-4" />, desc: 'Solo texto' },
  ];

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center">
              <span className="text-lg">💨</span>
            </div>
            <div>
              <h3 className="font-bold text-ds-text">Mensajes de Despedida</h3>
              <p className="text-xs text-ds-soft">Envia un mensaje automatico cuando alguien sale del servidor</p>
            </div>
          </div>
          <button
            onClick={() => onConfigChange({ enabled: !config.enabled })}
            className={`relative w-14 h-7 rounded-full transition-all ${config.enabled ?'bg-ds-accent' :'bg-ds-raised'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-ds-surface rounded-full transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {!config.enabled && (
          <div className="mt-4 p-3 bg-ds-surface rounded-lg border border-ds-border">
            <p className="text-xs text-ds-soft">
              Los mensajes de despedida estan desactivados.
            </p>
          </div>
        )}
      </div>

      {config.enabled && (
        <>
          {/* Canal */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-ds-soft block mb-3">
              Canal de Discord
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-soft" />
              <select
                value={config.channelId || ''}
                onChange={(e) => onConfigChange({ channelId: e.target.value || null })}
                className={selectCls}
              >
                <option value="">Seleccionar canal...</option>
                {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
              </select>
            </div>
            {!config.channelId && (
              <p className="text-xs text-ds-warn mt-2">Selecciona un canal para enviar los mensajes de despedida</p>
            )}
          </div>

          {/* Mensaje */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-ds-soft">
                Mensaje de Despedida
              </label>
              {config.message === '' && (
                <button
                  onClick={() => onConfigChange({ message: GOODBYE_MESSAGE_TEMPLATES[0] })}
                  className="text-xs px-2.5 py-1 bg-ds-accent/10 text-ds-accent-text rounded-lg hover:bg-ds-accent/10 transition-colors"
                >
                  Usar predefinido
                </button>
              )}
            </div>
            <textarea
              value={config.message}
              onChange={(e) => onConfigChange({ message: e.target.value })}
              rows={3}
              placeholder={GOODBYE_MESSAGE_TEMPLATES[0]}
              className={`${inputCls} resize-none`}
            />
            <div className="mt-2">
              <VariableHelper compact />
            </div>

            {/* Templates */}
            <div className="mt-3">
              <p className="text-xs font-bold text-ds-soft mb-2">Plantillas sugeridas</p>
              <div className="space-y-1.5">
                {GOODBYE_MESSAGE_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => onConfigChange({ message: tpl })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      config.message === tpl
                        ? 'bg-ds-accent/10 text-ds-accent-text border border-ds-accent/30'
                        : 'bg-ds-bg text-ds-soft hover:bg-ds-raised border border-transparent'
                    }`}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-ds-soft block mb-3">
              Color del Embed
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.embedColor}
                onChange={(e) => onConfigChange({ embedColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-ds-border cursor-pointer"
              />
              <input
                type="text"
                value={config.embedColor}
                onChange={(e) => onConfigChange({ embedColor: e.target.value })}
                className="w-24 px-3 py-2 bg-ds-bg border border-ds-border rounded-lg text-sm text-ds-text font-mono focus:outline-none focus:ring-2 focus:ring-ds-accent"
              />
              <div className="flex gap-1.5 flex-wrap">
                {GOODBYE_COLOR_PRESETS.map(({ color }) => (
                  <button
                    key={color}
                    onClick={() => onConfigChange({ embedColor: color })}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      config.embedColor === color
                        ? 'border-ds-border scale-110'
                        : 'border-ds-border hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Imagen */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-ds-soft block mb-3">
              Imagen del Embed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {imageModes.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onConfigChange({ imageMode: opt.value })}
                  className={`p-3 rounded-lg text-center transition-all border-2 ${
                    config.imageMode === opt.value
                      ? 'border-ds-accent bg-ds-accent/10 '
                      : 'border-ds-border hover:border-ds-accent'
                  }`}
                >
                  <div className={`mx-auto mb-1 ${config.imageMode === opt.value ? 'text-ds-accent-text' : 'text-ds-soft'}`}>
                    {opt.icon}
                  </div>
                  <span className="text-xs font-medium text-ds-text">{opt.label}</span>
                  <p className="text-[10px] text-ds-soft mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {config.imageMode === 'custom' && (
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={config.imageUrl || ''}
                  onChange={(e) => onConfigChange({ imageUrl: e.target.value || null })}
                  placeholder="URL de imagen o selecciona de galeria"
                  className={inputCls}
                />
                <button
                  onClick={() => setShowGallery(true)}
                  className="w-full px-4 py-2.5 border-2 border-dashed border-ds-border rounded-lg text-sm text-ds-soft hover:border-ds-accent hover:text-ds-accent-text transition-colors"
                >
                  Abrir galeria de imagenes
                </button>
                {config.imageUrl && (
                  <div className="flex items-center gap-3 p-2 bg-ds-bg rounded-lg">
                    <img src={config.imageUrl} alt="" className="w-20 h-12 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="flex-1 text-xs text-ds-soft truncate">{config.imageUrl}</span>
                    <button onClick={() => onConfigChange({ imageUrl: null })} className="p-1 text-ds-danger hover:text-ds-danger"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Opciones */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-ds-soft block mb-3">
              Opciones del Mensaje
            </label>
            <ToggleOption
              checked={config.showAvatar}
              onChange={(v) => onConfigChange({ showAvatar: v })}
              label="Mostrar avatar como thumbnail"
              desc="Muestra el avatar del usuario que se fue en la esquina del embed"
            />
          </div>
        </>
      )}

      {/* Gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-ds-input/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-ds-surface rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-ds-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-ds-text">Seleccionar imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-ds-soft hover:text-ds-text"><X className="w-5 h-5" /></button>
            </div>
            <MediaGallery
              selectedFileType="image"
              onFileSelect={(file) => {
                onConfigChange({ imageUrl: file.fileUrl });
                setShowGallery(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleOption({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <label className="flex items-center gap-3 p-3 bg-ds-bg rounded-lg cursor-pointer hover:bg-ds-raised transition-colors">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className={`w-10 h-5 rounded-full transition-all ${checked ?'bg-ds-accent' :'bg-ds-raised'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-ds-surface rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-ds-text">{label}</span>
        <p className="text-xs text-ds-soft">{desc}</p>
      </div>
    </label>
  );
}
