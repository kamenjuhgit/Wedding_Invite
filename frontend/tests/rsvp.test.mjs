import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
let server, api;
before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  ({ api } = await server.ssrLoadModule("/src/api.js"));
});
after(async () => {
  await server.close();
});
test("public form contains optional email and maybe response, but no guest-count input", async () => {
  const { default: RSVP } = await server.ssrLoadModule("/src/RSVP.jsx");
  const html = renderToStaticMarkup(React.createElement(RSVP));
  assert.match(html, /Email address/);
  assert.match(html, /Not sure yet/);
  assert.doesNotMatch(
    html,
    /name="guests"|name="guest_count"|name="admin_notes"/,
  );
  assert.match(html, /value="KE" selected/);
});
test("confirmation reflects all responses and phone-only editing instructions", async () => {
  const { default: Confirmation } = await server.ssrLoadModule(
    "/src/RSVPConfirmation.jsx",
  );
  const markup = (attendance) =>
    renderToStaticMarkup(
      React.createElement(Confirmation, {
        record: { name: "Guest", attendance, email: null },
      }),
    );
  assert.match(markup("maybe"), /still making plans/);
  assert.match(markup("no"), /miss you/);
  assert.match(markup("yes"), /celebrate with you/);
  assert.match(markup("yes"), /contact Selam or Kamenju/);
  assert.doesNotMatch(markup("yes"), /Edit My RSVP/);
});
test("API errors retain field and duplicate information", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          error: "Already RSVP’d",
          fields: { email: "Already used" },
          duplicate: true,
        }),
        { status: 409 },
      );
    await assert.rejects(
      api("", "/api/rsvp"),
      (e) =>
        e.status === 409 && e.duplicate && e.fields.email === "Already used",
    );
  } finally {
    global.fetch = original;
  }
});
test("admin cookie requests are explicit; public requests omit cookies", async () => {
  const original = global.fetch;
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push(options);
      return new Response("{}");
    };
    await api("", "/api/rsvp");
    await api("", "/api/admin/data", { credentials: "include" });
    assert.equal(calls[0].credentials, "omit");
    assert.equal(calls[1].credentials, "include");
  } finally {
    global.fetch = original;
  }
});
