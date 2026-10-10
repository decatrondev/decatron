import { Hash, Radio, Image, ImageOff, Loader2, CheckCircle, X } from 'lucide-react';
import type { DiscordChannel } from '../types';
import ToggleOption from './ToggleOption';
import StaticThumbnailPicker from './StaticThumbnailPicker';

interface AlertFormModalProps {
  title: string; onClose: () => void; onSave: () => void; saving: boolean; saveLabel: string;
  saveDisabled?: boolean; channels: DiscordChannel[]; children?: React.ReactNode;
  discordChannel: string; setDiscordChannel: (v: string) => void;
  thumbnailMode: string; setThumbnailMode: (v: string) => void;
  staticUrl: string; setStaticUrl: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  mention: boolean; setMention: (v: boolean) => void;
  embedColor: string; setEmbedColor: (v: string) => void;
  footer: string; setFooter: (v: string) => void;
  showButton: boolean; setShowButton: (v: boolean) => void;
  showStartTime: boolean; setShowStartTime: (v: boolean) => void;
  sendMode: string; setSendMode: (v: string) => void;
  delayMinutes: number; setDelayMinutes: (v: number) => void;
  updateInterval: number; setUpdateInterval: (v: number) => void;
  offlineAction: string; setOfflineAction: (v: string) => void;
}

