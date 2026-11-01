// RFC 5545: date-only event, exclusive next-day DTEND, CRLF and UTF-8 line folding.
export function calendarText(w, siteURL = "", now = new Date()) {
  const escape = (s) =>
    String(s)
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const start = w.calendarDate.replaceAll("-", "");
  const end = new Date(w.calendarDate + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Selam Kamenju//Wedding Invitation//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:selam-kamenju-20270106@wedding-invitation",
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
    `SUMMARY:${escape(w.names.join(" and ") + "’s Wedding")}`,
    `LOCATION:${escape(w.venue + ", Kenya")}`,
    `DESCRIPTION:${escape("Celebrate with Selam and Kamenju." + (siteURL ? " Invitation: " + siteURL : ""))}`,
    ...(siteURL ? [`URL:${siteURL}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let out = "",
          bytes = 0;
        for (const c of line) {
          const n = new TextEncoder().encode(c).length;
          if (bytes + n > 75) {
            out += "\r\n ";
            bytes = 1;
          }
          out += c;
          bytes += n;
        }
        return out;
      })
      .join("\r\n") + "\r\n"
  );
}
