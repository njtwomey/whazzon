import { z } from "zod";
import { HttpUrl, IsoDate, IsoDateTime, Markdown, Slug, SourceId } from "./common.js";
import { defineArtefact } from "./versioning.js";

/**
 * A pull from the harvest mailbox — stage 2's other input channel.
 *
 * whazzon subscribes a dedicated address to venue and promoter mailing lists.
 * What arrives there is a listing like any other, with two properties no web
 * page has: it is pushed rather than searched for, and it routinely carries
 * things the website does not — a members' preview, a one-off added to a
 * programme already printed, a cancellation.
 *
 * It also has one property that makes it awkward: **a newsletter is not
 * retrievable.** A web page cited in `fetch.url` can be opened by anyone
 * reviewing the harvest a month later; a message delivered once to a private
 * mailbox cannot. So the message text is committed here, beside the run that
 * read it, and the harvest observation cites this file. Without that the
 * harvest log would assert things no reviewer could ever check.
 *
 * The layout deliberately mirrors stage 2's:
 *
 *   data/<location>/mail/<YYYY-MM-DD>/<category>.yaml
 *   data/<location>/mail/<YYYY-MM-DD>/unmatched.yaml
 *
 * One file per category per pull, so the category subagent that already reads
 * one catalogue file and writes one harvest file reads exactly one mail file
 * too, and never loads another category's post.
 *
 * The pull is deterministic: `npm run mail` talks IMAP, parses MIME, redacts
 * and files. No model is involved, and nothing here decides what an event is.
 * That is the fan-out's job, from these files.
 */

/** Who sent it. Split, because matching is on the address and reading is on the name. */
const MailAddress = z.strictObject({
  name: z.string().optional(),
  address: z.string().min(1),
});

const MessageV1 = z.strictObject({
  /**
   * RFC 5322 Message-ID, angle brackets and all. The message's identity: a
   * re-pull over an overlapping window recognises what it already has by this
   * rather than filing a second copy.
   */
  messageId: z.string().min(1),
  /** When the sender sent it, not when we pulled it — those differ by days. */
  receivedAt: IsoDateTime,
  from: MailAddress,
  subject: z.string(),

  /**
   * `List-Id`, when set. Mailing list software sets it and keeps it stable
   * even when the `From:` address changes, which makes it the more durable of
   * the two things a source can be matched on.
   */
  listId: z.string().min(1).optional(),

  /**
   * The "view this email in your browser" link almost every campaign carries.
   * The nearest thing a newsletter has to a citable URL, so it becomes the
   * observation's `fetch.url` when present.
   */
  webVersion: HttpUrl.optional(),

  /**
   * The catalogue source this was matched to, and the pattern that matched.
   * Absent in `unmatched.yaml` — mail from a sender stage 1 has never heard
   * of, which is a discovery to curate rather than a failure.
   */
  sourceId: SourceId.optional(),
  matchedBy: z.string().min(1).optional(),

  /**
   * The message as text, links kept inline as `anchor text <url>`. Converted
   * from the HTML part where there is one, because a campaign's text/plain
   * alternative is usually a stub.
   *
   * Redacted before it lands here: the recipient address and per-recipient
   * tracking parameters are stripped, so committing the store does not commit
   * a mailbox's worth of unsubscribe tokens.
   */
  body: Markdown,
  /** True when `body` hit the size cap. Long campaigns are mostly footer. */
  truncated: z.boolean().default(false),
});

export type MailMessage = z.infer<typeof MessageV1>;

const MailPullV1 = z
  .strictObject({
    schema: z.string(),
    locationId: Slug,
    /** The date of the pull, matching the containing directory. */
    date: IsoDate,
    /**
     * The category these messages' sources belong to, matching the filename.
     * `unmatched` for mail that matched no catalogue source.
     */
    category: Slug,
    pulledAt: IsoDateTime,
    /** IMAP mailbox or Gmail label the pull read. */
    mailbox: z.string().min(1),
    messages: z.array(MessageV1),
  })
  .superRefine((pull, ctx) => {
    const seen = new Map<string, number>();
    pull.messages.forEach((message, i) => {
      const previous = seen.get(message.messageId);
      if (previous !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", i, "messageId"],
          message: `filed twice in one pull, already at messages[${previous}]`,
        });
      }
      seen.set(message.messageId, i);

      // Same rule as the harvest file, for the same reason: without it a pull
      // could quietly file theatre post into the cinema file and the subagent
      // reading it would never know.
      if (pull.category === "unmatched") {
        if (message.sourceId !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["messages", i, "sourceId"],
            message: `is matched to "${message.sourceId}" but sits in the unmatched file`,
          });
        }
      } else if (message.sourceId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", i, "sourceId"],
          message: `is unmatched, so it belongs in unmatched.yaml, not the ${pull.category} file`,
        });
      } else if (!message.sourceId.startsWith(`${pull.category}/`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages", i, "sourceId"],
          message: `is not in the "${pull.category}" category, but this is the ${pull.category} file`,
        });
      }
    });
    if (!pull.pulledAt.startsWith(pull.date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pulledAt"],
        message: `is ${pull.pulledAt} but the pull date is ${pull.date}`,
      });
    }
  });

export type MailPull = z.infer<typeof MailPullV1>;

export const MailArtefact = defineArtefact<MailPull>({
  kind: "whazzon.mail",
  versions: { 1: MailPullV1 },
  migrations: {},
  latest: MailPullV1,
});
