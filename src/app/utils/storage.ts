import { collection, addDoc, updateDoc, doc, getDoc, onSnapshot, query, orderBy, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Registration } from "./types";

const AUTO_PRINT_KEY = "event_auto_print_mode";

/**
 * Add a new registration to Firestore
 */
export async function addRegistration(name: string, affiliation: string, snsUrls: Registration["snsUrls"]): Promise<Registration> {
  const newReg = {
    name,
    affiliation,
    snsUrls,
    checkedInAt: new Date().toISOString(),
    printStatus: "pending",
  };
  
  const docRef = await addDoc(collection(db, "registrations"), newReg);
  
  return {
    id: docRef.id,
    ...newReg,
  } as Registration;
}

/**
 * Fetch a single registration by ID
 */
export async function getRegistration(id: string): Promise<Registration | null> {
  if (!id) return null;
  const docRef = doc(db, "registrations", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Registration;
  }
  return null;
}

/**
 * Update registration print status
 */
export async function updateRegistrationStatus(id: string, status: "pending" | "printed"): Promise<void> {
  const docRef = doc(db, "registrations", id);
  await updateDoc(docRef, {
    printStatus: status,
    printedAt: status === "printed" ? new Date().toISOString() : null,
  });
}

/**
 * Subscribe to real-time registrations for admin queue
 */
export function subscribeToRegistrations(callback: (regs: Registration[]) => void) {
  // Order by checkedInAt descending
  const q = query(collection(db, "registrations"), orderBy("checkedInAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const regs: Registration[] = [];
    snapshot.forEach((docSnap) => {
      regs.push({ id: docSnap.id, ...docSnap.data() } as Registration);
    });
    callback(regs);
  });
}

/**
 * Clear all registrations (Admin only)
 */
export async function clearRegistrations(): Promise<void> {
  const snapshot = await getDocs(collection(db, "registrations"));
  const promises = snapshot.docs.map(d => deleteDoc(d.ref));
  await Promise.all(promises);
}

/**
 * Local settings for auto-print mode (device-specific)
 */
export function getAutoPrintMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_PRINT_KEY) === "true";
}

export function setAutoPrintMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_PRINT_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("storage"));
}
