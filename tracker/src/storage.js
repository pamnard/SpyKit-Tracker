/**
 * Wrapper for LocalStorage persistence.
 */
export class SpyStorage {
    /**
     * @param {SpyConfig} config Configuration instance
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Retrieves a value from storage (LocalStorage only).
     * @param {string} key Key name (without namespace)
     * @returns {string|null} Stored value or null
     */
    get(key) {
        const fullKey = this.config.get('namespace') + key;
        return this.getLocalStorage(fullKey);
    }

    /**
     * Sets a value to LocalStorage.
     * @param {string} key Key name (without namespace)
     * @param {string} value Value to store
     * @param {number} days Unused (kept for API compatibility)
     */
    set(key, value, days = 365) {
        const fullKey = this.config.get('namespace') + key;
        this.setLocalStorage(fullKey, value);
    }

    /**
     * Gets a value from LocalStorage.
     * @param {string} key Key name
     * @returns {string|null} Value
     */
    getLocalStorage(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    /**
     * Sets a value to LocalStorage.
     * @param {string} key Key name
     * @param {string} value Value
     */
    setLocalStorage(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { }
    }
}
