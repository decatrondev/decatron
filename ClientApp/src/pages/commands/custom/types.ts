export type Restriction = 'all' | 'mod' | 'vip' | 'sub';

export interface CustomCommand {
    id: number;
    commandName: string;
    response: string;
    restriction: Restriction;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface NewCommand {
    commandName: string;
    response: string;
    restriction: Restriction;
    isActive: boolean;
}

export const EMPTY_COMMAND: NewCommand = { commandName: '', response: '', restriction: 'all', isActive: true };

export type ShowToast = (message: string, type?: 'success' | 'error' | 'info') => void;
