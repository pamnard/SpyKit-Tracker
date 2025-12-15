import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const devPortEnv = process.env.VITE_DEV_PORT;
const previewPortEnv = process.env.VITE_PREVIEW_PORT;

const devPort = devPortEnv ? Number(devPortEnv) : 5173;
const previewPort = previewPortEnv ? Number(previewPortEnv) : 4173;

if (Number.isNaN(devPort)) {
    throw new Error('VITE_DEV_PORT must be a number');
}

if (Number.isNaN(previewPort)) {
    throw new Error('VITE_PREVIEW_PORT must be a number');
}

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: true,
        port: devPort
    },
    preview: {
        host: true,
        port: previewPort
    },
    optimizeDeps: {
        include: [
            'react-syntax-highlighter/dist/esm/prism-light',
            'react-syntax-highlighter/dist/esm/languages/prism/javascript',
            'react-syntax-highlighter/dist/esm/languages/prism/typescript',
            'react-syntax-highlighter/dist/esm/languages/prism/sql',
            'react-syntax-highlighter/dist/esm/languages/prism/bash',
            'react-syntax-highlighter/dist/esm/languages/prism/json',
            'react-syntax-highlighter/dist/esm/languages/prism/markup',
            'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus',
        ],
    },
});
