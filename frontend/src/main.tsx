import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { ThemeProvider } from './theme';

const queryClient = new QueryClient();

const rootEl = document.getElementById('root');

if (!rootEl) {
    throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
