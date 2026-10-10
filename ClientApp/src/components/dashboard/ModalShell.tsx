import type { ReactNode } from 'react';
import { Modal } from '../ds';

/** Ventana emergente del panel: fondo oscuro + tarjeta de la librería. `actions` son los botones de abajo. Se cierra con la X (`onClose`), no al hacer clic fuera, como las anteriores: no se pierde lo escrito. */
export default function ModalShell({ title, children, actions, size, onClose }: {
    title: string; children: ReactNode; actions?: ReactNode; size?: 'md' | 'lg' | 'xl'; onClose?: () => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Modal title={title} actions={actions} size={size} onClose={onClose}>{children}</Modal>
        </div>
    );
}
