import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnimationsTabProps {
    animationType: string;
    setAnimationType: (v: string) => void;
    animationSpeed: string;
    setAnimationSpeed: (v: string) => void;
    cooldownMs: number;
    setCooldownMs: (v: number) => void;
    testing: boolean;
    setSaveMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
}

export function AnimationsTab({
    animationType,
    setAnimationType,
    animationSpeed,
    setAnimationSpeed,
    cooldownMs,
    setCooldownMs,
    testing,
    setSaveMessage,
}: AnimationsTabProps) {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    {t('soundAlertsTabs.animationConfig')}
                </h3>

                <div className="space-y-4">
                    {/* Animation Type */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            {t('soundAlertsTabs.animationType')}
                        </label>
                        <select
                            value={animationType}
                            onChange={(e) => setAnimationType(e.target.value)}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="none">{t('soundAlertsTabs.animNone')}</option>
                            <option value="fade">Fade</option>
                            <option value="slide">Slide</option>
                            <option value="bounce">Bounce</option>
                            <option value="zoom">Zoom</option>
                        </select>
                    </div>

                    {/* Animation Speed */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            {t('soundAlertsTabs.speed')}
                        </label>
                        <select
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(e.target.value)}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="slow">{t('soundAlertsTabs.speedSlow')}</option>
                            <option value="normal">{t('soundAlertsTabs.speedNormal')}</option>
                            <option value="fast">{t('soundAlertsTabs.speedFast')}</option>
                        </select>
                    </div>

                    {/* Cooldown */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block flex items-center justify-between">
                            <span>{t('soundAlertsTabs.cooldownAlerts')}</span>
                            <span className="text-[#2563eb]">{cooldownMs}ms</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="5000"
                            step="100"
                            value={cooldownMs}
                            onChange={(e) => setCooldownMs(parseInt(e.target.value))}
                            className="w-full accent-[#2563eb]"
                        />
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-2">
                            {t('soundAlertsTabs.cooldownDesc')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Test Button */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-600" />
                    {t('soundAlertsTabs.testAlert')}
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    {t('soundAlertsTabs.testAlertDesc')}
                </p>
                <button
                    onClick={async () => {
                        try {
                            setSaveMessage({ type: 'success', text: t('soundAlertsTabs.testComingSoon') });
                            setTimeout(() => setSaveMessage(null), 3000);
                        } catch (error) {
                            setSaveMessage({ type: 'error', text: t('soundAlertsTabs.testError') });
                        }
                    }}
                    disabled={testing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg text-lg"
                >
                    <Play className="w-5 h-5" />
                    {testing ? t('soundAlertsTabs.sending') : t('soundAlertsTabs.sendTestAlert')}
                </button>
            </div>
        </div>
    );
}
