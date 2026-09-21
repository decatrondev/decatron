import { ArrowLeft, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TcgContextBanner from './TcgContextBanner';

interface Props {
    title: string;
    subtitle?: string;
    balance?: number | null;
    backTo?: string;
    right?: React.ReactNode;
}

export default function TcgPageHeader({ title, subtitle, balance, backTo = '/me/tcg', right }: Props) {
    const navigate = useNavigate();
    return (
        <div className="space-y-4">
            <TcgContextBanner />
            <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(backTo)}
                    className="p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#374151] rounded-lg transition-colors"
                    aria-label="Volver"
                >
                    <ArrowLeft className="w-5 h-5 text-[#1e293b] dark:text-[#f8fafc]" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] dark:text-[#f8fafc]">{title}</h1>
                    {subtitle && <p className="text-[#64748b] dark:text-[#94a3b8] mt-1">{subtitle}</p>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {right}
                {balance != null && (
                    <div className="flex items-center gap-2 bg-[#1a1b1e] border border-[#374151] rounded-xl px-4 py-2">
                        <Coins className="w-5 h-5 text-[#eab308]" />
                        <span className="text-lg font-bold text-white">{balance.toLocaleString()}</span>
                        <span className="text-sm text-[#94a3b8]">DecaCoins</span>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
