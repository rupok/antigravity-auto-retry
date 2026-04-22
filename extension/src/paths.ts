import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Paths to the installed Antigravity workbench.html on each platform.
// The relative suffix from the install root to workbench.html is constant;
// only the install root differs per OS.
const WORKBENCH_SUFFIX = path.join(
  'out',
  'vs',
  'code',
  'electron-browser',
  'workbench',
  'workbench.html'
);

function macCandidates(): string[] {
  return [
    '/Applications/Antigravity.app/Contents/Resources/app',
    path.join(
      os.homedir(),
      'Applications',
      'Antigravity.app',
      'Contents',
      'Resources',
      'app'
    )
  ];
}

function winCandidates(): string[] {
  const roots = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Antigravity'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)']!, 'Antigravity')
  ].filter(Boolean) as string[];
  return roots.map((r) => path.join(r, 'resources', 'app'));
}

function linuxCandidates(): string[] {
  return [
    '/usr/share/antigravity/resources/app',
    '/opt/Antigravity/resources/app',
    '/opt/antigravity/resources/app',
    path.join(os.homedir(), '.local', 'share', 'antigravity', 'resources', 'app')
  ];
}

function candidateAppRoots(): string[] {
  switch (process.platform) {
    case 'darwin':
      return macCandidates();
    case 'win32':
      return winCandidates();
    default:
      return linuxCandidates();
  }
}

export function findWorkbenchHtml(): string | null {
  for (const root of candidateAppRoots()) {
    const p = path.join(root, WORKBENCH_SUFFIX);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function userDataDir(): string {
  return path.join(os.homedir(), '.antigravity-auto-retry');
}

export function userScriptPath(): string {
  return path.join(userDataDir(), 'antigravity-auto-retry.js');
}

export function backupPath(workbenchHtml: string): string {
  return workbenchHtml + '.antigravity-auto-retry.bak';
}
