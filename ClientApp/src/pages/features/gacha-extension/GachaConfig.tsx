import { useState } from 'react';
import { Dices, Shield, Sparkles, BarChart3, Clock, Image, Users, Monitor, Volume2, Link2, Terminal } from 'lucide-react';
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
import { CommandsTab } from './components/tabs/CommandsTab';
import { SoundsTab } from './components/tabs/SoundsTab';

const TABS: { id: GachaTabType; label: string; icon: React.ReactNode }[] = [
    { id: 'items',               label: 'Items',           icon: <Dices className="w-4 h-4" /> },
    { id: 'restrictions',        label: 'Restricciones',   icon: <Shield className="w-4 h-4" /> },
    { id: 'preferences',         label: 'Preferencias',    icon: <Sparkles className="w-4 h-4" /> },
    { id: 'rarity',              label: 'Probabilidades',  icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'rarity-restrictions', label: 'Limites Rareza',  icon: <Clock className="w-4 h-4" /> },
    { id: 'banners',             label: 'Banners',         icon: <Image className="w-4 h-4" /> },
    { id: 'participants',        label: 'Participantes',   icon: <Users className="w-4 h-4" /> },
    { id: 'overlay',             label: 'Overlay',         icon: <Monitor className="w-4 h-4" /> },
    { id: 'sounds',              label: 'Sonidos',         icon: <Volume2 className="w-4 h-4" /> },
    { id: 'integrations',        label: 'Integraciones',   icon: <Link2 className="w-4 h-4" /> },
    { id: 'commands',            label: 'Comandos',        icon: <Terminal className="w-4 h-4" /> },
];

export default function GachaConfig() {
    const [activeTab, setActiveTab] = useState<GachaTabType>('items');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-ds-text">Gacha System</h1>
                <p className="text-ds-soft mt-1">
                    Configura items, probabilidades, restricciones y overlay del sistema gacha
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={activeTab === tab.id ? 'ds-btn ds-btn--primary whitespace-nowrap' : 'ds-btn ds-btn--secondary whitespace-nowrap'}
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
            {activeTab === 'sounds' && <SoundsTab />}
            {activeTab === 'integrations' && <IntegrationsTab />}
            {activeTab === 'commands' && <CommandsTab />}
        </div>
    );
}
