import api from '../services/api';

/**
 * Descarga de archivos de un comprobante electrónico.
 *
 * No se puede usar un <a href> normal: los endpoints piden el JWT en la cabecera, así que
 * el archivo se trae con axios y se guarda desde memoria. El nombre lo decide el servidor
 * (serie-número), que es como el comprador espera encontrarlo en su carpeta de descargas.
 */

export type FormatoComprobante = 'pdf' | 'xml' | 'cdr';

export const FORMATOS: { id: FormatoComprobante; label: string; hint: string }[] = [
    { id: 'pdf', label: 'PDF',  hint: 'El comprobante para imprimir o guardar' },
    { id: 'xml', label: 'XML',  hint: 'El archivo firmado, el que vale ante SUNAT' },
    { id: 'cdr', label: 'CDR',  hint: 'La constancia de que SUNAT lo recibió' },
];

/** Saca el nombre de archivo de un Content-Disposition, si viene. */
function nombreDeCabecera(disposition: unknown): string | null {
    if (typeof disposition !== 'string') return null;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Baja un archivo del comprobante y dispara el guardado en el navegador.
 * `base` es la ruta sin el formato: `/supporters/my-invoices/12/download`.
 */
export async function descargarComprobante(base: string, formato: FormatoComprobante): Promise<void> {
    const res = await api.get(`${base}/${formato}`, { responseType: 'blob' });

    const nombre = nombreDeCabecera(res.headers['content-disposition'])
        ?? `comprobante.${formato === 'pdf' ? 'pdf' : 'xml'}`;

    const url = URL.createObjectURL(res.data as Blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    // Sin esto el blob se queda en memoria hasta que se cierre la pestaña.
    URL.revokeObjectURL(url);
}
