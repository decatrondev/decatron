import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
    code: string;
    language?: string;
}

export default function CodeBlock({ code, language = 'bash' }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group">
            <div className="absolute top-3 right-3 z-10">
                <button
                    onClick={handleCopy}
                    className="p-2 bg-ds-raised hover:bg-ds-bg border border-ds-border text-ds-text rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Copiar código"
                >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <pre className="bg-ds-bg text-ds-text rounded-lg p-6 overflow-x-auto border border-ds-border">
                <code className={`language-${language} text-sm font-mono`}>{code}</code>
            </pre>
        </div>
    );
}
