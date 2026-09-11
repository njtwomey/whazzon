import { convert } from "html-to-text";
import type { Source } from "../schema/catalogue.js";

/**
 * Turning a mailbox into catalogue-attributed listings.
 *
 * Everything here is a pure function over plain data — no IMAP, no
 * filesystem, no clock. `cli/mail.ts` does the I/O and calls into this; the
 * matching and the redaction are the parts most likely to be wrong, so they
 * are the parts kept testable.
 */

/** The bit of a message these functions need. Keeps callers free of the MIME types. */
export interface IncomingMessage {
  /** Sender address, bare: `news@arnolfini.org.uk`. */
  from: string;
  /** `List-Id` header value, if the sender set one. */
  listId?: string;
}

export interface Match {
  sourceId: string;
  /** The pattern that matched, so a surprising attribution can be traced. */
  matchedBy: string;
}

/**
 * A catalogue `mail.from` / `mail.listId` pattern as a regex.
 *
 * `*` is the only metacharacter, standing for any run of characters, so
 * `*@arnolfini.org.uk` reads as what it obviously means and a full address
 * with no `*` is an exact match. Everything else is escaped: a dot in a domain
 * must not quietly become "any character", or `*@bristol.gov.uk` would also
 * match `bristolXgovXuk`.
 */
