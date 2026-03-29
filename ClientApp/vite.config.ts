import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true, // Escuchar en todas las interfaces
        hmr: {
            host: 'twitch.decatron.net',
            protocol: 'wss',
            clientPort: 443,
        },
        allowedHosts: [
            'localhost',
            'twitch.decatron.net',
            '.decatron.net' // Permite todos los subdominios
        ],
        proxy: {
            '/api': {
                target: 'https://localhost:7264',
                changeOrigin: true,
                secure: false
            },
            '/downloads': {
                target: 'https://localhost:7264',
                changeOrigin: true,
                secure: false
            },
            '/uploads': {
                target: 'https://localhost:7264',
                changeOrigin: true,
                secure: false
            },
            '/system-files': {
                target: 'https://localhost:7264',
                changeOrigin: true,
                secure: false
            },
            '/hubs': {
                target: 'https://localhost:7264',
                changeOrigin: true,
                secure: false,
                ws: true
            }
        }
    }
})