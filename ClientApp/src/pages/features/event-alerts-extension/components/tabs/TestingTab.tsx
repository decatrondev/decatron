/**
 * Event Alerts Extension - Testing Tab Component
 * Simplificado y flexible
 */
import React, { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';

// Eventos que pueden tener mensaje del usuario
const EVENTS_WITH_MESSAGE = ['bits', 'subs', 'resubs'];

// Eventos que necesitan cantidad
const EVENTS_WITH_AMOUNT: Record<string, { label: string; placeholder: string; examples: number[] }> = {
  bits: { label: 'Bits', placeholder: 'Cantidad de bits', examples: [50, 100, 500, 1000] },
  giftSubs: { label: 'Subs regaladas', placeholder: 'Cantidad de subs', examples: [1, 5, 10, 25] },
  raids: { label: 'Viewers', placeholder: 'Cantidad de viewers', examples: [5, 20, 50, 100] },
  resubs: { label: 'Meses', placeholder: 'Meses de sub', examples: [2, 6, 12, 24] },
};

const EVENT_OPTIONS = [
  { value: 'follow', emoji: '❤️', label: 'Follow' },
  { value: 'bits', emoji: '💎', label: 'Bits' },
  { value: 'subs', emoji: '⭐', label: 'Suscripción' },
  { value: 'giftSubs', emoji: '🎁', label: 'Gift Subs' },
  { value: 'raids', emoji: '🚀', label: 'Raid' },
  { value: 'resubs', emoji: '🎉', label: 'Resub' },
  { value: 'hypeTrain', emoji: '🔥', label: 'Hype Train' },
];

interface TestingTabProps {
  onTest?: (eventType: string, data?: any) => void;
}

export const TestingTab: React.FC<TestingTabProps> = ({ onTest }) => {
  const [queue, setQueue] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [eventType, setEventType] = useState('follow');
  const [username, setUsername] = useState('TestUser123');
  const [amount, setAmount] = useState(100);
  const [message, setMessage] = useState('');

  const hasMessage = EVENTS_WITH_MESSAGE.includes(eventType);
  const amountConfig = EVENTS_WITH_AMOUNT[eventType];

  const handleTest = async () => {
    if (!onTest) return;

    setSending(true);
    const eventLabel = EVENT_OPTIONS.find(e => e.value === eventType)?.label ?? eventType;

    onTest(eventType, {
      username,
      message: hasMessage ? message : undefined,
      amount: amountConfig ? amount : undefined,
    });

    setQueue(prev => [...prev, `${eventLabel} - ${username}`]);

    setTimeout(() => setSending(false), 1000);
    setTimeout(() => setQueue(prev => prev.slice(1)), 5000);
  };

  const clearQueue = () => setQueue([]);

  const inputClass = "w-full px-4 py-2 border border-[#e2e8f0] dark:border-[#374151] rounded-lg bg-white dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] focus:ring-2 focus:ring-blue-500 outline-none text-sm";
  const labelClass = "text-xs font-bold text-[#64748b] dark:text-[#94a3b8] block mb-2";

  return (
    <div className="space-y-4">
      {/* Header con cola */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D]">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧪</span>
          <div>
            <div className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc]">Testing de Alertas</div>
            <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">Simula eventos para probar tus alertas</div>
          </div>
        </div>
        {queue.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
              {queue.length} en cola
            </span>
            <button onClick={clearQueue} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Formulario compacto */}
      <div className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] space-y-4">
        {/* Tipo de evento y Usuario en una fila */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tipo de Evento</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className={inputClass}
            >
              {EVENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.emoji} {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nombre del usuario"
              className={inputClass}
            />
          </div>
        </div>

        {/* Cantidad (solo si aplica) */}
        {amountConfig && (
          <div>
            <label className={labelClass}>{amountConfig.label}</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(parseInt(e.target.value) || 0)}
                placeholder={amountConfig.placeholder}
                className={inputClass + ' flex-1'}
              />
              <div className="flex gap-1">
                {amountConfig.examples.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setAmount(ex)}
                    className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                      amount === ex
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#f1f5f9] dark:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mensaje (solo para bits, subs, resubs) */}
        {hasMessage && (
          <div>
            <label className={labelClass}>Mensaje del usuario (opcional)</label>
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Ej: ¡Gracias por el stream!"
              className={inputClass}
            />
            <p className="text-xs text-[#94a3b8] mt-1">
              Este mensaje se leerá con TTS si está configurado
            </p>
          </div>
        )}

        {/* Botón de enviar */}
        <button
          onClick={handleTest}
          disabled={sending}
          className={`w-full px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
            sending
              ? 'bg-green-500 text-white'
              : 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] hover:from-[#1d4ed8] hover:to-[#2563eb] text-white'
          }`}
        >
          <Play className="w-4 h-4" />
          {sending ? '¡Enviado!' : 'Enviar Test'}
        </button>
      </div>

      {/* Info compacta */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          💡 Asegúrate de tener el overlay abierto en OBS o en otra ventana para ver las alertas.
        </p>
      </div>
    </div>
  );
};
