// EDIT THIS FILE FIRST. Unconfirmed details stay visibly unconfirmed.
export const wedding = {
  familyInvitation: "The families of Mr and Mrs Francis Kiiru and Mr and Mrs Estifanos Tesfai cordially invite you to celebrate the wedding of their children",
  names: ["Selam", "Kamenju"],
  portraitImage: "/couple-pastel.webp",
  portraitOpacity: 0.43, // 0 = invisible, 1 = full image; keep text readable.
  dateLabel: "6 January 2027",
  // Countdown to the wedding date at midnight Nairobi time, not the ceremony start time.
  dateISO: "2027-01-06T00:00:00+03:00",
  venue: "Eva’s Garden Redhill",
  location: "Redhill, Kenya",
  mapsURL:
    "https://www.google.com/maps/search/?api=1&query=Evas+Garden+Redhill&query_place_id=ChIJSWtz6NsjLxgRKUG333V1j48",
  placeId: "ChIJSWtz6NsjLxgRKUG333V1j48",
  address: "St Julian’s Road, Redhill, Kiambu County, Kenya",
  coordinates: { lat: -1.1774072, lng: 36.702287 },
  calendarDate: "2027-01-06",
  rsvpDeadline: "Please respond when you can",
  maxGuests: 6, // Keep in sync with MAX_GUESTS in backend/.env. Includes the responding guest.
  dressCode: "Dress beautifully. Feel comfortable.",
  dressNote:
    "We’ll be celebrating outdoors, so shoes that love the grass are a lovely idea.",
  schedule: [
    {
      time: "Morning",
      title: "The vows",
      text: "A ceremony beneath the trees, surrounded by the people we love.",
    },
    {
      time: "After the ceremony",
      title: "A little garden mingling",
      text: "Something to sip, familiar faces, and a little time to take it all in.",
    },
    {
      time: "2:00 PM",
      title: "The celebration",
      text: "A shared table, joyful toasts, and a dance floor waiting for you.",
    },
  ],
};
