# Venue map and directions

Without Google credentials, the botanical venue card is complete and usable. Its directions link uses the exact supplied Place ID `ChIJSWtz6NsjLxgRKUG333V1j48` and Eva’s Garden Redhill listing. No approximate illustrated geography or alternative venue is substituted.

To enable the interactive map:
1. Create a Google Cloud project, enable billing, Maps JavaScript API and Places API (New).
2. Create a JavaScript Map ID. Create a cloud map style with ivory land, muted beige roads, sage vegetation and restrained labels; associate the style with that Map ID. Example palette: land #f8f4eb, roads #e6d9c2, vegetation #dce5d0, water #dbe5e0, labels #526447.
3. Create a browser API key restricted by HTTP referrer to your exact production domain and necessary local development origins. Restrict APIs to the services used. Never put server credentials in Vite variables.
4. Set frontend `VITE_GOOGLE_MAPS_KEY` and `VITE_GOOGLE_MAP_ID`, rebuild and redeploy.

VenueMap.jsx loads Google only when “Explore the interactive map” is pressed. It resolves location from the supplied Place ID using the Places API, uses an Advanced Marker, and cooperative gestures avoid hijacking one-finger vertical scrolling. API failure or missing keys leave the directions card available. No iframe CSS filters are used.

Cloud styles must be configured in Google Cloud; ordinary CSS cannot recolor map roads/labels. Google billing, quotas and map IDs are external requirements, not included accounts. API acceptance, billing and map style rendering must be verified on your production domain.

Official references:
- https://developers.google.com/maps/documentation/javascript/cloud-customization/setup
- https://developers.google.com/maps/documentation/javascript/advanced-markers/start
- https://developers.google.com/maps/documentation/javascript/troubleshooting
