import { Utils } from './utils.js';

/**
 * Manages pixel configuration settings.
 */
export class PixelConfig {
    constructor() {
        /** @type {Object} Configuration values storage */
        this.values = {
            baseUrl: null,
            endpoint: '/track',
            sessionTimeout: 30, // minutes
            maxRetries: 3,
            retryDelay: 1000,
            batchSize: 1,
            batchTimeout: 5,

            // Tracking flags
            scrollTracking: true,
            clickTracking: true,
            formTracking: true,
            downloadTracking: true,
            visibilityTracking: true,

            // Internals
            namespace: 'pixel_',
            maxFailedEvents: 50,
            failedEventsTTL: 86400000, // 24h
            retryInterval: 60000,
            debug: false
        };
    }

    /**
     * Sets a configuration value.
     * @param {string} key Config key
     * @param {any} value Config value
     * @returns {boolean} True if valid and set
     */
    set(key, value) {
        if (this.validate(key, value)) {
            this.values[key] = value;
            return true;
        }
        return false;
    }

    /**
     * Gets a configuration value.
     * @param {string} key Config key
     * @returns {any} Config value
     */
    get(key) {
        return this.values[key];
    }

    /**
     * Validates configuration value.
     * @param {string} key Config key
     * @param {any} value Config value
     * @returns {boolean} Is valid
     */
    validate(key, value) {
        // Simple validation logic
        const validators = {
            baseUrl: v => typeof v === 'string' && v.length > 0,
            endpoint: v => typeof v === 'string' && v.startsWith('/'),
            batchSize: v => typeof v === 'number' && v >= 1,
            debug: v => typeof v === 'boolean',
            traffic: v => typeof v === 'object' && v !== null && !Array.isArray(v)
        };

        if (validators[key] && !validators[key](value)) {
            Utils.error(`Invalid config value for ${key}:`, value);
            return false;
        }
        return true;
    }

    /**
     * Constructs the full endpoint URL.
     * @returns {string} Full URL
     * @throws {Error} If baseUrl is missing
     */
    getEndpointUrl() {
        if (!this.values.baseUrl) {
            throw new Error('baseUrl not configured');
        }
        return this.values.baseUrl.replace(/\/$/, '') + this.values.endpoint;
    }
}

