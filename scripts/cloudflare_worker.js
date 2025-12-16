export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. Calculate TLS Fingerprint
        // We use available properties in request.cf to create a unique hash for the TLS session.
        // Note: This is not a standard JA3 because CF terminates TLS and we only see what they expose,
        // but it is very effective for detecting bots/tools vs browsers.
        const tlsData = {
            v: request.cf?.tlsVersion || '',
            c: request.cf?.tlsCipher || '',
            h2: request.cf?.httpProtocol || '',
            asn: request.cf?.asn || '',
            colo: request.cf?.colo || '', // Cloudflare datacenter
        };

        // Create a string to hash: "TLSv1.3|AEAD-AES128-GCM-SHA256|HTTP/2|12345"
        const fingerprintString = `${tlsData.v}|${tlsData.c}|${tlsData.h2}|${tlsData.asn}`;

        // Hash using Web Crypto API (SHA-256)
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintString));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tlsHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 2. Prepare new request headers
        // We must create a new Headers object because request.headers is immutable
        const newHeaders = new Headers(request.headers);

        // Add the calculated fingerprint
        newHeaders.set('X-TLS-Fingerprint', tlsHash);

        // (Optional) Pass raw parameters for debugging if needed
        // newHeaders.set('X-TLS-Version', tlsData.v);

        // 3. Forward request to origin
        // Create new request with modified headers
        const newRequest = new Request(request, {
            headers: newHeaders,
            // Pass through other properties
            method: request.method,
            body: request.body,
            redirect: request.redirect
        });

        return fetch(newRequest);
    }
};

