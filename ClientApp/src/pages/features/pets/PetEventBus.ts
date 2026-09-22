/** Canal mínimo para empujar estímulos (SignalR / Testing) al cerebro de la mascota dentro del Canvas. */
import type { PetEvent } from './types';

export class PetEventBus {
    private listeners = new Set<(e: PetEvent) => void>();
    emit(e: PetEvent) { this.listeners.forEach(l => l(e)); }
    subscribe(l: (e: PetEvent) => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
}
