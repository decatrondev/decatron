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
                    className="p-2 hover:bg-ds-raised rounded-lg transition-colors"
                    aria-label="Volver"
                >
                    <ArrowLeft className="w-5 h-5 text-ds-text" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-ds-text">{title}</h1>
                    {subtitle && <p className="text-ds-soft mt-1">{subtitle}</p>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {right}
                {balance != null && (
                    <div className="flex items-center gap-2 bg-ds-bg border border-ds-border rounded-lg px-4 py-2">
                        <Coins className="w-5 h-5 text-[#eab308]" />
                        <span className="text-lg font-bold text-ds-text">{balance.toLocaleString()}</span>
                        <span className="text-sm text-ds-soft">DecaCoins</span>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
