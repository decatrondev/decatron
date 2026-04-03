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

  const cardCls = "rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-lg";

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
            <span className="text-lg">🧪</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Pruebas de Mensajes</h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Envia mensajes de prueba al canal de Discord de <strong>{guildName}</strong>
            </p>
          </div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-700/30">
          <p className="text-xs text-blue-700 dark:text-blue-400">
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
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Bienvenida</h4>
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              welcomeEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-[#64748b]'
            }`}>
              {welcomeEnabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>

          {!welcomeEnabled ? (
            <p className="text-xs text-[#64748b] mb-3">Activa los mensajes de bienvenida en la tab correspondiente para poder enviar pruebas.</p>
          ) : !welcomeChannelId ? (
            <p className="text-xs text-orange-500 mb-3">Selecciona un canal de Discord en la tab de Bienvenida primero.</p>
          ) : (
            <p className="text-xs text-[#64748b] mb-3">Envia un mensaje de bienvenida de prueba al canal configurado.</p>
          )}

          <button
            onClick={() => handleTest('welcome')}
            disabled={testingType !== null || !welcomeEnabled || !welcomeChannelId}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
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
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Despedida</h4>
            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
              goodbyeEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-[#64748b]'
            }`}>
              {goodbyeEnabled ? 'ACTIVO' : 'INACTIVO'}
            </span>
          </div>

          {!goodbyeEnabled ? (
            <p className="text-xs text-[#64748b] mb-3">Activa los mensajes de despedida en la tab correspondiente para poder enviar pruebas.</p>
          ) : !goodbyeChannelId ? (
            <p className="text-xs text-orange-500 mb-3">Selecciona un canal de Discord en la tab de Despedida primero.</p>
          ) : (
            <p className="text-xs text-[#64748b] mb-3">Envia un mensaje de despedida de prueba al canal configurado.</p>
          )}

          <button
            onClick={() => handleTest('goodbye')}
            disabled={testingType !== null || !goodbyeEnabled || !goodbyeChannelId}
            className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-gray-500/20"
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
          <h4 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-3">Historial de pruebas</h4>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                r.success
                  ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400'
              }`}>
                {r.success ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span className="font-medium">{r.type === 'welcome' ? 'Bienvenida' : 'Despedida'}</span>
                <span className="text-[#94a3b8]">—</span>
                <span>{r.success ? 'Enviado correctamente' : 'Error al enviar'}</span>
                <span className="ml-auto text-[#94a3b8]">{r.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
