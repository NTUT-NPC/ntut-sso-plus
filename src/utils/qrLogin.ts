/**
 * QR Login utilities: QR payload parsing, AES-256-CBC encryption (Web Crypto API),
 * and Firebase REST API communication.
 *
 * Ciphertext format: "base64(IV):base64(ciphertext)" — compatible with pc.html CryptoJS decryption.
 */

export const API_BASE_URL = 'https://login.ntut.app/api/session';

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

export interface QrPayload {
    id: string;
    key: string;
}

/**
 * Parse and validate a QR code JSON payload.
 * Expected format: { "id": "uuid-string", "key": "base64-encoded-256bit-key" }
 */
export function parseQrPayload(raw: string): QrPayload {
    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('QR 內容不是有效的 JSON 格式');
    }

    if (!parsed.id || typeof parsed.id !== 'string' || parsed.id.trim() === '') {
        throw new Error('QR 內容缺少有效的 "id" 欄位');
    }

    const trimmedId = parsed.id.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId)) {
        throw new Error('"id" 格式不正確（應為 UUID）');
    }

    if (!parsed.key || typeof parsed.key !== 'string' || parsed.key.trim() === '') {
        throw new Error('QR 內容缺少有效的 "key" 欄位');
    }

    // Validate key appears to be Base64 (44 chars for 32 bytes)
    if (!/^[A-Za-z0-9+/]+=*$/.test(parsed.key)) {
        throw new Error('"key" 格式不正確（應為 Base64 編碼）');
    }

    return { id: trimmedId, key: parsed.key };
}

/**
 * AES-256-CBC encryption using Web Crypto API.
 *
 * - Generates a random 128-bit IV
 * - Parses Base64-encoded 32-byte key
 * - Output format: "base64(IV):base64(ciphertext)"
 *
 * Compatible with pc.html CryptoJS AES-CBC decryption.
 */
export async function aesEncryptCBC(plaintext: string, base64Key: string): Promise<string> {
    // Decode the Base64 key to raw bytes
    const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    if (keyBytes.length !== 32) {
        throw new Error(`金鑰長度不正確：期望 32 bytes，得到 ${keyBytes.length} bytes`);
    }

    // Import as CryptoKey
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC', length: 256 },
        false,
        ['encrypt']
    );

    // Generate random 128-bit IV
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Encode plaintext to UTF-8
    const data = new TextEncoder().encode(plaintext);

    // Encrypt (Web Crypto AES-CBC uses PKCS7 padding by default)
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        data
    );

    // Convert to Base64
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));

    return `${ivBase64}:${ciphertextBase64}`;
}

/**
 * Send encrypted payload to Firebase via HTTP PUT with timeout and retry.
 */
export async function sendToFirebase(sessionId: string, encryptedPayload: string): Promise<void> {
    const trimmedSessionId = sessionId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedSessionId)) {
        throw new Error('無效的 sessionId');
    }

    const url = `${API_BASE_URL}/${trimmedSessionId}`;
    const body = JSON.stringify({
        payload: encryptedPayload,
        timestamp: Date.now()
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }

            return; // Success
        } catch (err: any) {
            const isTimeout = err.name === 'AbortError';
            lastError = new Error(
                isTimeout
                    ? `連線逾時 (${FETCH_TIMEOUT_MS}ms)`
                    : (err.message || '未知錯誤')
            );

            if (attempt <= MAX_RETRIES) {
                const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw lastError || new Error('發送失敗');
}
