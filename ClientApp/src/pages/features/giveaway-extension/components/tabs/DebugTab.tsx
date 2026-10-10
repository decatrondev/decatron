import React, { useState } from 'react';

interface DebugTabProps {
  onGenerateParticipants: (config: ParticipantGeneratorConfig) => Promise<void>;
  onClearParticipants: () => Promise<void>;
}

export interface ParticipantGeneratorConfig {
  count: number;
  vipPercentage: number;
  modPercentage: number;
  subPercentage: number;
  followerPercentage: number;
  useCustomNames: boolean;
  customNames: string[];
}

const DebugTab: React.FC<DebugTabProps> = ({ onGenerateParticipants, onClearParticipants }) => {
  const [count, setCount] = useState(10);
  const [vipPercentage, setVipPercentage] = useState(20);
  const [modPercentage, setModPercentage] = useState(10);
  const [subPercentage, setSubPercentage] = useState(30);
  const [followerPercentage, setFollowerPercentage] = useState(80);
  const [useCustomNames, setUseCustomNames] = useState(false);
  const [customNamesText, setCustomNamesText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const customNames = useCustomNames
        ? customNamesText.split('\n').map(n => n.trim()).filter(n => n.length > 0)
        : [];

      await onGenerateParticipants({
        count,
        vipPercentage,
        modPercentage,
        subPercentage,
        followerPercentage,
        useCustomNames,
        customNames
      });
    } catch (error) {
      console.error('Error generating participants:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('¿Estás seguro de eliminar TODOS los participantes? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsClearing(true);
    try {
      await onClearParticipants();
    } catch (error) {
      console.error('Error clearing participants:', error);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-ds-warn/10 border border-ds-warn/40 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-ds-warn text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="text-ds-warn font-semibold mb-1">Herramienta de Testing</h3>
            <p className="text-ds-soft text-sm">
              Esta herramienta es solo para pruebas. Los participantes generados son ficticios
              y solo existen mientras el giveaway esté activo.
            </p>
          </div>
        </div>
      </div>

      {/* Generator Config */}
      <div className="bg-ds-raised/50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-ds-text mb-4">🎲 Generador de Participantes</h3>

        {/* Count */}
        <div>
          <label className="block text-sm font-medium text-ds-soft mb-2">
            Número de Participantes
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="ds-input w-full"
          />
          <p className="text-xs text-ds-soft mt-1">Máximo: 1000 participantes</p>
        </div>

        {/* Percentages */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              % VIPs
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={vipPercentage}
              onChange={(e) => setVipPercentage(parseFloat(e.target.value) || 0)}
              className="ds-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              % Moderadores
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={modPercentage}
              onChange={(e) => setModPercentage(parseFloat(e.target.value) || 0)}
              className="ds-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              % Suscriptores
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={subPercentage}
              onChange={(e) => setSubPercentage(parseFloat(e.target.value) || 0)}
              className="ds-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              % Followers
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={followerPercentage}
              onChange={(e) => setFollowerPercentage(parseFloat(e.target.value) || 0)}
              className="ds-input w-full"
            />
          </div>
        </div>

        {/* Custom Names Option */}
        <div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomNames}
              onChange={(e) => setUseCustomNames(e.target.checked)}
              className="w-4 h-4 text-ds-accent-text bg-ds-raised border-ds-border rounded focus:ring-ds-accent"
            />
            <span className="text-sm font-medium text-ds-soft">Usar nombres personalizados</span>
          </label>
        </div>

        {/* Custom Names Textarea */}
        {useCustomNames && (
          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              Nombres Personalizados (uno por línea)
            </label>
            <textarea
              value={customNamesText}
              onChange={(e) => setCustomNamesText(e.target.value)}
              placeholder="Usuario1&#10;Usuario2&#10;Usuario3&#10;..."
              rows={6}
              className="ds-input w-full font-mono"
            />
            <p className="text-xs text-ds-soft mt-1">
              Si defines menos nombres que participantes, se generarán nombres random para el resto
            </p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="ds-btn ds-btn--primary ds-btn--lg w-full"
        >
          {isGenerating ? '⏳ Generando...' : '🎲 Generar Participantes'}
        </button>
      </div>

      {/* Quick Presets */}
      <div className="bg-ds-raised/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-ds-text mb-4">⚡ Presets Rápidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => {
              setCount(5);
              setVipPercentage(0);
              setModPercentage(0);
              setSubPercentage(0);
              setFollowerPercentage(100);
            }}
            className="px-4 py-2 bg-ds-raised hover:bg-ds-faint rounded-lg text-sm text-ds-text transition-colors"
          >
            5 Normales
          </button>
          <button
            onClick={() => {
              setCount(20);
              setVipPercentage(20);
              setModPercentage(5);
              setSubPercentage(30);
              setFollowerPercentage(80);
            }}
            className="px-4 py-2 bg-ds-raised hover:bg-ds-faint rounded-lg text-sm text-ds-text transition-colors"
          >
            20 Mixtos
          </button>
          <button
            onClick={() => {
              setCount(50);
              setVipPercentage(10);
              setModPercentage(2);
              setSubPercentage(20);
              setFollowerPercentage(90);
            }}
            className="px-4 py-2 bg-ds-raised hover:bg-ds-faint rounded-lg text-sm text-ds-text transition-colors"
          >
            50 Realista
          </button>
          <button
            onClick={() => {
              setCount(100);
              setVipPercentage(50);
              setModPercentage(10);
              setSubPercentage(60);
              setFollowerPercentage(100);
            }}
            className="px-4 py-2 bg-ds-raised hover:bg-ds-faint rounded-lg text-sm text-ds-text transition-colors"
          >
            100 VIP Heavy
          </button>
        </div>
      </div>

      {/* Clear Button */}
      <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-ds-danger mb-2">🗑️ Limpiar Participantes</h3>
        <p className="text-ds-soft text-sm mb-4">
          Elimina TODOS los participantes del giveaway activo. Útil para empezar pruebas desde cero.
        </p>
        <button
          onClick={handleClear}
          disabled={isClearing}
          className="ds-btn ds-btn--danger ds-btn--lg"
        >
          {isClearing ? '⏳ Limpiando...' : '🗑️ Limpiar Todos los Participantes'}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-ds-accent/10 border border-ds-accent/50 rounded-lg p-4">
        <h4 className="text-ds-accent-text font-semibold mb-2">💡 Tips</h4>
        <ul className="text-ds-soft text-sm space-y-1">
          <li>• Los participantes generados respetan las validaciones de requisitos</li>
          <li>• Los pesos se calculan automáticamente según la configuración</li>
          <li>• Los nombres random combinan adjetivos + sustantivos + números</li>
          <li>• Puedes generar múltiples veces para acumular participantes</li>
          <li>• Los UserIDs son únicos (test_xxxxxxxx)</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugTab;
