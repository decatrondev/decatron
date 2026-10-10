import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Send, History } from 'lucide-react';
import TemplatesTab from './TemplatesTab';
import CampaignsTab from './CampaignsTab';
import LogsTab from './LogsTab';

const tabs = [
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'campaigns', label: 'Campañas', icon: Send },
    { id: 'logs', label: 'Historial', icon: History },
];

export default function EmailManagement() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('templates');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-ds-raised rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-ds-soft" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-ds-text">Email Campaigns</h1>
                    <p className="text-ds-soft mt-1">Crea templates visuales y envía emails a streamers via Resend</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-ds-surface rounded-lg border border-ds-border p-4">
                <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-ds-accent text-ds-on-accent shadow-blue-500/20'
                                    : 'bg-ds-bg text-ds-soft hover:bg-ds-raised '
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'templates' && <TemplatesTab />}
            {activeTab === 'campaigns' && <CampaignsTab />}
            {activeTab === 'logs' && <LogsTab />}
        </div>
    );
}
