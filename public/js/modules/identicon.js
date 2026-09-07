/* ============================================================================
 * Situla Auth 2.0 — Identicon & Profile Avatar Generator (identicon.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

/* ============================================================================
 * 128-bit String Hash Engine (FNV-1a)
 * ============================================================================ */

/**
 * Derives 16 bytes from an input string using FNV-1a hashing.
 * @param {string} str
 * @returns {number[]} Array of 16 byte integers (0-255)
 */
function hashStringToBytes(str) {
    if (!str || typeof str !== 'string') {
        str = 'situla_guest_user';
    }

    /* Check if already clean hex (e.g. UUID) */
    const cleanHex = str.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (cleanHex.length >= 32) {
        const bytes = [];
        for (let i = 0; i < 32; i += 2) {
            bytes.push(parseInt(cleanHex.substr(i, 2), 16));
        }
        return bytes;
    }

    /* FNV-1a 128-bit hash derivation */
    let h1 = 0x811c9dc5, h2 = 0x811c9dc5, h3 = 0x811c9dc5, h4 = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ (c * 31), 0x01000193);
        h3 = Math.imul(h3 ^ (c * 17), 0x01000193);
        h4 = Math.imul(h4 ^ (c * 7), 0x01000193);
    }

    return [
        (h1 >>> 24) & 0xff, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff,
        (h2 >>> 24) & 0xff, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, h2 & 0xff,
        (h3 >>> 24) & 0xff, (h3 >>> 16) & 0xff, (h3 >>> 8) & 0xff, h3 & 0xff,
        (h4 >>> 24) & 0xff, (h4 >>> 16) & 0xff, (h4 >>> 8) & 0xff, h4 & 0xff
    ];
}

/* ============================================================================
 * Symmetrical 5x5 SVG Identicon Generator
 * ============================================================================ */

/**
 * Generates an SVG string representation of an Identicon based on input string.
 * 5x5 grid with horizontal reflection symmetry (columns 0==4, 1==3).
 * @param {string} seed
 * @param {number} size Output dimension in px (default 16)
 * @returns {string} Standalone SVG XML string
 */
export function generateIdenticonSvg(seed, size = 16) {
    const bytes = hashStringToBytes(seed);

    /* Derive vibrant Apple-palette HSL foreground color from bytes 12-15 */
    const hue = ((bytes[14] << 8) | bytes[15]) % 360;
    const saturation = 65 + (bytes[13] % 25);
    const lightness = 52 + (bytes[12] % 16);
    const fgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    /* Dark matching tinted background */
    const bgColor = `hsl(${hue}, 28%, 14%)`;

    /* 5x5 Grid construction: 5 rows, 3 unique columns reflected to 5 */
    const rects = [];
    for (let r = 0; r < 5; r++) {
        const rowByte = bytes[r];
        for (let c = 0; c < 3; c++) {
            const isFilled = (rowByte & (1 << c)) !== 0;
            if (isFilled) {
                rects.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="${fgColor}"/>`);
                if (c < 2) {
                    const mirroredCol = 4 - c;
                    rects.push(`<rect x="${mirroredCol}" y="${r}" width="1" height="1" fill="${fgColor}"/>`);
                }
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="5" height="5" fill="${bgColor}"/>${rects.join('')}</svg>`;
}
