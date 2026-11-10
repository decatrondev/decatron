export interface PublicContribution {
    descriptionEs: string; descriptionEn: string; kind: 'money' | 'giftcard' | 'item'; currency: string;
    amount: number; displayName: string; channelUrl: string; custodian: string; deliveredBy: string;
}
export interface Contribution {
    id: number; reference: string; paymentId: number | null; applicationId: number | null; donorName: string;
    channelUrl: string; descriptionEs: string; descriptionEn: string; kind: 'money' | 'giftcard' | 'item'; currency: string;
    grossAmount: number | null; receivedAmount: number | null; prizeAmount: number | null; custodian: string; deliveredBy: string;
    evidence: string; publicIdentity: boolean; consentEvidence: string; status: 'pending' | 'confirmed' | 'reversed';
    revision: number; updatedAt: string; isOnlineDonation: boolean; isTest?: boolean;
    /** Solo organizador: quien pago con sesion (nombre de cuenta y canal). Vacio si pago sin sesion. */
    payerName?: string; payerChannelUrl?: string;
}
/** Aporte propio de la persona con sesion; los montos recibidos y de premios llegan solo tras la confirmacion. */
export interface MyContribution { id: number; reference: string; status: 'pending' | 'confirmed' | 'reversed'; isTest: boolean; publicIdentity: boolean; currency: string; grossAmount: number | null; receivedAmount: number | null; prizeAmount: number | null; applicationId: number | null; createdAt: string }
export interface DonationReceipt { reference: string; state: string; isTest: boolean; reviewStatus: string; publicIdentity: boolean; receivedAmount?: number | null; prizeAmount?: number | null; currency?: string }
export const CONTRIBUTIONS_API = '/admin/convocatorias/fortnite-streamers/contributions';
export const DONATIONS_API = '/supporters/call-donations';
export const blankContribution = (): Contribution => ({ id: 0, reference: '', paymentId: null, applicationId: null,
    donorName: '', channelUrl: '', descriptionEs: '', descriptionEn: '', kind: 'money', currency: 'USD', grossAmount: null,
    receivedAmount: null, prizeAmount: null, custodian: '', deliveredBy: '', evidence: '', publicIdentity: false,
    consentEvidence: '', status: 'pending', revision: 0, updatedAt: '', isOnlineDonation: false });
