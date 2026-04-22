import * as fs from 'fs';
import * as path from 'path';

import {
  backupPath,
  findWorkbenchHtml,
  userDataDir,
  userScriptPath
} from './paths';

const BEGIN_MARKER = '<!-- BEGIN antigravity-auto-retry -->';
const END_MARKER = '<!-- END antigravity-auto-retry -->';

export type PatchState = 'not-installed' | 'installed' | 'needs-reapply';

export class PermissionError extends Error {
  constructor(message: string, public readonly targetPath: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class WorkbenchNotFoundError extends Error {
  constructor() {
    super('Could not locate Antigravity workbench.html on this system.');
    this.name = 'WorkbenchNotFoundError';
  }
}

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p: string, content: string) {
  try {
    fs.writeFileSync(p, content, 'utf8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      throw new PermissionError(
        `No write permission for ${p}. Run the Install command again after granting write access.`,
        p
      );
    }
    throw err;
  }
}

function stripExistingPatch(html: string): string {
  const beginIdx = html.indexOf(BEGIN_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return html;

  const beforeBegin = html.lastIndexOf('\n', beginIdx);
  const start = beforeBegin >= 0 ? beforeBegin : beginIdx;
  const end = endIdx + END_MARKER.length;
  return html.slice(0, start) + html.slice(end);
}

function ensureUnsafeInlineInCsp(html: string): string {
  // Relax script-src to allow our inline bootstrap. We only touch the
  // script-src directive; everything else is left as-is.
  const cspMatch = html.match(
    /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([\s\S]*?)(")/i
  );
  if (!cspMatch) return html;

  const [full, prefix, policy, suffix] = cspMatch;

  const scriptSrcRegex = /(script-src\b)([\s\S]*?)(?=;|$)/i;
  const scriptSrcMatch = policy.match(scriptSrcRegex);
  if (!scriptSrcMatch) return html;

  const [, directive, values] = scriptSrcMatch;
  if (/'unsafe-inline'/.test(values)) return html;

  const newValues = values.replace(/(\s*)$/, ` 'unsafe-inline'$1`);
  const newPolicy = policy.replace(scriptSrcRegex, `${directive}${newValues}`);
  return html.replace(full, `${prefix}${newPolicy}${suffix}`);
}

function buildScriptBlock(scriptSource: string): string {
  // Wrap user script in a try/catch so a syntax error in the retry script
  // can never break the workbench bootstrap. Errors go to the renderer console.
  return [
    BEGIN_MARKER,
    '<script>',
    'try {',
    scriptSource,
    '} catch (e) { console.error("[antigravityAutoRetry] script failed", e); }',
    '</script>',
    END_MARKER
  ].join('\n');
}

function insertBlockBeforeHtmlClose(html: string, block: string): string {
  const closing = /<\/html>\s*$/i;
  if (!closing.test(html)) {
    return html.trimEnd() + '\n' + block + '\n';
  }
  return html.replace(closing, `${block}\n</html>\n`);
}

function ensureBackup(workbenchHtml: string) {
  const bak = backupPath(workbenchHtml);
  if (fs.existsSync(bak)) return;

  const original = readFile(workbenchHtml);
  // Only back up if the file is unpatched. If we're reapplying after an app
  // update, the file Antigravity just shipped is clean and becomes our new
  // source of truth.
  if (original.includes(BEGIN_MARKER)) return;
  writeFile(bak, original);
}

function seedUserScript(extensionDir: string) {
  const target = userScriptPath();
  const dir = userDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(target)) return;

  const bundled = path.join(extensionDir, 'antigravity-auto-retry.js');
  const src = readFile(bundled);
  writeFile(target, src);
}

export function detectState(): PatchState {
  const workbenchHtml = findWorkbenchHtml();
  if (!workbenchHtml) return 'not-installed';

  const bak = backupPath(workbenchHtml);
  const hasBackup = fs.existsSync(bak);
  const html = readFile(workbenchHtml);
  const hasMarkers = html.includes(BEGIN_MARKER) && html.includes(END_MARKER);

  if (hasMarkers) return 'installed';
  if (hasBackup) return 'needs-reapply';
  return 'not-installed';
}

export function install(extensionDir: string): { workbenchHtml: string; scriptPath: string } {
  const workbenchHtml = findWorkbenchHtml();
  if (!workbenchHtml) throw new WorkbenchNotFoundError();

  seedUserScript(extensionDir);
  ensureBackup(workbenchHtml);

  const scriptSource = readFile(userScriptPath());
  const original = readFile(workbenchHtml);

  const stripped = stripExistingPatch(original);
  const relaxed = ensureUnsafeInlineInCsp(stripped);
  const block = buildScriptBlock(scriptSource);
  const patched = insertBlockBeforeHtmlClose(relaxed, block);

  writeFile(workbenchHtml, patched);
  return { workbenchHtml, scriptPath: userScriptPath() };
}

export function uninstall(): { workbenchHtml: string; restored: boolean } {
  const workbenchHtml = findWorkbenchHtml();
  if (!workbenchHtml) throw new WorkbenchNotFoundError();

  const bak = backupPath(workbenchHtml);
  if (fs.existsSync(bak)) {
    const original = readFile(bak);
    writeFile(workbenchHtml, original);
    try {
      fs.unlinkSync(bak);
    } catch {
      // Non-fatal: leaving the backup around is harmless.
    }
    return { workbenchHtml, restored: true };
  }

  // No backup — do a best-effort strip of our script block and CSP relax.
  const html = readFile(workbenchHtml);
  const stripped = stripExistingPatch(html).trimEnd() + '\n';
  writeFile(workbenchHtml, stripped);
  return { workbenchHtml, restored: false };
}

export function sudoHintForPatch(workbenchHtml: string): string {
  // Guidance surfaced to the user when the extension hits EACCES. We do not
  // execute this — the user runs it themselves in a terminal.
  if (process.platform === 'win32') {
    return `Close Antigravity, then from an elevated PowerShell run:\n  takeown /f "${workbenchHtml}"\n  icacls "${workbenchHtml}" /grant "%USERNAME%:F"\nThen run "Antigravity Auto Retry: Install" again.`;
  }
  return `Grant yourself write access with:\n  sudo chown "$USER" "${workbenchHtml}"\nThen run "Antigravity Auto Retry: Install" again.`;
}
