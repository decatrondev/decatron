import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    // Sello de build. Se le pega como ?v= a los JSON de traducciones, que no llevan
    // hash en el nombre: sin esto un navegador con la copia vieja en cache sigue
    // mostrando las claves crudas hasta que el cache expire por su cuenta.
    define: {
        __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    },
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