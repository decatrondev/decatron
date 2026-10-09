import { useEffect, useState } from 'react';
import { getPreview, setPreview } from './runtime';

// Aviso fijo mientras el dueño navega el sitio con el borrador de diseño aplicado (vista previa local de su navegador).
export default function PreviewBanner() {
    const [on, setOn] = useState(!!getPreview());
    useEffect(() => {
        const sync = () => setOn(!!getPreview());
        window.addEventListener('decatron-design-changed', sync);
        window.addEventListener('storage', sync);
        return () => { window.removeEventListener('decatron-design-changed', sync); window.removeEventListener('storage', sync); };
    }, []);
    if (!on) return null;
    return (
        <div role="status" style={{
            position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 2147483000, display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 8px 8px 16px', background: 'var(--ds-raised)', color: 'var(--ds-text)', border: 'var(--ds-border-w) solid var(--ds-border)',
            borderRadius: 'var(--ds-radius-lg)', boxShadow: '0 10px 30px rgba(0,0,0,.35)', fontFamily: 'var(--ds-font-ui)', fontSize: 14, maxWidth: 'calc(100vw - 32px)',
        }}>
            <span>Vista previa del borrador de diseño (solo la ves tú)</span>
            <button type="button" className="ds-btn ds-btn--secondary ds-btn--sm" onClick={() => { setPreview(null); setOn(false); }}>Salir</button>
        </div>
    );
}
