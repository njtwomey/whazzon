import { existsSync } from "node:fs";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { loadSources } from "../lib/catalogue.js";
import { loadEnv, optional, required } from "../lib/env.js";
import { readArtefact, writeArtefact } from "../lib/files.js";
import { resolveLocations } from "../lib/locations.js";
import {
  DEFAULT_IGNORED_SENDERS,
  extractWebVersion,
  isIgnored,
  matchAll,
  redact,
  redactRecipientTokens,
  tidy,
  toBodyText,
} from "../lib/mail.js";
import { paths, rel, walk } from "../lib/paths.js";
import { MailArtefact, type MailMessage, type MailPull } from "../schema/mail.js";

/**
 * Pull the harvest mailbox into `data/<location>/mail/<date>/<category>.yaml`.
 *
 * Stage 2 has one input channel today: it goes and fetches pages. This adds
 * the other direction — a dedicated address subscribed to venue and promoter
 * mailing lists, so listings arrive rather than being searched for. What comes
 * that way is routinely not on the website at all: a members' preview, a show
 * added after the season was printed, a cancellation.
 *
 *   npm run mail -- gb-bristol                 the last 14 days
 *   npm run mail -- gb-bristol --since 30
 *   npm run mail -- gb-bristol --dry-run       what would be filed, filing nothing
 *
 * **No model runs here.** This connects, parses MIME, redacts, matches against
 * the catalogue and writes files. Deciding what in a newsletter is an event is
 * the fan-out's job, from these files — which keeps the expensive judgement in
 * one place and makes the pull re-runnable for nothing.
 *
 * Idempotent by `Message-Id`: a re-pull over an overlapping window recognises
 * what it already filed on any previous date and appends only what is new. So
 * `--since` can be generous without filing anything twice.
 *
 * Mail that matches no catalogue source is not dropped — it goes to
 * `unmatched.yaml` and is reported. A newsletter from a promoter stage 1 has
 * never heard of is a discovery, and it arrives here before it arrives
 * anywhere else.
 */

const { locations, rest } = resolveLocations();

function flag(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}

const dryRun = rest.includes("--dry-run");
const verbose = rest.includes("--verbose");

const warnings = loadEnv();
for (const warning of warnings) console.warn(`warn  ${warning.message}`);

/** Cap on one message's stored text. A long campaign is mostly footer. */
const BODY_LIMIT = 20_000;

/**
 * `List-Id` read off the raw header lines rather than the parsed header map,
 * because mailparser's shape for it varies with the header's form and the
 * value wanted is always just the bit inside the angle brackets.
 */
function listIdOf(parsed: ParsedMail): string | undefined {
  const line = parsed.headerLines.find((h) => h.key === "list-id")?.line;
  if (!line) return undefined;
  const value = line.slice(line.indexOf(":") + 1).trim();
  const angled = /<([^>]+)>/.exec(value);
  return (angled?.[1] ?? value).trim() || undefined;
}

/**
 * mailparser's callback overload makes inference pick `void` for the promise
 * form, so the promise signature is pinned once here rather than cast at every
 * call site.
 */
const parseMail = simpleParser as unknown as (source: Buffer | string) => Promise<ParsedMail>;

/**
 * The account, masked, for the connection line.
 *
 * The domain and first character are enough to tell you which mailbox you
 * reached; the rest is a working login name that has no business being in a
 * terminal scrollback, a screenshot or a pasted log.
 */
