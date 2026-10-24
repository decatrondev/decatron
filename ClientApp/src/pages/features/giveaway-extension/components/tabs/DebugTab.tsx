import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('features', { keyPrefix: 'giveaway' });
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
    if (!confirm(t('debug.confirmClear'))) {
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
            <h3 className="text-ds-warn font-semibold mb-1">{t('debug.title')}</h3>
            <p className="text-ds-soft text-sm">
              {t('debug.warnBody')}
            </p>
          </div>
        </div>
      </div>

      {/* Generator Config */}
      <div className="bg-ds-raised/50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-ds-text mb-4">{t('debug.gen')}</h3>

        {/* Count */}
        <div>
          <label className="block text-sm font-medium text-ds-soft mb-2">
            {t('debug.count')}
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value) || 1)}
            className="ds-input w-full"
          />
          <p className="text-xs text-ds-soft mt-1">{t('debug.countMax')}</p>
        </div>

        {/* Percentages */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              {t('debug.pVip')}
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
              {t('debug.pMod')}
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
              {t('debug.pSub')}
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
              {t('debug.pFollow')}
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
            <span className="text-sm font-medium text-ds-soft">{t('debug.useNames')}</span>
          </label>
        </div>

        {/* Custom Names Textarea */}
        {useCustomNames && (
          <div>
            <label className="block text-sm font-medium text-ds-soft mb-2">
              {t('debug.names')}
            </label>
            <textarea
              value={customNamesText}
              onChange={(e) => setCustomNamesText(e.target.value)}
              placeholder={t('debug.namesPh')}
              rows={6}
              className="ds-input w-full font-mono"
            />
            <p className="text-xs text-ds-soft mt-1">
              {t('debug.namesHint')}
            </p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="ds-btn ds-btn--primary ds-btn--lg w-full"
        >
          {isGenerating ? t('debug.generating') : t('debug.generate')}
        </button>
      </div>

      {/* Quick Presets */}
      <div className="bg-ds-raised/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-ds-text mb-4">{t('debug.presets')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => {
              setCount(5);
              setVipPercentage(0);
              setModPercentage(0);
              setSubPercentage(0);
              setFollowerPercentage(100);
            }}
            className="ds-btn ds-btn--secondary"
          >
            {t('debug.pr5')}
          </button>
          <button
            onClick={() => {
              setCount(20);
              setVipPercentage(20);
              setModPercentage(5);
              setSubPercentage(30);
              setFollowerPercentage(80);
            }}
            className="ds-btn ds-btn--secondary"
          >
            {t('debug.pr20')}
          </button>
          <button
            onClick={() => {
              setCount(50);
              setVipPercentage(10);
              setModPercentage(2);
              setSubPercentage(20);
              setFollowerPercentage(90);
            }}
            className="ds-btn ds-btn--secondary"
          >
            {t('debug.pr50')}
          </button>
          <button
            onClick={() => {
              setCount(100);
              setVipPercentage(50);
              setModPercentage(10);
              setSubPercentage(60);
              setFollowerPercentage(100);
            }}
            className="ds-btn ds-btn--secondary"
          >
            {t('debug.pr100')}
          </button>
        </div>
      </div>

      {/* Clear Button */}
      <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-ds-danger mb-2">{t('debug.clear')}</h3>
        <p className="text-ds-soft text-sm mb-4">
          {t('debug.clearHint')}
        </p>
        <button
          onClick={handleClear}
          disabled={isClearing}
          className="ds-btn ds-btn--danger ds-btn--lg"
        >
          {isClearing ? t('debug.clearing') : t('debug.clearAll')}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-ds-accent/10 border border-ds-accent/50 rounded-lg p-4">
        <h4 className="text-ds-accent-text font-semibold mb-2">{t('debug.tips')}</h4>
        <ul className="text-ds-soft text-sm space-y-1">
          <li>{t('debug.tip1')}</li>
          <li>{t('debug.tip2')}</li>
          <li>{t('debug.tip3')}</li>
          <li>{t('debug.tip4')}</li>
          <li>{t('debug.tip5')}</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugTab;
