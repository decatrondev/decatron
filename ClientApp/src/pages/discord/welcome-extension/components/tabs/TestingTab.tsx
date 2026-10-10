import { useState } from 'react';
import { Send, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { TestingTabProps } from '../../types';
import { useWelcomePersistence } from '../../hooks/useWelcomePersistence';

export default function TestingTab({ welcomeEnabled, goodbyeEnabled, welcomeChannelId, goodbyeChannelId, guildId, guildName }: TestingTabProps) {
  const [testingType, setTestingType] = useState<string | null>(null);
  const [results, setResults] = useState<{ type: string; success: boolean; time: string }[]>([]);
  const { sendTest } = useWelcomePersistence();

  const handleTest = async (type: 'welcome' | 'goodbye') => {
    setTestingType(type);
    const success = await sendTest(guildId, type);
    setResults(prev => [
      { type, success, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ]);
    setTestingType(null);
  };

  const cardCls = "rounded-lg border border-ds-border bg-ds-surface p-6 ";

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-ds-accent/10 rounded-lg flex items-center justify-center">
            <span className="text-lg">🧪</span>
          </div>
          <div>
            <h3 className="font-bold text-ds-text">Pruebas de Mensajes</h3>
            <p className="text-xs text-ds-soft">
              Envia mensajes de prueba al canal de Discord de <strong>{guildName}</strong>
            </p>
          </div>
        </div>
        <div className="p-3 bg-ds-accent/10 rounded-lg border border-ds-accent">
          <p className="text-xs text-ds-accent-text">
            Los mensajes de prueba se envian con el prefijo <strong>[PRUEBA]</strong> y un footer especial para distinguirlos de los reales.
            Se usara el bot como usuario de ejemplo.
          </p>
        </div>
      </div>

      {/* Test buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Welcome test */}
        <div className={`${cardCls} ${!welcomeEnabled || !welcomeChannelId ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">👋</span>
            <h4 className="font-bold text-sm text-ds-text">Bienvenida</h4>
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              welcomeEnabled ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-bg text-ds-soft'
            }`}>
              {welcomeEnabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>

          {!welcomeEnabled ? (
            <p className="text-xs text-ds-soft mb-3">Activa los mensajes de bienvenida en la tab correspondiente para poder enviar pruebas.</p>
          ) : !welcomeChannelId ? (
            <p className="text-xs text-ds-warn mb-3">Selecciona un canal de Discord en la tab de Bienvenida primero.</p>
          ) : (
            <p className="text-xs text-ds-soft mb-3">Envia un mensaje de bienvenida de prueba al canal configurado.</p>
          )}

          <button
            onClick={() => handleTest('welcome')}
            disabled={testingType !== null || !welcomeEnabled || !welcomeChannelId}
            className="ds-btn ds-btn--primary ds-btn--lg w-full"
          >
            {testingType === 'welcome' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar prueba de bienvenida</>
            )}
          </button>
        </div>

        {/* Goodbye test */}
        <div className={`${cardCls} ${!goodbyeEnabled || !goodbyeChannelId ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💨</span>
            <h4 className="font-bold text-sm text-ds-text">Despedida</h4>
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              goodbyeEnabled ? 'bg-ds-ok/10 text-ds-ok ' : 'bg-ds-bg text-ds-soft'
            }`}>
              {goodbyeEnabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>

          {!goodbyeEnabled ? (
            <p className="text-xs text-ds-soft mb-3">Activa los mensajes de despedida en la tab correspondiente para poder enviar pruebas.</p>
          ) : !goodbyeChannelId ? (
            <p className="text-xs text-ds-warn mb-3">Selecciona un canal de Discord en la tab de Despedida primero.</p>
          ) : (
            <p className="text-xs text-ds-soft mb-3">Envia un mensaje de despedida de prueba al canal configurado.</p>
          )}

          <button
            onClick={() => handleTest('goodbye')}
            disabled={testingType !== null || !goodbyeEnabled || !goodbyeChannelId}
            className="w-full px-4 py-3 bg-ds-raised hover:bg-ds-accent-hover text-ds-text font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-gray-500/20"
          >
            {testingType === 'goodbye' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar prueba de despedida</>
            )}
          </button>
        </div>
      </div>

      {/* Results log */}
      {results.length > 0 && (
        <div className={cardCls}>
          <h4 className="text-xs font-bold text-ds-soft mb-3">Historial de pruebas</h4>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                r.success
                  ? 'bg-ds-ok/10 text-ds-ok '
                  : 'bg-ds-danger/10 text-ds-danger '
              }`}>
                {r.success ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span className="font-medium">{r.type === 'welcome' ? 'Bienvenida' : 'Despedida'}</span>
                <span className="text-ds-soft">—</span>
                <span>{r.success ? 'Enviado correctamente' : 'Error al enviar'}</span>
                <span className="ml-auto text-ds-soft">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
