export const PREFERRED_MIC_DEVICE_STORAGE_KEY = "nurmed_preferred_mic_device_id";

export function getPreferredMicDeviceId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = localStorage.getItem(PREFERRED_MIC_DEVICE_STORAGE_KEY);
  return v && v.length > 0 ? v : undefined;
}

export function setPreferredMicDeviceId(deviceId: string) {
  localStorage.setItem(PREFERRED_MIC_DEVICE_STORAGE_KEY, deviceId);
}
