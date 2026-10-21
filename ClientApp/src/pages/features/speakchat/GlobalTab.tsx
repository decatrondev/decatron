import { Check, Copy } from 'lucide-react';
import SpeakChatHistory from '../SpeakChatHistory';
import { cardClass, inputClass, labelClass, sectionTitle, sectionDesc, Toggle } from './shared';
import type { ConfigProps } from './types';

interface GlobalTabProps extends ConfigProps {
    overlayUrl: string;
    copiedUrl: boolean;
    copyOverlayUrl: () => void;
    historyKey: number;
}

export default function GlobalTab({ config, setConfig, overlayUrl, copiedUrl, copyOverlayUrl, historyKey }: GlobalTabProps) {
    return (
        <div className="space-y-6">
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className={sectionTitle}>🎤 Speak Chat activo</p>
                        <p className={sectionDesc}>Activa o desactiva la lectura de mensajes en este canal</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Toggle
                            checked={config.global.enabled}
                            onChange={v => setConfig(c => ({ ...c, global: { enabled: v } }))}
                        />
                        <span className="text-sm font-bold text-ds-text">
                            {config.global.enabled ? 'Activado' : 'Desactivado'}
                        </span>
                    </div>
                </div>
            </div>

            <div className={cardClass}>
                <p className={sectionTitle}>🔗 URL del Overlay (OBS)</p>
                <p className={sectionDesc}>
                    Agrega esta URL como Browser Source en OBS Studio. Con plan pago funciona directo en OBS.
                    Con el plan Free necesitas tener una pestaña del navegador abierta.
                </p>
                <div className="flex gap-2">
                    <input
                        readOnly
                        value={overlayUrl || 'Cargando...'}
                        className={`${inputClass} font-mono`}
                    />
                    <button
                        onClick={copyOverlayUrl}
                        disabled={!overlayUrl}
                        className="ds-btn ds-btn--primary whitespace-nowrap"
                    >
                        {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedUrl ? '¡Copiado!' : 'Copiar'}
                    </button>
                </div>
            </div>

            <SpeakChatHistory refreshKey={historyKey} />
        </div>
    );
}
