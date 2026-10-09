import { Zap, Info } from 'lucide-react';

interface VariableCardProps {
    name: string;
    description: string;
    intelligent?: boolean;
    example: {
        command?: string;
        response?: string;
        result?: string;
        usage?: string[];
    };
}

export default function VariableCard({ name, description, intelligent, example }: VariableCardProps) {
    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden transition-all">
            <div className="p-4">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <code className="text-lg font-bold text-ds-accent-text bg-ds-raised px-3 py-1 rounded-lg">
                                {name}
                            </code>
                            {intelligent && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-ds-raised text-ds-accent-text rounded-lg text-xs font-bold">
                                    <Zap className="w-3 h-3" />
                                    Inteligente
                                </span>
                            )}
                        </div>
                        <p className="text-ds-soft">{description}</p>
                    </div>
                </div>

                {/* Examples */}
                <div className="space-y-3">
                    {example.command && (
                        <div className="bg-ds-bg rounded-lg p-3 border border-ds-border">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-ds-accent-text" />
                                <span className="text-sm font-semibold text-ds-text">
                                    Ejemplo
                                </span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-ds-soft font-medium">Comando:</span>
                                    <code className="ml-2 text-ds-text font-mono">
                                        {example.command}
                                    </code>
                                </div>
                                {example.response && (
                                    <div>
                                        <span className="text-ds-soft font-medium">Respuesta:</span>
                                        <code className="ml-2 text-ds-text font-mono">
                                            {example.response}
                                        </code>
                                    </div>
                                )}
                                {example.result && (
                                    <div>
                                        <span className="text-ds-soft font-medium">Resultado:</span>
                                        <code className="ml-2 text-ds-accent-text font-mono">
                                            {example.result}
                                        </code>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {example.usage && (
                        <div className="bg-ds-bg rounded-lg p-3 border border-ds-border">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-ds-accent-text" />
                                <span className="text-sm font-semibold text-ds-text">
                                    Uso Inteligente
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {example.usage.map((item, index) => (
                                    <code
                                        key={index}
                                        className="block text-sm text-ds-text font-mono"
                                    >
                                        {item}
                                    </code>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
