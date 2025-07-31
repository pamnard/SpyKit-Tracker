(function () {
    // --- Default configuration ---
    const config = {
        baseUrl: null, // REQUIRED: must be set via config
        sessionTimeout: 30, // minutes
        maxRetries: 3, // maximum retry attempts
        retryDelay: 1000, // base delay in ms
        batchSize: 1, // batch size (1 = disabled)
        batchTimeout: 5, // batch timeout in seconds

        // Automatic events
        scrollTracking: true,
        clickTracking: true,
        formTracking: true,
        downloadTracking: true,
        visibilityTracking: true,

        // Multi-domain support
        domains: [], // list of own domains

        // Internal settings
        namespace: 'spyKit_', // namespace for localStorage keys
        maxFailedEvents: 50, // maximum failed events in localStorage
        failedEventsTTL: 24 * 60 * 60 * 1000, // TTL for failed events (24 hours)
        retryInterval: 60 * 1000, // retry interval (1 minute)

        // Debug
        debug: false,

        // Cross-domain synchronization
        domainSync: false // enable visitor_id sync between domains
    };

    // --- Generate endpoints from base URL ---
    function getEndpoint() {
        if (!config.baseUrl) {
            throw new Error('[spyKit] baseUrl not configured. Please set it via _spy.push([\"config\", \"baseUrl\", \"https://your-server.com\"]);');
        }
        return config.baseUrl.replace(/\/$/, '') + '/track';
    }

    function getBatchEndpoint() {
        if (!config.baseUrl) {
            throw new Error('[spyKit] baseUrl not configured. Please set it via _spy.push([\"config\", \"baseUrl\", \"https://your-server.com\"]);');
        }
        return config.baseUrl.replace(/\/$/, '') + '/track/batch';
    }

    // --- UTM parameters ---
    function getUTMs() {
        const params = new URLSearchParams(window.location.search);
        const utms = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => {
            if (params.has(key)) utms[key] = params.get(key);
        });
        return utms;
    }

    // --- Device information ---
    function getDeviceInfo() {
        const ua = navigator.userAgentData;
        return {
            screenWidth: screen.width,
            screenHeight: screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio || 1,
            language: navigator.language,
            languages: navigator.languages ? navigator.languages.join(',') : '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userAgent: navigator.userAgent,
            // Modern User-Agent Client Hints API
            uaCH: ua ? {
                brands: ua.brands?.map(b => `${b.brand}/${b.version}`).join(', ') || '',
                mobile: ua.mobile,
                platform: ua.platform,
                architecture: ua.getHighEntropyValues ? null : undefined, // will be filled async
                model: ua.getHighEntropyValues ? null : undefined,
                platformVersion: ua.getHighEntropyValues ? null : undefined,
                uaFullVersion: ua.getHighEntropyValues ? null : undefined
            } : null,
            // Fallback for older browsers
            platform: ua?.platform || navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            hardwareConcurrency: navigator.hardwareConcurrency || 0,
            deviceMemory: navigator.deviceMemory || 0,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
    }

    // --- Generate fingerprint for stable ID ---
    function generateFingerprint() {
        try {
            const fp = {
                screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                timezoneOffset: new Date().getTimezoneOffset(),
                language: navigator.language,
                languages: navigator.languages ? navigator.languages.join(',') : '',
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                hardwareConcurrency: navigator.hardwareConcurrency || 0,
                deviceMemory: navigator.deviceMemory || 0,
                pixelRatio: window.devicePixelRatio || 1,
                touchSupport: 'ontouchstart' in window,
                maxTouchPoints: navigator.maxTouchPoints || 0,
                // Canvas fingerprint (passive)
                canvas: (function () {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        ctx.textBaseline = 'top';
                        ctx.font = '14px Arial';
                        ctx.fillText('spyKit', 2, 2);
                        return canvas.toDataURL().substr(-50); // only last 50 characters
                    } catch (e) {
                        return '';
                    }
                })()
            };

            // Simple hash function
            const fingerprint = JSON.stringify(fp);
            let hash = 0;
            for (let i = 0; i < fingerprint.length; i++) {
                const char = fingerprint.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 32bit integer
            }

            return 'fp_' + Math.abs(hash).toString(36);
        } catch (e) {
            // Fallback if something went wrong
            return 'fb_' + Math.random().toString(36).substr(2, 12) + Date.now();
        }
    }

    // --- Cookie utilities ---
    function setCookie(name, value, days = 365) {
        try {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));

            // Get root domain (example.com from shop.example.com)
            const hostname = window.location.hostname;
            const parts = hostname.split('.');
            const rootDomain = parts.length > 2 ? '.' + parts.slice(-2).join('.') : hostname;

            const expires = `expires=${date.toUTCString()}`;
            const cookieValue = `${name}=${value}; ${expires}; domain=${rootDomain}; path=/; SameSite=Lax`;

            document.cookie = cookieValue;
            debugLog(`Cookie set: ${name}=${value} for domain ${rootDomain}`);
            return true;
        } catch (e) {
            debugLog('Could not set cookie:', e.message);
            return false;
        }
    }

    function getCookie(name) {
        try {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) {
                    return c.substring(nameEQ.length, c.length);
                }
            }
            return null;
        } catch (e) {
            debugLog('Could not get cookie:', e.message);
            return null;
        }
    }

    function getStoredValue(key) {
        // Try cookie first
        let value = getCookie(key);

        // Fallback to localStorage
        if (!value) {
            try {
                value = localStorage.getItem(key);
            } catch (e) {
                debugLog('Could not access localStorage:', e.message);
            }
        }

        return value;
    }

    function setStoredValue(key, value) {
        // Try cookie first
        const cookieSet = setCookie(key, value);

        // Duplicate in localStorage as backup
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            debugLog('Could not save to localStorage:', e.message);
        }

        return cookieSet;
    }

    // --- User IDs ---
    function getOrSetId(key) {
        let id = getStoredValue(key);
        if (!id) {
            // Try to use fingerprint, otherwise random
            if (key.includes('visitor_id')) {
                id = generateFingerprint();
                debugLog('Generated visitor_id from fingerprint:', id);
            } else {
                id = Math.random().toString(36).substr(2, 12) + Date.now();
            }

            // Save to cookie + localStorage
            setStoredValue(key, id);
        }
        return id;
    }
    let user_id = getStoredValue(config.namespace + 'user_id'); // for CRM ID linking
    const visitor_id = getOrSetId(config.namespace + 'visitor_id'); // analog of client_id in GA4

    // --- session_id with timeout ---
    function getSessionId(timeoutMinutes = 30) {
        const now = Date.now();
        let session = {};
        try {
            const sessionData = getStoredValue(config.namespace + 'session');
            session = JSON.parse(sessionData || '{}');
        } catch (e) {
            session = {};
        }
        if (!session.id || !session.ts || now - session.ts > timeoutMinutes * 60 * 1000) {
            session = {
                id: Math.random().toString(36).substr(2, 12) + now,
                ts: now
            };
            setStoredValue(config.namespace + 'session', JSON.stringify(session));
        } else {
            // update last activity time
            session.ts = now;
            setStoredValue(config.namespace + 'session', JSON.stringify(session));
        }
        return session.id;
    }
    function getSessionIdWithTimeout() {
        return getSessionId(config.sessionTimeout);
    }

    // --- Function to set user_id from CRM ---
    function setUserId(crm_user_id) {
        if (crm_user_id) {
            user_id = crm_user_id;
            setStoredValue(config.namespace + 'user_id', crm_user_id);
            debugLog('User ID set:', crm_user_id);
        }
    }

    // --- Validation ---
    function validateConfig(key, value) {
        const validators = {
            baseUrl: (v) => typeof v === 'string' && v.length > 0,
            namespace: (v) => typeof v === 'string' && v.length > 0,
            domains: (v) => Array.isArray(v) && v.every(d => typeof d === 'string'),
            batchSize: (v) => typeof v === 'number' && v >= 1 && v <= 1000,
            batchTimeout: (v) => typeof v === 'number' && v > 0 && v <= 300,
            sessionTimeout: (v) => typeof v === 'number' && v > 0 && v <= 1440, // up to 24 hours
            maxRetries: (v) => typeof v === 'number' && v >= 0 && v <= 10,
            retryDelay: (v) => typeof v === 'number' && v >= 100 && v <= 60000,
            maxFailedEvents: (v) => typeof v === 'number' && v >= 1 && v <= 10000,
            failedEventsTTL: (v) => typeof v === 'number' && v > 0,
            retryInterval: (v) => typeof v === 'number' && v >= 1000 && v <= 600000, // 1 sec to 10 min
            scrollTracking: (v) => typeof v === 'boolean',
            clickTracking: (v) => typeof v === 'boolean',
            formTracking: (v) => typeof v === 'boolean',
            downloadTracking: (v) => typeof v === 'boolean',
            visibilityTracking: (v) => typeof v === 'boolean',
            debug: (v) => typeof v === 'boolean',
            domainSync: (v) => typeof v === 'boolean'
        };

        const validator = validators[key];
        if (!validator) {
            debugLog(`Unknown config key: ${key}`);
            return false;
        }

        if (!validator(value)) {
            console.error(`[spyKit] Invalid config value for ${key}: ${JSON.stringify(value)}`);
            return false;
        }

        return true;
    }

    function validateEvent(event, data) {
        if (typeof event !== 'string' || event.length === 0) {
            console.error(`[spyKit] Invalid event name: ${JSON.stringify(event)}`);
            return false;
        }

        if (event.length > 100) {
            console.error(`[spyKit] Event name too long (max 100 chars): ${event}`);
            return false;
        }

        if (data !== null && data !== undefined && typeof data !== 'object') {
            console.error(`[spyKit] Event data must be an object: ${typeof data}`);
            return false;
        }

        // Check data size
        try {
            const serialized = JSON.stringify(data);
            if (serialized.length > 10000) { // 10KB limit
                console.error(`[spyKit] Event data too large (max 10KB): ${serialized.length} bytes`);
                return false;
            }
        } catch (e) {
            console.error(`[spyKit] Event data not serializable:`, e);
            return false;
        }

        return true;
    }

    function validateUserId(userId) {
        if (typeof userId !== 'string' || userId.length === 0) {
            console.error(`[spyKit] Invalid userId: ${JSON.stringify(userId)}`);
            return false;
        }

        if (userId.length > 200) {
            console.error(`[spyKit] UserId too long (max 200 chars): ${userId}`);
            return false;
        }

        return true;
    }

    // --- Command processing ---
    function processCommand(command) {
        if (!Array.isArray(command) || command.length === 0) {
            console.error(`[spyKit] Invalid command format: ${JSON.stringify(command)}`);
            return;
        }

        const [action, ...args] = command;

        if (typeof action !== 'string') {
            console.error(`[spyKit] Invalid action type: ${typeof action}`);
            return;
        }

        switch (action) {
            case 'config':
                const [key, value] = args;
                if (validateConfig(key, value)) {
                    config[key] = value;
                    debugLog(`Config updated: ${key} = ${JSON.stringify(value)}`);
                }
                break;

            case 'track':
                const [event, data = {}] = args;
                if (validateEvent(event, data)) {
                    sendEvent(event, data);
                }
                break;

            case 'setUserId':
                const [userId] = args;
                if (validateUserId(userId)) {
                    setUserId(userId);
                }
                break;

            case 'debug':
                const [enable = true] = args;
                if (typeof enable === 'boolean') {
                    setDebugMode(enable);
                } else {
                    console.error(`[spyKit] Invalid debug value: ${typeof enable}`);
                }
                break;

            default:
                console.error(`[spyKit] Unknown command: ${action}`);
        }
    }

    function setDebugMode(enable) {
        config.debug = enable;
        if (enable) {
            console.log('[spyKit] Debug mode enabled');
            console.log('[spyKit] Config:', config);
            console.log('[spyKit] IDs:', {
                user_id,
                visitor_id,
                session_id: getSessionIdWithTimeout()
            });
        } else {
            console.log('[spyKit] Debug mode disabled');
        }
    }

    function debugLog(message, data = null) {
        if (config.debug) {
            if (data) {
                console.log(`[spyKit] ${message}`, data);
            } else {
                console.log(`[spyKit] ${message}`);
            }
        }
    }

    // --- Multi-domain utilities ---
    function isInternalDomain(hostname) {
        if (!hostname || config.domains.length === 0) return false;

        // Check exact matches
        if (config.domains.includes(hostname)) {
            return true;
        }

        // Check subdomains (e.g., blog.example.com for example.com)
        return config.domains.some(domain => {
            return hostname.endsWith('.' + domain) || domain.endsWith('.' + hostname);
        });
    }

    function getEventTypeForLink(hostname, href) {
        if (isInternalDomain(hostname)) {
            return 'internal_click';
        } else {
            return 'external_click';
        }
    }

    // --- Event batching ---
    let eventBatch = [];
    let batchTimer = null;

    function flushBatch() {
        if (eventBatch.length === 0) return;

        const batch = [...eventBatch];
        eventBatch = [];

        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }

        if (batch.length === 1) {
            // Send single event as usual
            const payloadString = JSON.stringify(batch[0]);
            debugLog(`Sending single event: ${batch[0].event}`, batch[0]);
            sendWithRetryLogic(payloadString, batch[0], false);
        } else {
            // Send batch to separate endpoint
            const batchPayload = {
                events: batch
            };
            const payloadString = JSON.stringify(batchPayload);
            debugLog(`Sending batch of ${batch.length} events`, batch.map(e => e.event));
            sendWithRetryLogic(payloadString, batchPayload, true);
        }
    }

    function addToBatch(payload) {
        eventBatch.push(payload);
        debugLog(`Added event to batch: ${payload.event} (batch size: ${eventBatch.length}/${config.batchSize})`);

        // Check batch size
        if (eventBatch.length >= config.batchSize) {
            debugLog('Batch size limit reached, flushing batch');
            flushBatch();
            return;
        }

        // Set timer if not exists
        if (batchTimer === null && config.batchSize > 1) {
            debugLog(`Setting batch timer for ${config.batchTimeout}s`);
            batchTimer = setTimeout(function () {
                debugLog('Batch timeout reached, flushing batch');
                flushBatch();
            }, config.batchTimeout * 1000);
        }
    }

    // Send batch on page unload
    function handlePageUnload() {
        if (eventBatch.length > 0) {
            debugLog(`Page unload: sending ${eventBatch.length} pending events via beacon`);
            // Force send via sendBeacon for reliability
            const batch = [...eventBatch];
            eventBatch = [];

            if (batch.length === 1) {
                navigator.sendBeacon(getEndpoint(), JSON.stringify(batch[0]));
            } else {
                const batchPayload = {
                    events: batch
                };
                navigator.sendBeacon(getBatchEndpoint(), JSON.stringify(batchPayload));
            }
        }
    }

    // Listen to page unload events
    window.addEventListener('beforeunload', handlePageUnload);
    window.addEventListener('pagehide', handlePageUnload);
    window.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            handlePageUnload();
        }
    });

    // --- Local storage for failed events ---
    function saveFailedEvent(payload) {
        try {
            const failedData = getStoredValue(config.namespace + 'failed');
            const failed = JSON.parse(failedData || '[]');
            failed.push({
                payload: payload,
                attempts: 0,
                ts: Date.now()
            });
            // Limit number of saved events
            if (failed.length > config.maxFailedEvents) {
                failed.splice(0, failed.length - config.maxFailedEvents);
            }
            setStoredValue(config.namespace + 'failed', JSON.stringify(failed));
        } catch (e) {
            // Ignore storage errors
        }
    }

    function getFailedEvents() {
        try {
            const failedData = getStoredValue(config.namespace + 'failed');
            return JSON.parse(failedData || '[]');
        } catch (e) {
            return [];
        }
    }

    function removeFailedEvent(index) {
        try {
            const failed = getFailedEvents();
            failed.splice(index, 1);
            setStoredValue(config.namespace + 'failed', JSON.stringify(failed));
        } catch (e) {
            // Ignore storage errors
        }
    }

    // --- Sending with retry mechanism ---
    function sendWithRetry(payloadString, retryCount = 0, isBatch = false) {
        const targetEndpoint = isBatch ? getBatchEndpoint() : getEndpoint();

        return new Promise((resolve, reject) => {
            // Try sending via sendBeacon (first attempt only)
            if (retryCount === 0 && navigator.sendBeacon && navigator.sendBeacon(targetEndpoint, payloadString)) {
                resolve();
                return;
            }

            // Fallback: fetch with keepalive
            if (window.fetch) {
                fetch(targetEndpoint, {
                    method: 'POST',
                    body: payloadString,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: retryCount === 0 // keepalive for first attempt only
                }).then(response => {
                    if (response.ok) {
                        resolve();
                    } else {
                        const error = new Error(`HTTP ${response.status}`);
                        error.shouldRetry = response.status < 400; // don't retry 400+ errors
                        reject(error);
                    }
                }).catch(error => {
                    error.shouldRetry = true; // network errors can be retried
                    reject(error);
                });
                return;
            }

            // Fallback: XMLHttpRequest (for older browsers)
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', targetEndpoint, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        const error = new Error(`HTTP ${xhr.status}`);
                        error.shouldRetry = xhr.status < 400; // don't retry 400+ errors
                        reject(error);
                    }
                };
                xhr.onerror = function () {
                    const error = new Error('Network error');
                    error.shouldRetry = true; // network errors can be retried
                    reject(error);
                };
                xhr.send(payloadString);
            } catch (e) {
                reject(e);
            }
        });
    }

    // --- Send logic with retry ---
    function sendWithRetryLogic(payloadString, originalPayload, isBatch = false) {
        function attemptSend(retryCount = 0) {
            const eventName = originalPayload.event || (originalPayload.events ? `batch(${originalPayload.events.length})` : 'unknown');
            debugLog(`Attempting to send ${eventName} (try ${retryCount + 1}/${config.maxRetries + 1})`);

            sendWithRetry(payloadString, retryCount, isBatch)
                .then(() => {
                    debugLog(`Successfully sent ${eventName}`);
                })
                .catch((error) => {
                    debugLog(`Failed to send ${eventName}: ${error.message}`);

                    // Don't retry for 400+ errors
                    if (error.shouldRetry !== false && retryCount < config.maxRetries) {
                        // Exponential backoff: 1s, 2s, 4s, 8s...
                        const delay = config.retryDelay * Math.pow(2, retryCount);
                        debugLog(`Retrying ${eventName} in ${delay}ms`);
                        setTimeout(function () {
                            attemptSend(retryCount + 1);
                        }, delay);
                    } else if (error.shouldRetry !== false) {
                        // Save event for later retry (only if retryable)
                        debugLog(`Saving ${eventName} for later retry`);
                        saveFailedEvent(originalPayload);
                    } else {
                        debugLog(`Dropping ${eventName} due to 400+ error`);
                    }
                });
        }

        attemptSend();
    }

    // --- Main event sending function ---
    function sendEvent(event, data = {}) {
        debugLog(`Event triggered: ${event}`, data);

        const payload = {
            event,
            data,
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            ts: Date.now(),
            user_id,
            visitor_id,
            session_id: getSessionIdWithTimeout(),
            utm: getUTMs(),
            device: getDeviceInfo(),
        };

        // Add to batch or send immediately
        if (config.batchSize > 1) {
            addToBatch(payload);
        } else {
            const payloadString = JSON.stringify(payload);
            sendWithRetryLogic(payloadString, payload);
        }
    }

    // --- Retry failed events ---
    function retryFailedEvents() {
        const failed = getFailedEvents();
        failed.forEach((item, index) => {
            if (item.attempts < config.maxRetries) {
                const payloadString = JSON.stringify(item.payload);
                sendWithRetry(payloadString, item.attempts)
                    .then(() => {
                        removeFailedEvent(index);
                    })
                    .catch(() => {
                        // Increase attempt counter
                        item.attempts++;
                        if (item.attempts >= config.maxRetries) {
                            // Remove events older than TTL or exceeding retry limit
                            if (Date.now() - item.ts > config.failedEventsTTL) {
                                removeFailedEvent(index);
                            }
                        }
                    });
            }
        });
    }

    // Periodic retry of failed events
    let retryIntervalId = setInterval(retryFailedEvents, config.retryInterval);

    // --- SPA: track navigation (history API) ---
    function hookHistory(fn) {
        const orig = history[fn];
        history[fn] = function () {
            const ret = orig.apply(this, arguments);
            window.dispatchEvent(new Event('spyKit:locationchange'));
            return ret;
        };
    }
    hookHistory('pushState');
    hookHistory('replaceState');
    window.addEventListener('popstate', function () {
        window.dispatchEvent(new Event('spyKit:locationchange'));
    });
    window.addEventListener('spyKit:locationchange', function () {
        sendEvent('pageview', {});
    });

    // --- Process command queue if called before script loading ---
    if (window._spy && Array.isArray(window._spy)) {
        window._spy.forEach(function (command) {
            if (Array.isArray(command)) {
                processCommand(command);
            }
        });
    }

    // --- Replace _spy with command processing function ---
    window._spy = {
        push: function () {
            Array.from(arguments).forEach(function (command) {
                if (Array.isArray(command)) {
                    processCommand(command);
                }
            });
        }
    };

    // --- Automatic events ---

    // Scroll tracking
    if (config.scrollTracking) {
        let maxScroll = 0;
        let scrollTimeout = null;

        function trackScroll() {
            const scrollPercent = Math.round((window.pageYOffset + window.innerHeight) / document.body.scrollHeight * 100);
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;

                // Send event with delay to avoid spam
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(function () {
                    sendEvent('scroll', {
                        depth: Math.min(maxScroll, 100)
                    });
                }, 500);
            }
        }

        window.addEventListener('scroll', trackScroll, { passive: true });
    }

    // Click tracking for external links and files
    if (config.clickTracking || config.downloadTracking) {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.href;
            const hostname = link.hostname;
            const currentHostname = window.location.hostname;

            // Check links (internal/external)
            if (config.clickTracking && hostname && hostname !== currentHostname) {
                const eventType = getEventTypeForLink(hostname, href);
                const eventData = {
                    url: href,
                    text: link.textContent?.trim() || '',
                    domain: hostname
                };

                // Add additional info for internal navigation
                if (eventType === 'internal_click') {
                    eventData.is_cross_domain = true;
                }

                sendEvent(eventType, eventData);
                debugLog(`${eventType} detected: ${hostname}`);
            }

            // Check file downloads
            if (config.downloadTracking) {
                const fileExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|mp3|mp4|avi|mov|wmv|flv|jpg|jpeg|png|gif|svg)$/i;
                if (fileExtensions.test(href)) {
                    sendEvent('file_download', {
                        url: href,
                        filename: href.split('/').pop(),
                        extension: href.split('.').pop()?.toLowerCase() || ''
                    });
                }
            }
        });
    }

    // Form submit tracking
    if (config.formTracking) {
        document.addEventListener('submit', function (e) {
            const form = e.target;
            if (form.tagName === 'FORM') {
                const formData = {
                    id: form.id || '',
                    action: form.action || '',
                    method: form.method || 'get',
                    fields_count: form.elements.length
                };

                // Collect field names (without values for privacy)
                const fieldNames = [];
                for (let i = 0; i < form.elements.length; i++) {
                    const field = form.elements[i];
                    if (field.name && field.type !== 'submit' && field.type !== 'button') {
                        fieldNames.push(field.name);
                    }
                }
                formData.field_names = fieldNames;

                sendEvent('form_submit', formData);
            }
        });
    }

    // Page visibility tracking
    if (config.visibilityTracking) {
        let pageShownTime = Date.now();
        let isVisible = !document.hidden;

        function handleVisibilityChange() {
            const now = Date.now();

            if (document.hidden && isVisible) {
                // Page hidden
                const timeVisible = now - pageShownTime;
                sendEvent('page_hidden', {
                    time_visible: Math.round(timeVisible / 1000) // in seconds
                });
                isVisible = false;
            } else if (!document.hidden && !isVisible) {
                // Page visible
                sendEvent('page_visible', {});
                pageShownTime = now;
                isVisible = true;
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Send event on window focus/blur
        window.addEventListener('focus', function () {
            if (!document.hidden) {
                sendEvent('page_focus', {});
                pageShownTime = Date.now();
            }
        });

        window.addEventListener('blur', function () {
            if (!document.hidden) {
                const timeVisible = Date.now() - pageShownTime;
                sendEvent('page_blur', {
                    time_visible: Math.round(timeVisible / 1000)
                });
            }
        });
    }

    // --- Cleanup function to prevent memory leaks ---
    window._spyCleanup = function () {
        // Clear interval
        if (retryIntervalId) {
            clearInterval(retryIntervalId);
            retryIntervalId = null;
        }

        // Clear batch timer
        if (batchTimer) {
            clearTimeout(batchTimer);
            batchTimer = null;
        }

        // Send remaining events
        if (eventBatch.length > 0) {
            flushBatch();
        }

        debugLog('spyKit cleaned up');
    };

    // Automatic cleanup on unload (optional)
    window.addEventListener('beforeunload', window._spyCleanup);

    // --- Cross-domain synchronization ---
    function syncDomainsClientId() {
        if (!config.domainSync || !config.domains || config.domains.length === 0) {
            return;
        }

        const currentDomain = window.location.hostname;
        const syncDomains = config.domains.filter(domain => domain !== currentDomain);

        if (syncDomains.length === 0) {
            return;
        }

        debugLog('Starting domain sync for visitor_id:', visitor_id);

        let completedCount = 0;
        const totalDomains = syncDomains.length;

        // Callback function to track completion
        window._spyKitSyncCallback = function (result) {
            completedCount++;
            debugLog(`Domain sync callback: ${completedCount}/${totalDomains} - ${result}`);

            if (completedCount >= totalDomains) {
                debugLog('Domain sync completed');
                // Clear callback
                delete window._spyKitSyncCallback;
            }
        };

        // Create pixels for each domain
        syncDomains.forEach(function (domain, index) {
            try {
                const img = new Image();
                const syncUrl = `https://${domain}/sync?visitor_id=${encodeURIComponent(visitor_id)}&callback=_spyKitSyncCallback`;

                img.onload = function () {
                    debugLog(`Sync successful for domain: ${domain}`);
                    if (window._spyKitSyncCallback) {
                        window._spyKitSyncCallback('success');
                    }
                };

                img.onerror = function () {
                    debugLog(`Sync failed for domain: ${domain}`);
                    if (window._spyKitSyncCallback) {
                        window._spyKitSyncCallback('error');
                    }
                };

                // Set timeout for request completion
                setTimeout(function () {
                    if (img.complete === false) {
                        debugLog(`Sync timeout for domain: ${domain}`);
                        if (window._spyKitSyncCallback) {
                            window._spyKitSyncCallback('timeout');
                        }
                    }
                }, 5000);

                img.src = syncUrl;

            } catch (e) {
                debugLog(`Error creating sync pixel for ${domain}:`, e.message);
                if (window._spyKitSyncCallback) {
                    window._spyKitSyncCallback('error');
                }
            }
        });
    }

    // --- Automatically send pageview on first load ---
    sendEvent('pageview', {});

    // --- Start domain sync if enabled ---
    if (config.domainSync) {
        // Small delay to not interfere with main page load
        setTimeout(syncDomainsClientId, 1000);
    }
})();