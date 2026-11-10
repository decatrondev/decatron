import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Segmented } from '../../components/ds';
import CallApplicationForm from './CallApplicationForm';
import CallDonationPanel from './CallDonationPanel';

export type CollaborateTab = 'money' | 'custody';

interface Props {
    onClose: () => void;
    initialTab: CollaborateTab;
    donationsOpen: boolean;
    applicationsOpen: boolean;
    pageVersion: string;
    custodyNoticeVersion: string;
    /** Avisa a la pagina que algo cambio (pago, solicitud) para refrescar «Mis aportes». */
    onChanged: () => void;
}

/**
 * Panel «Colaborar» dentro de la propia convocatoria: dinero (pago con Culqi, sin esperar aprobacion) o paVos,
 * tarjeta y regalos (solicitud con aviso de custodia). El checkout de Culqi abre su propia ventana encima de esta.
 */
export default function CollaborateModal({ onClose, initialTab, donationsOpen, applicationsOpen, pageVersion, custodyNoticeVersion, onChanged }: Props) {
    const { t } = useTranslation('tournament-call');
    const [tab, setTab] = useState<CollaborateTab>(initialTab);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        root.current?.focus();
        const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('iframe[src*="culqi"]')) onClose(); };
        window.addEventListener('keydown', key);
        return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus?.(); };
    }, [onClose]);
    return <div className="call-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div ref={root} tabIndex={-1} className="call-modal-holder">
            <Modal title={t('collaborateModalTitle')} size="xl" onClose={onClose}>
                <Segmented items={[{ id: 'money', label: t('tabMoney') }, { id: 'custody', label: t('tabCustody') }]} value={tab} onChange={value => setTab(value as CollaborateTab)} />
                {tab === 'money'
                    ? <CallDonationPanel target="fortnite-streamers" embedded onChanged={onChanged} />
                    : <div className="call-modal-custody"><Alert>{t('custody.tabHelp')}</Alert>
                        <CallApplicationForm kind="collaborator" open={applicationsOpen} donationsOpen={donationsOpen} pageVersion={pageVersion} custodyNoticeVersion={custodyNoticeVersion} /></div>}
            </Modal>
        </div>
    </div>;
}
