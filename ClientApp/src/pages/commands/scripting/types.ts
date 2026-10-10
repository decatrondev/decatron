export type ExampleCategory = 'basic' | 'intermediate' | 'advanced';

export interface ValidationResult {
    isValid: boolean;
    errorMessage?: string;
    errorLine?: number;
}

export interface PreviewResult {
    success: boolean;
    output: string;
    errorLine?: number;
}

export interface HistoryState {
    content: string;
    cursorPosition: number;
}

export interface AutocompleteSuggestion {
    text: string;
    displayText: string;
    description: string;
    type: 'keyword' | 'function' | 'variable' | 'snippet';
}

export interface ApiError {
    response?: { data?: { message?: string } };
}

/** Todo lo que las piezas del editor necesitan del hook `useScriptEditor`. */
export type ScriptEditor = ReturnType<typeof import('./useScriptEditor').useScriptEditor>;
