import { Zap, MessageSquare, Code, Terminal, ListMusic } from 'lucide-react';

export type Category = 'default' | 'custom' | 'microcommands' | 'scripting' | 'songrequest';

export interface PublicCommandItem {
    key: string; // categoria:identificador único
    category: Category;
    commandKey: string;
    name: string; // tal cual viene guardado, sin agregar ni quitar "!"
    description: string; // Default y Song Request traen descripción real
    restriction?: string; // Custom y Song Request traen restriction
    hidden: boolean;
    publicDescription: string;
}

export const ITEMS_PER_PAGE = 8;

export const CATEGORY_META: Record<Category, { label: string; icon: React.ReactNode }> = {
    default: { label: 'Comandos por Defecto', icon: <Zap className="w-4 h-4" /> },
    custom: { label: 'Comandos Custom', icon: <Code className="w-4 h-4" /> },
    microcommands: { label: 'Microcommands', icon: <MessageSquare className="w-4 h-4" /> },
    scripting: { label: 'Scripting', icon: <Terminal className="w-4 h-4" /> },
    songrequest: { label: 'Song Request', icon: <ListMusic className="w-4 h-4" /> },
};
