import api from '../../../services/api';
import type { PromoOwnCardAdmin, PromoLimits, PromoOverview, PromoPiece, PromoTemplate, PromoZone } from './types';

/** Códigos de error que devuelve el servidor (se traducen en el panel). Si no vienen, un código genérico. */
export function errorCodes(e: unknown): string[] {
    const codes = (e as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
    return Array.isArray(codes) && codes.length ? codes.map(String) : ['unknown'];
}

export const promoAdminApi = {
    overview: async (): Promise<PromoOverview> => (await api.get('/admin/promo/overview')).data,
    upsertPiece: async (p: PromoPiece): Promise<PromoPiece> => (await api.put('/admin/promo/pieces', p)).data.piece,
    duplicatePiece: async (id: number): Promise<PromoPiece> => (await api.post(`/admin/promo/pieces/${id}/duplicate`)).data.piece,
    setStatus: async (id: number, status: string): Promise<PromoPiece> => (await api.post(`/admin/promo/pieces/${id}/status`, { status })).data.piece,
    deletePiece: async (id: number): Promise<void> => { await api.delete(`/admin/promo/pieces/${id}`); },
    upsertTemplate: async (t: PromoTemplate): Promise<PromoTemplate> => (await api.put('/admin/promo/templates', t)).data.template,
    deleteTemplate: async (id: number): Promise<void> => { await api.delete(`/admin/promo/templates/${id}`); },
    upsertZone: async (z: PromoZone): Promise<PromoZone> => (await api.put('/admin/promo/zones', z)).data.zone,
    deleteZone: async (id: number): Promise<void> => { await api.delete(`/admin/promo/zones/${id}`); },
    ownCards: async (): Promise<PromoOwnCardAdmin[]> => (await api.get('/admin/promo/own-cards')).data.cards,
    setOwnCardHidden: async (id: number, hidden: boolean): Promise<void> => { await api.post(`/admin/promo/own-cards/${id}/hidden`, { hidden }); },
    clearOwnCardImage: async (id: number): Promise<void> => { await api.delete(`/admin/promo/own-cards/${id}/image`); },
    updateLimits: async (l: PromoLimits): Promise<PromoLimits> => (await api.put('/admin/promo/limits', l)).data.limits,
};
