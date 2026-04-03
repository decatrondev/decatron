import { useState } from 'react';
import { Hash, Shield, UserPlus, Image, ImageOff, X } from 'lucide-react';
import type { WelcomeTabProps, WelcomeSettings, ImageMode } from '../../types';
import { WELCOME_COLOR_PRESETS, WELCOME_MESSAGE_TEMPLATES, DM_MESSAGE_TEMPLATES } from '../../constants/defaults';
import VariableHelper from '../VariableHelper';
import MediaGallery from '../../../../../components/timer/MediaGallery';

export default function WelcomeTab({ config, onConfigChange, channels, roles, guildName }: WelcomeTabProps) {
  const [showGallery, setShowGallery] = useState(false);

  const selectCls = "w-full pl-9 pr-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563eb] appearance-none [&>option]:bg-white [&>option]:dark:bg-[#1B1C1D] [&>option]:text-gray-900 [&>option]:dark:text-white";
  const inputCls = "w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]";
  const cardCls = "rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg";

  const imageModes: { value: ImageMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'avatar', label: 'Avatar', icon: <UserPlus className="w-4 h-4" />, desc: 'Avatar del miembro' },
    { value: 'custom', label: 'Custom', icon: <Image className="w-4 h-4" />, desc: 'Imagen personalizada' },
    { value: 'none', label: 'Ninguna', icon: <ImageOff className="w-4 h-4" />, desc: 'Solo texto' },
  ];

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
              <span className="text-lg">👋</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Mensajes de Bienvenida</h3>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Envia un mensaje automatico cuando alguien se une al servidor</p>
            </div>
          </div>
          <button
            onClick={() => onConfigChange({ enabled: !config.enabled })}
            className={`relative w-14 h-7 rounded-full transition-all ${config.enabled ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${config.enabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {!config.enabled && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-200 dark:border-yellow-700/30">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Los mensajes de bienvenida estan desactivados. Activalos para saludar a nuevos miembros automaticamente.
            </p>
          </div>
        )}
      </div>

      {config.enabled && (
        <>
          {/* Canal de Discord */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
              Canal de Discord
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
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
              <p className="text-xs text-orange-500 mt-2">Selecciona un canal para enviar los mensajes de bienvenida</p>
            )}
          </div>

          {/* Mensaje */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                Mensaje de Bienvenida
              </label>
              {config.message === '' && (
                <button
                  onClick={() => onConfigChange({ message: WELCOME_MESSAGE_TEMPLATES[0] })}
                  className="text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-[#2563eb] rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  Usar predefinido
                </button>
              )}
            </div>
            <textarea
              value={config.message}
              onChange={(e) => onConfigChange({ message: e.target.value })}
              rows={3}
              placeholder={WELCOME_MESSAGE_TEMPLATES[0]}
              className={`${inputCls} resize-none`}
            />
            <div className="mt-2">
              <VariableHelper compact />
            </div>

            {/* Message templates */}
            <div className="mt-3">
              <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">Plantillas sugeridas</p>
              <div className="space-y-1.5">
                {WELCOME_MESSAGE_TEMPLATES.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => onConfigChange({ message: tpl })}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      config.message === tpl
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2563eb] border border-[#2563eb]/30'
                        : 'bg-[#f8fafc] dark:bg-[#374151]/30 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/50 border border-transparent'
                    }`}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color del embed */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
              Color del Embed
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.embedColor}
                onChange={(e) => onConfigChange({ embedColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-[#e2e8f0] dark:border-[#374151] cursor-pointer"
              />
              <input
                type="text"
                value={config.embedColor}
                onChange={(e) => onConfigChange({ embedColor: e.target.value })}
                className="w-24 px-3 py-2 bg-[#f8fafc] dark:bg-[#374151]/50 border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
              <div className="flex gap-1.5 flex-wrap">
                {WELCOME_COLOR_PRESETS.map(({ color }) => (
                  <button
                    key={color}
                    onClick={() => onConfigChange({ embedColor: color })}
                    className={`w-7 h-7 rounded-full border-2 shadow-sm transition-transform ${
                      config.embedColor === color
                        ? 'border-gray-900 dark:border-white scale-110'
                        : 'border-white dark:border-[#374151] hover:scale-105'
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
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
              Imagen del Embed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {imageModes.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onConfigChange({ imageMode: opt.value })}
                  className={`p-3 rounded-xl text-center transition-all border-2 ${
                    config.imageMode === opt.value
                      ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb]'
                  }`}
                >
                  <div className={`mx-auto mb-1 ${config.imageMode === opt.value ? 'text-[#2563eb]' : 'text-[#64748b]'}`}>
                    {opt.icon}
                  </div>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{opt.label}</span>
                  <p className="text-[10px] text-[#64748b] mt-0.5">{opt.desc}</p>
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
                  className="w-full px-4 py-2.5 border-2 border-dashed border-[#e2e8f0] dark:border-[#374151] rounded-xl text-sm text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                >
                  Abrir galeria de imagenes
                </button>
                {config.imageUrl && (
                  <div className="flex items-center gap-3 p-2 bg-[#f8fafc] dark:bg-[#374151]/30 rounded-xl">
                    <img src={config.imageUrl} alt="" className="w-20 h-12 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="flex-1 text-xs text-[#64748b] truncate">{config.imageUrl}</span>
                    <button onClick={() => onConfigChange({ imageUrl: null })} className="p-1 text-red-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Opciones del embed */}
          <div className={cardCls}>
            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-3">
              Opciones del Mensaje
            </label>
            <div className="space-y-2">
              <ToggleOption
                checked={config.mentionUser}
                onChange={(v) => onConfigChange({ mentionUser: v })}
                label="Mencionar al usuario"
                desc="Envia una mencion @usuario arriba del embed"
              />
              <ToggleOption
                checked={config.showAvatar}
                onChange={(v) => onConfigChange({ showAvatar: v })}
                label="Mostrar avatar como thumbnail"
                desc="Muestra el avatar del usuario en la esquina del embed"
              />
            </div>
          </div>

          {/* Rol automatico */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#8b5cf6]" />
              <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                Rol Automatico
              </label>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3">
              Asigna un rol automaticamente cuando alguien se une al servidor
            </p>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
              <select
                value={config.autoRoleId || ''}
                onChange={(e) => onConfigChange({ autoRoleId: e.target.value || null })}
                className={selectCls}
              >
                <option value="">Ninguno (no asignar rol)</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {config.autoRoleId && (
              <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-700/30">
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  Los nuevos miembros recibiran el rol <strong>{roles.find(r => r.id === config.autoRoleId)?.name || 'seleccionado'}</strong> automaticamente
                </p>
              </div>
            )}
          </div>

          {/* DM Privado */}
          <div className={`${cardCls} ${config.dmEnabled ? 'border-blue-200 dark:border-blue-700/30' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <div>
                  <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">
                    Mensaje Directo (DM)
                  </label>
                  <p className="text-[10px] text-[#94a3b8]">Envia un DM privado al nuevo miembro</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const enabling = !config.dmEnabled;
                  const updates: Partial<WelcomeSettings> = { dmEnabled: enabling };
                  if (enabling && !config.dmMessage) {
                    updates.dmMessage = 'Bienvenido a {server}! Esperamos que disfrutes tu estadia.';
                  }
                  onConfigChange(updates);
                }}
                className={`relative w-14 h-7 rounded-full transition-all ${config.dmEnabled ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${config.dmEnabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {config.dmEnabled && (
              <div className="space-y-3">
                <textarea
                  value={config.dmMessage || ''}
                  onChange={(e) => onConfigChange({ dmMessage: e.target.value || null })}
                  rows={3}
                  placeholder={DM_MESSAGE_TEMPLATES[0]}
                  className={`${inputCls} resize-none`}
                />
                <VariableHelper compact />
                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-700/30">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Nota: Algunos usuarios tienen los DMs desactivados. En ese caso el mensaje no se enviara silenciosamente.
                  </p>
                </div>

                {/* DM templates */}
                <div>
                  <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2">Plantillas sugeridas</p>
                  <div className="space-y-1.5">
                    {DM_MESSAGE_TEMPLATES.map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => onConfigChange({ dmMessage: tpl })}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                          config.dmMessage === tpl
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2563eb] border border-[#2563eb]/30'
                            : 'bg-[#f8fafc] dark:bg-[#374151]/30 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/50 border border-transparent'
                        }`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Gallery modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Seleccionar imagen</h3>
              <button onClick={() => setShowGallery(false)} className="text-[#64748b] hover:text-gray-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
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
    <label className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-[#374151]/50 rounded-xl cursor-pointer hover:bg-[#e2e8f0] dark:hover:bg-[#374151]/70 transition-colors">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className={`w-10 h-5 rounded-full transition-all ${checked ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6]' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{desc}</p>
      </div>
    </label>
  );
}
