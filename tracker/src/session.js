import { Utils } from './utils.js';

/**
 * Manages User, Visitor, and Session IDs.
 */
export class SpySession {
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
     * Gets existing visitor_id or generates a new one.
     * @returns {string} Visitor ID
     */
    getOrSetVisitorId() {
        let id = this.storage.get('visitor_id');
        if (!id) {
            id = this.device.getBasicFingerprint(); // Use device method
            this.storage.set('visitor_id', id);
        }
        return id;
    }

    /**
     * Sets the User ID (e.g. from CRM).
     * @param {string} id User ID
     */
    setUserId(id) {
        this.userId = id;
        this.storage.set('user_id', id);
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

