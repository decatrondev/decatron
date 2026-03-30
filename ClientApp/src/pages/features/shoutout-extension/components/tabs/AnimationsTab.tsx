import { Zap, Type, Layout as LayoutIcon, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnimationsTabProps {
    animationType: string;
    setAnimationType: (v: string) => void;
    animationSpeed: string;
    setAnimationSpeed: (v: string) => void;
    textOutlineEnabled: boolean;
    setTextOutlineEnabled: (v: boolean) => void;
    textOutlineColor: string;
    setTextOutlineColor: (v: string) => void;
    textOutlineWidth: number;
    setTextOutlineWidth: (v: number) => void;
    containerBorderEnabled: boolean;
    setContainerBorderEnabled: (v: boolean) => void;
    containerBorderColor: string;
    setContainerBorderColor: (v: string) => void;
    containerBorderWidth: number;
    setContainerBorderWidth: (v: number) => void;
    testing: boolean;
    handleTestShoutout: () => void;
}

export function AnimationsTab({
    animationType, setAnimationType,
    animationSpeed, setAnimationSpeed,
    textOutlineEnabled, setTextOutlineEnabled,
    textOutlineColor, setTextOutlineColor,
    textOutlineWidth, setTextOutlineWidth,
    containerBorderEnabled, setContainerBorderEnabled,
    containerBorderColor, setContainerBorderColor,
    containerBorderWidth, setContainerBorderWidth,
    testing, handleTestShoutout
}: AnimationsTabProps) {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            {/* Animation */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    {t('shoutoutTabs.animation')}
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                            {t('shoutoutTabs.animationType')}
                        </label>
                        <select
                            value={animationType}
                            onChange={(e) => setAnimationType(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="none">{t('shoutoutTabs.animNone')}</option>
                            <option value="slide">{t('shoutoutTabs.animSlide')}</option>
                            <option value="bounce">{t('shoutoutTabs.animBounce')}</option>
                            <option value="fade">{t('shoutoutTabs.animFade')}</option>
                            <option value="zoom">{t('shoutoutTabs.animZoom')}</option>
                            <option value="rotate">{t('shoutoutTabs.animRotate')}</option>
                        </select>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            {t('shoutoutTabs.animDesc')}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                            {t('shoutoutTabs.animationSpeed')}
                        </label>
                        <select
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="slow">{t('shoutoutTabs.speedSlow')}</option>
                            <option value="normal">{t('shoutoutTabs.speedNormal')}</option>
                            <option value="fast">{t('shoutoutTabs.speedFast')}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Text Outline */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Type className="w-5 h-5 text-purple-600" />
                    {t('shoutoutTabs.textOutline')}
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                {t('shoutoutTabs.enableOutline')}
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                {t('shoutoutTabs.outlineDesc')}
                            </p>
                        </div>
                        <button
                            onClick={() => setTextOutlineEnabled(!textOutlineEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                textOutlineEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    textOutlineEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {textOutlineEnabled && (
                        <>
                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                                    {t('shoutoutTabs.outlineColor')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={textOutlineColor}
                                        onChange={(e) => setTextOutlineColor(e.target.value)}
                                        className="w-16 h-10 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                    />
                                    <input
                                        type="text"
                                        value={textOutlineColor}
                                        onChange={(e) => setTextOutlineColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold flex items-center justify-between">
                                    <span>{t('shoutoutTabs.outlineWidth')}</span>
                                    <span className="text-[#2563eb] font-bold">{textOutlineWidth}px</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={textOutlineWidth}
                                    onChange={(e) => setTextOutlineWidth(parseInt(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    <span>{t('shoutoutTabs.thinPx')}</span>
                                    <span>{t('shoutoutTabs.thickPx')}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Container Border */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <LayoutIcon className="w-5 h-5 text-blue-600" />
                    {t('shoutoutTabs.containerBorder')}
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-semibold text-[#1e293b] dark:text-[#f8fafc]">
                                {t('shoutoutTabs.enableBorder')}
                            </label>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                {t('shoutoutTabs.borderDesc')}
                            </p>
                        </div>
                        <button
                            onClick={() => setContainerBorderEnabled(!containerBorderEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                containerBorderEnabled ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    containerBorderEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    {containerBorderEnabled && (
                        <>
                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold">
                                    {t('shoutoutTabs.borderColor')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={containerBorderColor}
                                        onChange={(e) => setContainerBorderColor(e.target.value)}
                                        className="w-16 h-10 rounded cursor-pointer border border-[#e2e8f0] dark:border-[#374151]"
                                    />
                                    <input
                                        type="text"
                                        value={containerBorderColor}
                                        onChange={(e) => setContainerBorderColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-[#e2e8f0] dark:border-[#374151] rounded-lg text-sm font-mono text-[#1e293b] dark:text-[#f8fafc]"
                                        placeholder="#ffffff"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-2 block font-semibold flex items-center justify-between">
                                    <span>{t('shoutoutTabs.borderWidth')}</span>
                                    <span className="text-[#2563eb] font-bold">{containerBorderWidth}px</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={containerBorderWidth}
                                    onChange={(e) => setContainerBorderWidth(parseInt(e.target.value))}
                                    className="w-full accent-[#2563eb]"
                                />
                                <div className="flex justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                    <span>{t('shoutoutTabs.thinPx')}</span>
                                    <span>{t('shoutoutTabs.thickPx')}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Preview */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-green-600" />
                    {t('shoutoutTabs.previewSection')}
                </h3>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                    {t('shoutoutTabs.previewDesc')}
                </p>
                <button
                    onClick={handleTestShoutout}
                    disabled={testing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg transition-all shadow-lg text-lg"
                >
                    <Play className="w-5 h-5" />
                    {testing ? t('shoutoutTabs.sending') : t('shoutoutTabs.testAnimations')}
                </button>
            </div>
        </div>
    );
}
