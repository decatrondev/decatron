import { Info, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

interface DocAlertProps {
    type: 'info' | 'warning' | 'success' | 'tip';
    title?: string;
    children: React.ReactNode;
}

// Aviso neutro: borde completo tenue, tinte mínimo y color solo en el icono (sin barra lateral).
// El color de estado (verde/ámbar) solo se usa en éxito y advertencia; info y consejo llevan el azul de la marca.
const alertStyles = {
    info: { tone: 'border-ds-border bg-ds-raised', icon: <Info className="w-5 h-5 text-ds-accent-text" /> },
    warning: { tone: 'border-ds-warn/30 bg-ds-warn/5', icon: <AlertTriangle className="w-5 h-5 text-ds-warn" /> },
    success: { tone: 'border-ds-ok/30 bg-ds-ok/5', icon: <CheckCircle className="w-5 h-5 text-ds-ok" /> },
    tip: { tone: 'border-ds-border bg-ds-raised', icon: <Lightbulb className="w-5 h-5 text-ds-accent-text" /> },
};

export default function DocAlert({ type, title, children }: DocAlertProps) {
    const style = alertStyles[type];

    return (
        <div className={`${style.tone} border rounded-lg p-4`}>
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {style.icon}
                </div>
                <div className="flex-1">
                    {title && (
                        <h4 className="font-bold mb-1 text-ds-text">
                            {title}
                        </h4>
                    )}
                    <div className="text-ds-soft">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
