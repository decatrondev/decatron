import { useState } from 'react';
import { Dices, Shield, Sparkles, BarChart3, Clock, Image, Users, Monitor, Link2 } from 'lucide-react';
import type { GachaTabType } from './types';
import { ItemsTab } from './components/tabs/ItemsTab';
import { RestrictionsTab } from './components/tabs/RestrictionsTab';
import { PreferencesTab } from './components/tabs/PreferencesTab';
import { RarityTab } from './components/tabs/RarityTab';
import { RarityRestrictionsTab } from './components/tabs/RarityRestrictionsTab';
import { BannersTab } from './components/tabs/BannersTab';
import { ParticipantsTab } from './components/tabs/ParticipantsTab';
import { OverlayTab } from './components/tabs/OverlayTab';
import { IntegrationsTab } from './components/tabs/IntegrationsTab';

const TABS: { id: GachaTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'items',               label: 'Items',           icon: <Dices className="w-4 h-4" /> },
    { id: 'restrictions',        label: 'Restricciones',   icon: <Shield className="w-4 h-4" /> },
    { id: 'preferences',         label: 'Preferencias',    icon: <Sparkles className="w-4 h-4" /> },
    { id: 'rarity',              label: 'Probabilidades',  icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'rarity-restrictions', label: 'Limites Rareza',  icon: <Clock className="w-4 h-4" /> },
    { id: 'banners',             label: 'Banners',         icon: <Image className="w-4 h-4" /> },
    { id: 'participants',        label: 'Participantes',   icon: <Users className="w-4 h-4" /> },
    { id: 'overlay',             label: 'Overlay',         icon: <Monitor className="w-4 h-4" /> },
    { id: 'integrations',        label: 'Integraciones',   icon: <Link2 className="w-4 h-4" /> },
];

export default function GachaConfig() {
    const [activeTab, setActiveTab] = useState<GachaTabType>('items');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Gacha System</h1>
                <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Configura items, probabilidades, restricciones y overlay del sistema gacha
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151] hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'items' && <ItemsTab />}
            {activeTab === 'restrictions' && <RestrictionsTab />}
            {activeTab === 'preferences' && <PreferencesTab />}
            {activeTab === 'rarity' && <RarityTab />}
            {activeTab === 'rarity-restrictions' && <RarityRestrictionsTab />}
            {activeTab === 'banners' && <BannersTab />}
            {activeTab === 'participants' && <ParticipantsTab />}
            {activeTab === 'overlay' && <OverlayTab />}
            {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
    );
}
