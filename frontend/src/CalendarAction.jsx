import React from "react";
import { calendarText } from "./calendar";
import { wedding as w } from "./config";
export default function CalendarAction() {
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          calendarText(
            w,
            import.meta.env.VITE_SITE_URL || window.location.origin,
          ),
        ],
        { type: "text/calendar;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "Selam-and-Kamenju.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" className="button outline" onClick={download}>
      Save the Date <span aria-hidden="true">↓</span>
    </button>
  );
}
