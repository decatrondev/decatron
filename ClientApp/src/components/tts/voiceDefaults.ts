/**
 * Valores por defecto de voz para configuraciones nuevas.
 *
 * Estaban repetidos a mano en nueve archivos —propinas, temporizadores, bits, variantes
 * de alertas—, así que cambiar la voz por defecto obligaba a acordarse de los nueve. No
 * causaban el desajuste de catálogos que sí provocaban las listas, porque son un solo
 * valor, pero se olvidan igual.
 *
 * Sin dependencias a propósito: lo importan archivos de constantes que no deben arrastrar
 * React ni el cliente de API.
 */

/** Voz premium (Polly) con la que arranca una configuración nueva. */
export const DEFAULT_PREMIUM_VOICE = 'Lupe';

/** Idioma con el que arranca una configuración nueva. */
export const DEFAULT_LANGUAGE_CODE = 'es-US';

/**
 * Calidad de partida: la barata. Neural cuesta cuatro veces más, y eso se elige a
 * propósito, nunca por omisión.
 */
export const DEFAULT_POLLY_ENGINE = 'standard';
