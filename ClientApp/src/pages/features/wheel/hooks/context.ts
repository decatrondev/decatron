import type { WheelSummary } from '../model';

export type PanelStatus = { kind: 'ok' | 'error'; text: string } | null;

/**
 * Lo mínimo que los hooks del panel necesitan del componente principal: la rueda
 * abierta y la forma de avisarle al streamer qué pasó. Los hooks no conocen el resto
 * del estado, así que ninguno puede depender de cómo está armado el panel.
 */
export interface PanelCtx {
    wheel: WheelSummary | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
    setStatus: (status: PanelStatus) => void;
    setSaving: (saving: boolean) => void;
}
