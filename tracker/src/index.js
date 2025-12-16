import { Utils } from './utils.js';
import { SpyConfig } from './config.js';
import { SpyStorage } from './storage.js';
import { SpyDevice } from './device.js';
import { SpySession } from './session.js';
import { SpyTransport } from './transport.js';
import { SpyAutoEvents } from './auto-events.js';

/**
 * Main controller for SpyKit Pixel.
 */
class SpyPixel {
    constructor() {
        this.config = new SpyConfig();
        this.storage = new SpyStorage(this.config);
        this.session = null; // initialized after config
        this.device = null;  // initialized in init
        this.transport = null;
        this.autoEvents = null;

        this.processQueue();
    }

    /**
     * Initializes the pixel after config is ready.
     */
    init() {
        // Init device first to support fingerprint generation
        this.device = new SpyDevice();
        this.session = new SpySession(this.storage, this.config, this.device);
        this.transport = new SpyTransport(this.config, this.storage);
        this.autoEvents = new SpyAutoEvents(this, this.config);

        // Domain Sync
        if (this.config.get('domainSync')) {
            this.syncDomains();
        }

        // Initial Pageview
        this.track('pageview');
        Utils.log(this.config.get('debug'), 'SpyPixel initialized');
    }

    /**
     * Processes a command from the queue.
     * @param {Array} args Command arguments [command, ...data]
     */
    push(args) {
        if (!Array.isArray(args)) return;
        const [command, ...data] = args;

        switch (command) {
            case 'config':
                this.config.set(data[0], data[1]);
                break;
            case 'track':
                this.track(data[0], data[1]);
                break;
            case 'setUserId':
                if (this.session) this.session.setUserId(data[0]);
                break;
            case 'debug':
                this.config.set('debug', data[0]);
                break;
        }

        // Re-init if config passed and not initialized
        if (command === 'config' && data[0] === 'baseUrl' && !this.transport) {
            this.init();
        }
    }

    /**
     * Tracks a specific event.
     * @param {string} eventName Name of the event
     * @param {Object} data Custom event data
     */
    async track(eventName, data = {}) {
        if (!this.transport) return; // Wait for config

        if (this.device) {
            await this.device.ready();
        }

        const sessionCtx = this.session.getContext();

        const deviceInfo = this.device.getInfo();

        const payload = {
            event_name: eventName,
            timestamp: Date.now() / 1000,

            // IDs
            user_id: sessionCtx.user_id,
            visitor_id: sessionCtx.visitor_id,
            session_id: sessionCtx.session_id,

            // Context
            url: window.location.href,
            referrer: document.referrer,
            user_agent: navigator.userAgent,

            // Objects
            device: deviceInfo,
            utm: this.getUTM(),
            data: data
        };

        this.transport.send(payload);
    }

    /**
     * Parses UTM parameters from URL.
     * @returns {Object} UTM parameters
     */
    getUTM() {
        const p = new URLSearchParams(window.location.search);
        const utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
            if (p.has(k)) utm[k] = p.get(k);
        });
        return utm;
    }

    /**
     * Processes the initial command queue.
     */
    processQueue() {
        const q = window._spy || [];
        window._spy = { push: (args) => this.push(args) };
        q.forEach(args => this.push(args));
    }

    /**
     * Syncs visitor ID across domains.
     */
    syncDomains() {
        const domains = this.config.get('domains') || [];
        const current = window.location.hostname;
        const visitorId = this.session.visitorId;

        domains.filter(d => d !== current).forEach(d => {
            new Image().src = `https://${d}/sync?visitor_id=${visitorId}`;
        });
    }
}

// --- Start ---
window.SpyPixel = new SpyPixel();

