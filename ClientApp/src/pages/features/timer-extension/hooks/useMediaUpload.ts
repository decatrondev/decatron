/**
 * Timer Extension - useMediaUpload Hook
 *
 * Hook personalizado para manejar la subida y gestión de archivos multimedia.
 */

import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import type { MediaFile, SaveMessageType } from '../types';

interface UseMediaUploadOptions {
    onMessage?: (message: SaveMessageType) => void;
}

export const useMediaUpload = (options?: UseMediaUploadOptions) => {
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Cargar lista de archivos multimedia del servidor
    const loadMediaFiles = async () => {
        try {
            const res = await api.get('/timer/media');
            if (res.data.success && res.data.files) {
                setMediaFiles(res.data.files);
            }
        } catch (error) {
            console.error('Error loading media files:', error);
        }
    };

    // Subir archivo multimedia
    const handleFileUpload = async (file: File) => {
        try {
            setUploading(true);
            setUploadProgress(0);

            // Determinar tipo de archivo
            const ext = file.name.split('.').pop()?.toLowerCase();
            let fileType: 'sound' | 'image' | 'gif' | 'video' = 'image';

            if (['mp3', 'wav', 'ogg'].includes(ext || '')) fileType = 'sound';
            else if (['gif'].includes(ext || '')) fileType = 'gif';
            else if (['mp4', 'webm'].includes(ext || '')) fileType = 'video';

            // Obtener duración si es audio/video
            let duration = 0;
            if (fileType === 'sound' || fileType === 'video') {
                const mediaElement = document.createElement(fileType === 'sound' ? 'audio' : 'video');
                const fileUrl = URL.createObjectURL(file);

                await new Promise<void>((resolve) => {
                    mediaElement.onloadedmetadata = () => {
                        duration = mediaElement.duration;
                        URL.revokeObjectURL(fileUrl);
                        resolve();
                    };
                    mediaElement.src = fileUrl;
                });
            }

            const formData = new FormData();
            formData.append('File', file);
            formData.append('FileType', fileType);
            formData.append('DurationSeconds', duration.toString());

            await api.post('/timer/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percent);
                    }
                }
            });

            options?.onMessage?.({ type: 'success', text: `Archivo subido: ${file.name}` });
            await loadMediaFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || 'Error al subir archivo';
            options?.onMessage?.({ type: 'error', text: message });
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Eliminar archivo multimedia
    const handleDeleteMediaFile = async (fileId: string) => {
        if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

        try {
            await api.delete(`/timer/media/${fileId}`);
            options?.onMessage?.({ type: 'success', text: 'Archivo eliminado' });
            await loadMediaFiles();
        } catch (error: any) {
            const message = error.response?.data?.message || 'Error al eliminar archivo';
            options?.onMessage?.({ type: 'error', text: message });
        }
    };

    // Cargar archivos al iniciar
    useEffect(() => {
        loadMediaFiles();
    }, []);

    return {
        // Estado
        mediaFiles,
        uploading,
        uploadProgress,

        // Acciones
        loadMediaFiles,
        handleFileUpload,
        handleDeleteMediaFile
    };
};
