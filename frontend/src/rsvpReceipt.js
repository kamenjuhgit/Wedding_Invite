// A local receipt remembers the last successful reply on this browser, never edit permission.
// Keep the stable v2 key so installing this fix does not discard genuine confirmations.
export const RECEIPT_KEY = "sk-rsvp-receipt-v2";
export function receiptFor(record) {
  return {
    version: 2,
    name: typeof record.name === "string" ? record.name.trim().slice(0, 100) : "",
    attendance: record.attendance,
    canEdit: typeof record.canEdit === "boolean" ? record.canEdit : Boolean(record.email),
  };
}
export function parseReceipt(value) {
  try {
    const item = JSON.parse(value);
    if (item?.version !== 2 || !["yes", "no", "maybe"].includes(item.attendance) ||
        typeof item.canEdit !== "boolean") return null;
    return receiptFor(item);
  } catch { return null; }
}
export function loadReceipt() {
  // Try both independently: an invalid local value must not hide a valid session receipt.
  for (const kind of ["localStorage", "sessionStorage"]) {
    try {
      const receipt = parseReceipt(globalThis[kind]?.getItem(RECEIPT_KEY));
      if (receipt) return receipt;
    } catch { /* Some browsers deny storage access. */ }
  }
  return null;
}
export function saveReceipt(record) {
  const value = JSON.stringify(receiptFor(record));
  let persistent = false;
  for (const kind of ["localStorage", "sessionStorage"]) {
    try {
      const storage = globalThis[kind];
      storage?.setItem(RECEIPT_KEY, value);
      if (kind === "localStorage") persistent = storage?.getItem(RECEIPT_KEY) === value;
    } catch { /* Try session storage when persistent storage is unavailable. */ }
  }
  return persistent;
}
export function clearReceipt() {
  for (const kind of ["localStorage", "sessionStorage"]) {
    try { globalThis[kind]?.removeItem(RECEIPT_KEY); } catch {}
  }
}
