/**
 * Utility functions helper.
 */
export const Utils = {
    /**
     * Generates a random UUID v4.
     * @returns {string} UUID string
     */
    generateUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Generates a simple hash from string.
     * @param {string} str Input string
     * @returns {string} Hash string
     */
    hashString: (str) => {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    },

    /**
     * Conditional logger.
     * @param {boolean} debug Debug mode flag
     * @param {...any} args Arguments to log
     */
    log: (debug, ...args) => {
        if (debug) console.log('[SpyKit]', ...args);
    },

    /**
     * Error logger.
     * @param {...any} args Error arguments
     */
    error: (...args) => {
        console.error('[SpyKit]', ...args);
    }
};

