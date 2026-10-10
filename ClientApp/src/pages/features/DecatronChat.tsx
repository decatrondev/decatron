import { MessageSquare, Lock, Plus, Trash2, Send, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation('features');
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
            alert(err.response?.data?.message || t('decatronChat.errorCreating'));
        }
    };

    const deleteConversation = async (conversationId: string) => {
        if (!confirm(t('decatronChat.deleteConfirm'))) return;

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
        const tempUserMsgId = Date.now();
        const tempUserMessage: Message = {
            id: tempUserMsgId,
            role: 'user',
            content: content,
            createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_URL || '/api';
            const response = await fetch(
                `${baseUrl}/chat/conversations/${activeConversation}/messages/stream`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ content }),
                    credentials: 'include'
                }
            );

            if (!response.ok) {
                let errorMsg = t('decatronChat.errorSending');
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch {}
                throw new Error(errorMsg);
            }

            // Crear placeholder del mensaje del asistente
            const assistantMsgId = Date.now() + 1;
            const assistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                createdAt: new Date().toISOString()
            };

            // Leer el stream SSE
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let assistantStarted = false;
            let currentEvent = '';
            let rafId: number | null = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    // Capturar tipo de evento
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                        continue;
                    }

                    if (!line.startsWith('data: ')) continue;

                    const jsonStr = line.slice(6);
                    try {
                        const parsed = JSON.parse(jsonStr);

                        if (currentEvent === 'userMessage' || parsed.userMessage) {
                            // Reemplazar mensaje temporal del usuario con el real de la DB
                            const realUser = parsed.userMessage || parsed;
                            setMessages(prev => prev.map(m =>
                                m.id === tempUserMsgId ? { ...realUser } : m
                            ));
                            currentEvent = '';
                            continue;
                        }

                        if (currentEvent === 'done' || parsed.done) {
                            // Actualizar con datos finales de DB
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId ? { ...parsed.assistantMessage } : m
                            ));
                            if (parsed.conversation) {
                                setConversations(prev => prev.map(c =>
                                    c.id === activeConversation
                                        ? { ...c, title: parsed.conversation.title, messageCount: parsed.conversation.messageCount }
                                        : c
                                ));
                            }
                            setStreamingMessage(null);
                            currentEvent = '';
                            continue;
                        }

                        if (currentEvent === 'error' || parsed.error) {
                            currentEvent = '';
                            throw new Error(parsed.message || 'Stream error');
                        }

                        // Token de contenido (evento sin nombre)
                        if (parsed.content !== undefined) {
                            if (!assistantStarted) {
                                assistantStarted = true;
                                setIsThinking(false);
                                setMessages(prev => [...prev, assistantMsg]);
                                setStreamingMessage(assistantMsg);
                            }
                            fullContent += parsed.content;
                            // Batch renders: acumular y renderizar en el siguiente frame
                            const snapshot = fullContent;
                            if (rafId) cancelAnimationFrame(rafId);
                            rafId = requestAnimationFrame(() => {
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId ? { ...m, content: snapshot } : m
                                ));
                                rafId = null;
                            });
                        }

                        currentEvent = '';
                    } catch (e) {
                        currentEvent = '';
                        if (e instanceof Error && e.message !== 'Stream error') continue;
                        throw e;
                    }
                }
            }

            // Flush final: asegurar que el último contenido se renderice
            if (rafId) cancelAnimationFrame(rafId);
            if (assistantStarted) {
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: fullContent } : m
                ));
            } else {
                setIsThinking(false);
            }
        } catch (err: any) {
            console.error('Error sending message:', err);
            alert(err.message || t('decatronChat.errorSending'));
            setMessageInput(content);
            setIsThinking(false);
            setStreamingMessage(null);
            setMessages(prev => prev.filter(m => m.id !== tempUserMsgId));
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
            // Para typewriter: mostrar mensaje completo inmediatamente
            // Para streaming real: el contenido ya está en pantalla, solo limpiar estado
            if (currentInterval) {
                setMessages(prev => {
                    const updated = [...prev];
                    const msgIndex = updated.findIndex(m => m.id === streamingMessage.id);
                    if (msgIndex >= 0) {
                        updated[msgIndex] = streamingMessage;
                    }
                    return updated;
                });
            }
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
            alert(err.response?.data?.message || t('decatronChat.errorContinuing'));
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
        return <div className="text-center py-8 text-ds-soft">{t('decatronChat.loading')}</div>;
    }

    if (!accessInfo?.canView) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="bg-ds-danger/10 border border-ds-danger/40 rounded-lg p-8 max-w-md text-center">
                    <Lock className="w-16 h-16 text-ds-accent-text mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-ds-danger mb-2">{t('decatronChat.accessDenied')}</h2>
                    <p className="text-ds-soft mb-6">
                        {accessInfo?.reason === 'system_disabled'
                            ? t('decatronChat.systemDisabled')
                            : t('decatronChat.noPermission')}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent font-bold rounded-lg transition-all"
                    >
                        {t('decatronChat.backToDashboard')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex gap-4">
            {/* Sidebar - Conversaciones */}
            <div className="w-80 bg-ds-surface rounded-lg border border-ds-border flex flex-col overflow-hidden">
                <div className="p-4 border-b border-ds-border">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-ds-text">{t('decatronChat.conversations')}</h2>
                        {accessInfo.canChat && (
                            <button
                                onClick={createConversation}
                                className="p-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-all"
                                title={t('decatronChat.newConversation')}
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {!accessInfo.canChat && (
                        <div className="text-xs text-ds-warn bg-ds-warn/10 p-2 rounded">
                            {t('decatronChat.viewOnly')}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {conversations.length === 0 ? (
                        <div className="text-center text-ds-soft py-8 text-sm">
                            {accessInfo.canChat ? t('decatronChat.createToStart') : t('decatronChat.noConversations')}
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`p-3 rounded-lg cursor-pointer transition-all group ${activeConversation === conv.id
                                    ? 'bg-ds-accent/10 border border-ds-accent'
                                    : 'hover:bg-ds-bg border border-transparent'
                                    }`}
                                onClick={() => setActiveConversation(conv.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-ds-text truncate">
                                            {conv.title}
                                        </h3>
                                        <p className="text-xs text-ds-soft mt-1">
                                            {t('decatronChat.messages_count', { count: conv.messageCount })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteConversation(conv.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-ds-danger/10 rounded transition-all"
                                        title={t('decatronChat.delete')}
                                    >
                                        <Trash2 className="w-4 h-4 text-ds-danger" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 bg-ds-surface rounded-lg border border-ds-border flex flex-col overflow-hidden">
                {!activeConversation ? (
                    <div className="flex-1 flex items-center justify-center text-ds-soft">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">{t('decatronChat.selectOrCreate')}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingMessages ? (
                                <div className="text-center py-8 text-ds-soft">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-ds-soft py-8">
                                    {t('decatronChat.sendToStart')}
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, idx) => (
                                        <MessageBubble
                                            key={`${msg.id}-${idx}`}
                                            message={msg}
                                            onEditCode={(code) => setMessageInput(`Modifica este código:\n\n${code}\n\nCambios: `)}
                                            isStreaming={streamingMessage?.id === msg.id}
                                            onContinue={continueMessage}
                                        />
                                    ))}
                                    {isThinking && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[85%] rounded-lg p-4 bg-ds-surface border border-ds-border">
                                                <div className="text-xs font-bold mb-2 text-ds-soft">
                                                    🤖 Decatron IA
                                                </div>
                                                <div className="flex items-center gap-2 text-ds-soft">
                                                    <div className="flex gap-1">
                                                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                                                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                                                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                                                    </div>
                                                    <span className="text-sm italic">{isContinuing ? t('decatronChat.continuing') : t('decatronChat.thinking')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {streamingMessage && (
                                        <div className="flex justify-start">
                                            <button
                                                onClick={stopTypewriter}
                                                className="px-3 py-1.5 bg-ds-danger-solid hover:bg-ds-danger-hover text-ds-on-accent text-xs font-semibold rounded-lg transition-colors"
                                            >
                                                {t('decatronChat.stop')}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        {accessInfo.canChat && (
                            <div className="p-4 border-t border-ds-border">
                                <div className="flex gap-2">
                                    <textarea
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={t('decatronChat.inputPlaceholder')}
                                        className="flex-1 px-4 py-3 bg-ds-bg border border-ds-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ds-accent text-ds-text"
                                        rows={3}
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !messageInput.trim()}
                                        className="px-6 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
    const { t } = useTranslation('features');
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
                        <div className="flex items-center justify-between bg-ds-surface px-4 py-2 rounded-t-lg border-b border-ds-border">
                            <span className="text-xs font-mono text-ds-soft">{language}</span>
                            <div className="flex gap-2">
                                {canPreview && (
                                    <button
                                        onClick={() => openPreview(codeString, language)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded transition-colors"
                                        title={t('decatronChat.preview')}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        {t('decatronChat.preview')}
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
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded transition-colors"
                                        title={t('decatronChat.edit')}
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {t('decatronChat.edit')}
                                    </button>
                                )}
                                <button
                                    onClick={() => copyToClipboard(codeString, codeId)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded transition-colors"
                                    title={t('decatronChat.copy')}
                                >
                                    {copiedCode === codeId ? (
                                        <>
                                            <Check className="w-3 h-3" />
                                            {t('decatronChat.copied')}
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" />
                                            {t('decatronChat.copy')}
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
                <code className="bg-ds-raised text-ds-danger px-1.5 py-0.5 rounded text-sm font-mono border border-ds-border">
                    {children}
                </code>
            );
        }
    };

    return (
        <>
            <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                <div
                    className={`max-w-[85%] rounded-lg p-4 ${isAssistant
                        ? 'bg-ds-surface border border-ds-border '
                        : 'bg-ds-accent text-ds-on-accent '
                        }`}
                >
                    <div className={`text-xs font-bold mb-2 ${isAssistant ? 'text-ds-soft ' : 'text-ds-accent-text'}`}>
                        {isAssistant ? '🤖 Decatron IA' : t('decatronChat.you')}
                    </div>
                    {isAssistant ? (
                        <div className="prose dark:prose-invert prose-sm max-w-none text-ds-text">
                            {isStreaming ? (
                                <>
                                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                                    <span className="inline-block w-2 h-4 ml-1 bg-ds-accent animate-pulse"></span>
                                </>
                            ) : (
                                <ReactMarkdown components={components}>
                                    {message.content}
                                </ReactMarkdown>
                            )}
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                    {isAssistant && message.tokensUsed && message.responseTimeMs ? (
                        <div className="text-xs text-ds-soft mt-3 pt-3 border-t border-ds-border">
                            <div className="flex items-center justify-between">
                                <span>{message.tokensUsed} tokens • {message.responseTimeMs}ms</span>
                                {!isStreaming && message.content.length > 100 && onContinue && (
                                    <button
                                        onClick={() => onContinue(message.id)}
                                        className="px-2 py-1 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent text-xs font-semibold rounded transition-colors"
                                        title="Continuar generando desde donde se quedó"
                                    >
                                        ▶ {t('decatronChat.continue')}
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
                    className="fixed inset-0 bg-ds-input/70 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowPreview(false)}
                >
                    <div
                        className="bg-ds-surface rounded-lg w-full max-w-6xl h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-ds-border bg-ds-bg">
                            <div className="flex items-center gap-2">
                                <ExternalLink className="w-5 h-5 text-ds-accent-text" />
                                <h3 className="text-lg font-black text-ds-text">{t('decatronChat.livePreview')}</h3>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setPreviewKey(prev => prev + 1);
                                    }}
                                    className="px-3 py-2 bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent rounded-lg transition-colors text-sm font-semibold"
                                    title={t('decatronChat.reload')}
                                >
                                    {t('decatronChat.reload')}
                                </button>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="px-4 py-2 bg-ds-raised hover:bg-ds-border text-ds-text rounded-lg transition-colors font-semibold"
                                >
                                    {t('decatronChat.close')}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden bg-ds-surface">
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