export function globToRegExp(pattern: string): RegExp {
  const parts = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".*")}$`, "i");
}

/**
 * Which catalogue source this message is from, if any.
 *
 * `List-Id` is tried first: it is set by the mailing list software rather than
 * typed into a campaign, so it survives a venue moving from `news@` to
 * `hello@`, which the `From:` address does not.
 *
 * First match in catalogue order wins. Ambiguity is real — two venues under
 * one arts trust can share a sending domain — so `matchAll` exists to report
 * it rather than have the caller guess it never happens.
 */
export function matchSource(message: IncomingMessage, sources: Source[]): Match | undefined {
  return matchAll(message, sources)[0];
}

/** Every source this message matches, in catalogue order. Normally none or one. */
export function matchAll(message: IncomingMessage, sources: Source[]): Match[] {
  const from = message.from.trim().toLowerCase();
  const listId = message.listId?.trim().toLowerCase();
  const out: Match[] = [];

  for (const source of sources) {
    if (!source.mail) continue;
    let matchedBy: string | undefined;

    for (const pattern of source.mail.listId ?? []) {
      if (listId && globToRegExp(pattern).test(listId)) {
        matchedBy = `listId:${pattern}`;
        break;
      }
    }
    if (!matchedBy) {
      for (const pattern of source.mail.from) {
        if (globToRegExp(pattern).test(from)) {
          matchedBy = `from:${pattern}`;
          break;
        }
      }
    }
    if (matchedBy) out.push({ sourceId: source.id, matchedBy });
  }
  return out;
}

/**
 * Senders that are never listings: the mailbox's own service mail.
 *
 * Without this, a security alert or a "2-Step Verification turned on" notice
 * is filed as a candidate source and reported for curation on every pull,
 * for ever. It also keeps that mail out of a committed file, which matters
 * more than the noise does — an account-activity notice is exactly the kind of
 * thing that should not be in a public repository.
 *
 * Overridable with `WHAZZON_MAIL_IGNORE`, comma-separated, same glob syntax as
 * a binding.
 */
export const DEFAULT_IGNORED_SENDERS = ["*@accounts.google.com", "*@google.com", "mailer-daemon@*", "postmaster@*"];

/** True when this sender should not be filed at all. */
export function isIgnored(from: string, patterns: string[]): boolean {
  const address = from.trim().toLowerCase();
  return patterns.some((pattern) => globToRegExp(pattern).test(address));
}

/**
 * Query parameters that identify the person the campaign was sent to, rather
 * than the campaign. Stripped before anything is committed.
 *
 * The store is committed because a newsletter has no URL a reviewer could open
 * later — but "commit the evidence" must not mean committing a mailbox's worth
 * of per-recipient tokens, each of which is a working unsubscribe link for the
 * address that received it.
 */
const RECIPIENT_PARAMS = new Set([
  "mc_eid", // Mailchimp
  "_hsenc", // HubSpot
  "_hsmi",
  "vero_id",
  "subscriber_id",
  "subscriber",
  "contact_id",
  "recipient",
  "email",
  "user_email",
]);

/**
 * Mailchimp's `e` is the recipient hash, but `e` is far too generic to strip
 * everywhere — plenty of sites use it for something meaningful. Scoped to the
 * hosts where it is known to be a recipient id.
 */
const HOST_SCOPED_PARAMS: { host: RegExp; params: string[] }[] = [
  { host: /(^|\.)list-manage\.com$/i, params: ["e"] },
  { host: /(^|\.)campaign-archive\.com$/i, params: ["e"] },
  // The view-in-browser link, which is also the one promoted to `webVersion`
  // and thence to the observation's `fetch.url`. Missing this host would put a
  // recipient hash in the harvest log itself, not merely in the mail store.
  { host: /(^|\.)mailchi\.mp$/i, params: ["e"] },
  { host: /(^|\.)createsend\.com$/i, params: ["e"] },
];

/**
 * A Mailchimp click-tracking wrapper, unwrapped to the page it points at.
 *
 * Campaign links arrive as `click.mailchimp.com/track/click/<acct>/<host>?p=`
 * plus base64 JSON that carries the real URL. Left wrapped, every event `url`
 * the harvest takes from a newsletter is a tracking hop rather than the venue's
 * own page — and the prompt calls that field close to mandatory. Anything
 * that is not such a wrapper comes back untouched.
 */
export function unwrapTracking(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!/(^|\.)click\.mailchimp\.com$/i.test(url.hostname)) return raw;
  const p = url.searchParams.get("p");
  if (!p) return raw;
  try {
    const outer = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as { p?: string };
    const inner = JSON.parse(outer.p ?? "") as { url?: string };
    return typeof inner.url === "string" && /^https?:\/\//.test(inner.url) ? inner.url : raw;
  } catch {
    return raw;
  }
}

/**
 * A Campaign Monitor recipient id, wherever it appears as a delimited token.
 *
 * It turns up in link paths (`-RCP48I49698O0-`) and, less obviously, inside
 * the Message-ID itself (`cmukref.A2E373161.….RCP48I49698O0.…@`). The
 * Message-ID is the pull's idempotency key, so it cannot be dropped — but the
 * scrub is deterministic, so a scrubbed id still recognises its own message
 * on the next pull.
 */
export function redactRecipientTokens(s: string): string {
  return s.replace(/(^|[-.])RCP[A-Z0-9]+(?=[-./]|$)/g, "$1RCP0");
}

/** Strip identifying parameters from one URL. Returns it unchanged if unparseable. */
export function redactUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const scoped = HOST_SCOPED_PARAMS.filter((rule) => rule.host.test(url.hostname)).flatMap((rule) => rule.params);
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (RECIPIENT_PARAMS.has(lower) || lower.startsWith("utm_") || scoped.includes(lower)) {
      url.searchParams.delete(key);
    }
  }
  // Campaign Monitor puts the recipient id in the path, not the query:
  // `/A2E373161-CMP10407CON1460-RCP48I49698O0-4-Z-...`. The campaign id
  // beside it is what makes the URL citable, so only the RCP segment goes.
  url.pathname = redactRecipientTokens(url.pathname);
  // A `?` left behind when every parameter went is noise in a diff.
  return url.toString().replace(/\?$/, "");
}

/**
 * Everything that identifies the mailbox, out of the message text: the
 * recipient address wherever it is printed, and the tracking parameters in
 * every URL.
 */
export function redact(text: string, recipients: string[]): string {
  let out = text.replace(/https?:\/\/[^\s<>()"'\]]+/g, (url) => redactUrl(unwrapTracking(url)));
  for (const address of recipients) {
    if (!address) continue;
    out = out.split(new RegExp(escapeRegExp(address), "gi")).join("[recipient]");
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The "view this email in your browser" link, which is the nearest thing a
 * campaign has to a citable URL and therefore what the harvest observation
 * puts in `fetch.url`.
 *
 * Read off the HTML rather than the converted text because the anchor's own
 * wording is what identifies it, and conversion can wrap it across lines.
 */
const WEB_VERSION_WORDING =
  /view\s+(?:this\s+|the\s+)?(?:email|e-?mail|message|newsletter)?\s*(?:in|on)\s+(?:your\s+)?browser|view\s+(?:it\s+)?online|web\s+version|view\s+as\s+a?\s*web\s*page/i;

export function extractWebVersion(html: string): string | undefined {
  const anchor = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchor)) {
    const text = match[2]!
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (WEB_VERSION_WORDING.test(text)) {
      const href = match[1]!.trim();
      if (href.startsWith("http://") || href.startsWith("https://")) return redactUrl(unwrapTracking(href));
    }
  }
  return undefined;
}

/**
 * The message as readable text with its links intact.
 *
 * Converted from the HTML part in preference to the `text/plain` alternative,
 * which in a campaign is usually a stub saying "this email is best viewed in
 * HTML". Links are kept because a newsletter's per-event hrefs are the whole
 * point: `url` on an event is close to mandatory, and text without them turns
 * a harvestable listing into a paragraph about a listing.
 */
export function toBodyText(html: string | undefined, plain: string | undefined): string {
  if (html) {
    return convert(html, {
      wordwrap: false,
      selectors: [
        // Tracking pixels and spacer gifs are most of a campaign's images, and
        // the few real ones are rarely usable as an event's `image` anyway.
        { selector: "img", format: "skip" },
        { selector: "a", options: { linkBrackets: ["<", ">"], hideLinkHrefIfSameAsText: true } },
      ],
    }).trim();
  }
  return (plain ?? "").trim();
}

/** Collapse the runs of blank lines a converted campaign is full of. */
export function tidy(text: string): string {
  return text
    .replace(/[^\S\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
