/**
 * Timer Extension - useTimerUI Hook
 *
 * Hook personalizado para manejar el estado de la interfaz de usuario.
 */

import { useState } from 'react';
import type { TabType, DragElement } from '../types';

export const useTimerUI = () => {
    const [activeTab, setActiveTab] = useState<TabType>('basic');
    const [isDragging, setIsDragging] = useState(false);
    const [dragElement, setDragElement] = useState<DragElement>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Manejar inicio del drag
    const handleMouseDown = (element: DragElement, e: React.MouseEvent, _currentPosition: { x: number; y: number }) => {
        setIsDragging(true);
        setDragElement(element);

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    // Manejar movimiento del drag
    const handleMouseMove = (
        e: React.MouseEvent,
        canvasRef: React.RefObject<HTMLDivElement>,
        onPositionUpdate: (element: DragElement, position: { x: number; y: number }) => void
    ) => {
        if (!isDragging || !dragElement || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const newX = e.clientX - canvasRect.left - dragOffset.x;
        const newY = e.clientY - canvasRect.top - dragOffset.y;

        // Convertir a coordenadas del canvas 1000x300
        const scaledX = (newX / canvasRect.width) * 1000;
        const scaledY = (newY / canvasRect.height) * 300;

        onPositionUpdate(dragElement, { x: scaledX, y: scaledY });
    };

    // Manejar fin del drag
    const handleMouseUp = () => {
        setIsDragging(false);
        setDragElement(null);
    };

    return {
        // Estado
        activeTab,
        isDragging,
        dragElement,
        dragOffset,

        // Setters
        setActiveTab,
        setIsDragging,
        setDragElement,
        setDragOffset,

        // Acciones
        handleMouseDown,
        handleMouseMove,
        handleMouseUp
    };
};
