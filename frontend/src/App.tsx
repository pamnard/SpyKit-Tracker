import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ChatDrawerProvider } from './context/ChatDrawerContext';
import { AppLayout } from './components/AppLayout';
import { ReportPage } from './pages/ReportPage';
import { EditorPage } from './pages/EditorPage';
import { NewReportPage } from './pages/NewReportPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { CreateViewPage } from './pages/CreateViewPage';
import { ViewPage } from './pages/ViewPage';
import { EditViewPage } from './pages/EditViewPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isLoading } = useAuth();
    if (isLoading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-gray-400">Loading...</div>;
    if (!user) return <LoginPage />;
    return <>{children}</>;
};

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <ProtectedRoute>
                    <ChatDrawerProvider>
                        <Routes>
                            <Route path="/" element={<AppLayout />}>
                                    <Route index element={
                                        <div className="flex flex-col items-center justify-center h-full text-muted">
                                            <p className="text-lg">Select a report to view</p>
                                        </div>
                                    } />
                                    <Route path="new" element={<NewReportPage />} />
                                    <Route path="report/:id" element={<ReportPage />} />
                                    <Route path="report/:id/edit" element={<EditorPage />} />
                                    <Route path="settings" element={<SettingsPage />} />
                                    <Route path="users" element={<UsersPage />} />
                                    <Route path="views/new" element={<CreateViewPage />} />
                                    <Route path="views/:id" element={<ViewPage />} />
                                    <Route path="views/:id/edit" element={<EditViewPage />} />
                            </Route>
                        </Routes>
                    </ChatDrawerProvider>
                </ProtectedRoute>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
