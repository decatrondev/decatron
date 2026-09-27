// SignalR de mentira para el banco de paridad: el overlay viejo se conecta a esto y el banco le manda las
// alertas con window.__parityEmit('ShowEventAlert', datos). No hay red.

type Handler = (...args: any[]) => void;

const handlers = new Map<string, Handler[]>();

(window as any).__parityEmit = (method: string, ...args: any[]) => {
    for (const h of handlers.get(method) ?? []) h(...args);
};
(window as any).__parityResetHub = () => handlers.clear();

export enum LogLevel { Trace, Debug, Information, Warning, Error, Critical, None }

export class HubConnection {
    on(method: string, handler: Handler) { handlers.set(method, [...(handlers.get(method) ?? []), handler]); }
    off(method: string) { handlers.delete(method); }
    onreconnected() {}
    onclose() {}
    async start() {}
    async stop() {}
    async invoke() {}
}

export class HubConnectionBuilder {
    withUrl() { return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() { return new HubConnection(); }
}
