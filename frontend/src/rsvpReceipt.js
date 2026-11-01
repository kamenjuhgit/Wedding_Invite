// Version 2 intentionally ignores ambiguous legacy flags/receipts; it is written only after a successful save.
// A receipt is a convenience, never permission to read/edit an RSVP.
// Store only response category and whether email editing was available—no contacts or name.
export const RECEIPT_KEY = "sk-rsvp-receipt-v2";
export function receiptFor(record) {
  return {
    version: 2,
    attendance: record.attendance,
    canEdit:
      typeof record.canEdit === "boolean"
        ? record.canEdit
        : Boolean(record.email),
  };
}
export function parseReceipt(value) {
  try {
    const item = JSON.parse(value);
    if (
      item?.version !== 2 ||
      !["yes", "no", "maybe"].includes(item.attendance) ||
      typeof item.canEdit !== "boolean"
    )
      return null;
    return receiptFor(item);
  } catch {
    return null;
  }
}
