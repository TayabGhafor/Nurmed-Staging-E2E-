"use client";

import { useState } from "react";
import CryptoJS from "crypto-js";

export const useAudioDecryption = () => {
  const [decryptedAudioUrl, setDecryptedAudioUrl] = useState<string | null>(
    null,
  );
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  const setAudioUrl = (url: string | null) => {
    setDecryptionError(null);
    setIsDecrypting(false);

    // Revoke previous URL to prevent memory leaks (only for object URLs we created)
    if (decryptedAudioUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(decryptedAudioUrl);
    }

    setDecryptedAudioUrl(url);
  };

  const setAudioBlob = (blob: Blob, fallbackMimeType?: string) => {
    const type = blob.type || fallbackMimeType || "audio/mpeg";
    const url = URL.createObjectURL(new Blob([blob], { type }));
    setAudioUrl(url);
  };

  const decryptAudio = async (encryptedFile: File): Promise<void> => {
    if (!encryptedFile) {
      setDecryptionError("Please select an encrypted audio file!");
      return;
    }

    setIsDecrypting(true);
    setDecryptionError(null);

    try {
      const encryptedBase64 = await readFileAsText(encryptedFile);

      const secretKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
      if (!secretKey) {
        throw new Error("Encryption key is need to be revalidated");
      }
      const key = CryptoJS.SHA256(secretKey);
      const iv = CryptoJS.enc.Hex.parse("00000000000000000000000000000000");

      const decrypted = CryptoJS.AES.decrypt(
        //@ts-ignore
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedBase64.trim()) },
        key,
        { iv: iv },
      );

      const typedArray = convertWordArrayToUint8Array(decrypted);
      const mimeType = detectAudioMimeType(typedArray);
      const blob = new Blob([typedArray.buffer as ArrayBuffer], { type: mimeType });

      // Revoke previous URL to prevent memory leaks
      if (decryptedAudioUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(decryptedAudioUrl);
      }

      const audioUrl = URL.createObjectURL(blob);
      setDecryptedAudioUrl(audioUrl);
    } catch (error) {
      console.log('error', error);
      setDecryptionError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsDecrypting(false);
    }
  };

  // Helper function to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === "string") {
          resolve(event.target.result);
        } else {
          reject(new Error("Failed to read file as text"));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const detectAudioMimeType = (data: Uint8Array): string => {
    if (data.length < 4) return "audio/mpeg";
    // WebM/Matroska: EBML header 0x1A 0x45 0xDF 0xA3
    if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
      return "audio/webm";
    }
    // OGG: "OggS"
    if (data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) {
      return "audio/ogg";
    }
    // WAV: "RIFF"
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
      return "audio/wav";
    }
    return "audio/mpeg";
  };

  const convertWordArrayToUint8Array = (
    wordArray: CryptoJS.lib.WordArray,
  ): Uint8Array => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;

    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    return u8;
  };

  return {
    decryptedAudioUrl,
    isDecrypting,
    decryptionError,
    decryptAudio,
    setAudioUrl,
    setAudioBlob,
  };
};
