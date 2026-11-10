export interface CallCopy { title: string; summary: string; imageAlt: string; rules: string }
export interface CallContent { es: CallCopy; en: CallCopy; imageUrl: string; imageCredit: string; imageSource: string; tournamentUrl: string }
export interface CallAdminData { content: CallContent; revision: number; published: boolean; applicationsOpen: boolean; donationsOpen: boolean }
export type ApplicationKind = 'participant' | 'collaborator';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export interface CallProfile { kind: ApplicationKind; displayName: string; channelUrl: string; avatarUrl: string }
export interface CallChannel { id: number; name: string; url: string; avatarUrl: string; botEnabled: boolean | null }
/** Resumen privado (solo bandeja del organizador) de un aporte ligado a una solicitud. */
export interface LinkedContribution { id: number; reference: string; status: 'pending' | 'confirmed' | 'reversed'; isTest: boolean; currency: string; grossAmount: number | null; receivedAmount: number | null; createdAt: string }
export interface CallApplication extends CallProfile {
    id: number; channelUserId: number; contact: string; notes: string; contributionType: string; amount: number | null;
    currency: string; publicListing: boolean; usesBot: boolean; willStream: boolean; status: ApplicationStatus;
    reviewNote: string; revision: number; createdAt: string; updatedAt: string;
    /** "payment" = ficha creada al pagar; se aprueba sola al confirmar el organizador la recepcion. */
    origin?: 'form' | 'payment'; custodyAccepted?: boolean; publicOffer?: boolean; contributions?: LinkedContribution[] | null;
    /** Solo bandeja del organizador: bot encendido en el canal (no prueba que lo use); null = sin dato. */
    botEnabled?: boolean | null;
}
/** Oferta de paVos, tarjeta o regalo bajo custodia del colaborador: dato declarado, nunca se suma a los premios. */
export interface CallCustodyOffer { displayName: string; channelUrl: string; avatarUrl: string; contributionType: 'vbucks' | 'giftcard'; amount: number; currency: string }
export interface CallMe { channels: CallChannel[]; contact: string; applications: CallApplication[] }
export const CALL_ME_API = '/me/convocatorias/fortnite-streamers';
export const CALL_PATH = '/convocatorias/fortnite-streamers';
export const CALL_API = '/admin/convocatorias/fortnite-streamers';
export const CALL_COVER = '/images/tournament-call/fortnite-island.jpg';
export const CALL_COVER_SOURCE = 'https://store.epicgames.com/p/fortnite';
export const blankContent = (): CallContent => ({ es: { title: '', summary: '', imageAlt: '', rules: '' }, en: { title: '', summary: '', imageAlt: '', rules: '' }, imageUrl: '', imageCredit: '', imageSource: '', tournamentUrl: '' });
