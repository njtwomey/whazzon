import { describe, expect, it } from "vitest";
import type { Source } from "../schema/catalogue.js";
import {
  DEFAULT_IGNORED_SENDERS,
  extractWebVersion,
  globToRegExp,
  isIgnored,
  matchAll,
  redact,
  redactRecipientTokens,
  redactUrl,
  tidy,
  toBodyText,
  unwrapTracking,
} from "./mail.js";

/**
 * The two things worth testing in the mail path are the two that fail
 * silently: an attribution that sends one venue's newsletter into another
 * venue's harvest, and a redaction that misses, committing a working
 * unsubscribe token for the mailbox to a public repository.
 *
 * Everything else in `cli/mail.ts` is I/O against a live server.
 */

function source(id: string, mail: Source["mail"]): Source {
  return {
    id,
    name: id,
    category: id.split("/")[0]!,
    kind: "venue",
    status: "provisional",
    url: "https://example.org/whats-on/",
    mail,
    tags: [],
    cadence: "weekly",
    addedAt: "2026-08-29",
  } as Source;
}

describe("globToRegExp", () => {
  it("matches an exact address", () => {
    expect(globToRegExp("news@arnolfini.org.uk").test("news@arnolfini.org.uk")).toBe(true);
    expect(globToRegExp("news@arnolfini.org.uk").test("hello@arnolfini.org.uk")).toBe(false);
  });

  it("matches a whole sending domain", () => {
    const pattern = globToRegExp("*@arnolfini.org.uk");
    expect(pattern.test("news@arnolfini.org.uk")).toBe(true);
    expect(pattern.test("noreply@arnolfini.org.uk")).toBe(true);
    expect(pattern.test("news@arnolfini.org.uk.evil.com")).toBe(false);
  });

  it("is case-insensitive, because From: headers are not normalised", () => {
    expect(globToRegExp("*@Arnolfini.org.uk").test("NEWS@arnolfini.ORG.UK")).toBe(true);
  });

  it("does not let a dot in a domain act as a wildcard", () => {
    // The bug this guards: `.` compiled unescaped would match any character,
    // so a lookalike domain would be attributed to the real venue.
    expect(globToRegExp("*@bristol.gov.uk").test("spam@bristolXgovXuk")).toBe(false);
  });
});

describe("matchAll", () => {
  const sources = [
    source("art/arnolfini", { from: ["*@arnolfini.org.uk"] }),
    source("theatre/old-vic", { from: ["*@bristololdvic.org.uk"], listId: ["oldvic.*.list-manage.com"] }),
    source("music/no-binding", undefined),
  ];

  it("attributes by sending domain", () => {
    expect(matchAll({ from: "news@arnolfini.org.uk" }, sources)).toEqual([
      { sourceId: "art/arnolfini", matchedBy: "from:*@arnolfini.org.uk" },
    ]);
  });

  it("prefers List-Id, which survives a change of sending address", () => {
    const matches = matchAll({ from: "campaigns@mailer.example.com", listId: "oldvic.us1.list-manage.com" }, sources);
    expect(matches).toEqual([{ sourceId: "theatre/old-vic", matchedBy: "listId:oldvic.*.list-manage.com" }]);
  });

  it("returns nothing for a sender the catalogue has never heard of", () => {
    expect(matchAll({ from: "promoter@somewhere.example" }, sources)).toEqual([]);
  });

  it("reports every match so ambiguity can be surfaced rather than guessed at", () => {
    const shared = [
      source("theatre/a", { from: ["*@artstrust.example"] }),
      source("theatre/b", { from: ["*@artstrust.example"] }),
    ];
    expect(matchAll({ from: "news@artstrust.example" }, shared).map((m) => m.sourceId)).toEqual([
      "theatre/a",
      "theatre/b",
    ]);
  });
});

describe("isIgnored", () => {
  it("drops the mailbox provider's own service mail", () => {
    // Left in, these are filed as candidate sources on every pull for ever,
    // and an account-activity notice lands in a committed file.
    expect(isIgnored("no-reply@accounts.google.com", DEFAULT_IGNORED_SENDERS)).toBe(true);
    expect(isIgnored("mailer-daemon@googlemail.com", DEFAULT_IGNORED_SENDERS)).toBe(true);
  });

  it("keeps anything that could plausibly be a listing", () => {
    expect(isIgnored("news@arnolfini.org.uk", DEFAULT_IGNORED_SENDERS)).toBe(false);
    expect(isIgnored("hello@notgoogle.com", DEFAULT_IGNORED_SENDERS)).toBe(false);
  });
});

