/**
 * Wrapper for Cookies and LocalStorage persistence.
 */
export class SpyStorage {
    /**
     * @param {SpyConfig} config Configuration instance
     */
    constructor(config) {
        this.config = config;
    }

    /**
     * Retrieves a value from storage (Cookie first, then LS).
     * @param {string} key Key name (without namespace)
     * @returns {string|null} Stored value or null
     */
    get(key) {
        const fullKey = this.config.get('namespace') + key;
        return this.getCookie(fullKey) || this.getLocalStorage(fullKey);
    }

    /**
     * Sets a value to both Cookie and LocalStorage.
     * @param {string} key Key name (without namespace)
     * @param {string} value Value to store
     * @param {number} days Cookie expiration in days
     */
    set(key, value, days = 365) {
        const fullKey = this.config.get('namespace') + key;
        this.setCookie(fullKey, value, days);
        this.setLocalStorage(fullKey, value);
    }

    /**
     * Gets a cookie by name.
     * @param {string} name Cookie name
     * @returns {string|null} Cookie value
     */
    getCookie(name) {
        const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return v ? v[2] : null;
    }

    /**
     * Sets a cookie.
     * @param {string} name Cookie name
     * @param {string} value Cookie value
     * @param {number} days Expiration days
     */
    setCookie(name, value, days) {
        try {
            const d = new Date();
            d.setTime(d.getTime() + 24 * 60 * 60 * 1000 * days);
            const domain = this.getRootDomain();
            document.cookie = `${name}=${value};path=/;expires=${d.toGMTString()};domain=${domain};SameSite=Lax`;
        } catch (e) { }
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

    /**
     * Extract the root domain for cookie scope.
     * @returns {string} Root domain (e.g., .example.com)
     */
    getRootDomain() {
        const parts = window.location.hostname.split('.');
        return parts.length > 2 ? '.' + parts.slice(-2).join('.') : window.location.hostname;
    }
}

