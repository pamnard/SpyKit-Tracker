import { useEffect, useState } from 'react';
import { LayoutHeader } from '../components/LayoutHeader';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { Dices } from 'lucide-react';
import { CodeBlock } from '../components/CodeBlock';
import { PixelSettings } from '../types';

export function SettingsPage() {
    const { data, isLoading, error: loadError } = useSettings();
    const updateSettingsMutation = useUpdateSettings();

    const [settings, setSettings] = useState<PixelSettings>({ fileName: '', endpoint: '' });
    const [saved, setSaved] = useState(false);

    // Sync state when data is loaded
    useEffect(() => {
        if (data) {
            setSettings(data);
        }
    }, [data]);

    const handleSave = async () => {
        try {
            await updateSettingsMutation.mutateAsync(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            // Error is handled by mutation state, but we can log or show toast here
        }
    };

    const generateRandomName = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let name = '';
        for (let i = 0; i < 8; i++) {
            name += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return name + '.js';
    };

    const generateRandomEndpoint = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let endpoint = '/';
        for (let i = 0; i < 6; i++) {
            endpoint += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return endpoint;
    };

    if (isLoading) {
        return (
            <div>
                <LayoutHeader title="Settings" baseUrl="/" hideEdit={true} />
                <div className="p-4">Loading settings...</div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div>
                <LayoutHeader title="Settings" baseUrl="/" hideEdit={true} />
                <div className="p-4 text-danger">Error loading settings: {(loadError as Error).message}</div>
            </div>
        );
    }

    return (
        <div>
            <LayoutHeader title="Pixel Settings" baseUrl="/" hideEdit={true} />

            <div className="space-y-6 px-6 pb-12">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-muted block mb-1">
                            Pixel File Name
                        </label>
                        <div className="relative">
                            <input
                                className="w-full border-b border-border bg-surface px-3 py-2 text-sm text-text pr-10"
                                value={settings.fileName}
                                onChange={(e) => setSettings({ ...settings, fileName: e.target.value })}
                                placeholder="pixel.js"
                            />
                            <button
                                className="absolute right-0 top-0 bottom-0 px-3 text-muted hover:text-text transition-colors"
                                onClick={() => setSettings({ ...settings, fileName: generateRandomName() })}
                                title="Generate random name"
                            >
                                <Dices size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-subtle mt-1 p-2">
                            The JavaScript file name that will be served (e.g., pixel.js, analytics.js). Randomize this to avoid blocking by ad blockers that filter by common file names.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-muted block mb-1">
                            Endpoint Path
                        </label>
                        <div className="relative">
                            <input
                                className="w-full border-b border-border bg-surface px-3 py-2 text-sm text-text pr-10"
                                value={settings.endpoint}
                                onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
                                placeholder="/track"
                            />
                            <button
                                className="absolute right-0 top-0 bottom-0 px-3 text-muted hover:text-text transition-colors"
                                onClick={() => setSettings({ ...settings, endpoint: generateRandomEndpoint() })}
                                title="Generate random endpoint"
                            >
                                <Dices size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-subtle mt-1 p-2">
                            The endpoint path for tracking events (e.g., /track, /api/track). Randomize this to avoid blocking by ad blockers that filter by common URL paths.
                        </p>
                    </div>

                    {updateSettingsMutation.isError && (
                        <div className="rounded-lg border border-danger bg-danger/10 px-4 py-2 text-sm text-danger">
                            Error saving settings: {(updateSettingsMutation.error as Error).message}
                        </div>
                    )}

                    {saved && (
                        <div className="rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm text-primary">
                            Settings saved successfully. Changes will take effect in ~10 seconds (cache update).
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            className="rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-contrast hover:bg-primary/90 disabled:opacity-50"
                            onClick={handleSave}
                            disabled={updateSettingsMutation.isPending || !settings.fileName || !settings.endpoint}
                        >
                            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                        </button>
                        <button
                            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
                            onClick={() => data && setSettings(data)} // Reset to loaded data
                            disabled={updateSettingsMutation.isPending}
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <div className="rounded-md border border-border bg-surface-muted p-4">
                    <h2 className="mb-2 text-lg font-semibold">Integration Example</h2>
                    <p className="text-xs text-subtle mb-3">
                        Use this code snippet on your website:
                    </p>
                    <CodeBlock
                        language="javascript"
                        className="border border-border bg-surface text-xs"
                        code={`<script>
    var _spy = window._spy = window._spy || [];

    // Configuration
    _spy.push(['config', 'baseUrl', '/your-proxy-path']); // Relative path to your proxy (recommended) or absolute URL
    _spy.push(['config', 'endpoint', '${settings.endpoint}']); // configured endpoint
    _spy.push(['config', 'namespace', 'spyKit_']);
    _spy.push(['config', 'domains', ['localhost', 'example.com', 'shop.example.com']]);
    _spy.push(['config', 'batchSize', 5]);
    _spy.push(['config', 'batchTimeout', 10]);
    _spy.push(['config', 'sessionTimeout', 30]);
    _spy.push(['config', 'maxFailedEvents', 100]); // higher limit for failed events
    _spy.push(['config', 'retryInterval', 30000]); // check more often (30 sec)
    _spy.push(['config', 'domainSync', true]); // enable cross-domain synchronization

    // Disable individual events (all enabled by default)
    // _spy.push(['config', 'scrollTracking', false]);
    // _spy.push(['config', 'clickTracking', false]);
    // _spy.push(['config', 'formTracking', false]);
    // _spy.push(['config', 'downloadTracking', false]);
    // _spy.push(['config', 'visibilityTracking', false]);

    (function () {
        var js = document.createElement('script');
        js.async = true;
        js.src = '/${settings.fileName}';
        var f = document.getElementsByTagName('script')[0];
        f.parentNode.insertBefore(js, f);
    })();
</script>`}
                    />
                    <div className="flex flex-col gap-2 mt-3 pl-1">
                        <p className="text-xs text-subtle">
                            Events will be sent to: <code className="px-1 py-0.5 rounded bg-surface border border-border">your-site/your-proxy-path{settings.endpoint}</code>
                        </p>
                        <p className="text-xs text-subtle">
                            Pixel file will be served at: <code className="px-1 py-0.5 rounded bg-surface border border-border">your-site/your-proxy-path/{settings.fileName}</code>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
