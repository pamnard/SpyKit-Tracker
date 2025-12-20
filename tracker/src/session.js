import { Utils } from './utils.js';

/**
 * Manages User, Visitor, and Session IDs.
 */
export class PixelSession {
    /**
     * @param {SpyStorage} storage Storage instance
     * @param {SpyConfig} config Config instance
     * @param {SpyDevice} device Device instance
     */
    constructor(storage, config, device) {
        this.storage = storage;
        this.config = config;
        this.device = device;
        this.visitorId = this.getOrSetVisitorId();
        this.userId = this.storage.get('user_id');
        this.sessionId = this.refreshSession();
    }

    /**
     * Gets visitor_id.
     * GDPR compliant: derived from stable fingerprint, no storage used.
     * @returns {string} Visitor ID
     */
    getOrSetVisitorId() {
        return this.device.getBasicFingerprint();
    }

    /**
     * Sets the User ID (e.g. from CRM).
     * @param {string} id User ID
     */
    setUserId(id) {
        if (!this.isValidUserId(id)) return;
        this.userId = id;
        this.storage.set('user_id', id);
    }

    /**
     * Validates User ID format to prevent PII leakage.
     * @param {string} id User ID
     * @returns {boolean} True if valid
     */
    isValidUserId(id) {
        if (!id) return false;
        const strId = String(id);

        // Block Email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strId)) {
            console.warn('[Pixel] Security Warning: user_id looks like an Email. Please use a hashed ID or internal UUID.');
            return false;
        }

        return true;
    }

    /**
     * Checks session timeout and rotates session ID if needed.
     * @returns {string} Session ID
     */
    refreshSession() {
        const now = Date.now();
        let session = {};
        try {
            session = JSON.parse(this.storage.get('session') || '{}');
        } catch (e) { }

        const timeout = this.config.get('sessionTimeout') * 60 * 1000;

        if (!session.id || !session.ts || (now - session.ts > timeout)) {
            // New session
            session = {
                id: Utils.generateUUID(),
                ts: now
            };
        } else {
            // Update timestamp
            session.ts = now;
        }

        this.storage.set('session', JSON.stringify(session));
        return session.id;
    }

    /**
     * Returns current identification context.
     * @returns {Object} {uid, visitor_id, session_id}
     */
    getContext() {
        return {
            user_id: this.userId,
            visitor_id: this.visitorId,
            session_id: this.sessionId
        };
    }
}

