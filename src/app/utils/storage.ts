import { Registration } from "./types";

const STORAGE_KEY = "event_registrations";
const AUTO_PRINT_KEY = "event_auto_print_mode";

export function getRegistrations(): Registration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to parse registrations:", error);
    return [];
  }
}

export function saveRegistrations(regs: Registration[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(regs));
    // Manually dispatch a storage event for local updates on the same tab
    window.dispatchEvent(new Event("storage"));
  } catch (error) {
    console.error("Failed to save registrations:", error);
  }
}

export function addRegistration(name: string, affiliation: string, snsUrls: Registration["snsUrls"]): Registration {
  const regs = getRegistrations();
  const newReg: Registration = {
    id: Math.random().toString(36).substring(2, 9),
    name,
    affiliation,
    snsUrls,
    checkedInAt: new Date().toISOString(),
    printStatus: "pending",
  };
  regs.unshift(newReg); // Put the newest first
  saveRegistrations(regs);
  return newReg;
}

export function updateRegistrationStatus(id: string, status: "pending" | "printed"): Registration[] {
  const regs = getRegistrations();
  const updated = regs.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        printStatus: status,
        printedAt: status === "printed" ? new Date().toISOString() : undefined,
      };
    }
    return r;
  });
  saveRegistrations(updated);
  return updated;
}

export function getAutoPrintMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_PRINT_KEY) === "true";
}

export function setAutoPrintMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_PRINT_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("storage"));
}
