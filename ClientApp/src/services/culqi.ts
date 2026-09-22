/**
 * Checkout de Culqi embebido (token en el navegador + cargo en el backend), el mismo
 * patrón que usan DecaCoins y Supporters. Se cobra en soles con tipo de cambio fijo.
 */
import api from './api';

export const PEN_PER_USD = 3.80;

function loadCulqiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        const w = window as any;
        if (w.CulqiCheckout) { resolve(); return; }
        const wait = () => {
            const check = setInterval(() => { if (w.CulqiCheckout) { clearInterval(check); resolve(); } }, 50);
            setTimeout(() => { clearInterval(check); reject(new Error('Culqi timeout')); }, 10000);
        };
        if (document.getElementById('culqi-checkout-js')) { wait(); return; }
        const script = document.createElement('script');
        script.id = 'culqi-checkout-js';
        script.src = 'https://js.culqi.com/checkout-js';
        script.onload = wait;
        script.onerror = () => reject(new Error('No se pudo cargar Culqi'));
        document.head.appendChild(script);
    });
}

export interface CulqiResult { token: string; email: string; firstName: string; lastName: string }

export async function openCulqiCheckout(amountUsd: number, title: string): Promise<CulqiResult> {
    await loadCulqiScript();
    const { data: keyData } = await api.get('/coins/culqi-public-key');
    if (!keyData.publicKey) throw new Error('Culqi no configurado');
    const amountPen = Math.round(amountUsd * PEN_PER_USD * 100);
    return new Promise((resolve, reject) => {
        const config = {
            settings: { title, currency: 'PEN', amount: amountPen },
            client: { email: '' },
            options: { lang: 'es', modal: true, installments: false, paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false } },
        };
        const culqi = new (window as any).CulqiCheckout(keyData.publicKey, config);
        culqi.culqi = () => {
            if (culqi.token) {
                const r = { token: culqi.token.id, email: culqi.token.email || '', firstName: culqi.token.first_name || '', lastName: culqi.token.last_name || '' };
                culqi.close();
                resolve(r);
            } else if (culqi.error) {
                const msg = culqi.error.user_message || culqi.error.merchant_message || 'Error al procesar la tarjeta';
                culqi.close();
                reject(new Error(msg));
            }
        };
        culqi.open();
    });
}