function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function pull(locationId: string): Promise<void> {
  const sources = loadSources(locationId);
  const subscribed = sources.filter((s) => s.mail);

  const categories = new Set(sources.map((s) => s.category));
  if (categories.has("unmatched")) {
    throw new Error(
      `this location has a category literally called "unmatched", which collides with ` +
        `the file unmatched mail is filed into. Rename the category.`,
    );
  }

  console.log(`\n=== ${locationId} ===`);
  if (subscribed.length === 0) {
    console.log(
      `no source in this catalogue has a \`mail:\` binding, so nothing could be attributed.\n` +
        `Add one to a source you have subscribed to:\n\n` +
        `  mail:\n    from: ["*@arnolfini.org.uk"]\n\n` +
        `Pulling anyway — everything will be filed as unmatched, which is a\n` +
        `reasonable way to see what the mailbox actually contains.`,
    );
  } else {
    console.log(`${subscribed.length}/${sources.length} sources have a mail binding`);
  }

  // Every message already filed, on any date. This is what makes a generous
  // `--since` free: the window can overlap previous pulls without duplicating.
  const known = new Set<string>();
  for (const path of walk(paths.mailDir(locationId), ".yaml")) {
    try {
      const { data } = readArtefact(MailArtefact, path);
      for (const message of data.messages) known.add(message.messageId);
    } catch (error) {
      console.warn(`warn  ${rel(path)} could not be read: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (known.size > 0) console.log(`${known.size} message(s) already filed`);

  const host = required("WHAZZON_MAIL_HOST");
  const user = required("WHAZZON_MAIL_USER");
  const pass = required("WHAZZON_MAIL_PASS");
  const port = Number(optional("WHAZZON_MAIL_PORT", "993"));
  const mailbox = flag("mailbox") ?? optional("WHAZZON_MAIL_MAILBOX", "INBOX");
  const sinceDays = Number(flag("since") ?? optional("WHAZZON_MAIL_SINCE_DAYS", "14"));
  const limit = Number(flag("limit") ?? "500");
  const ignored = optional("WHAZZON_MAIL_IGNORE", DEFAULT_IGNORED_SENDERS.join(","))
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const pulledAt = new Date();
  const date = flag("date") ?? isoDate(pulledAt);

  console.log(`connecting to ${maskAddress(user)} at ${host}:${port}, mailbox ${mailbox}, since ${isoDate(since)}`);

  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
  const fresh: { message: MailMessage; category: string }[] = [];
  const ambiguous: { subject: string; sourceIds: string[] }[] = [];
  const unmatchedSenders = new Map<string, { count: number; subject: string; listId?: string }>();
  let seen = 0;
  let skipped = 0;
  let ignoredCount = 0;

  await client.connect();
  const lock = await client.getMailboxLock(mailbox);
  try {
    const uids = await client.search({ since }, { uid: true });
    const list = Array.isArray(uids) ? uids.slice(-limit) : [];
    console.log(`${list.length} message(s) in the window`);
    if (list.length === 0) return;

    for await (const item of client.fetch(list, { source: true }, { uid: true })) {
      seen += 1;
      if (!item.source) continue;
      const parsed = await parseMail(item.source);

      // Scrubbed before it is used as the dedup key: Campaign Monitor encodes
      // the recipient in the Message-ID, and the key is committed with the file.
      const messageId = redactRecipientTokens(parsed.messageId ?? `<uid-${item.uid}@${host}>`);
      if (known.has(messageId)) {
        skipped += 1;
        continue;
      }
      known.add(messageId);

      const sender = Array.isArray(parsed.from?.value) ? parsed.from.value[0] : undefined;
      const address = (sender?.address ?? "").toLowerCase();
      const listId = listIdOf(parsed);
      const subject = parsed.subject ?? "";

      // Service mail from the mailbox provider is never a listing, and filing
      // it would put account-activity notices into a committed file.
      if (isIgnored(address, ignored)) {
        ignoredCount += 1;
        continue;
      }

      const matches = matchAll({ from: address, listId }, sources);
      if (matches.length > 1) ambiguous.push({ subject, sourceIds: matches.map((m) => m.sourceId) });
      const match = matches[0];

      if (!match) {
        const entry = unmatchedSenders.get(address) ?? { count: 0, subject, listId };
        entry.count += 1;
        unmatchedSenders.set(address, entry);
      }

      const html = typeof parsed.html === "string" ? parsed.html : undefined;
      const body = tidy(redact(toBodyText(html, parsed.text), [user]));
      const webVersion = html ? extractWebVersion(html) : undefined;

      const message: MailMessage = {
        messageId,
        receivedAt: (parsed.date ?? pulledAt).toISOString().replace(/\.\d+Z$/, "Z"),
        from: sender?.name ? { name: sender.name, address } : { address },
        subject,
        ...(listId ? { listId } : {}),
        ...(webVersion ? { webVersion } : {}),
        ...(match ? { sourceId: match.sourceId, matchedBy: match.matchedBy } : {}),
        body: body.slice(0, BODY_LIMIT),
        truncated: body.length > BODY_LIMIT,
      };

      fresh.push({ message, category: match ? match.sourceId.split("/")[0]! : "unmatched" });
      if (verbose) console.log(`  ${match ? match.sourceId.padEnd(30) : "(unmatched)".padEnd(30)} ${subject}`);
    }
  } finally {
    lock.release();
    await client.logout();
  }

  // --- file it ------------------------------------------------------------

  const byCategory = new Map<string, MailMessage[]>();
  for (const { message, category } of fresh) {
    const list = byCategory.get(category) ?? [];
    list.push(message);
    byCategory.set(category, list);
  }

  console.log(
    `\n${seen} fetched, ${skipped} already filed` +
      (ignoredCount ? `, ${ignoredCount} ignored sender(s)` : "") +
      `, ${fresh.length} new`,
  );

  for (const [category, messages] of [...byCategory].sort()) {
    messages.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const path = paths.mailFile(locationId, date, category);

    // Re-running on the same day extends that day's file rather than replacing
    // it — the store is append-only, the same as the harvest log, and for the
    // same reason: the fold has to be rebuildable from what is on disk.
    let existing: MailMessage[] = [];
    if (existsSync(path)) {
      existing = readArtefact(MailArtefact, path).data.messages;
    }

    const pullFile: Omit<MailPull, "schema"> = {
      locationId,
      date,
      category,
      pulledAt: pulledAt.toISOString().replace(/\.\d+Z$/, "Z"),
      mailbox,
      messages: [...existing, ...messages],
    };

    if (dryRun) {
      console.log(`  would write ${rel(path)} (+${messages.length}, ${pullFile.messages.length} total)`);
      continue;
    }
    writeArtefact(MailArtefact, path, pullFile);
    console.log(`  ${rel(path)} (+${messages.length}, ${pullFile.messages.length} total)`);
  }

  // --- what a human has to act on ----------------------------------------

  if (ambiguous.length > 0) {
    console.log(`\n${ambiguous.length} message(s) matched more than one source; the first was used:`);
    for (const a of ambiguous) console.log(`  ${a.sourceIds.join(", ")}  — ${a.subject}`);
    console.log(`  Narrow the binding with \`listId\`, which distinguishes lists on a shared domain.`);
  }

  if (unmatchedSenders.size > 0) {
    console.log(`\n${unmatchedSenders.size} sender(s) matched no catalogue source:\n`);
    for (const [address, entry] of [...unmatchedSenders].sort((a, b) => b[1].count - a[1].count)) {
      console.log(`  ${String(entry.count).padStart(3)}x  ${address || "(no address)"}`);
      console.log(`        ${entry.subject}`);
      if (entry.listId) console.log(`        List-Id: ${entry.listId}`);
    }
    console.log(
      `\nThese are stage 1's work, not stage 2's: either the sender is a source\n` +
        `that needs a \`mail:\` binding, or it is one the catalogue does not have yet.\n` +
        `Their post is in ${rel(paths.mailFile(locationId, date, "unmatched"))} either way.`,
    );
  }
}

for (const locationId of locations) {
  try {
    await pull(locationId);
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
