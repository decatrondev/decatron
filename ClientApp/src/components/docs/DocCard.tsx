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
            <div className="relative p-6 bg-ds-surface rounded-lg border border-ds-border opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-accent-text border border-ds-border">
                        {icon}
                    </div>
                    <h3 className="text-lg font-bold text-ds-text">
                        {title}
                    </h3>
                </div>
                <p className="text-sm text-ds-soft">{description}</p>
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold bg-ds-raised text-ds-soft border border-ds-border rounded-full">
                    Pronto
                </span>
            </div>
        );
    }

    return (
        <Link
            to={to}
            className="group block p-6 bg-ds-surface rounded-lg border border-ds-border hover:border-ds-accent transition-all"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-ds-bg rounded-lg flex items-center justify-center text-ds-accent-text border border-ds-border group-hover:bg-ds-accent group-hover:text-white transition-colors">
                    {icon}
                </div>
                <h3 className="text-lg font-bold text-ds-text group-hover:text-ds-accent-text transition-colors">
                    {title}
                </h3>
            </div>
            <p className="text-sm text-ds-soft mb-3">{description}</p>
            <div className="flex items-center gap-2 text-ds-accent-text text-sm font-bold group-hover:gap-3 transition-all">
                Ver guia
                <ArrowRight className="w-4 h-4" />
            </div>
        </Link>
    );
}
