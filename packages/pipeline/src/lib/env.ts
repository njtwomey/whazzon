import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { rel, repoRoot } from "./paths.js";

/**
 * Reading `.env`.
 *
 * whazzon has needed no secrets until now: every stage reads committed files
 * or public pages, which is why the pipeline can be re-run by anyone who
 * clones it. The harvest mailbox is the first exception — an IMAP password
 * cannot be committed — so this is deliberately the only place in the project
 * that reads one, and only `cli/mail.ts` calls it.
 *
 * Hand-rolled rather than `dotenv`, because the format is eight lines of
 * `KEY=value` and a dependency that reads secrets is a dependency worth not
 * having. Existing environment variables win, so CI can inject them without a
 * file.
 */

export interface EnvWarning {
  message: string;
}

const warnings: EnvWarning[] = [];

/** Everything read out of `.env`, in file order, values unquoted. */
function parse(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed
      .slice(0, eq)
      .replace(/^export\s+/, "")
      .trim();
    let value = trimmed.slice(eq + 1).trim();
    // A Gmail app password is printed with spaces in it and pasted that way.
    // Quoting is therefore normal here, not an edge case.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out.set(key, value);
  }
  return out;
}

/**
 * Load `.env` into `process.env`, without overriding what is already set.
 * Returns the warnings worth showing the user — chiefly a file other accounts
 * on the machine can read, which is worth saying out loud rather than
 * silently tolerating.
 */
export function loadEnv(path = join(repoRoot(), ".env")): EnvWarning[] {
  warnings.length = 0;
  if (!existsSync(path)) return warnings;

  const mode = statSync(path).mode & 0o777;
  if (mode & 0o077) {
    warnings.push({
      message: `${rel(path)} is mode ${mode.toString(8).padStart(3, "0")} — readable beyond you. chmod 600 ${rel(path)}`,
    });
  }

  for (const [key, value] of parse(readFileSync(path, "utf8"))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return warnings;
}

/** A required setting, with a message that says how to supply it rather than just what is missing. */
export function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(
      `${key} is not set.\n\n` +
        `The harvest mailbox is configured in .env at the repo root. Copy the\n` +
        `template and fill it in:\n\n` +
        `  cp .env.example .env && chmod 600 .env\n`,
    );
  }
  return value;
}

export function optional(key: string, fallback: string): string {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
}
