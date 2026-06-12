"use client";

import { useState } from "react";
import CryptoJS from "crypto-js";
import { NoteType } from "../kyClient/dashboard";
import toast from "react-hot-toast";

export const useAudioEncryption = () => {
  const [encryptedAudioData, setEncryptedAudioData] = useState<string>("");
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);

  const encryptAudio = async (audioFile: File): Promise<void> => {
    if (!audioFile) {
      setEncryptionError("Please select an audio file!");
      return;
    }

    setIsEncrypting(true);
    setEncryptionError(null);

    try {
      const arrayBuffer = await readFileAsArrayBuffer(audioFile);
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);

      const secretKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
      if (!secretKey) {
        throw new Error("Encryption key is need to be revalidated");
      }
      const key = CryptoJS.SHA256(secretKey);
      const iv = CryptoJS.enc.Hex.parse("00000000000000000000000000000000");

      const encrypted = CryptoJS.AES.encrypt(wordArray, key, { iv: iv });
      const encryptedData = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

      setEncryptedAudioData(encryptedData);
    } catch (error) {
      setEncryptionError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsEncrypting(false);
    }
  };

  const uploadEncryptedAudio = async (
    mrn?: string,
    noteType?: NoteType,
    sessionId?: string | number,
  ): Promise<string | null> => {
    // decide here what to actually use:
    const typeToUse = noteType ?? NoteType.CREATE_SESSION;

    if (!encryptedAudioData) {
      setEncryptionError("Please encrypt an audio file first!");
      return null;
    }

    setIsUploading(true);
    setEncryptionError(null);
    setUploadProgress(0);
    setEstimatedTimeRemaining(null);

    return new Promise((resolve, reject) => {
      try {
        const now = new Date();
        const timestamp = now
          .toISOString()
          .replace(/[-:]/g, "")
          .replace("T", "-")
          .replace(/\..+/, "");

        const filename = mrn
          ? `${mrn}-${timestamp}.enc`
          : `encrypted_audio-${timestamp}.enc`;

        // Create Blob with the encrypted data
        const tempFile = new Blob([encryptedAudioData], {
          type: "application/octet-stream",
        });

        // Create FormData and append file with filename
        const formData = new FormData();
        formData.append("file", tempFile, filename);

        // Use XMLHttpRequest to track upload progress
        const xhr = new XMLHttpRequest();
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
        
        // Track upload metrics for robust ETA calculation
        let uploadStartTime = Date.now();
        let lastProgressTime = uploadStartTime;
        let lastLoaded = 0;
        
        // Moving average with recent speed samples (last 5 measurements)
        const speedSamples: number[] = [];
        const maxSamples = 5;
        const minTimeForEstimate = 500; // Wait 500ms before showing estimate
        const smoothingFactor = 0.3; // For exponential smoothing
        let lastEstimate: number | null = null;

        // Progress event handler with robust ETA calculation
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);

            const currentTime = Date.now();
            const timeElapsed = currentTime - uploadStartTime;
            
            // Don't calculate ETA too early (avoid wild estimates at start)
            if (timeElapsed < minTimeForEstimate || event.loaded === 0) {
              setEstimatedTimeRemaining(null);
              return;
            }

            // Calculate instantaneous speed for this interval
            const timeSinceLastUpdate = currentTime - lastProgressTime;
            if (timeSinceLastUpdate > 0) {
              const bytesSinceLastUpdate = event.loaded - lastLoaded;
              const instantSpeed = (bytesSinceLastUpdate / timeSinceLastUpdate) * 1000; // bytes per second

              // Only add valid speed samples (ignore zero or negative)
              if (instantSpeed > 0) {
                speedSamples.push(instantSpeed);
                
                // Keep only the most recent samples
                if (speedSamples.length > maxSamples) {
                  speedSamples.shift();
                }
              }
            }

            // Update tracking variables
            lastProgressTime = currentTime;
            lastLoaded = event.loaded;

            // Calculate ETA using weighted moving average
            if (speedSamples.length > 0) {
              // Weighted average: recent speeds have more weight
              let weightedSpeed = 0;
              let totalWeight = 0;
              
              speedSamples.forEach((speed, index) => {
                const weight = index + 1; // More recent = higher weight
                weightedSpeed += speed * weight;
                totalWeight += weight;
              });
              
              const avgSpeed = weightedSpeed / totalWeight;
              
              // Calculate raw estimate
              const remainingBytes = event.total - event.loaded;
              let rawEstimate = remainingBytes / avgSpeed;

              // Apply exponential smoothing to prevent jumpy estimates
              if (lastEstimate !== null) {
                rawEstimate = smoothingFactor * rawEstimate + (1 - smoothingFactor) * lastEstimate;
              }
              
              // Round and constrain the estimate
              let estimatedSeconds = Math.round(rawEstimate);
              
              // Handle edge cases
              if (estimatedSeconds < 0) estimatedSeconds = 0;
              if (estimatedSeconds > 3600) estimatedSeconds = 3600; // Cap at 1 hour
              if (event.loaded >= event.total * 0.99) estimatedSeconds = 0; // Almost done
              
              lastEstimate = estimatedSeconds;
              setEstimatedTimeRemaining(estimatedSeconds);
            } else {
              // Fallback to simple average if no samples yet
              const avgSpeed = event.loaded / (timeElapsed / 1000);
              const remainingBytes = event.total - event.loaded;
              const estimatedSeconds = Math.max(0, Math.round(remainingBytes / avgSpeed));
              setEstimatedTimeRemaining(estimatedSeconds);
            }
          }
        });

        // Load event handler (upload complete)
        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadedFileId(data.note_id);
              setUploadProgress(100);
              setEstimatedTimeRemaining(0);
              toast.success("Audio uploaded successfully!", {
                duration: 3000,
                position: "bottom-right",
              });
              setIsUploading(false);
              resolve(data.note_id);
            } catch (parseError) {
              setIsUploading(false);
              const errorMessage = "Failed to parse server response";
              setEncryptionError(errorMessage);
              toast.error(errorMessage, {
                duration: 3000,
                position: "bottom-right",
              });
              reject(new Error(errorMessage));
            }
          } else if (xhr.status === 403) {
            // Clear all cookies (using js-cookie) and localStorage, then redirect
            if (typeof window !== 'undefined') {
              // Remove known cookies
              const cookiesToRemove = [
                "access_token",
                "user",
                "refresh_token",
                "password_updated",
                "reset_password",
                "locked"
              ];
              cookiesToRemove.forEach((cookie) => {
                if (window.Cookies) window.Cookies.remove(cookie);
              });
              localStorage.clear();
              window.location.href = "/login";
            }
            setIsUploading(false);
            resolve(null);
          } else {
            setIsUploading(false);
            const errorMessage = `Upload failed with status ${xhr.status}: ${xhr.responseText}`;
            console.error("Server response:", xhr.responseText);
            setEncryptionError(errorMessage);
            toast.error(errorMessage, {
              duration: 3000,
              position: "bottom-right",
            });
            reject(new Error(errorMessage));
          }
        });

        // Error event handler
        xhr.addEventListener("error", () => {
          setIsUploading(false);
          const errorMessage = "Upload failed: Network error";
          console.error("Upload error:", errorMessage);
          setEncryptionError(errorMessage);
          
          // Check if it's a network error
          const isNetworkError = true; // XHR error events are always network-related
          
          if (!isNetworkError) {
            toast.error(errorMessage, {
              duration: 3000,
              position: "bottom-right",
            });
          }
          
          reject(new Error(errorMessage));
        });

        // Abort event handler
        xhr.addEventListener("abort", () => {
          setIsUploading(false);
          const errorMessage = "Upload aborted";
          setEncryptionError(errorMessage);
          reject(new Error(errorMessage));
        });

        // Open connection and send request. For update sessions, include the
        // session_id so the backend appends to the existing session's audio.
        let uploadUrl = `${baseUrl}/note/upload-file-to-s3/?note_type=${typeToUse}`;
        if (typeToUse === NoteType.UPDATE_SESSION && sessionId != null) {
          uploadUrl += `&session_id=${sessionId}`;
        }
        xhr.open("POST", uploadUrl);
        xhr.setRequestHeader("accept", "application/json");
        xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem("access_token")}`);
        xhr.send(formData);

      } catch (error) {
        setIsUploading(false);
        console.error("Upload error:", error);
        const errorMessage = `Upload failed: ${error instanceof Error ? error.message : String(error)}`;
        setEncryptionError(errorMessage);
        
        // Only show toast error if it's not a network error
        const isNetworkError = errorMessage.includes('Failed to fetch') ||
                              errorMessage.includes('NetworkError') ||
                              errorMessage.includes('offline') ||
                              errorMessage.includes('stg-api.nurmed.ai') ||
                              errorMessage.includes('net::ERR_INTERNET_DISCONNECTED') ||
                              errorMessage.includes('net::ERR_NETWORK_CHANGED');
        
        if (!isNetworkError) {
          toast.error(errorMessage, {
            duration: 3000,
            position: "bottom-right",
          });
        }
        
        reject(error);
      }
    });
  };

  const downloadEncryptedAudio = (mrn?: string): void => {
    if (!encryptedAudioData) {
      setEncryptionError("Please encrypt an audio file first!");
      return;
    }

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "-")
      .replace(/\..+/, "");

    const filename = mrn
      ? `${mrn}-${timestamp}.enc`
      : `encrypted_audio-${timestamp}.enc`;

    const blob = new Blob([encryptedAudioData], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          resolve(event.target.result);
        } else {
          reject(new Error("Failed to read file as ArrayBuffer"));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  return {
    encryptedAudioData,
    isEncrypting,
    isUploading,
    encryptionError,
    uploadedFileId,
    uploadProgress,
    estimatedTimeRemaining,
    encryptAudio,
    uploadEncryptedAudio,
    downloadEncryptedAudio,
  };
};
