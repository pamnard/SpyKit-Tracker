/**
 * SpyKit Pixel v2.0
 * Modular, class-based architecture.
 */
(function (window, document) {
    'use strict';

    // --- Utils ---
    /**
     * Utility functions helper.
     */
    const Utils = {
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
         * Generates a basic browser fingerprint.
         * Used as a fallback for visitor identification.
         * @returns {string} Fingerprint hash
         */
        generateFingerprint: () => {
            try {
                // Simplified fingerprint for visitor_id generation fallback
                const fp = [
                    navigator.userAgent,
                    screen.width + 'x' + screen.height,
                    new Date().getTimezoneOffset(),
                    navigator.language
                ].join('|');
                
                let hash = 0;
                for (let i = 0; i < fp.length; i++) {
                    const char = fp.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return 'fp_' + Math.abs(hash).toString(36);
            } catch (e) {
                return 'rn_' + Math.random().toString(36).substr(2, 12);
            }
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

    // --- Configuration ---
    /**
     * Manages pixel configuration settings.
     */
    class SpyConfig {
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
                
                // Multi-domain
                domains: [],
                domainSync: false,
                
                // Internals
                namespace: 'spyKit_',
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
                domains: v => Array.isArray(v)
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

    // --- Storage (Cookie + LocalStorage) ---
    /**
     * Wrapper for Cookies and LocalStorage persistence.
     */
    class SpyStorage {
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
                d.setTime(d.getTime() + 24*60*60*1000*days);
                const domain = this.getRootDomain();
                document.cookie = `${name}=${value};path=/;expires=${d.toGMTString()};domain=${domain};SameSite=Lax`;
            } catch(e) {}
        }

        /**
         * Gets a value from LocalStorage.
         * @param {string} key Key name
         * @returns {string|null} Value
         */
        getLocalStorage(key) {
            try { return localStorage.getItem(key); } catch(e) { return null; }
        }

        /**
         * Sets a value to LocalStorage.
         * @param {string} key Key name
         * @param {string} value Value
         */
        setLocalStorage(key, value) {
            try { localStorage.setItem(key, value); } catch(e) {}
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

    // --- Device Information ---
    /**
     * Collects device, screen, and browser information.
     */
    class SpyDevice {
        constructor() {
            this.adBlockActive = null;
            this.checkAdBlock();
        }

        /**
         * Gathers all available device info.
         * @returns {Object} Device information object
         */
        getInfo() {
            return {
                screenWidth: screen.width,
                screenHeight: screen.height,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                screenAvailWidth: screen.availWidth,
                screenAvailHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio || 1,
                orientation: (screen.orientation ? screen.orientation.type : '') || (window.orientation || ''),
                
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],
                
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                webdriver: navigator.webdriver,
                pdfViewerEnabled: navigator.pdfViewerEnabled,
                doNotTrack: navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
                cookieEnabled: navigator.cookieEnabled,
                
                adBlock: this.adBlockActive,
                
                gpuRenderer: this.getGPU(),
                performance: this.getPerformance(),
                connection: this.getConnection()
            };
        }

        /**
         * Extracts GPU renderer info via WebGL.
         * @returns {string|null} GPU Renderer string
         */
        getGPU() {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) return null;
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null;
            } catch(e) { return null; }
        }

        /**
         * Collects navigation performance metrics.
         * @returns {Object|null} Performance metrics (TTFB, Load, etc.)
         */
        getPerformance() {
            if (!window.performance || !window.performance.getEntriesByType) return null;
            const nav = window.performance.getEntriesByType('navigation')[0];
            if (!nav) return null;
            
            return {
                ttfb: Math.round(nav.responseStart - nav.requestStart),
                domLoad: Math.round(nav.domContentLoadedEventEnd - nav.requestStart),
                fullLoad: Math.round(nav.loadEventEnd > 0 ? (nav.loadEventEnd - nav.requestStart) : 0)
            };
        }

        /**
         * Gets network connection info.
         * @returns {Object|null} Connection info
         */
        getConnection() {
            const c = navigator.connection;
            return c ? {
                effectiveType: c.effectiveType,
                downlink: c.downlink,
                rtt: c.rtt,
                saveData: c.saveData
            } : null;
        }

        /**
         * Checks for AdBlock presence by injecting a bait element.
         */
        checkAdBlock() {
            if (!document.body) {
                window.addEventListener('DOMContentLoaded', () => this.checkAdBlock());
                return;
            }
            try {
                const ad = document.createElement('div');
                ad.className = 'adsbox banner-ads';
                ad.style.cssText = 'position:absolute;top:-999px;left:-999px;height:1px;width:1px;';
                document.body.appendChild(ad);
                
                setTimeout(() => {
                    this.adBlockActive = (ad.offsetParent === null || ad.offsetHeight === 0);
                    if (ad.parentNode) ad.parentNode.removeChild(ad);
                }, 100);
            } catch(e) { this.adBlockActive = false; }
        }
    }

    // --- Session Management ---
    /**
     * Manages User, Visitor, and Session IDs.
     */
    class SpySession {
        /**
         * @param {SpyStorage} storage Storage instance
         * @param {SpyConfig} config Config instance
         */
        constructor(storage, config) {
            this.storage = storage;
            this.config = config;
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
                id = Utils.generateFingerprint(); // Use fingerprint-based ID for stability
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
            } catch(e) {}

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
         * @returns {Object} {uid, device_id, session_id}
         */
        getContext() {
            return {
                uid: this.userId,
                device_id: this.visitorId,
                session_id: this.sessionId
            };
        }
    }

    // --- Transport (Batching & Sending) ---
    /**
     * Handles data transport, batching, and retries.
     */
    class SpyTransport {
        /**
         * @param {SpyConfig} config Config instance
         * @param {SpyStorage} storage Storage instance
         */
        constructor(config, storage) {
            this.config = config;
            this.storage = storage;
            this.queue = [];
            this.timer = null;
            
            // Retry background worker
            setInterval(() => this.retryFailed(), this.config.get('retryInterval'));
            
            // Flush on unload
            window.addEventListener('beforeunload', () => this.flush(true));
            window.addEventListener('pagehide', () => this.flush(true));
        }

        /**
         * Queues an event for sending.
         * @param {Object} payload Event payload
         */
        send(payload) {
            this.queue.push(payload);
            Utils.log(this.config.get('debug'), 'Queued event:', payload.event_name);

            if (this.queue.length >= this.config.get('batchSize')) {
                this.flush();
            } else if (!this.timer && this.config.get('batchSize') > 1) {
                this.timer = setTimeout(() => this.flush(), this.config.get('batchTimeout') * 1000);
            } else if (this.config.get('batchSize') === 1) {
                this.flush();
            }
        }

        /**
         * Flushes the event queue to the server.
         * @param {boolean} useBeacon Whether to use Navigator.sendBeacon
         */
        flush(useBeacon = false) {
            if (this.queue.length === 0) return;
            
            const batch = [...this.queue];
            this.queue = [];
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }

            const endpoint = this.config.getEndpointUrl();
            // Send object if single, array if batch
            const body = batch.length === 1 ? JSON.stringify(batch[0]) : JSON.stringify(batch);

            if (useBeacon && navigator.sendBeacon) {
                navigator.sendBeacon(endpoint, body);
            } else {
                this.sendXHR(endpoint, body, batch);
            }
        }

        /**
         * Sends data via XHR with retry logic.
         * @param {string} url Endpoint URL
         * @param {string} body JSON string body
         * @param {Array} originalBatch Original batch object for retry
         * @param {number} retryCount Current retry attempt
         */
        sendXHR(url, body, originalBatch, retryCount = 0) {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    Utils.log(this.config.get('debug'), 'Sent batch', originalBatch);
                } else if (xhr.status >= 500 || xhr.status === 429) {
                    this.handleFail(originalBatch, retryCount);
                }
            };
            
            xhr.onerror = () => this.handleFail(originalBatch, retryCount);
            xhr.send(body);
        }

        /**
         * Handles failed requests (retry or save).
         * @param {Array} batch Batch data
         * @param {number} retryCount Retry count
         */
        handleFail(batch, retryCount) {
            const maxRetries = this.config.get('maxRetries');
            if (retryCount < maxRetries) {
                const delay = this.config.get('retryDelay') * Math.pow(2, retryCount);
                setTimeout(() => {
                    const body = JSON.stringify(batch);
                    this.sendXHR(this.config.getEndpointUrl(), body, batch, retryCount + 1);
                }, delay);
            } else {
                this.saveFailed(batch);
            }
        }

        /**
         * Saves failed events to LocalStorage for later retry.
         * @param {Array} batch Batch data
         */
        saveFailed(batch) {
            try {
                let failed = JSON.parse(this.storage.get('failed') || '[]');
                batch.forEach(event => {
                    failed.push({ event, ts: Date.now(), attempts: this.config.get('maxRetries') });
                });
                // Cap storage
                if (failed.length > this.config.get('maxFailedEvents')) {
                    failed = failed.slice(-this.config.get('maxFailedEvents'));
                }
                this.storage.set('failed', JSON.stringify(failed));
            } catch(e) {}
        }

        /**
         * Retries sending failed events from storage.
         */
        retryFailed() {
            const failedData = this.storage.get('failed');
            if (!failedData) return;
            
            try {
                let failed = JSON.parse(failedData);
                const now = Date.now();
                const ttl = this.config.get('failedEventsTTL');
                
                // Filter expired
                failed = failed.filter(f => (now - f.ts) < ttl);
                
                if (failed.length > 0) {
                    const batch = failed.map(f => f.event);
                    this.sendXHR(this.config.getEndpointUrl(), JSON.stringify(batch), batch);
                    this.storage.set('failed', '[]'); // Clear after retry attempt
                }
            } catch(e) {}
        }
    }

    // --- Automatic Events ---
    /**
     * Handles automatic event tracking (clicks, scroll, forms, etc).
     */
    class SpyAutoEvents {
        /**
         * @param {SpyPixel} pixel Main pixel instance
         * @param {SpyConfig} config Config instance
         */
        constructor(pixel, config) {
            this.pixel = pixel;
            this.config = config;
            this.init();
        }

        /**
         * Initializes enabled trackers.
         */
        init() {
            if (this.config.get('scrollTracking')) this.trackScroll();
            if (this.config.get('clickTracking')) this.trackClicks();
            if (this.config.get('formTracking')) this.trackForms();
            if (this.config.get('visibilityTracking')) this.trackVisibility();
            if (this.config.get('downloadTracking')) this.trackDownloads();
            
            this.trackHistory();
        }

        /**
         * Tracks scroll depth.
         */
        trackScroll() {
            let maxScroll = 0;
            let timer = null;
            window.addEventListener('scroll', () => {
                const percent = Math.round((window.pageYOffset + window.innerHeight) / document.body.scrollHeight * 100);
                if (percent > maxScroll) {
                    maxScroll = percent;
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        this.pixel.track('scroll', { depth: Math.min(maxScroll, 100) });
                    }, 500);
                }
            }, { passive: true });
        }

        /**
         * Tracks clicks on links and downloads.
         */
        trackClicks() {
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (!link) return;
                
                const href = link.href;
                const hostname = link.hostname;
                const currentHost = window.location.hostname;
                
                if (hostname && hostname !== currentHost && this.config.get('clickTracking')) {
                    const isInternal = this.isInternalDomain(hostname);
                    this.pixel.track(isInternal ? 'internal_click' : 'external_click', {
                        url: href,
                        text: link.textContent?.trim(),
                        domain: hostname,
                        is_cross_domain: isInternal
                    });
                }
                
                // Downloads
                if (this.config.get('downloadTracking')) {
                     const ext = href.split('.').pop()?.toLowerCase();
                     if (ext && /^(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|exe|mp3|mp4|avi|mov)$/.test(ext)) {
                         this.pixel.track('file_download', { url: href, extension: ext, filename: href.split('/').pop() });
                     }
                }
            });
        }
        
        /**
         * Checks if a domain is internal (configured).
         * @param {string} hostname Domain to check
         * @returns {boolean} True if internal
         */
        isInternalDomain(hostname) {
            const domains = this.config.get('domains') || [];
            return domains.includes(hostname) || domains.some(d => hostname.endsWith('.' + d));
        }

        /**
         * Tracks form submissions.
         */
        trackForms() {
            document.addEventListener('submit', (e) => {
                const form = e.target;
                if (form.tagName !== 'FORM') return;
                
                const fieldNames = Array.from(form.elements)
                    .filter(el => el.name && el.type !== 'submit' && el.type !== 'password')
                    .map(el => el.name);
                    
                this.pixel.track('form_submit', {
                    id: form.id,
                    action: form.action,
                    fields: fieldNames
                });
            });
        }

        /**
         * Tracks page visibility changes.
         */
        trackVisibility() {
            let visibleStart = Date.now();
            let isVisible = !document.hidden;
            
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && isVisible) {
                     this.pixel.track('page_hidden', { time_visible: Math.round((Date.now() - visibleStart)/1000) });
                     isVisible = false;
                } else if (!document.hidden && !isVisible) {
                    this.pixel.track('page_visible', {});
                    visibleStart = Date.now();
                    isVisible = true;
                }
            });
        }
        
        trackDownloads() {
            // Handled in trackClicks to avoid duplicate listeners
        }

        /**
         * Tracks History API changes (SPA navigation).
         */
        trackHistory() {
             const pushState = history.pushState;
             history.pushState = function() {
                 pushState.apply(this, arguments);
                 window.dispatchEvent(new Event('spy:location'));
             };
             window.addEventListener('popstate', () => window.dispatchEvent(new Event('spy:location')));
             window.addEventListener('spy:location', () => this.pixel.track('pageview'));
        }
    }

    // --- Main Pixel Class ---
    /**
     * Main controller for SpyKit Pixel.
     */
    class SpyPixel {
        constructor() {
            this.config = new SpyConfig();
            this.storage = new SpyStorage(this.config);
            this.session = null; // initialized after config
            this.device = new SpyDevice();
            this.transport = null;
            this.autoEvents = null;
            
            this.processQueue();
        }

        /**
         * Initializes the pixel after config is ready.
         */
        init() {
            this.session = new SpySession(this.storage, this.config);
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
        track(eventName, data = {}) {
            if (!this.transport) return; // Wait for config
            
            const sessionCtx = this.session.getContext();
            
            const deviceInfo = this.device.getInfo();
            
            const payload = {
                event_name: eventName,
                timestamp: Date.now() / 1000,
                
                // IDs
                uid: sessionCtx.uid,
                device_id: sessionCtx.device_id,
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
             ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k => {
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

})(window, document);
