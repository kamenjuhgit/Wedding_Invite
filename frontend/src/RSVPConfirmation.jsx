import React from "react";
import Monogram from "./Monogram";
import CalendarAction from "./CalendarAction";
export default function RSVPConfirmation({ record, onEdit, onNew, notice }) {
  const guest = record.name ? `, ${record.name}` : "";
  const canEdit =
    typeof record.canEdit === "boolean"
      ? record.canEdit
      : Boolean(record.email);
  const messages = {
    yes: `Thank you${guest}. We can’t wait to celebrate with you.`,
    no: `Thank you for letting us know${guest}. We’ll miss you.`,
    maybe: `Thank you${guest}. We understand you’re still making plans.`,
  };
  return (
    <div className="confirmation saved-rsvp botanical-confirmation">
      <Monogram size={85} />
      <h3>{messages[record.attendance] || "Thank you for your reply."}</h3>
      <p role="status">{notice || "Your RSVP has been received with love."}</p>
      <p>
        {canEdit
          ? "You can update your response when you’re ready. A fresh email code protects every edit."
          : "To change your response, please contact Selam or Kamenju."}
      </p>
      <div className="confirmation-actions">
        {canEdit && (
          <button className="button dark" onClick={onEdit}>
            Edit My RSVP
          </button>
        )}
        {record.attendance === "yes" && <CalendarAction />}
      </div>
      {onNew && (
        <div className="rsvp-edit-at-end">
          <p className="small">Replying for someone else on this device?</p>
          <button type="button" className="button outline" onClick={onNew}>
            Create another RSVP
          </button>
          <p className="small">Use their own phone number and, if provided, their own email address.</p>
        </div>
      )}
    </div>
  );
}