export default function AlertFormModal(props: AlertFormModalProps) {
  const { title, onClose, onSave, saving, saveLabel, saveDisabled, channels, children,
    discordChannel, setDiscordChannel, thumbnailMode, setThumbnailMode, staticUrl, setStaticUrl,
    message, setMessage, mention, setMention, embedColor, setEmbedColor, footer, setFooter,
    showButton, setShowButton, showStartTime, setShowStartTime,
    sendMode, setSendMode, delayMinutes, setDelayMinutes,
    updateInterval, setUpdateInterval, offlineAction, setOfflineAction } = props;

  return (
    <div className="fixed inset-0 bg-ds-input/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ds-surface rounded-lg p-6 max-w-3xl w-full border border-ds-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-ds-text">{title}</h3>
          <button onClick={onClose} className="text-ds-soft hover:text-ds-text"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {children}

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Canal de Discord</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-soft" />
                <select value={discordChannel} onChange={(e) => setDiscordChannel(e.target.value)}
                  className="ds-input w-full pl-9 pr-4">
                  <option value="">Seleccionar canal...</option>
                  {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Miniatura</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'live', label: 'En vivo', icon: <Radio className="w-4 h-4" />, },
                  { value: 'static', label: 'Estatica', icon: <Image className="w-4 h-4" />, },
                  { value: 'none', label: 'Ninguna', icon: <ImageOff className="w-4 h-4" />, },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setThumbnailMode(opt.value)}
                    className={`p-3 rounded-lg text-center transition-all border-2 ${thumbnailMode === opt.value ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border hover:border-ds-accent'}`}>
                    <div className={`mx-auto mb-1 ${thumbnailMode === opt.value ? 'text-ds-accent-text' : 'text-ds-soft'}`}>{opt.icon}</div>
                    <span className="text-xs font-medium text-ds-text">{opt.label}</span>
                  </button>
                ))}
              </div>
              {thumbnailMode === 'static' && <StaticThumbnailPicker value={staticUrl} onChange={setStaticUrl} />}
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Mensaje <span className="text-ds-soft font-normal">(opcional)</span></label>
              <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ej: Mi streamer favorito esta en vivo!"
                className="ds-input w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Color del embed</label>
              <div className="flex items-center gap-3">
                <input type="color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} className="w-10 h-10 rounded-lg border border-ds-border cursor-pointer" />
                <input type="text" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} className="ds-input w-24 font-mono" />
                <div className="flex gap-1 flex-wrap">
                  {['#ff0000', '#2563eb', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                    <button key={c} onClick={() => setEmbedColor(c)} className={`w-6 h-6 rounded-full border-2 ${embedColor === c ? 'border-ds-border scale-110' : 'border-ds-border '}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Footer <span className="text-ds-soft font-normal">(opcional)</span></label>
              <input type="text" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Decatron Bot • twitch.decatron.net"
                className="ds-input w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Modo de envio</label>
              <div className="space-y-2">
                {[
                  { value: 'instant', label: 'Instantaneo', desc: 'Envia al instante con avatar como imagen' },
                  { value: 'wait', label: 'Esperar thumbnail', desc: `Espera ${delayMinutes} min para enviar con preview del stream` },
                  { value: 'instant_update', label: 'Instantaneo + actualizar', desc: `Envia al instante, se actualiza en ${delayMinutes} min con preview` },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${sendMode === opt.value ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border '}`}>
                    <input type="radio" name="sendMode" value={opt.value} checked={sendMode === opt.value} onChange={() => setSendMode(opt.value)} className="mt-0.5 accent-ds-accent" />
                    <div>
                      <span className="text-sm font-medium text-ds-text">{opt.label}</span>
                      <p className="text-xs text-ds-soft">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {sendMode !== 'instant' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-ds-soft mb-1">Tiempo de espera</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 5].map(min => (
                      <button key={min} onClick={() => setDelayMinutes(min)}
                        className={delayMinutes === min ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>
                        {min} min
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Actualizar cada</label>
              <p className="text-xs text-ds-soft mb-2">El mensaje se edita con viewers y thumbnail frescos</p>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map(min => (
                  <button key={min} onClick={() => setUpdateInterval(min)}
                    className={updateInterval === min ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>
                    {min} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ds-text mb-2">Cuando termine el stream</label>
              <div className="space-y-2">
                {[
                  { value: 'summary', label: 'Mostrar resumen', desc: 'Edita con duracion, viewers max/promedio' },
                  { value: 'none', label: 'No tocar', desc: 'Deja el mensaje como esta' },
                  { value: 'delete', label: 'Eliminar mensaje', desc: 'Borra el mensaje de Discord' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${offlineAction === opt.value ? 'border-ds-accent bg-ds-accent/10 ' : 'border-ds-border '}`}>
                    <input type="radio" name="offlineAction" value={opt.value} checked={offlineAction === opt.value} onChange={() => setOfflineAction(opt.value)} className="mt-0.5 accent-ds-accent" />
                    <div>
                      <span className="text-sm font-medium text-ds-text">{opt.label}</span>
                      <p className="text-xs text-ds-soft">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <ToggleOption checked={mention} onChange={setMention} label="Mencionar @everyone" desc="Notifica a todos en el servidor" />
              <ToggleOption checked={showButton} onChange={setShowButton} label='Boton "Ver Stream"' desc="Agrega un boton clickeable al embed" />
              <ToggleOption checked={showStartTime} onChange={setShowStartTime} label="Mostrar hora de inicio" desc="Muestra hace cuanto empezo el stream" />
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-ds-text mb-2">Preview del embed</label>
            <div className="dark bg-[#313338] rounded-lg p-4 text-ds-text text-sm sticky top-0">
              <div className="flex gap-3">
                <div className="w-1 rounded-full flex-shrink-0" style={{ backgroundColor: embedColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-ds-faint rounded-full" />
                    <span className="text-sm text-[#00a8fc] font-medium">Streamer</span>
                  </div>
                  <p className="font-semibold text-[#00a8fc] mb-2">🔴 EN VIVO — Titulo del stream aqui</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div><p className="text-[10px] text-ds-soft font-bold">Juego</p><p className="text-xs">Just Chatting</p></div>
                    <div><p className="text-[10px] text-ds-soft font-bold">Viewers</p><p className="text-xs">123</p></div>
                    {showStartTime && <div><p className="text-[10px] text-ds-soft font-bold">Inicio</p><p className="text-xs">Hace 5 min</p></div>}
                  </div>
                  {thumbnailMode !== 'none' && (
                    <div className="bg-ds-raised rounded-lg h-32 mb-3 flex items-center justify-center">
                      <span className="text-ds-soft text-xs">{thumbnailMode === 'live' ? 'Preview del stream en vivo' : 'Imagen estatica'}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-ds-soft">{footer || 'Decatron Bot • twitch.decatron.net'}</p>
                    <span className="text-[10px] text-ds-soft">•</span>
                    <p className="text-[10px] text-ds-soft">Hoy a las 20:30</p>
                  </div>
                </div>
              </div>
              {showButton && (
                <div className="mt-3 ml-4">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4f545c] rounded text-sm">📺 Ver Stream</span>
                </div>
              )}
              {mention && <p className="text-xs text-ds-soft mt-3 ml-4 italic">@everyone {message || 'Streamer esta en vivo!'}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6 mt-6 border-t border-ds-border">
          <button onClick={onClose} className="ds-btn ds-btn--secondary ds-btn--lg flex-1">Cancelar</button>
          <button onClick={onSave} disabled={saving || saveDisabled}
            className="ds-btn ds-btn--primary ds-btn--lg flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
