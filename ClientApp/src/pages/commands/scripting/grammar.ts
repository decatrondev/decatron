import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-clike';
import '../../../styles/prism-custom.css';

// Gramática del lenguaje de scripting de Decatron (los colores salen de --ds-syntax-*, ver prism-custom.css)
languages.decatronscript = {
    // El texto entre comillas va primero (y completo, con sus $(variables) dentro) para pintarse de un solo color.
    'string': { pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\.)*\1/, greedy: true },
    'keyword': /\b(set|when|then|end|send)\b/,
    'function': /\b(roll|pick|count)\b/,
    'variable': /\$\([^)]+\)/,
    'number': /\b\d+\b/,
    'operator': /[+\-*/<>=!]+|==|!=|>=|<=/,
    'punctuation': /[{}[\];(),.:]/
};

/** HTML resaltado de un script; si falla, el texto tal cual. */
export const highlightCode = (code: string): string => {
    try {
        return highlight(code, languages.decatronscript, 'decatronscript');
    } catch {
        return code;
    }
};
