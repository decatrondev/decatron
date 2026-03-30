import { useTranslation } from 'react-i18next';
import type { StyleConfig } from '../../types';

interface TypographyTabProps {
    styles: StyleConfig;
    setStyles: (styles: StyleConfig) => void;
}

export function TypographyTab({ styles, setStyles }: TypographyTabProps) {
    const { t } = useTranslation('features');
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-4">
                    {t('shoutoutTabs.fontConfig')}
                </h3>

                <div className="space-y-4">
                    {/* Font Family */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            {t('shoutoutTabs.fontFamily')}
                        </label>
                        <select
                            value={styles.fontFamily}
                            onChange={(e) => setStyles({ ...styles, fontFamily: e.target.value })}
                            className="w-full px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                        >
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Poppins">Poppins</option>
                            <option value="Arial">Arial</option>
                        </select>
                    </div>

                    {/* Text Color */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            {t('shoutoutTabs.textColor')}
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={styles.textColor}
                                onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                                className="w-20 h-12 rounded-lg cursor-pointer border-2 border-[#e2e8f0] dark:border-[#374151]"
                            />
                            <input
                                type="text"
                                value={styles.textColor}
                                onChange={(e) => setStyles({ ...styles, textColor: e.target.value })}
                                className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc] font-mono"
                            />
                        </div>
                    </div>

                    {/* Text Shadow */}
                    <div>
                        <label className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2 block">
                            {t('shoutoutTabs.textShadow')}
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            {(['none', 'normal', 'strong', 'glow'] as const).map((shadow) => (
                                <button
                                    key={shadow}
                                    type="button"
                                    onClick={() => setStyles({ ...styles, textShadow: shadow })}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                                        styles.textShadow === shadow
                                            ? 'border-[#2563eb] bg-blue-50 dark:bg-blue-900/20 text-[#2563eb]'
                                            : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] text-[#64748b] dark:text-[#94a3b8]'
                                    }`}
                                >
                                    {shadow === 'none' ? t('shoutoutTabs.shadowNone') : shadow.charAt(0).toUpperCase() + shadow.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
