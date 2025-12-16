import { Utils } from './utils.js';

/**
 * Handles data transport, batching, and retries.
 */
export class SpyTransport {
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
        } catch (e) { }
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
        } catch (e) { }
    }
}

