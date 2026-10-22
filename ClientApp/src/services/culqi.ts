/**
 * Checkout de Culqi embebido (token en el navegador + cargo en el backend), el mismo
 * patrón que usan DecaCoins y Supporters. Se cobra en soles con tipo de cambio fijo.
 */
import api from './api';

/** Solo por si el backend no lo informa: el valor histórico. El real llega con la clave pública. */
export const PEN_PER_USD_FALLBACK = 3.80;

export function loadCulqiScript(): Promise<void> {
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

export interface CulqiResult { token: string; email: string; firstName: string; lastName: string; publicKey: string }

export async function openCulqiCheckout(amountUsd: number, title: string): Promise<CulqiResult> {
    await loadCulqiScript();
    const { data: keyData } = await api.get('/coins/culqi-public-key');
    if (!keyData.publicKey) throw new Error('Culqi no configurado');
    // El monto que se muestra tiene que ser exactamente el que se va a cobrar.
    const amountPen = Math.round(amountUsd * (keyData.penPerUsd || PEN_PER_USD_FALLBACK) * 100);
    return openCulqiWithKey(keyData.publicKey, amountPen, title);
}

/** Abre el checkout con una llave pública y un monto en céntimos de sol ya calculados (el panel de la plataforma los trae de su propio servidor). */
export async function openCulqiWithKey(publicKey: string, amountPen: number, title: string, lang: 'es' | 'en' = 'es'): Promise<CulqiResult> {
    await loadCulqiScript();
    return new Promise((resolve, reject) => {
        const config = {
            settings: { title, currency: 'PEN', amount: amountPen },
            client: { email: '' },
            options: { lang, modal: true, installments: false, paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false } },
        };
        const culqi = new (window as any).CulqiCheckout(publicKey, config);
        culqi.culqi = () => {
            if (culqi.token) {
                const r = { token: culqi.token.id, email: culqi.token.email || '', firstName: culqi.token.first_name || '', lastName: culqi.token.last_name || '', publicKey };
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

/** Lo que devuelve el banco cuando el titular se autentica; se reenvía tal cual al servidor. */
export interface Culqi3DSParams {
    eci: string;
    xid: string;
    cavv: string;
    protocolVersion: string;
    directoryServerTransactionId: string;
}

function loadCulqi3DSScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        const w = window as any;
        if (w.Culqi3DS) { resolve(); return; }
        const wait = () => {
            const check = setInterval(() => { if (w.Culqi3DS) { clearInterval(check); resolve(); } }, 50);
            setTimeout(() => { clearInterval(check); reject(new Error('Culqi 3DS timeout')); }, 10000);
        };
        if (document.getElementById('culqi-3ds-js')) { wait(); return; }
        const script = document.createElement('script');
        script.id = 'culqi-3ds-js';
        script.src = 'https://3ds.culqi.com';
        script.onload = wait;
        script.onerror = () => reject(new Error('No se pudo cargar la verificación del banco'));
        document.head.appendChild(script);
    });
}

/**
 * Huella del dispositivo para el antifraude de Culqi. Va en el primer cobro y se repite
 * igual en el segundo. Si no se puede generar el cobro sigue sin ella: no vale la pena
 * bloquear un pago normal por esto.
 */
export async function generateCulqiDeviceId(publicKey: string): Promise<string | null> {
    try {
        await loadCulqi3DSScript();
        const c3ds = (window as any).Culqi3DS;
        c3ds.publicKey = publicKey;
        return (await c3ds.generateDevice()) || null;
    } catch {
        return null;
    }
}

/** Abre la verificación del banco (3D Secure) y devuelve lo que hay que mandarle al servidor. */
export async function authenticateCulqi3DS(opts: {
    publicKey: string; token: string; amountCentavos: number; email: string;
}): Promise<Culqi3DSParams> {
    await loadCulqi3DSScript();
    const c3ds = (window as any).Culqi3DS;

    return new Promise<Culqi3DSParams>((resolve, reject) => {
        let terminado = false;
        const terminar = (fin: () => void) => {
            if (terminado) return;
            terminado = true;
            window.removeEventListener('message', onMessage);
            fin();
        };

        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const r = event.data;
            if (r?.parameters3DS) terminar(() => resolve(r.parameters3DS as Culqi3DSParams));
            else if (r?.error) terminar(() => reject(new Error(typeof r.error === 'string' ? r.error : 'No se pudo autenticar la transacción')));
        };

        try {
            c3ds.reset();
            c3ds.publicKey = opts.publicKey;
            c3ds.settings = {
                charge: { totalAmount: opts.amountCentavos, currency: 'PEN', returnUrl: window.location.href },
                card: { email: opts.email },
            };
            c3ds.options = {
                // Si cierra la ventana del banco sin terminar, el pago se cancela.
                closeModalAction: () => terminar(() => reject(new Error('Cancelaste la verificación del banco.'))),
            };
            window.addEventListener('message', onMessage);
            c3ds.initAuthentication(opts.token);
        } catch (e: any) {
            terminar(() => reject(new Error(e?.message || 'No se pudo abrir la verificación del banco')));
        }
    });
}

/**
 * Manda el cobro al servidor y, si el banco pide verificar al titular (3D Secure), abre su
 * ventana y repite el mismo cobro con el resultado. `enviar` recibe lo que hay que sumar al
 * cuerpo en cada intento: la huella del dispositivo y, en el segundo, la autenticación.
 */
export async function cobrarConCulqi<T = any>(opts: {
    publicKey: string; token: string; email: string;
    enviar: (extra: { deviceFingerPrintId: string | null; authentication3Ds?: Culqi3DSParams }) => Promise<{ data: T & { requires3DS?: boolean; amount?: number } }>;
}) {
    const deviceFingerPrintId = await generateCulqiDeviceId(opts.publicKey);
    let res = await opts.enviar({ deviceFingerPrintId });

    if (res.data?.requires3DS) {
        const authentication3Ds = await authenticateCulqi3DS({
            publicKey: opts.publicKey,
            token: opts.token,
            amountCentavos: res.data.amount ?? 0,
            email: opts.email,
        });
        res = await opts.enviar({ deviceFingerPrintId, authentication3Ds });
    }
    return res;
}
