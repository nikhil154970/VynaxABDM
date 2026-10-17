/** Decode JWT expiry without verifying signature (client-side session hygiene only). */
export function isJwtExpired(token) {
  if (!token) return true;
  try {
    const base64 = token.split('.')[1];
    if (!base64) return true;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    if (!payload?.exp) return false;
    return payload.exp * 1000 < Date.now() - 3000;
  } catch {
    return true;
  }
}

export const AUTH_EVENTS = {
  STAFF_EXPIRED: 'hims:staff-session-expired',
  PATIENT_EXPIRED: 'hims:patient-session-expired',
};

let staffExpiredNotified = false;
let patientExpiredNotified = false;

export function clearStaffSession() {
  const had = Boolean(localStorage.getItem('accessToken'));
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  return had;
}

export function clearPatientSession() {
  const had = Boolean(localStorage.getItem('patientToken'));
  localStorage.removeItem('patientToken');
  localStorage.removeItem('patient');
  return had;
}

/** Soft redirect via React Router — no full page reload. */
export function notifyStaffSessionExpired() {
  if (staffExpiredNotified) return;
  staffExpiredNotified = true;
  clearStaffSession();
  window.dispatchEvent(new Event(AUTH_EVENTS.STAFF_EXPIRED));
}

export function notifyPatientSessionExpired() {
  if (patientExpiredNotified) return;
  patientExpiredNotified = true;
  clearPatientSession();
  window.dispatchEvent(new Event(AUTH_EVENTS.PATIENT_EXPIRED));
}

export function resetStaffSessionFlags() {
  staffExpiredNotified = false;
}

export function resetPatientSessionFlags() {
  patientExpiredNotified = false;
}

export function getValidStaffSession() {
  const token = localStorage.getItem('accessToken');
  const rawUser = localStorage.getItem('user');
  if (!token || !rawUser || isJwtExpired(token)) {
    clearStaffSession();
    return null;
  }
  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    clearStaffSession();
    return null;
  }
}

export function getValidPatientSession() {
  const token = localStorage.getItem('patientToken');
  const rawPatient = localStorage.getItem('patient');
  if (!token || !rawPatient || isJwtExpired(token)) {
    clearPatientSession();
    return null;
  }
  try {
    return { token, patient: JSON.parse(rawPatient) };
  } catch {
    clearPatientSession();
    return null;
  }
}
