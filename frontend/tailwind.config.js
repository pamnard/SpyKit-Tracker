/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
    theme: {
        extend: {
            colors: {
                bg: 'rgb(var(--bg) / <alpha-value>)',
                surface: 'rgb(var(--surface) / <alpha-value>)',
                'surface-muted': 'rgb(var(--surface-muted) / <alpha-value>)',
                'surface-strong': 'rgb(var(--surface-strong) / <alpha-value>)',
                border: 'rgb(var(--border) / <alpha-value>)',
                'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
                text: 'rgb(var(--text) / <alpha-value>)',
                muted: 'rgb(var(--muted) / <alpha-value>)',
                subtle: 'rgb(var(--subtle) / <alpha-value>)',
                primary: 'rgb(var(--primary) / <alpha-value>)',
                'primary-strong': 'rgb(var(--primary-strong) / <alpha-value>)',
                'primary-contrast': 'rgb(var(--primary-contrast) / <alpha-value>)',
                danger: 'rgb(var(--danger) / <alpha-value>)',
            },
        },
    },
    plugins: [],
};
