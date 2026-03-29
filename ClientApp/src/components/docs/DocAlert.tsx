import { Info, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

interface DocAlertProps {
    type: 'info' | 'warning' | 'success' | 'tip';
    title?: string;
    children: React.ReactNode;
}

const alertStyles = {
    info: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: 'text-blue-800 dark:text-blue-300',
        text: 'text-blue-700 dark:text-blue-400'
    },
    warning: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
        title: 'text-amber-800 dark:text-amber-300',
        text: 'text-amber-700 dark:text-amber-400'
    },
    success: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
        title: 'text-green-800 dark:text-green-300',
        text: 'text-green-700 dark:text-green-400'
    },
    tip: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        icon: <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
        title: 'text-purple-800 dark:text-purple-300',
        text: 'text-purple-700 dark:text-purple-400'
    }
};

export default function DocAlert({ type, title, children }: DocAlertProps) {
    const style = alertStyles[type];

    return (
        <div className={`${style.bg} ${style.border} border rounded-xl p-4`}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {style.icon}
                </div>
                <div className="flex-1">
                    {title && (
                        <h4 className={`font-bold mb-1 ${style.title}`}>
                            {title}
                        </h4>
                    )}
                    <div className={style.text}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
