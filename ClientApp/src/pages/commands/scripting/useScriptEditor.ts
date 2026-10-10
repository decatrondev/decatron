import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { usePermissions } from '../../../hooks/usePermissions';
import { useToast } from '../../../components/dashboard/toast';
import { TEMPLATES, VARIABLES } from './data';
import type { ApiError, AutocompleteSuggestion, ExampleCategory, HistoryState, PreviewResult, ValidationResult } from './types';
import type { Example } from './data';

/** Estado y acciones del editor de scripts: cargar, historial, validar, probar, guardar, autocompletado y formato. */
export function useScriptEditor() {
    const { t } = useTranslation('commands');
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();
    const { toast, showToast } = useToast();
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [testing, setTesting] = useState(false);
    const [commandName, setCommandName] = useState('');
    const [scriptContent, setScriptContent] = useState('');
    const [restriction, setRestriction] = useState('all'); // all, mod, vip, sub
    const [isActive, setIsActive] = useState(true);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ExampleCategory | 'all'>('all');
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [currentLine, setCurrentLine] = useState(0);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteOptions, setAutocompleteOptions] = useState<AutocompleteSuggestion[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
    const [confirmClear, setConfirmClear] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const redirectTimer = useRef<number | undefined>(undefined);

    const isEditMode = !!id;

    useEffect(() => {
        if (id && !permissionsLoading && hasMinimumLevel('commands')) {
            loadScript();
        } else if (!id) {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, permissionsLoading]);

    useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

    const loadScript = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/scripts/${id}`);
            setCommandName(res.data.commandName);
            setScriptContent(res.data.scriptContent);
            setRestriction(res.data.restriction || 'all');
            setIsActive(res.data.isActive);
            addToHistory(res.data.scriptContent);
        } catch (err) {
            console.error('Error loading script:', err);
            showToast(t('scripting.messages.loadError'), 'error');
            redirectTimer.current = window.setTimeout(() => navigate('/commands/scripting'), 1200);
        } finally {
            setLoading(false);
        }
    };

    const addToHistory = (content: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({
            content,
            cursorPosition: textareaRef.current?.selectionStart || 0
        });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setScriptContent(history[historyIndex - 1].content);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setScriptContent(history[historyIndex + 1].content);
        }
    };

    const handleScriptChange = (newContent: string) => {
        setScriptContent(newContent);
        setValidationResult(null);
        setPreviewResult(null);
        addToHistory(newContent);
    };

    const validateScript = async () => {
        if (!scriptContent.trim()) {
            setValidationResult({ isValid: false, errorMessage: t('scripting.messages.scriptRequired') });
            return false;
        }

        try {
            setValidating(true);
            const res = await api.post('/scripts/validate', { scriptContent });
            setValidationResult(res.data.data);
            return res.data.data.isValid;
        } catch {
            setValidationResult({ isValid: false, errorMessage: t('scripting.messages.validationError') });
            return false;
        } finally {
            setValidating(false);
        }
    };

    const testScript = async () => {
        if (!scriptContent.trim()) {
            setPreviewResult({ success: false, output: t('scripting.messages.scriptRequired') });
            return;
        }

        try {
            setTesting(true);
            const res = await api.post('/scripts/preview', {
                scriptContent,
                commandName: commandName || 'test'
            });
            setPreviewResult(res.data.data);
        } catch {
            setPreviewResult({ success: false, output: t('scripting.messages.testError') });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!commandName.trim()) {
            showToast(t('scripting.messages.fieldRequired'), 'error');
            return;
        }

        if (!scriptContent.trim()) {
            showToast(t('scripting.messages.scriptRequired'), 'error');
            return;
        }

        const isValid = await validateScript();
        if (!isValid) {
            showToast(t('scripting.messages.validationError'), 'error');
            return;
        }

        try {
            setSaving(true);
            if (isEditMode) {
                await api.put(`/scripts/${id}`, { scriptContent, restriction, isActive });
                showToast(t('scripting.messages.updateSuccess'));
            } else {
                await api.post('/scripts', { commandName: commandName.trim(), scriptContent, restriction, isActive });
                showToast(t('scripting.messages.createSuccess'));
            }
            // Deja ver el aviso antes de volver a la lista.
            redirectTimer.current = window.setTimeout(() => navigate('/commands/scripting'), 1000);
        } catch (error) {
            const err = error as ApiError;
            showToast(err.response?.data?.message || t('scripting.messages.saveError'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Ctrl+S guarda (usa siempre la versión más reciente de handleSave).
    const saveRef = useRef(handleSave);
    saveRef.current = handleSave;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveRef.current();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const getTextarea = () => document.getElementById('code-editor') as HTMLTextAreaElement | null;

    const insertText = (text: string) => {
        const textarea = getTextarea();
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = scriptContent.substring(0, start) + text + scriptContent.substring(end);

        handleScriptChange(newContent);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };

    const insertTemplate = (template: string) => {
        if (TEMPLATES[template]) {
            insertText(TEMPLATES[template]);
        }
    };

    // Actualizar línea actual cuando cambia la posición del cursor
    const handleCursorChange = () => {
        const textarea = getTextarea();
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const lineNumber = textBeforeCursor.split('\n').length;
        setCurrentLine(lineNumber);

        // Detectar autocomplete
        checkAutocomplete();
    };

    // Auto-complete - Sugerencias al escribir
    const checkAutocomplete = () => {
        const textarea = getTextarea();
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const currentLineText = textBeforeCursor.split('\n').pop() || '';
        const lastWord = currentLineText.split(/\s/).pop() || '';

        if (lastWord.length < 2) {
            setShowAutocomplete(false);
            return;
        }

        const suggestions: AutocompleteSuggestion[] = [];

        // Keywords
        const keywords = ['set', 'when', 'then', 'end', 'send'];
        keywords.forEach(kw => {
            if (kw.startsWith(lastWord.toLowerCase())) {
                suggestions.push({
                    text: kw,
                    displayText: kw,
                    description: t('scripting.editor.exampleBasic'),
                    type: 'keyword'
                });
            }
        });

        // Functions
        const functions = [
            { name: 'roll(1, 6)', desc: t('scripting.editor.exampleBasic') },
            { name: 'pick("a, b")', desc: t('scripting.editor.exampleBasic') },
            { name: 'count()', desc: t('scripting.editor.exampleCounters') }
        ];
        functions.forEach(fn => {
            if (fn.name.startsWith(lastWord.toLowerCase())) {
                suggestions.push({
                    text: fn.name,
                    displayText: fn.name,
                    description: fn.desc,
                    type: 'function'
                });
            }
        });

        // Variables
        VARIABLES.map(v => `$(${v})`).forEach(v => {
            if (v.startsWith(lastWord)) {
                suggestions.push({
                    text: v,
                    displayText: v,
                    description: t('scripting.editor.exampleVariables'),
                    type: 'variable'
                });
            }
        });

        if (suggestions.length > 0) {
            setAutocompleteOptions(suggestions);
            setSelectedSuggestionIndex(0);
            setShowAutocomplete(true);

            // Calcular posición del autocomplete
            const lineHeight = 24;
            setAutocompletePosition({
                top: (currentLine - 1) * lineHeight + 60,
                left: 60
            });
        } else {
            setShowAutocomplete(false);
        }
    };

    // Insertar sugerencia de autocomplete
    const insertSuggestion = (suggestion: AutocompleteSuggestion) => {
        const textarea = getTextarea();
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = scriptContent.substring(0, cursorPos);
        const currentLineText = textBeforeCursor.split('\n').pop() || '';
        const lastWord = currentLineText.split(/\s/).pop() || '';

        // Reemplazar la última palabra con la sugerencia
        const beforeLastWord = textBeforeCursor.substring(0, textBeforeCursor.length - lastWord.length);
        const afterCursor = scriptContent.substring(cursorPos);
        const newContent = beforeLastWord + suggestion.text + afterCursor;

        setScriptContent(newContent);
        setShowAutocomplete(false);

        setTimeout(() => {
            const newCursorPos = beforeLastWord.length + suggestion.text.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    // Formatear código automáticamente
    const formatCode = () => {
        const lines = scriptContent.split('\n');
        let indentLevel = 0;
        const formatted: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Des-indentar antes de 'end'
            if (trimmed.startsWith('end')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            // Agregar línea con indentación
            const indent = '    '.repeat(indentLevel);
            formatted.push(indent + trimmed);

            // Indentar después de 'then'
            if (trimmed.endsWith('then')) {
                indentLevel++;
            }
        }

        const newContent = formatted.join('\n');
        handleScriptChange(newContent);

        getTextarea()?.focus();
    };

    const loadExample = (example: Example) => {
        handleScriptChange(example.code);
        getTextarea()?.focus();
    };

    // Limpiar pide confirmación solo si hay algo escrito.
    const clearEditor = () => {
        if (scriptContent.trim()) {
            setConfirmClear(true);
            return;
        }
        handleScriptChange('');
    };
    const confirmClearEditor = () => {
        setConfirmClear(false);
        handleScriptChange('');
    };

    return {
        t, id, navigate, isEditMode, toast, permissionsLoading, hasMinimumLevel,
        loading, saving, validating, testing,
        commandName, setCommandName, scriptContent, restriction, setRestriction, isActive, setIsActive,
        validationResult, previewResult, selectedCategory, setSelectedCategory,
        history, historyIndex, currentLine,
        showAutocomplete, autocompleteOptions, selectedSuggestionIndex, autocompletePosition,
        confirmClear, setConfirmClear, confirmClearEditor,
        undo, redo, handleScriptChange, validateScript, testScript, handleSave,
        insertText, insertTemplate, handleCursorChange, insertSuggestion, formatCode, loadExample, clearEditor,
    };
}
