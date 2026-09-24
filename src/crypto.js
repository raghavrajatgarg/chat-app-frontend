// src/crypto.js

const enc = new TextEncoder();
const dec = new TextDecoder();

// Derives a consistent AES-GCM key using a static salt based on the room passphrase
export async function getRoomKey(passphrase) {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  // Static salt derived from the room name so all participants share the identical key
  const salt = enc.encode(`static-salt-v1-${passphrase}`);
  
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypts plaintext and prepends a 12-byte random IV, returning a Base64 string
export async function encryptMessage(text, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(text)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// Decrypts the Base64 ciphertext by extracting the IV and decoding the payload
export async function decryptMessage(base64Ciphertext, key) {
  try {
    const binaryString = atob(base64Ciphertext);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[Encrypted Message]";
  }
}