describe("redactUrl", () => {
  it("strips the recipient hash from a Mailchimp link", () => {
    expect(redactUrl("https://venue.us1.list-manage.com/track/click?u=abc&id=123&e=deadbeef")).toBe(
      "https://venue.us1.list-manage.com/track/click?u=abc&id=123",
    );
  });

  it("strips the recipient hash from a view-in-browser link", () => {
    // This one is load-bearing beyond the mail store: `webVersion` becomes the
    // harvest observation's `fetch.url`, so a miss here leaks into the log.
    expect(redactUrl("https://mailchi.mp/venue/september-2026?e=8fa1c9")).toBe(
      "https://mailchi.mp/venue/september-2026",
    );
  });

  it("strips a Campaign Monitor recipient id, which lives in the path rather than the query", () => {
    // Found by the first real pull: every link in an Aerospace Bristol mail,
    // unsubscribe included, carried the recipient in a hyphenated path segment.
    expect(redactUrl("https://cmemailmarketing.co.uk/A2E373161-CMP10407CON1460-RCP48I49698O0-4-Z-1-Z")).toBe(
      "https://cmemailmarketing.co.uk/A2E373161-CMP10407CON1460-RCP0-4-Z-1-Z",
    );
  });

  it("keeps a generic `e` parameter on a host where it is not a recipient id", () => {
    expect(redactUrl("https://example.org/events?e=7")).toBe("https://example.org/events?e=7");
  });

  it("strips per-recipient parameters and campaign tracking", () => {
    expect(redactUrl("https://venue.org/show?mc_eid=abc123&utm_source=newsletter&id=42")).toBe(
      "https://venue.org/show?id=42",
    );
  });

  it("leaves nothing dangling when every parameter goes", () => {
    expect(redactUrl("https://venue.org/show?utm_source=newsletter")).toBe("https://venue.org/show");
  });

  it("returns anything it cannot parse untouched", () => {
    expect(redactUrl("not a url at all")).toBe("not a url at all");
  });
});

describe("unwrapTracking", () => {
  // A real wrapper shape, target swapped for an example host.
  const inner = JSON.stringify({ u: 30010842, v: 2, url: "https://venue.example/whats-on/gig?e=8fa1c9", id: "abc" });
  const outer = Buffer.from(JSON.stringify({ s: "sig", v: 2, p: inner })).toString("base64url");
  const wrapped = `https://click.mailchimp.com/track/click/30010842/venue.example?p=${outer}`;

  it("resolves a Mailchimp click wrapper to the page it points at", () => {
    expect(unwrapTracking(wrapped)).toBe("https://venue.example/whats-on/gig?e=8fa1c9");
  });

  it("is applied before redaction, so the unwrapped target is cleaned too", () => {
    expect(redact(`Book <${wrapped}>`, [])).toBe("Book <https://venue.example/whats-on/gig?e=8fa1c9>");
  });

  it("leaves any other URL alone", () => {
    expect(unwrapTracking("https://venue.example/x?p=notbase64")).toBe("https://venue.example/x?p=notbase64");
  });
});

describe("redactRecipientTokens", () => {
  it("scrubs the recipient out of a Campaign Monitor Message-ID, keeping it a stable key", () => {
    const id = "<cmukref.A2E373161.EB2622471.CMP10407CON1460.9.Z.RCP48I49698O0.0.0.11.1.8.0.Z.2026@e.example.org>";
    const once = redactRecipientTokens(id);
    expect(once).not.toContain("RCP48I49698O0");
    expect(once).toContain("CMP10407CON1460");
    expect(redactRecipientTokens(once)).toBe(once);
  });
});

describe("redact", () => {
  it("replaces the mailbox address wherever it is printed", () => {
    const text = "Sent to Mailbox@Example.Com. Unsubscribe: https://x.example/u?email=mailbox@example.com";
    const out = redact(text, ["mailbox@example.com"]);
    expect(out).not.toMatch(/mailbox@example\.com/i);
    expect(out).toContain("[recipient]");
  });

  it("redacts URLs embedded in running text", () => {
    const out = redact("Book now <https://venue.org/x?mc_eid=abc>", ["me@example.com"]);
    expect(out).toBe("Book now <https://venue.org/x>");
  });
});

describe("extractWebVersion", () => {
  it("finds the view-in-browser link, which is the only citable URL a campaign has", () => {
    const html = `<p><a href="https://mailchi.mp/venue/september?e=deadbeef">View this email in your browser</a></p>`;
    // Redacted on the way out: this URL ends up in the harvest log's
    // `fetch.url`, and `e` on a campaign host is the recipient's hash.
    expect(extractWebVersion(html)).toBe("https://mailchi.mp/venue/september");
  });

  it("recognises the other wordings campaigns use", () => {
    expect(extractWebVersion(`<a href="https://a.example/x">Web version</a>`)).toBe("https://a.example/x");
    expect(extractWebVersion(`<a href="https://a.example/y">View online</a>`)).toBe("https://a.example/y");
  });

  it("returns nothing rather than a guess when there is no such link", () => {
    expect(extractWebVersion(`<a href="https://a.example/tickets">Book tickets</a>`)).toBeUndefined();
  });
});

describe("toBodyText", () => {
  it("keeps hrefs, because an event without its link is barely a listing", () => {
    const html = `<h1>September</h1><p><a href="https://venue.org/gig">Kelly Moran, 22 Sep</a></p>`;
    const text = toBodyText(html, undefined);
    expect(text).toContain("Kelly Moran, 22 Sep");
    expect(text).toContain("https://venue.org/gig");
  });

  it("drops images, which in a campaign are mostly tracking pixels", () => {
    const text = toBodyText(`<p>Hello</p><img src="https://track.example/open.gif?e=abc" width="1">`, undefined);
    expect(text).not.toContain("track.example");
  });

  it("falls back to the plain-text part when there is no HTML", () => {
    expect(toBodyText(undefined, "  plain listing  ")).toBe("plain listing");
  });
});

describe("tidy", () => {
  it("collapses the blank-line runs a converted campaign is full of", () => {
    expect(tidy("a\n\n\n\n\nb   \n")).toBe("a\n\nb");
  });
});
