import * as vscode from 'vscode';

import {
  PatchState,
  PermissionError,
  WorkbenchNotFoundError,
  detectState,
  install,
  refreshScript,
  sudoHintForPatch,
  uninstall
} from './patcher';
import { findWorkbenchHtml, userScriptPath } from './paths';

let statusBarItem: vscode.StatusBarItem;

const stateLabel: Record<PatchState, string> = {
  'installed': '$(check) Auto Retry: on',
  'not-installed': '$(circle-slash) Auto Retry: off',
  'needs-reapply': '$(warning) Auto Retry: reapply'
};

const stateTooltip: Record<PatchState, string> = {
  'installed': 'Auto Retry patch is active. Click to show status.',
  'not-installed': 'Auto Retry is not installed. Click to install.',
  'needs-reapply': 'Antigravity was updated and the patch was removed. Click to reapply.'
};

const stateCommand: Record<PatchState, string> = {
  'installed': 'antigravityAutoRetry.status',
  'not-installed': 'antigravityAutoRetry.install',
  'needs-reapply': 'antigravityAutoRetry.reapply'
};

function refreshStatusBar() {
  const state = detectState();
  statusBarItem.text = stateLabel[state];
  statusBarItem.tooltip = stateTooltip[state];
  statusBarItem.command = stateCommand[state];
  statusBarItem.show();
}

async function handleError(err: unknown) {
  if (err instanceof WorkbenchNotFoundError) {
    await vscode.window.showErrorMessage(
      'Antigravity installation not found. Is this running inside Antigravity?'
    );
    return;
  }
  if (err instanceof PermissionError) {
    const workbenchHtml = findWorkbenchHtml();
    const hint = workbenchHtml ? sudoHintForPatch(workbenchHtml) : err.message;
    const choice = await vscode.window.showErrorMessage(
      `Permission denied writing to Antigravity files.\n\n${hint}`,
      { modal: true },
      'Copy Command'
    );
    if (choice === 'Copy Command') {
      await vscode.env.clipboard.writeText(hint);
    }
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  await vscode.window.showErrorMessage(`Antigravity Auto Retry: ${message}`);
}

async function runInstall(extensionDir: string, reapply: boolean) {
  try {
    const { scriptPath } = install(extensionDir);
    const verb = reapply ? 'Reapplied' : 'Installed';
    const choice = await vscode.window.showInformationMessage(
      `${verb}. Reload the window for the patch to take effect.`,
      'Reload Window',
      'Open Retry Script'
    );
    if (choice === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else if (choice === 'Open Retry Script') {
      const doc = await vscode.workspace.openTextDocument(scriptPath);
      await vscode.window.showTextDocument(doc);
    }
  } catch (err) {
    await handleError(err);
  } finally {
    refreshStatusBar();
  }
}

async function runUninstall() {
  try {
    const { restored } = uninstall();
    const detail = restored
      ? 'workbench.html restored from backup.'
      : 'Backup was missing; stripped the script block instead.';
    const choice = await vscode.window.showInformationMessage(
      `Uninstalled. ${detail} Reload the window to drop the script.`,
      'Reload Window'
    );
    if (choice === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    await handleError(err);
  } finally {
    refreshStatusBar();
  }
}

async function showStatus() {
  const state = detectState();
  const workbenchHtml = findWorkbenchHtml();
  const lines = [
    `State: ${state}`,
    `Workbench: ${workbenchHtml ?? '(not found)'}`,
    `Retry script: ${userScriptPath()}`
  ];
  await vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
}

async function runRefreshScript(context: vscode.ExtensionContext) {
  try {
    const choice = await vscode.window.showWarningMessage(
      'Refresh the retry script from the bundled version?',
      {
        modal: true,
        detail: `Overwrites ${userScriptPath()} with the script shipped with this extension. If you've customized that file, back it up first.`
      },
      'Back up & Refresh',
      'Refresh (no backup)'
    );
    if (!choice) return;

    const { backupPath: bak, wasOverwrite } = refreshScript(
      context.extensionPath,
      choice === 'Back up & Refresh'
    );

    const summary = wasOverwrite
      ? bak
        ? `Retry script refreshed. Previous version saved to ${bak}.`
        : 'Retry script refreshed.'
      : 'Retry script seeded (no previous version existed).';

    const nextAction: 'Reload Window' | 'Install Patch' =
      detectState() === 'installed' ? 'Reload Window' : 'Install Patch';

    const pick = await vscode.window.showInformationMessage(
      `${summary} ${
        nextAction === 'Reload Window'
          ? 'Reload the window for the new script to take effect.'
          : 'Run "Antigravity Auto Retry: Install" to patch workbench.html with it.'
      }`,
      nextAction
    );

    if (pick === 'Reload Window') {
      await vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else if (pick === 'Install Patch') {
      await runInstall(context.extensionPath, false);
    }
  } catch (err) {
    await handleError(err);
  } finally {
    refreshStatusBar();
  }
}

async function openScript() {
  const uri = vscode.Uri.file(userScriptPath());
  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  } catch {
    await vscode.window.showWarningMessage(
      'Retry script not found. Run "Antigravity Auto Retry: Install" first.'
    );
  }
}

async function maybeNudge(context: vscode.ExtensionContext) {
  const state = detectState();
  if (state === 'installed') return;

  if (state === 'not-installed') {
    const shownKey = 'firstRunPromptShown';
    if (context.globalState.get<boolean>(shownKey)) return;
    await context.globalState.update(shownKey, true);

    const choice = await vscode.window.showInformationMessage(
      'Antigravity Auto Retry is installed. Apply the workbench patch now so it runs on every launch?',
      'Install Patch',
      'Later'
    );
    if (choice === 'Install Patch') {
      await runInstall(context.extensionPath, false);
    }
    return;
  }

  // needs-reapply — nudge with a 6h cooldown so we don't nag after every reload.
  const lastNudgeKey = 'lastReapplyNudge';
  const last = context.globalState.get<number>(lastNudgeKey, 0);
  const now = Date.now();
  if (now - last < 6 * 60 * 60 * 1000) return;

  await context.globalState.update(lastNudgeKey, now);
  const choice = await vscode.window.showWarningMessage(
    'Antigravity Auto Retry: patch is missing (likely an app update). Reapply?',
    'Reapply',
    'Later'
  );
  if (choice === 'Reapply') {
    await runInstall(context.extensionPath, true);
  }
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0
  );
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('antigravityAutoRetry.install', () =>
      runInstall(context.extensionPath, false)
    ),
    vscode.commands.registerCommand('antigravityAutoRetry.reapply', () =>
      runInstall(context.extensionPath, true)
    ),
    vscode.commands.registerCommand('antigravityAutoRetry.uninstall', runUninstall),
    vscode.commands.registerCommand('antigravityAutoRetry.refreshScript', () =>
      runRefreshScript(context)
    ),
    vscode.commands.registerCommand('antigravityAutoRetry.status', showStatus),
    vscode.commands.registerCommand('antigravityAutoRetry.openScript', openScript)
  );

  refreshStatusBar();
  void maybeNudge(context);
}

export function deactivate() {
  statusBarItem?.dispose();
}
