import { Bot, Zap, Shield, Settings, Users, BarChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Index() {
    const { t } = useTranslation('landing');

    const features = [
        { icon: Bot, title: t('featureCommandsTitle'), description: t('featureCommandsDescription') },
        { icon: Shield, title: t('featureModerationTitle'), description: t('featureModerationDescription') },
        { icon: Settings, title: t('featureSettingsTitle'), description: t('featureSettingsDescription') },
        { icon: Users, title: t('featureMultiChannelTitle'), description: t('featureMultiChannelDescription') },
        { icon: BarChart, title: t('featureStatsTitle'), description: t('featureStatsDescription') },
        { icon: Zap, title: t('featurePerformanceTitle'), description: t('featurePerformanceDescription') }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            <section className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1C1D] px-4">
                <div className="max-w-6xl w-full grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-600 rounded-full text-blue-600 dark:text-blue-400 font-semibold">
                            <Bot className="w-5 h-5" />
                            <span>{t('poweredBy')}</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {t('title')}
                        </h1>

                        <p className="text-xl text-[#64748b] dark:text-[#94a3b8]">
                            {t('heroDescription')}
                        </p>

                        <div className="flex gap-4">
                            <Link to="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all">
                                <span>{t('loginButton')}</span>
                                <Zap className="w-5 h-5" />
                            </Link>
                            <a href="#features" className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#2563eb] text-[#2563eb] dark:text-blue-400 font-bold rounded-lg">
                                {t('viewFeatures')}
                            </a>
                        </div>
                    </div>

                    <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-2xl shadow-2xl p-6 border border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex gap-2 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <div className="bg-white dark:bg-[#1e293b] rounded-lg p-8 min-h-[300px] flex items-center justify-center">
                            <Bot className="w-32 h-32 text-[#2563eb] opacity-50" />
                        </div>
                    </div>
                </div>
            </section>

            <section id="features" className="py-24 px-4 bg-white dark:bg-[#1B1C1D]">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl font-black mb-4 text-center text-[#2563eb]">{t('featuresHeading')}</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((f, i) => (
                            <div key={i} className="p-8 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <f.icon className="w-12 h-12 text-[#2563eb] mb-4" />
                                <h3 className="text-xl font-bold mb-3 text-[#1e293b] dark:text-[#f8fafc]">{f.title}</h3>
                                <p className="text-[#64748b] dark:text-[#94a3b8]">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="py-12 px-4 bg-[#f8fafc] dark:bg-[#1B1C1D] border-t border-[#e2e8f0] dark:border-[#374151]">
                <p className="text-center text-[#64748b] dark:text-[#94a3b8]">{t('copyright')}</p>
            </footer>
        </div>
    );
}
