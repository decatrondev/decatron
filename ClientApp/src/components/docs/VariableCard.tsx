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
        <div className="bg-white dark:bg-[#1B1C1D] rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden hover:shadow-lg transition-all">
            <div className="p-4">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <code className="text-lg font-bold text-[#2563eb] bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
                                {name}
                            </code>
                            {intelligent && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-bold">
                                    <Zap className="w-3 h-3" />
                                    Inteligente
                                </span>
                            )}
                        </div>
                        <p className="text-[#64748b] dark:text-[#94a3b8]">{description}</p>
                    </div>
                </div>

                {/* Examples */}
                <div className="space-y-3">
                    {example.command && (
                        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-[#2563eb]" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Ejemplo
                                </span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-[#64748b] dark:text-[#94a3b8] font-medium">Comando:</span>
                                    <code className="ml-2 text-gray-800 dark:text-[#f8fafc] font-mono">
                                        {example.command}
                                    </code>
                                </div>
                                {example.response && (
                                    <div>
                                        <span className="text-[#64748b] dark:text-[#94a3b8] font-medium">Respuesta:</span>
                                        <code className="ml-2 text-gray-800 dark:text-[#f8fafc] font-mono">
                                            {example.response}
                                        </code>
                                    </div>
                                )}
                                {example.result && (
                                    <div>
                                        <span className="text-[#64748b] dark:text-[#94a3b8] font-medium">Resultado:</span>
                                        <code className="ml-2 text-green-600 dark:text-green-400 font-mono">
                                            {example.result}
                                        </code>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {example.usage && (
                        <div className="bg-[#f8fafc] dark:bg-[#1B1C1D] rounded-lg p-3 border border-[#e2e8f0] dark:border-[#374151]">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Uso Inteligente
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {example.usage.map((item, index) => (
                                    <code
                                        key={index}
                                        className="block text-sm text-gray-800 dark:text-[#f8fafc] font-mono"
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
