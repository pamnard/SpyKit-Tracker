/**
 * Handles automatic event tracking (clicks, scroll, forms, etc).
 */
export class PixelAutoEvents {
    /**
     * @param {Pixel} pixel Main pixel instance
     * @param {PixelConfig} config Config instance
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
                this.pixel.track('external_click', {
                    url: href,
                    text: link.textContent?.trim(),
                    domain: hostname,
                    is_external: true
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

    trackDownloads() {
        // Handled in trackClicks to avoid duplicate listeners
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
                this.pixel.track('page_hidden', { time_visible: Math.round((Date.now() - visibleStart) / 1000) });
                isVisible = false;
            } else if (!document.hidden && !isVisible) {
                this.pixel.track('page_visible', {});
                visibleStart = Date.now();
                isVisible = true;
            }
        });
    }

    /**
     * Tracks History API changes (SPA navigation).
     */
    trackHistory() {
        const pushState = history.pushState;
        history.pushState = function () {
            pushState.apply(this, arguments);
            window.dispatchEvent(new Event('pixel:location'));
        };
        window.addEventListener('popstate', () => window.dispatchEvent(new Event('pixel:location')));
        window.addEventListener('pixel:location', () => this.pixel.track('pageview'));
    }
}

