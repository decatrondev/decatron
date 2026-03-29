import { MessageSquare, Lock, Plus, Trash2, Send, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '../../services/api';

// Type for code component props
interface CodeProps {
    children?: React.ReactNode;
    className?: string;
}

interface Conversation {
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    tokensUsed?: number;
    responseTimeMs?: number;
    createdAt: string;
}

interface AccessInfo {
    canView: boolean;
    canChat: boolean;
    isOwner?: boolean;
    reason?: string;
}

export default function DecatronChat() {
    const navigate = useNavigate();
    const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
    const [currentInterval, setCurrentInterval] = useState<NodeJS.Timeout | null>(null);
    const [isContinuing, setIsContinuing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        checkAccess();
    }, []);

    useEffect(() => {
        if (accessInfo?.canView) {
            loadConversations();
        }
    }, [accessInfo]);

    useEffect(() => {
        if (activeConversation) {
            loadConversation(activeConversation);
        }
    }, [activeConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkAccess = async () => {
        try {
            const res = await api.get('/chat/check-access');
            if (res.data.success) {
                setAccessInfo({
                    canView: res.data.canView,
                    canChat: res.data.canChat,
                    isOwner: res.data.isOwner,
                    reason: res.data.reason
                });
            }
        } catch (err) {
            console.error('Error checking access:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadConversations = async () => {
        try {
            const res = await api.get('/chat/conversations');
            if (res.data.success) {
                setConversations(res.data.conversations);
                // Si no hay conversación activa y hay conversaciones, seleccionar la primera
                if (!activeConversation && res.data.conversations.length > 0) {
                    setActiveConversation(res.data.conversations[0].id);
                }
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
        }
    };

    const loadConversation = async (conversationId: string) => {
        try {
            setLoadingMessages(true);
            const res = await api.get(`/chat/conversations/${conversationId}`);
            if (res.data.success) {
                setMessages(res.data.messages);
            }
        } catch (err) {
            console.error('Error loading conversation:', err);
        } finally {
            setLoadingMessages(false);
        }
    };

    const createConversation = async () => {
        try {
            const res = await api.post('/chat/conversations', {
                title: 'Nueva conversación'
            });
            if (res.data.success) {
                setConversations(prev => [res.data.conversation, ...prev]);
                setActiveConversation(res.data.conversation.id);
                setMessages([]);
            }
        } catch (err: any) {
            console.error('Error creating conversation:', err);
            alert(err.response?.data?.message || 'Error al crear conversación');
        }
    };

    const deleteConversation = async (conversationId: string) => {
        if (!confirm('¿Eliminar esta conversación? No se puede deshacer.')) return;

        try {
            const res = await api.delete(`/chat/conversations/${conversationId}`);
            if (res.data.success) {
                setConversations(prev => prev.filter(c => c.id !== conversationId));
                if (activeConversation === conversationId) {
                    setActiveConversation(conversations[0]?.id || null);
                    setMessages([]);
                }
            }
        } catch (err) {
            console.error('Error deleting conversation:', err);
        }
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !activeConversation || sending) return;

        const content = messageInput.trim();
        setMessageInput('');
        setSending(true);
        setIsThinking(true);

        // Agregar mensaje del usuario inmediatamente
        const tempUserMessage: Message = {
            id: Date.now(),
            role: 'user',
            content: content,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const res = await api.post(`/chat/conversations/${activeConversation}/messages`, {
                content
            });

            if (res.data.success) {
                // Quitar indicador de pensando
                setIsThinking(false);

                // Reemplazar mensaje temporal del usuario con el real
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== tempUserMessage.id);
                    return [...filtered, res.data.userMessage];
                });

                // Iniciar efecto typewriter con el mensaje del asistente
                startTypewriterEffect(res.data.assistantMessage);

                // Actualizar el título de la conversación si cambió
                if (res.data.conversation.title) {
                    setConversations(prev => prev.map(c =>
                        c.id === activeConversation
                            ? { ...c, title: res.data.conversation.title, messageCount: res.data.conversation.messageCount }
                            : c
                    ));
                }
            }
        } catch (err: any) {
            console.error('Error sending message:', err);
            alert(err.response?.data?.message || 'Error al enviar mensaje');
            setMessageInput(content); // Restaurar el mensaje
            setIsThinking(false);
            // Quitar mensaje temporal del usuario
            setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
        } finally {
            setSending(false);
        }
    };

    const startTypewriterEffect = (message: Message, append: boolean = false) => {
        const fullContent = message.content;
        let currentIndex = 0;

        // Si estamos agregando (continuando), obtener el mensaje existente
        if (append) {
            const existingMsg = messages.find(m => m.id === message.id);
            if (existingMsg) {
                // Crear mensaje con contenido existente + nuevo contenido
                const combinedContent = existingMsg.content + fullContent;
                message = { ...message, content: combinedContent };
                currentIndex = existingMsg.content.length;
            }
        }

        // Crear mensaje inicial
        const initialMessage: Message = append
            ? message
            : { ...message, content: '' };

        if (!append) {
            setStreamingMessage(initialMessage);
            setMessages(prev => [...prev, initialMessage]);
        } else {
            setStreamingMessage(message);
        }

        // Intervalo para agregar caracteres (letra por letra)
        const interval = setInterval(() => {
            if (currentIndex < message.content.length) {
                const currentContent = message.content.substring(0, currentIndex + 1);

                setMessages(prev => {
                    const updated = [...prev];
                    const msgIndex = updated.findIndex(m => m.id === message.id);
                    if (msgIndex >= 0) {
                        updated[msgIndex] = {
                            ...message,
                            content: currentContent
                        };
                    }
                    return updated;
                });

                currentIndex++;
            } else {
                // Finalizar typewriter
                clearInterval(interval);
                setCurrentInterval(null);
                setStreamingMessage(null);

                // Asegurar que el mensaje final está completo
                setMessages(prev => {
                    const updated = [...prev];
                    const msgIndex = updated.findIndex(m => m.id === message.id);
                    if (msgIndex >= 0) {
                        updated[msgIndex] = message;
                    }
                    return updated;
                });
            }
        }, 15); // 15ms por letra para efecto más rápido y fluido

        setCurrentInterval(interval);
    };

    const stopTypewriter = () => {
        if (currentInterval) {
            clearInterval(currentInterval);
            setCurrentInterval(null);
        }
        if (streamingMessage) {
            // Mostrar mensaje completo inmediatamente
            setMessages(prev => {
                const updated = [...prev];
                const msgIndex = updated.findIndex(m => m.id === streamingMessage.id);
                if (msgIndex >= 0) {
                    updated[msgIndex] = streamingMessage;
                }
                return updated;
            });
            setStreamingMessage(null);
        }
    };

    const continueMessage = async (messageId: number) => {
        if (!activeConversation || isContinuing) return;

        setIsContinuing(true);
        setIsThinking(true);

        try {
            const res = await api.post(`/chat/conversations/${activeConversation}/messages`, {
                content: 'Continúa desde donde te quedaste, no repitas lo anterior.'
            });

            if (res.data.success) {
                setIsThinking(false);

                // Obtener el mensaje del asistente que vamos a continuar
                const assistantMessage = res.data.assistantMessage;

                // Actualizar el mensaje existente agregando la continuación
                setMessages(prev => {
                    const updated = [...prev];
                    const msgIndex = updated.findIndex(m => m.id === messageId);
                    if (msgIndex >= 0) {
                        const existingContent = updated[msgIndex].content;
                        const continuedMessage = {
                            ...updated[msgIndex],
                            content: existingContent + '\n\n' + assistantMessage.content,
                            tokensUsed: (updated[msgIndex].tokensUsed || 0) + (assistantMessage.tokensUsed || 0),
                            responseTimeMs: assistantMessage.responseTimeMs
                        };

                        // Iniciar typewriter solo con el nuevo contenido
                        setTimeout(() => {
                            startTypewriterEffect({
                                ...continuedMessage,
                                content: '\n\n' + assistantMessage.content
                            }, true);
                        }, 100);

                        return updated;
                    }
                    return updated;
                });

                // Actualizar conversación
                if (res.data.conversation.title) {
                    setConversations(prev => prev.map(c =>
                        c.id === activeConversation
                            ? { ...c, title: res.data.conversation.title, messageCount: res.data.conversation.messageCount }
                            : c
                    ));
                }
            }
        } catch (err: any) {
            console.error('Error continuing message:', err);
            alert(err.response?.data?.message || 'Error al continuar mensaje');
            setIsThinking(false);
        } finally {
            setIsContinuing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">Cargando...</div>;
    }

    if (!accessInfo?.canView) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-red-600 dark:text-red-400 mb-2">Acceso Denegado</h2>
                    <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">
                        {accessInfo?.reason === 'system_disabled'
                            ? 'El sistema de chat está deshabilitado.'
                            : 'No tienes permisos para acceder al chat IA.'}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                    >
                        Volver al Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex gap-4">
            {/* Sidebar - Conversaciones */}
            <div className="w-80 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[#e2e8f0] dark:border-[#374151]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Conversaciones</h2>
                        {accessInfo.canChat && (
                            <button
                                onClick={createConversation}
                                className="p-2 bg-[#2563eb] hover:bg-blue-700 text-white rounded-lg transition-all"
                                title="Nueva conversación"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {!accessInfo.canChat && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                            Solo puedes ver conversaciones
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {conversations.length === 0 ? (
                        <div className="text-center text-[#64748b] dark:text-[#94a3b8] py-8 text-sm">
                            {accessInfo.canChat ? 'Crea una conversación para comenzar' : 'No hay conversaciones'}
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`p-3 rounded-lg cursor-pointer transition-all group ${activeConversation === conv.id
                                    ? 'bg-[#2563eb]/10 border border-[#2563eb]'
                                    : 'hover:bg-[#f8fafc] dark:hover:bg-[#374151] border border-transparent'
                                    }`}
                                onClick={() => setActiveConversation(conv.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">
                                            {conv.title}
                                        </h3>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            {conv.messageCount} mensajes
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteConversation(conv.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] flex flex-col overflow-hidden">
                {!activeConversation ? (
                    <div className="flex-1 flex items-center justify-center text-[#64748b] dark:text-[#94a3b8]">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">Selecciona una conversación o crea una nueva</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingMessages ? (
                                <div className="text-center py-8 text-[#64748b] dark:text-[#94a3b8]">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-[#64748b] dark:text-[#94a3b8] py-8">
                                    Envía un mensaje para comenzar
                                </div>
                            ) : (
                                <>
                                    {messages.map(msg => (
                                        <MessageBubble
                                            key={msg.id}
                                            message={msg}
                                            onEditCode={(code) => setMessageInput(`Modifica este código:\n\n${code}\n\nCambios: `)}
                                            isStreaming={streamingMessage?.id === msg.id}
                                            onContinue={continueMessage}
                                        />
                                    ))}
                                    {isThinking && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[85%] rounded-2xl p-4 bg-white dark:bg-[#0f1011] border border-[#e2e8f0] dark:border-[#374151] shadow-sm">
                                                <div className="text-xs font-bold mb-2 text-[#64748b] dark:text-[#94a3b8]">
                                                    🤖 Decatron IA
                                                </div>
                                                <div className="flex items-center gap-2 text-[#64748b] dark:text-[#94a3b8]">
                                                    <div className="flex gap-1">
                                                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                                                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                                                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                                                    </div>
                                                    <span className="text-sm italic">{isContinuing ? 'Continuando' : 'Pensando'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {streamingMessage && (
                                        <div className="flex justify-start">
                                            <button
                                                onClick={stopTypewriter}
                                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-md"
                                            >
                                                ⏹ Detener
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        {accessInfo.canChat && (
                            <div className="p-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                                <div className="flex gap-2">
                                    <textarea
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Escribe tu mensaje... (Shift+Enter para nueva línea)"
                                        className="flex-1 px-4 py-3 bg-[#f8fafc] dark:bg-[#0f1011] border border-[#e2e8f0] dark:border-[#374151] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-[#1e293b] dark:text-[#f8fafc]"
                                        rows={3}
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !messageInput.trim()}
                                        className="px-6 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {sending ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Send className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

interface MessageBubbleProps {
    message: Message;
    onEditCode?: (code: string) => void;
    isStreaming?: boolean;
    onContinue?: (messageId: number) => void;
}

function MessageBubble({ message, onEditCode, isStreaming, onContinue }: MessageBubbleProps) {
    const isAssistant = message.role === 'assistant';
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewContent, setPreviewContent] = useState('');
    const [previewKey, setPreviewKey] = useState(0);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(id);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const detectWebCode = (code: string, language: string) => {
        const isHTML = language === 'html' || code.includes('<html') || code.includes('<!DOCTYPE');
        const hasCSS = code.includes('<style>') || language === 'css';
        const hasJS = code.includes('<script>') || language === 'javascript' || language === 'js';
        return isHTML || (hasCSS && hasJS);
    };

    const openPreview = (code: string, language: string) => {
        let content = code;

        // Si es solo CSS, envolver en HTML básico
        if (language === 'css') {
            content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Preview</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        ${code}
    </style>
</head>
<body>
    <h1>CSS Preview</h1>
    <p>Este es un preview de tu CSS. Agrega elementos en el código para verlos estilizados.</p>
</body>
</html>`;
        }
        // Si es solo JS, crear un HTML con canvas y div para output
        else if (language === 'javascript' || language === 'js') {
            content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JavaScript Preview</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f0f0f0;
        }
        #output {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 10px;
            min-height: 100px;
        }
        canvas {
            display: block;
            margin: 20px auto;
            background: white;
            border: 2px solid #333;
        }
    </style>
</head>
<body>
    <h2>JavaScript Preview</h2>
    <div id="output"></div>
    <script>
        // Helper para mostrar output
        function log(...args) {
            const output = document.getElementById('output');
            const div = document.createElement('div');
            div.textContent = args.join(' ');
            div.style.marginBottom = '5px';
            output.appendChild(div);
        }

        // Reemplazar console.log para que se muestre en el output
        const originalLog = console.log;
        console.log = function(...args) {
            originalLog.apply(console, args);
            log(...args);
        };

        // Tu código
        try {
            ${code}
        } catch (error) {
            log('Error: ' + error.message);
            console.error(error);
        }
    </script>
</body>
</html>`;
        }
        // Si ya es HTML completo, validar que tenga DOCTYPE
        else if (!code.includes('<!DOCTYPE')) {
            content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
</head>
<body>
${code}
</body>
</html>`;
        }

        setPreviewContent(content);
        setPreviewKey(prev => prev + 1); // Forzar recreación del iframe
        setShowPreview(true);
    };

    const components: Components = {
        code({ children, className }: CodeProps) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

            if (match) {
                const language = match[1];
                const canPreview = detectWebCode(codeString, language);

                return (
                    <div className="relative group my-4">
                        <div className="flex items-center justify-between bg-[#1e1e1e] dark:bg-[#0d1117] px-4 py-2 rounded-t-lg border-b border-[#374151]">
                            <span className="text-xs font-mono text-[#94a3b8]">{language}</span>
                            <div className="flex gap-2">
                                {canPreview && (
                                    <button
                                        onClick={() => openPreview(codeString, language)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                                        title="Ver preview"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Preview
                                    </button>
                                )}
                                {onEditCode && (
                                    <button
                                        onClick={() => {
                                            onEditCode(codeString);
                                            // Scroll to input
                                            setTimeout(() => {
                                                const textarea = document.querySelector('textarea');
                                                textarea?.focus();
                                                textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }, 100);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                        title="Editar código"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Editar
                                    </button>
                                )}
                                <button
                                    onClick={() => copyToClipboard(codeString, codeId)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2563eb] hover:bg-blue-700 text-white rounded transition-colors"
                                    title="Copiar código"
                                >
                                    {copiedCode === codeId ? (
                                        <>
                                            <Check className="w-3 h-3" />
                                            Copiado
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" />
                                            Copiar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <SyntaxHighlighter
                            language={language}
                            style={vscDarkPlus}
                            PreTag="div"
                            customStyle={{
                                margin: 0,
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                                borderBottomLeftRadius: '0.5rem',
                                borderBottomRightRadius: '0.5rem',
                            }}
                        >
                            {codeString}
                        </SyntaxHighlighter>
                    </div>
                );
            }
            return (
                <code className="bg-[#f1f5f9] dark:bg-[#262626] text-[#e11d48] dark:text-[#fb7185] px-1.5 py-0.5 rounded text-sm font-mono border border-[#e2e8f0] dark:border-[#374151]">
                    {children}
                </code>
            );
        }
    };

    return (
        <>
            <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                <div
                    className={`max-w-[85%] rounded-2xl p-4 ${isAssistant
                        ? 'bg-white dark:bg-[#0f1011] border border-[#e2e8f0] dark:border-[#374151] shadow-sm'
                        : 'bg-[#2563eb] text-white shadow-md'
                        }`}
                >
                    <div className={`text-xs font-bold mb-2 ${isAssistant ? 'text-[#64748b] dark:text-[#94a3b8]' : 'text-blue-100'}`}>
                        {isAssistant ? '🤖 Decatron IA' : 'Tú'}
                    </div>
                    {isAssistant ? (
                        <div className="prose dark:prose-invert prose-sm max-w-none text-[#1e293b] dark:text-[#e2e8f0]">
                            <ReactMarkdown components={components}>
                                {message.content}
                            </ReactMarkdown>
                            {isStreaming && (
                                <span className="inline-block w-2 h-4 ml-1 bg-[#2563eb] animate-pulse"></span>
                            )}
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                    {isAssistant && message.tokensUsed && message.responseTimeMs ? (
                        <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#374151]">
                            <div className="flex items-center justify-between">
                                <span>{message.tokensUsed} tokens • {message.responseTimeMs}ms</span>
                                {!isStreaming && message.content.length > 100 && onContinue && (
                                    <button
                                        onClick={() => onContinue(message.id)}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                                        title="Continuar generando desde donde se quedó"
                                    >
                                        ▶ Continuar
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1B1C1D] rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#0f1011]">
                            <div className="flex items-center gap-2">
                                <ExternalLink className="w-5 h-5 text-green-600" />
                                <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">Preview en Vivo</h3>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setPreviewKey(prev => prev + 1);
                                    }}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold"
                                    title="Recargar preview"
                                >
                                    Recargar
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 bg-[#e2e8f0] dark:bg-[#262626] hover:bg-[#cbd5e1] dark:hover:bg-[#374151] text-[#1e293b] dark:text-[#f8fafc] rounded-lg transition-colors font-semibold"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-white">
                            <iframe
                                key={previewKey}
                                srcDoc={previewContent}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-modals allow-forms"
                                title="Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
