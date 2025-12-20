import { Utils } from './utils.js';
import { PixelConfig } from './config.js';
import { PixelStorage } from './storage.js';
import { PixelDevice } from './device.js';
import { PixelSession } from './session.js';
import { PixelTransport } from './transport.js';
import { PixelAutoEvents } from './auto-events.js';

/**
 * Main controller for Pixel.
 */
class Pixel {
    constructor() {
        this.config = new PixelConfig();
        this.storage = new PixelStorage(this.config);
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
        this.device = new PixelDevice();
        this.session = new PixelSession(this.storage, this.config, this.device);
        this.transport = new PixelTransport(this.config, this.storage);
        this.autoEvents = new PixelAutoEvents(this, this.config);

        // Initial Pageview
        this.track('pageview');
        Utils.log(this.config.get('debug'), 'Pixel initialized');
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
            traffic: this.config.get('traffic') || {},
            data: data
        };

        this.transport.send(payload);
    }


    /**
     * Processes the initial command queue.
     */
    processQueue() {
        const q = window._pixel || [];
        window._pixel = { push: (args) => this.push(args) };
        q.forEach(args => this.push(args));
    }
}

// --- Start ---
window.Pixel = new Pixel();

