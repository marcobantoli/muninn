/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './overlay.html',
        './frontend/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            colors: {
                muninn: {
                    bg: '#0a0e1a',
                    surface: '#111827',
                    card: '#1a2035',
                    border: '#2a3050',
                    accent: '#6c5ce7',
                    'accent-light': '#a29bfe',
                    glow: '#6c5ce7',
                    success: '#00b894',
                    warning: '#fdcb6e',
                    danger: '#e17055',
                    text: '#e2e8f0',
                    'text-dim': '#94a3b8',
                    'text-muted': '#64748b'
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace']
            },
            boxShadow: {
                'glow': '0 0 20px rgba(108, 92, 231, 0.3)',
                'glow-lg': '0 0 40px rgba(108, 92, 231, 0.4)',
                'card': '0 4px 24px rgba(0, 0, 0, 0.3)'
            },
            animation: {
                'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
                'fade-in': 'fade-in 0.3s ease-out',
                'slide-up': 'slide-up 0.4s ease-out',
                'float': 'float 3s ease-in-out infinite'
            },
            keyframes: {
                'pulse-glow': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(108, 92, 231, 0.3)' },
                    '50%': { boxShadow: '0 0 40px rgba(108, 92, 231, 0.6)' }
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' }
                }
            }
        }
    },
    plugins: []
};
