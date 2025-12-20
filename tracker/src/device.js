import { Utils } from './utils.js';

/**
 * Collects device, screen, and browser information.
 */
export class PixelDevice {
    constructor() {
        this.adBlockActive = null;
        this.checkAdBlock();

        this.fingerprintData = {
            audio: null,
            canvas: null,
            webgl: null
        };

        this.clientHints = {};
        this.readyPromise = this.initFingerprints();
    }

    /**
     * Waits for heavy calculations to finish (max 1 second).
     */
    async ready() {
        const timeout = new Promise(resolve => setTimeout(resolve, 1000));
        return Promise.race([this.readyPromise, timeout]);
    }

    /**
     * Starts all heavy fingerprinting tasks in parallel.
     */
    async initFingerprints() {
        try {
            await Promise.all([
                this.getAudioFingerprint().then(res => this.fingerprintData.audio = res),
                this.getCanvasFingerprintAsync().then(res => this.fingerprintData.canvas = res),
                this.getWebGLFingerprintAsync().then(res => this.fingerprintData.webgl = res),
                this.getHighEntropyValues().then(res => this.clientHints = res)
            ]);
        } catch (e) {
            console.error('Fingerprint error:', e);
        }
    }

    /**
     * Gets high-entropy Client Hints if available (Chrome-based only).
     * @returns {Promise<Object>} Object with model, platformVersion etc.
     */
    getHighEntropyValues() {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            return navigator.userAgentData.getHighEntropyValues([
                'architecture',
                'model',
                'platformVersion',
                'fullVersionList'
            ]).catch(() => ({}));
        }
        return Promise.resolve({});
    }

    /**
     * Collects audio fingerprint asynchronously.
     * @returns {Promise<string|null>}
     */
    getAudioFingerprint() {
        return new Promise(resolve => {
            try {
                const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!AudioContext) return resolve(null);

                const context = new AudioContext(1, 44100, 44100);
                const oscillator = context.createOscillator();
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(10000, context.currentTime);

                const compressor = context.createDynamicsCompressor();
                [
                    ['threshold', -50],
                    ['knee', 40],
                    ['ratio', 12],
                    ['reduction', -20],
                    ['attack', 0],
                    ['release', 0.25]
                ].forEach(param => {
                    if (compressor[param[0]] && compressor[param[0]].setValueAtTime) {
                        compressor[param[0]].setValueAtTime(param[1], context.currentTime);
                    }
                });

                oscillator.connect(compressor);
                compressor.connect(context.destination);
                oscillator.start(0);

                context.startRendering().then(buffer => {
                    resolve(Utils.hashString(buffer.getChannelData(0).join('')));
                }).catch(() => resolve(null));
            } catch (e) { resolve(null); }
        });
    }

    /**
     * Async wrapper for Canvas fingerprint to avoid UI freeze.
     */
    getCanvasFingerprintAsync() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(this.getCanvasFingerprint());
            }, 0);
        });
    }

    /**
     * Async wrapper for WebGL fingerprint to avoid UI freeze.
     */
    getWebGLFingerprintAsync() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(this.getWebGLFingerprint());
            }, 0);
        });
    }

    /**
     * Detects webview type from user agent and window objects.
     * @returns {string|null} WebView type (e.g., "Telegram", "Facebook") or null if not a webview
     */
    detectWebview() {
        const ua = navigator.userAgent;

        // Telegram WebView Android
        if (ua.includes('Android') && typeof window.TelegramWebview !== 'undefined') {
            return 'Telegram';
        }

        // Telegram WebView iOS
        if (ua.includes('iPhone') && typeof window.TelegramWebviewProxy !== 'undefined' && typeof window.TelegramWebviewProxyProto !== 'undefined') {
            return 'Telegram';
        }

        // Facebook iOS/Android WebView
        if (ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('FBIOS')) {
            return 'Facebook';
        }

        // Instagram WebView (often uses similar pattern to Facebook)
        if (ua.includes('Instagram')) {
            return 'Instagram';
        }

        // WhatsApp WebView
        if (ua.includes('WhatsApp')) {
            return 'WhatsApp';
        }

        // Twitter WebView
        if (ua.includes('Twitter')) {
            return 'Twitter';
        }

        // LinkedIn WebView
        if (ua.includes('LinkedInApp')) {
            return 'LinkedIn';
        }

        // Slack WebView
        if (ua.includes('Slack')) {
            return 'Slack';
        }

        // If no specific webview type detected, return null
        // Backend will check isWebView() and set "Unknown WebView" if needed
        return null;
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
            platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator['platform'],
            hardwareConcurrency: navigator.hardwareConcurrency || null,
            webdriver: navigator.webdriver,

            // Client Hints (High Entropy)
            model: this.clientHints.model || '',
            platformVersion: this.clientHints.platformVersion || '',
            architecture: this.clientHints.architecture || '',

            pdfViewerEnabled: navigator.pdfViewerEnabled,
            doNotTrack: navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
            cookieEnabled: navigator.cookieEnabled,

            adBlock: this.adBlockActive,

            webview: this.detectWebview(),

            gpuRenderer: this.getGPU(),
            performance: this.getPerformance(),
            connection: this.getConnection(),
            fingerprint: {
                canvas: this.fingerprintData.canvas ? Utils.hashString(this.fingerprintData.canvas) : '',
                audio: this.fingerprintData.audio || '',
                webgl: this.fingerprintData.webgl ? Utils.hashString(this.fingerprintData.webgl) : ''
            }
        };
    }

    /**
     * Collects "heavy" fingerprint components for server-side matching.
     * @returns {Object} Fingerprint components
     */
    getFingerprintComponents() {
        return {
            canvas: this.fingerprintData.canvas ? Utils.hashString(this.fingerprintData.canvas) : '',
            audio: this.fingerprintData.audio || '',
            webgl: this.fingerprintData.webgl ? Utils.hashString(this.fingerprintData.webgl) : ''
        };
    }

    /**
     * Generates Canvas fingerprint.
     * @returns {string|null} Canvas data URL
     */
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const txt = "BrowserLeaks, <canvas> 1.0 \uD83D\uDE03";

            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);

            ctx.fillStyle = "#069";
            ctx.fillText(txt, 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText(txt, 4, 17);

            return canvas.toDataURL();
        } catch (e) { return null; }
    }

    /**
     * Generates WebGL fingerprint (draws a gradient triangle).
     * @returns {string|null} Data URL of the rendered scene
     */
    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return null;

            const vShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vShader, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}');
            gl.compileShader(vShader);

            const fShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fShader, 'void main(){gl_FragColor=vec4(1,0.5,0.2,1);}'); // Orange color
            gl.compileShader(fShader);

            const program = gl.createProgram();
            gl.attachShader(program, vShader);
            gl.attachShader(program, fShader);
            gl.linkProgram(program);
            gl.useProgram(program);

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);

            const p = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(p);
            gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, 3);
            return canvas.toDataURL();
        } catch (e) { return null; }
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
        } catch (e) { return null; }
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
        } catch (e) { this.adBlockActive = false; }
    }

    /**
     * Generates a basic browser fingerprint intended to be stable across
     * WebView and standard browser on the same device.
     * Excludes User-Agent and volatile version numbers.
     * @returns {string} Fingerprint hash
     */
    getBasicFingerprint() {
        try {
            // Normalize screen dimensions to handle orientation changes
            const width = screen.width;
            const height = screen.height;
            const res = (width < height) ? `${width}x${height}` : `${height}x${width}`;

            const fp = [
                res,
                screen.colorDepth,
                window.devicePixelRatio,
                navigator.hardwareConcurrency,
                navigator['deviceMemory'], // Available in Chrome-based browsers
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                navigator.language,
                (navigator.userAgentData && navigator.userAgentData.platform) || navigator['platform']
            ].join('|');

            return Utils.hashString(fp);
        } catch (e) {
            return 'rn_' + Math.random().toString(36).substr(2, 12);
        }
    }
}
