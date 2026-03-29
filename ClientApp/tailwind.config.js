/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        // Tremor
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Azul profesional (accent)
                accent: {
                    DEFAULT: '#2563eb',
                    light: '#1d4ed8',
                    hover: 'rgba(37, 99, 235, 0.1)',
                },
                // Backgrounds
                bg: {
                    light: '#ffffff',
                    dark: '#1B1C1D',
                },
                card: {
                    light: '#f8fafc',
                    dark: '#262626',
                },
                // Borders
                border: {
                    light: '#e2e8f0',
                    dark: '#374151',
                },
                // Text
                text: {
                    light: '#f8fafc',
                    dark: '#1e293b',
                    muted: {
                        light: '#64748b',
                        dark: '#94a3b8',
                    }
                },
                // Success
                success: {
                    DEFAULT: '#10b981',
                    dark: '#059669',
                    border: '#22c55e',
                    bg: 'rgba(34, 197, 94, 0.1)',
                },
                // Danger
                danger: {
                    DEFAULT: '#dc2626',
                    dark: '#b91c1c',
                    border: '#ef4444',
                    bg: 'rgba(239, 68, 68, 0.1)',
                },
                // Twitch purple
                twitch: {
                    DEFAULT: '#9146ff',
                    dark: '#772ce8',
                }
            },
        },
    },
    plugins: [],
}