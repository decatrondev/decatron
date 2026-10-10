/**
 * Timer Extension - Guide Tab (Setup Wizard)
 *
 * Dashboard interactivo que guía al usuario paso a paso para configurar su Extensible.
 * Analiza el estado actual de la configuración y muestra el progreso y alertas.
 */

import {
    CheckCircle, AlertTriangle, ArrowRight, Play, ExternalLink,
    Clock, Gift, Palette, Monitor, Copy, BookOpen
} from 'lucide-react';
import { useState } from 'react';
import type { TabType } from '../../types';
import api from '../../../../../services/api';

interface GuideTabProps {
    config: any; // Recibe todo el objeto timerConfig
    onNavigate: (tab: TabType) => void;
    overlayUrl: string;
}

export const GuideTab: React.FC<GuideTabProps> = ({ config, onNavigate, overlayUrl }) => {
    const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [copied, setCopied] = useState(false);
    const [selectedGuide, setSelectedGuide] = useState<string>('basic');

    // --- ANÁLISIS DE ESTADO ---
    
    // 1. Tiempo Base
    const duration = config.defaultDuration || 0;
    const isTimeConfigured = duration > 0;
    const timeStatus = isTimeConfigured ? 'ok' : 'error';

    // 2. Eventos (Motor de Dinero)
    // Verificar si al menos un evento importante está habilitado
    const events = config.eventsConfig || {};
    const isBitsEnabled = events.bits?.enabled;
    const isSubsEnabled = events.subPrime?.enabled || events.subTier1?.enabled;
    const isEventsConfigured = isBitsEnabled || isSubsEnabled;
    const eventStatus = isEventsConfigured ? 'ok' : 'warning';

    // 3. Alertas
    const alerts = config.alertsConfig || {};
    const isAlertsEnabled = alerts.enabled;
    const alertStatus = isAlertsEnabled ? 'ok' : 'warning';

    // 4. Estilo (Tema)
    // Siempre es "ok" porque hay defaults, pero verificamos si tocó algo
    const theme = config.themeConfig || {};
    const isThemeCustom = theme.mode !== 'dark' || theme.containerBackground !== '#000000'; // Simple heurística
    
    // CALCULO DE PROGRESO GLOBAL
    let progressSteps = 0;
    if (isTimeConfigured) progressSteps++;
    if (isEventsConfigured) progressSteps++;
    if (isAlertsEnabled) progressSteps++;
    // Paso 4 (Overlay) siempre cuenta como medio punto si existe URL
    if (overlayUrl) progressSteps++;

    const totalProgress = Math.round((progressSteps / 4) * 100);

    // --- HANDLERS ---

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(overlayUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleQuickTest = async () => {
        try {
            setTestStatus('sending');
            await api.post('/timer/test/event', {
                eventType: 'bits',
                username: 'DecatronBot',
                amount: 100,
                addTime: false // Solo visual
            });
            setTestStatus('success');
            setTimeout(() => setTestStatus('idle'), 2000);
        } catch (e) {
            setTestStatus('error');
            setTimeout(() => setTestStatus('idle'), 2000);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* HERO SECTION: Progreso Global */}
            <div className="relative overflow-hidden rounded-lg bg-ds-surface border border-ds-border p-8 text-ds-text">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-ds-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Radial Progress */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-ds-soft" />
                            <circle 
                                cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" 
                                className={`${totalProgress === 100 ? 'text-ds-ok' : 'text-ds-accent-text'} transition-all duration-1000 ease-out`}
                                strokeDasharray={351} 
                                strokeDashoffset={351 - (351 * totalProgress) / 100} 
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-3xl font-black">{totalProgress}%</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-70">Listo</span>
                        </div>
                    </div>

                    <div className="text-center md:text-left flex-1">
                        <h2 className="text-3xl font-black mb-2">
                            {totalProgress === 100 ? '¡Todo listo para el Extensible! 🚀' : 'Configura tu Timer'}
                        </h2>
                        <p className="text-ds-soft max-w-xl">
                            {totalProgress === 100 
                                ? 'Tu configuración parece completa. Asegúrate de copiar la URL del overlay y probar una alerta antes de iniciar.' 
                                : 'Sigue los pasos a continuación para dejar tu timer listo. Lo más importante son las Reglas de Eventos.'}
                        </p>
                    </div>

                    {/* Quick Test Button */}
                    <div className="flex-shrink-0">
                        <button 
                            onClick={handleQuickTest}
                            disabled={testStatus !== 'idle'}
                            className={`px-6 py-4 rounded-lg font-bold transition-all flex items-center gap-3 ${
                                testStatus === 'success' ? 'bg-ds-accent text-ds-on-accent' : 
                                testStatus === 'error' ? 'bg-ds-danger-solid text-ds-on-accent' : 
                                'bg-ds-surface/10 hover:bg-ds-surface/20 text-ds-text backdrop-blur-sm border border-ds-border/10'
                            }`}
                        >
                            {testStatus === 'sending' ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-ds-border border-t-transparent"></div>
                            ) : testStatus === 'success' ? (
                                <><CheckCircle className="w-5 h-5" /> ¡Enviado!</>
                            ) : (
                                <><Play className="w-5 h-5 fill-current" /> Probar Alerta</>
                            )}
                        </button>
                        <p className="text-[10px] text-center mt-2 opacity-50">Simula 100 bits en el overlay</p>
                    </div>
                </div>
            </div>

            {/* STEPS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                
                {/* PASO 1: TIEMPO BASE */}
                <div className={`relative p-6 rounded-lg border transition-all ${
                    timeStatus === 'ok' ? 'bg-ds-surface border-ds-ok/40 ' : 'bg-ds-danger/10 border-ds-danger/40 '
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-lg ${timeStatus === 'ok' ? 'bg-ds-ok/10 text-ds-ok' : 'bg-ds-danger/10 text-ds-danger'}`}>
                            <Clock className="w-6 h-6" />
                        </div>
                        {timeStatus === 'ok' ? <CheckCircle className="w-5 h-5 text-ds-ok" /> : <AlertTriangle className="w-5 h-5 text-ds-danger" />}
                    </div>
                    <h3 className="text-lg font-bold text-ds-text mb-1">1. Tiempo Inicial</h3>
                    <p className="text-sm text-ds-soft mb-4 min-h-[40px]">
                        {isTimeConfigured 
                            ? `Configurado: ${Math.floor(duration/3600)}h ${Math.floor((duration%3600)/60)}m` 
                            : 'El timer inicia en 0 segundos. Necesitas definir una base.'}
                    </p>
                    <button 
                        onClick={() => onNavigate('basic')}
                        className="w-full py-2 rounded-lg border border-ds-border hover:bg-ds-bg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        Configurar <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {/* PASO 2: EVENTOS (CRÍTICO) */}
                <div className={`relative p-6 rounded-lg border transition-all ${
                    eventStatus === 'ok' ? 'bg-ds-surface border-ds-ok/40 ' : 'bg-ds-warn/10 border-ds-warn/40 '
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-lg ${eventStatus === 'ok' ? 'bg-ds-accent/10 text-ds-accent-text' : 'bg-ds-warn/10 text-ds-warn'}`}>
                            <Gift className="w-6 h-6" />
                        </div>
                        {eventStatus === 'ok' ? <CheckCircle className="w-5 h-5 text-ds-ok" /> : <AlertTriangle className="w-5 h-5 text-ds-warn" />}
                    </div>
                    <h3 className="text-lg font-bold text-ds-text mb-1">2. Reglas de Dinero</h3>
                    <p className="text-sm text-ds-soft mb-4 min-h-[40px]">
                        {isEventsConfigured 
                            ? 'Bits y/o Subs están activos. ¡El timer crecerá!' 
                            : 'El timer no sumará tiempo con donaciones. Activa Bits o Subs.'}
                    </p>
                    <button 
                        onClick={() => onNavigate('events')}
                        className="w-full py-2 rounded-lg border border-ds-border hover:bg-ds-bg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        Definir Reglas <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                {/* PASO 3: ESTILO & ALERTAS */}
                <div className={`relative p-6 rounded-lg border transition-all bg-ds-surface border-ds-border `}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-lg bg-ds-accent/10 text-ds-accent-text">
                            <Palette className="w-6 h-6" />
                        </div>
                        <div className="flex gap-1">
                            {alertStatus === 'ok' && <span className="w-2 h-2 rounded-full bg-ds-accent" title="Alertas OK"></span>}
                            {isThemeCustom && <span className="w-2 h-2 rounded-full bg-ds-accent" title="Tema Editado"></span>}
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-ds-text mb-1">3. Estilo Visual</h3>
                    <p className="text-sm text-ds-soft mb-4 min-h-[40px]">
                        Personaliza colores, fuentes y activa las alertas visuales para el overlay.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => onNavigate('theme')}
                            className="py-2 rounded-lg border border-ds-border hover:bg-ds-bg text-xs font-bold"
                        >
                            Tema
                        </button>
                        <button 
                            onClick={() => onNavigate('alerts')}
                            className="py-2 rounded-lg border border-ds-border hover:bg-ds-bg text-xs font-bold"
                        >
                            Alertas
                        </button>
                    </div>
                </div>

                {/* PASO 4: OVERLAY */}
                <div className="relative p-6 rounded-lg border border-ds-border bg-ds-surface transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 rounded-lg bg-ds-bg text-ds-soft">
                            <Monitor className="w-6 h-6" />
                        </div>
                        <ExternalLink className="w-5 h-5 text-ds-soft" />
                    </div>
                    <h3 className="text-lg font-bold text-ds-text mb-1">4. Conectar a OBS</h3>
                    <p className="text-sm text-ds-soft mb-4 min-h-[40px]">
                        Copia la URL y añádela como "Browser Source" en tu escena de OBS.
                    </p>
                    <button 
                        onClick={handleCopyUrl}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                            copied ? 'bg-ds-accent text-ds-on-accent' : 'bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover'
                        }`}
                    >
                        {copied ? '¡Copiado!' : <><Copy className="w-4 h-4" /> Copiar URL</>}
                    </button>
                </div>
            </div>

            {/* HELP FOOTER */}
            {/* WIKI SECTION: Documentación Práctica */}
            <div className="pt-8 border-t border-ds-border">
                <h3 className="text-lg font-bold text-ds-text mb-6 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-ds-accent-text" />
                    Documentación Rápida
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Navegación Vertical */}
                    <div className="lg:col-span-1 space-y-1">
                        {[
                            { id: 'basic', label: 'Básico y Tiempo', icon: '⚙️' },
                            { id: 'events', label: 'Reglas de Dinero', icon: '🎁' },
                            { id: 'style', label: 'Diseño Visual', icon: '🎨' },
                            { id: 'alerts', label: 'Alertas y Sonidos', icon: '🔔' },
                            { id: 'interaction', label: 'Comandos y Metas', icon: '💬' },
                            { id: 'advanced', label: 'Avanzado y Backup', icon: '🔧' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedGuide(item.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-3 ${
                                    selectedGuide === item.id
                                        ? 'bg-ds-raised text-ds-text '
                                        : 'bg-ds-surface text-ds-soft hover:bg-ds-surface border border-transparent hover:border-ds-border'
                                }`}
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Contenido Dinámico */}
                    <div className="lg:col-span-3">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 min-h-[300px]">
                            {selectedGuide === 'basic' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Configuración Básica</h4>
                                    <p className="text-sm text-ds-soft">
                                        Aquí defines cuánto dura el timer al iniciar. Es el "tanque de gasolina" inicial.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-accent-text mb-2">LO ESENCIAL</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Duración Inicial:</strong> Tiempo con el que arranca (ej: 24h).</li>
                                                <li>• <strong>Auto-Start:</strong> Si quieres que arranque solo al abrir OBS.</li>
                                                <li>• <strong>Backup:</strong> Aquí encontrarás la tarjeta azul para restaurar sesiones si se va la luz.</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-warn/10 rounded-lg border border-ds-warn/40">
                                            <h5 className="font-bold text-xs uppercase text-ds-warn mb-2">TIP PRO</h5>
                                            <p className="text-sm text-ds-warn">
                                                Usa el <strong>"Tiempo Base Acumulado (Offset)"</strong> si quieres sumar horas de streamings anteriores al contador total visible.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedGuide === 'events' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Reglas de Eventos (El Motor)</h4>
                                    <p className="text-sm text-ds-soft">
                                        Define cuánto tiempo suma cada interacción. Sin esto, el timer solo baja y nunca sube.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-accent-text mb-2">CÓMO FUNCIONA</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Bits:</strong> Configura tiempo base o reglas avanzadas (ej: "Min 1000 bits = 10 min").</li>
                                                <li>• <strong>Subs:</strong> Diferencia entre Prime, Tier 1, 2 y 3.</li>
                                                <li>• <strong>Raids:</strong> Puedes dar tiempo fijo + tiempo extra por cada viewer que traigan.</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-accent/10 rounded-lg border border-ds-accent">
                                            <h5 className="font-bold text-xs uppercase text-ds-accent-text mb-2">REGLAS AVANZADAS</h5>
                                            <p className="text-sm text-ds-accent-text">
                                                No te limites a "1 bit = 1 seg". Crea <strong>Reglas (Tiers)</strong> para incentivar donaciones grandes. Ejemplo: "Si donan 50 subs de golpe, suma 1 hora extra".
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedGuide === 'style' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Personalización Visual</h4>
                                    <p className="text-sm text-ds-soft">
                                        Repartido en 3 pestañas: <strong>Tema</strong> (Fondo), <strong>Barra</strong> (Gráfico) y <strong>Tipografía</strong> (Texto).
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-accent-text mb-2">OPCIONES CLAVE</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Tema:</strong> Usa "Transparente" si quieres integrarlo en tu overlay existente.</li>
                                                <li>• <strong>Barra:</strong> Activa "Candy Stripes" para darle vida. Usa un GIF como indicador.</li>
                                                <li>• <strong>Fuentes:</strong> Sube tu propia fuente o usa las de Google Fonts integradas.</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-accent/10 rounded-lg border border-ds-accent">
                                            <h5 className="font-bold text-xs uppercase text-ds-accent-text mb-2">TRUCO VISUAL</h5>
                                            <p className="text-sm text-ds-accent-text">
                                                En la pestaña <strong>Display</strong>, activa "Mostrar Porcentaje" y "Tiempo Transcurrido" para dar más contexto a tus viewers sobre el progreso del extensible.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedGuide === 'alerts' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Alertas y Notificaciones</h4>
                                    <p className="text-sm text-ds-soft">
                                        Feedback visual inmediato en el timer cuando alguien aporta tiempo.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-warn mb-2">CONFIGURACIÓN</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Global:</strong> Define el estilo base (color, posición) para todas las alertas.</li>
                                                <li>• <strong>Específica:</strong> Personaliza mensaje y sonido por evento (Bits vs Subs).</li>
                                                <li>• <strong>Variantes:</strong> Crea alertas especiales para donaciones grandes (ej: &gt;1000 bits = Sonido Épico).</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-warn/10 rounded-lg border border-ds-warn/40">
                                            <h5 className="font-bold text-xs uppercase text-ds-warn mb-2">IMPORTANTE</h5>
                                            <p className="text-sm text-ds-warn">
                                                Usa el botón de <strong>"Prueba Rápida"</strong> en esta pestaña de Guía o en la de Alertas para verificar que el sonido y la animación funcionan en OBS.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedGuide === 'interaction' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Comandos, Metas y Sorteos</h4>
                                    <p className="text-sm text-ds-soft">
                                        Herramientas para interactuar con tu comunidad durante el extensible.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-ok mb-2">HERRAMIENTAS</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Comandos:</strong> <code>!dtimer addtime</code> para mods. Configura permisos en la pestaña Comandos.</li>
                                                <li>• <strong>Sorteos:</strong> Configura sorteos automáticos que se disparan al terminar el tiempo.</li>
                                                <li>• <strong>Metas:</strong> Barra visual de objetivos (ej: "Llegar a 24h").</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-ok/10 rounded-lg border border-ds-ok/40">
                                            <h5 className="font-bold text-xs uppercase text-ds-ok mb-2">RECOMENDACIÓN</h5>
                                            <p className="text-sm text-ds-ok">
                                                Activa la <strong>Lista Blanca</strong> en Comandos para dar acceso a VIPs de confianza si quieres que te ayuden a gestionar el tiempo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedGuide === 'advanced' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <h4 className="text-xl font-bold text-ds-text">Funciones Avanzadas</h4>
                                    <p className="text-sm text-ds-soft">
                                        Para power users: automatización y gestión de datos.
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-ds-bg rounded-lg">
                                            <h5 className="font-bold text-xs uppercase text-ds-soft mb-2">CAPACIDADES</h5>
                                            <ul className="text-sm space-y-2 text-ds-soft">
                                                <li>• <strong>Happy Hour:</strong> Multiplica el tiempo añadido en horas específicas (x2, x3).</li>
                                                <li>• <strong>Auto-Pause:</strong> Pausa el timer automáticamente para dormir (ej: 3am - 9am).</li>
                                                <li>• <strong>Plantillas:</strong> Guarda tu configuración de "Subathon" y "Speedrun" por separado.</li>
                                            </ul>
                                        </div>
                                        <div className="p-4 bg-ds-bg rounded-lg border border-ds-border">
                                            <h5 className="font-bold text-xs uppercase text-ds-soft mb-2">SEGURIDAD</h5>
                                            <p className="text-sm text-ds-soft">
                                                El sistema tiene <strong>Auto-Save</strong> cada 5 minutos. Si el servidor se reinicia, ve a la pestaña <strong>Básico</strong> para restaurar tu sesión exacta.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center pt-8">
                <p className="text-sm text-ds-soft">
                    ¿Necesitas tutoriales avanzados? <a href="#" className="text-ds-accent-text hover:underline">Ver documentación completa</a> o únete al Discord.
                </p>
            </div>
        </div>
    );
};

export default GuideTab;