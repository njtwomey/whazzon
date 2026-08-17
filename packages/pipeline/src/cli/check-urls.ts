import { loadSources } from "../lib/catalogue.js";
import { resolveLocations } from "../lib/locations.js";
import { routesOf } from "../lib/routes.js";
import type { RouteRole } from "../schema/catalogue.js";

/**
 * Deterministic reachability check over every catalogued URL. No LLM, no
 * extraction — just "is this page still there".
 *
 * Stage 1 proposes URLs from a model's knowledge, which is exactly the kind of
 * thing that is confidently wrong. This is the cheap check that catches a
 * hallucinated or moved listings page before stage 2 spends real effort on it,
 * and the same command later catches venues that have closed.
 *
 * Three outcomes, deliberately kept distinct:
 *
 *   ok       reachable
 *   blocked  the host answered but refused us (403/429) — a bot wall, not a
 *            dead site. Marking these closed would silently drop real venues,
 *            so they are reported separately and need a human to eyeball them.
 *   dead     no answer, or an answer saying the page is not there
 *
 * For a dead URL with a path, the origin is probed as well: the overwhelmingly
 * common stage 1 error is a real venue with a guessed `/whats-on/` path, and
 * knowing the root is alive turns "is this venue real?" into a one-line fix.
 *
 * Every route is checked, not just the listings page. A source's `api` or `ics`
 * route is the one stage 2 actually reads where it exists, so an endpoint that
 * has quietly moved is worth exactly as much as a moved page — and it is the
 * kind of breakage nobody notices by eye.
 *
 *   npm run check-urls -- gb-bristol
 *   npm run check-urls -- gb-bristol --category theatre
 */

const { locations, rest } = resolveLocations();
const categoryFilter = rest.includes("--category") ? rest[rest.indexOf("--category") + 1] : undefined;

const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

type Verdict = "ok" | "blocked" | "dead";

interface Result {
  id: string;
  /** `<source id>` for a single-route source, `<source id> [api]` otherwise. */
  label: string;
  role: RouteRole;
  url: string;
  verdict: Verdict;
  status?: number;
  finalUrl?: string;
  error?: string;
  /** Set when the path failed but the site's root answered. */
  rootAlive?: string;
}

async function request(url: string): Promise<{ status?: number; finalUrl?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Plenty of venue sites reject HEAD, so use GET and drop the body once the
    // headers are in.
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // An empty UA gets a bot wall from many hosts, which would report a
        // perfectly good page as dead.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
    await response.body?.cancel();
    return {
      status: response.status,
      finalUrl: response.url !== url ? response.url : undefined,
    };
  } catch (error) {
    return {
      error: controller.signal.aborted
        ? `timeout after ${TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.cause instanceof Error
            ? error.cause.message
            : error.message
          : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function verdictFor(status?: number): Verdict {
  if (status === undefined) return "dead";
  if (status === 403 || status === 429 || status === 401) return "blocked";
  return status < 400 ? "ok" : "dead";
}

async function probe(target: Target): Promise<Result> {
  const first = await request(target.url);
  const verdict = verdictFor(first.status);
  const result: Result = {
    id: target.id,
    label: target.label,
    role: target.role,
    url: target.url,
    verdict,
    status: first.status,
    finalUrl: first.finalUrl,
    error: first.error,
  };

  if (verdict === "dead") {
    const origin = new URL(target.url).origin + "/";
    if (origin !== target.url) {
      const root = await request(origin);
      if (verdictFor(root.status) !== "dead") result.rootAlive = origin;
    }
  }
  return result;
}

interface Target {
  id: string;
  label: string;
  role: RouteRole;
  url: string;
}

const sources = locations
  .flatMap((locationId) => loadSources(locationId))
  .filter((s) => s.status !== "closed")
  .filter((s) => !categoryFilter || s.category === categoryFilter);

/** One target per route, so a source with an API endpoint is checked twice. */
const targets: Target[] = sources.flatMap((source) => {
  const routes = routesOf(source);
  return routes.map((route) => ({
    id: source.id,
    label: routes.length > 1 ? `${source.id} [${route.role}]` : source.id,
    role: route.role,
    url: route.url,
  }));
});

const compound = sources.filter((source) => routesOf(source).length > 1).length;

console.log(
  `checking ${targets.length} URLs across ${sources.length} sources` +
    (compound > 0 ? ` (${compound} with more than one route)` : "") +
    `...\n`,
);

const results: Result[] = [];
const queue = [...targets];

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) break;
      const result = await probe(target);
      results.push(result);
      const mark = { ok: "ok     ", blocked: "BLOCKED", dead: "DEAD   " }[result.verdict];
      const detail =
        result.verdict === "ok"
          ? (result.finalUrl ?? "")
          : (result.error ?? `HTTP ${result.status}`) + (result.rootAlive ? `  (root alive: ${result.rootAlive})` : "");
      console.log(`${mark} ${result.label.padEnd(44)} ${detail}`);
    }
  }),
);

const ok = results.filter((r) => r.verdict === "ok");
const blocked = results.filter((r) => r.verdict === "blocked");
const dead = results.filter((r) => r.verdict === "dead");
const redirected = ok.filter((r) => r.finalUrl);
const fixable = dead.filter((r) => r.rootAlive);

console.log(
  `\n${ok.length} ok, ${blocked.length} blocked by the host, ${dead.length} unreachable (of ${results.length})`,
);

if (blocked.length > 0) {
  console.log(
    `\n${blocked.length} refused us but are probably fine — bot protection, not a dead site.` +
      `\nCheck by hand; do NOT mark these closed:`,
  );
  for (const r of blocked) console.log(`  ${r.label.padEnd(44)} HTTP ${r.status}  ${r.url}`);
}

if (fixable.length > 0) {
  console.log(
    `\n${fixable.length} have a dead path but a live site — almost certainly a wrong` +
      `\nlistings path rather than a wrong venue. Find the real path or use the root:`,
  );
  for (const r of fixable) console.log(`  ${r.label}\n    dead: ${r.url}\n    live: ${r.rootAlive}`);
}

const gone = dead.filter((r) => !r.rootAlive);
if (gone.length > 0) {
  console.log(`\n${gone.length} did not answer at all — wrong domain, or genuinely gone:`);
  for (const r of gone) console.log(`  ${r.label.padEnd(44)} ${r.url}\n    ${r.error ?? `HTTP ${r.status}`}`);
}

if (redirected.length > 0) {
  console.log(`\n${redirected.length} redirected — consider updating the catalogue URL:`);
  for (const r of redirected) console.log(`  ${r.label}\n    ${r.url}\n    ${r.finalUrl}`);
}

// Unreachable URLs are a curation task, not a build failure — exit 0 so this
// can be run casually without tripping anything.
