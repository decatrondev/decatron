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
                <button onClick={() => navigate('/admin')} className="p-2 hover:bg-[#e2e8f0] dark:hover:bg-[#374151] rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-[#64748b]" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">Email Campaigns</h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">Crea templates visuales y envía emails a streamers via Resend</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-4 shadow-lg">
                <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-[#f8fafc] dark:bg-[#374151]/50 text-[#64748b] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
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
