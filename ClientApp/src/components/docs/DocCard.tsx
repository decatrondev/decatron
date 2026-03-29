import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DocCardProps {
    to: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    comingSoon?: boolean;
}

export default function DocCard({ to, icon, title, description, comingSoon }: DocCardProps) {
    if (comingSoon) {
        return (
            <div className="relative p-6 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg flex items-center justify-center text-[#2563eb] border border-[#e2e8f0] dark:border-[#374151]">
                        {icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {title}
                    </h3>
                </div>
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{description}</p>
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    Pronto
                </span>
            </div>
        );
    }

    return (
        <Link
            to={to}
            className="group block p-6 bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] dark:hover:border-[#2563eb] transition-all hover:shadow-lg"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg flex items-center justify-center text-[#2563eb] border border-[#e2e8f0] dark:border-[#374151] group-hover:bg-[#2563eb] group-hover:text-white transition-colors">
                    {icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-[#2563eb] transition-colors">
                    {title}
                </h3>
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-3">{description}</p>
            <div className="flex items-center gap-2 text-[#2563eb] text-sm font-bold group-hover:gap-3 transition-all">
                Ver guia
                <ArrowRight className="w-4 h-4" />
            </div>
        </Link>
    );
}
