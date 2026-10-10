import { GraduationCap, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import type { ExampleCategory } from './types';

// Contenido fijo del editor: ejemplos, plantillas, variables y funciones. Los textos (título, descripción) están
// en i18n (commands:scripting.editor.*); aquí solo el código, que es el mismo en todos los idiomas.

export interface Example { id: string; code: string; category: ExampleCategory; icon: LucideIcon }

export const EXAMPLES: Example[] = [
    { id: 'dice', category: 'basic', icon: Sparkles, code: 'set resultado = roll(1, 6)\nsend "🎲 $(user) lanzó un dado y obtuvo: $(resultado)"' },
    { id: 'pick', category: 'basic', icon: Sparkles, code: 'set opciones = "pizza, tacos, sushi, hamburguesa"\nset eleccion = pick($(opciones))\nsend "🍕 $(user), te recomiendo: $(eleccion)"' },
    { id: 'counter', category: 'basic', icon: Sparkles, code: 'set contador = count()\nsend "📊 Este comando se ha usado $(contador) veces por $(user)"' },
    { id: 'twoDice', category: 'intermediate', icon: Zap, code: 'set dado1 = roll(1, 6)\nset dado2 = roll(1, 6)\nset total = $(dado1) + $(dado2)\n\nwhen $(dado1) == $(dado2) then\n    send "🎲🎲 DOBLES! $(user) sacó $(dado1) y $(dado2) = $(total)"\nend\n\nwhen $(dado1) != $(dado2) then\n    send "🎲 $(user) sacó $(dado1) + $(dado2) = $(total)"\nend' },
    { id: 'luck', category: 'intermediate', icon: Zap, code: 'set suerte = roll(1, 100)\n\nwhen $(suerte) >= 90 then\n    send "⭐ LEGENDARIA! $(user) tiene $(suerte)% de suerte"\nend\n\nwhen $(suerte) >= 70 then\n    send "🔥 Buena suerte: $(user) tiene $(suerte)%"\nend\n\nwhen $(suerte) >= 50 then\n    send "👍 Suerte normal: $(user) tiene $(suerte)%"\nend\n\nwhen $(suerte) < 50 then\n    send "😅 Mala suerte: $(user) tiene $(suerte)%"\nend' },
    { id: 'counterMessages', category: 'intermediate', icon: Zap, code: 'set contador = count()\nset usuario = $(user)\n\nwhen $(contador) == 1 then\n    send "🎉 ¡Primera vez usando este comando, $(usuario)!"\nend\n\nwhen $(contador) > 100 then\n    send "🏆 ¡Wow! Este comando se ha usado $(contador) veces"\nend\n\nwhen $(contador) > 10 then\n    send "📊 Comando popular: $(contador) usos"\nend\n\nwhen $(contador) <= 10 then\n    send "📊 Comando usado $(contador) veces"\nend' },
    { id: 'complete', category: 'advanced', icon: GraduationCap, code: 'set usuario = $(user)\nset juego = $(game)\nset canal = $(channel)\nset contador = count()\nset suerte = roll(1, 100)\nset dado1 = roll(1, 6)\nset dado2 = roll(1, 6)\nset suma = $(dado1) + $(dado2)\n\nwhen $(contador) == 1 then\n    send "🎉 ¡Primera vez de $(usuario) en $(canal)!"\nend\n\nwhen $(suerte) >= 90 then\n    send "⭐ ÉPICO! $(usuario) tiene $(suerte)% jugando $(juego)"\nend\n\nwhen $(suerte) >= 60 then\n    send "😊 $(usuario) tiene buena suerte: $(suerte)%"\nend\n\nwhen $(suerte) < 60 then\n    send "😅 $(usuario) tiene $(suerte)% de suerte"\nend\n\nwhen $(suma) == 12 then\n    send "🎲 DOBLE SEIS! Puntuación perfecta"\nend\n\nwhen $(suma) < 12 then\n    send "🎲 Dados: $(dado1) + $(dado2) = $(suma)"\nend\n\nsend "📊 Total de usos: $(contador)"' },
];

/** Plantillas rápidas de la columna lateral (se insertan en el cursor). */
export const TEMPLATES: Record<string, string> = {
    dice: 'set resultado = roll(1, 6)\nsend "🎲 $(user) lanzó un dado y obtuvo: $(resultado)"',
    pick: 'set opciones = "pizza, hamburguesa, tacos, sushi"\nset eleccion = pick($(opciones))\nsend "🍽️ $(user), te recomiendo: $(eleccion)"',
    counter: 'set veces = count()\nsend "🔢 Este comando se ha usado $(veces) veces"',
    conditional: 'set numero = roll(1, 10)\nwhen $(numero) >= 8 then\n    send "🎉 ¡Excelente! Obtuviste $(numero)"\nend\nwhen $(numero) < 8 then\n    send "😅 Obtuviste $(numero)"\nend',
};

export const VARIABLES = ['user', 'channel', 'game', 'uptime', 'ruser', 'touser'] as const;

export const FUNCTIONS = [
    { id: 'roll', name: 'roll(min, max)', example: 'roll(1, 100)' },
    { id: 'pick', name: 'pick("a, b, c")', example: 'pick("pizza, tacos, sushi")' },
    { id: 'count', name: 'count()', example: 'count()' },
] as const;

export const SYNTAX_DOCS = [
    { id: 'variables', code: 'set nombre = valor' },
    { id: 'conditionals', code: 'when condicion then\n    acciones\nend' },
    { id: 'messages', code: 'send "Hola $(user)"' },
    { id: 'operators', code: '==, !=, >, <, >=, <=, +, -' },
] as const;
