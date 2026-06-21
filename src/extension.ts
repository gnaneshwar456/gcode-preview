import * as vscode from 'vscode';
import * as path from 'path';
import { recoverGCode } from './parser/recovery';

export function activate(context: vscode.ExtensionContext) {
    console.log('GCode Preview Extension Activated');

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let lastActiveGCodeUri: string | undefined = undefined;

    const openPreviewCommand = vscode.commands.registerCommand('gcode-preview.openPreview', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Two);
        } else {
            currentPanel = vscode.window.createWebviewPanel(
                'gcodePreview',
                'GCode Preview',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist'))]
                }
            );

            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
                lastActiveGCodeUri = undefined;
            }, null, context.subscriptions);

            currentPanel.webview.html = getWebviewContent(currentPanel.webview, context);
            
            currentPanel.webview.onDidReceiveMessage(async message => {
                if (message.type === 'crop-gcode') {
                    if (!lastActiveGCodeUri) {
                        vscode.window.showErrorMessage('No active GCode document assigned to this preview.');
                        return;
                    }
                    await handleCropGCode(message.startLayer, context, lastActiveGCodeUri);
                }
            }, undefined, context.subscriptions);

            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'gcode') {
                lastActiveGCodeUri = editor.document.uri.toString();
                updateWebview(currentPanel, editor.document, false);
            }
        }
    });

    context.subscriptions.push(openPreviewCommand);

    let debounceTimeout: NodeJS.Timeout | undefined = undefined;

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document && event.document.languageId === 'gcode') {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                if (currentPanel) {
                    lastActiveGCodeUri = editor.document.uri.toString();
                    updateWebview(currentPanel, editor.document, true);
                }
            }, 500);
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'gcode' && currentPanel) {
            const uri = editor.document.uri.toString();
            if (uri !== lastActiveGCodeUri) {
                lastActiveGCodeUri = uri;
                updateWebview(currentPanel, editor.document, false);
            }
        }
    }, null, context.subscriptions);
    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('gcodePreview') && currentPanel) {
            currentPanel.webview.postMessage({ type: 'config-update', config: getConfig() });
        }
    }, null, context.subscriptions);
}

function getConfig() {
    const config = vscode.workspace.getConfiguration('gcodePreview');
    return {
        bedSize: config.get<number>('bedSize', 220),
        theme: config.get<'dark' | 'light'>('theme', 'dark'),
        extrusionColor: config.get<string>('extrusionColor', '#ff7a00'),
        recoveryPurgeGCode: config.get<string>('recoveryPurgeGCode', 'G1 E10 F300\n')
    };
}

async function handleCropGCode(startLayer: number, context: vscode.ExtensionContext, gcodeUriStr: string) {
    let text = '';
    const uri = vscode.Uri.parse(gcodeUriStr);
    
    try {
        const fileData = await vscode.workspace.fs.readFile(uri);
        text = Buffer.from(fileData).toString('utf8');
    } catch(e) {
        vscode.window.showErrorMessage('Failed to read GCode file: ' + e);
        return;
    }

    try {
        const config = getConfig();
        const recoveredText = recoverGCode(text, startLayer, config.recoveryPurgeGCode);

        const defaultUri = vscode.Uri.file(uri.fsPath.replace(/\.gcode$/i, `_recovered_L${startLayer}.gcode`));
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: {
                'GCode Files': ['gcode', 'gco', 'g']
            },
            title: 'Save Recovered GCode'
        });

        if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(recoveredText, 'utf8'));
            vscode.window.showInformationMessage(`Recovered GCode saved successfully to ${path.basename(saveUri.fsPath)}`);
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage('Failed to recover GCode: ' + msg);
    }
}

/**
 * Sends the GCode content to the webview for parsing.
 * Accepts the TextDocument directly to avoid reading stale editor state.
 */
function updateWebview(panel: vscode.WebviewPanel, document: vscode.TextDocument, isUpdate: boolean) {
    if (document.languageId !== 'gcode') { return; }
    const text = document.getText();
    panel.webview.postMessage({ type: 'parse-gcode', text, isUpdate, config: getConfig() });
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js')));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>GCode Preview</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            overflow: hidden;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
            font-size: 12px;
        }

        #canvas-container {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
        }

        /* ─── Overlay UI ─────────────────────────────────────────────── */
        #ui-layer {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 10;
        }

        /* ─── Panel base ─────────────────────────────────────────────── */
        .panel {
            pointer-events: auto;
            background: var(--vscode-editorWidget-background, rgba(30,30,30,0.92));
            border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
            border-radius: 8px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            transition: box-shadow 0.2s ease;
        }
        .panel:hover {
            box-shadow: 0 6px 32px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.3);
        }

        /* ─── Divider ────────────────────────────────────────────────── */
        .divider {
            width: 1px;
            align-self: stretch;
            background: var(--vscode-widget-border, rgba(255,255,255,0.1));
            margin: 0 2px;
            flex-shrink: 0;
        }

        /* ─── Section header ─────────────────────────────────────────── */
        .section-label {
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground, #888);
            margin-bottom: 4px;
            white-space: nowrap;
        }

        /* ─── TOP BAR ────────────────────────────────────────────────── */
        #top-bar {
            position: absolute;
            top: 12px;
            left: 12px;
            right: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: stretch;
        }

        /* ─── Playback Panel ─────────────────────────────────────────── */
        #panel-playback {
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
        }
        .playback-buttons {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .icon-btn {
            background: transparent;
            border: 1px solid transparent;
            color: var(--vscode-button-foreground, #ccc);
            cursor: pointer;
            border-radius: 6px;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, border-color 0.15s, transform 0.1s;
            line-height: 0;
        }
        .icon-btn:hover {
            background: var(--vscode-button-hoverBackground, rgba(255,255,255,0.1));
            border-color: var(--vscode-widget-border, rgba(255,255,255,0.15));
            transform: translateY(-1px);
        }
        .icon-btn:active { transform: scale(0.95); }
        .icon-btn svg { width: 16px; height: 16px; fill: currentColor; }

        .icon-btn.primary {
            background: var(--vscode-button-background, #0078d4);
            color: var(--vscode-button-foreground, #fff);
            padding: 6px 8px;
        }
        .icon-btn.primary:hover {
            background: var(--vscode-button-hoverBackground, #106ebe);
        }

        /* ─── Layer Panel ────────────────────────────────────────────── */
        #panel-layers {
            padding: 8px 14px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex: 1;
            min-width: 200px;
        }
        .slider-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .slider-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground, #888);
            width: 28px;
            flex-shrink: 0;
        }
        input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            appearance: none;
            height: 4px;
            border-radius: 2px;
            background: var(--vscode-scrollbarSlider-background, rgba(255,255,255,0.15));
            outline: none;
            cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: var(--vscode-button-background, #0078d4);
            border: 2px solid var(--vscode-editorWidget-background, #1e1e1e);
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            cursor: pointer;
            transition: transform 0.1s;
        }
        input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        input[type="range"]#layer-slider-start::-webkit-slider-thumb {
            background: var(--vscode-charts-blue, #4da3ff);
        }
        .slider-value {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-editor-foreground, #ccc);
            width: 32px;
            text-align: right;
            flex-shrink: 0;
            font-variant-numeric: tabular-nums;
        }
        .goto-row {
            margin-top: 3px;
            padding-top: 6px;
            border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
        }
        input[type="number"].num-input {
            flex: 1;
            min-width: 0;
            background: var(--vscode-input-background, #2a2a2a);
            color: var(--vscode-input-foreground, #ccc);
            border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.15));
            border-radius: 4px;
            padding: 3px 6px;
            font-size: 11px;
            font-variant-numeric: tabular-nums;
            outline: none;
            -moz-appearance: textfield;
            appearance: textfield;
        }
        input[type="number"].num-input::-webkit-outer-spin-button,
        input[type="number"].num-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type="number"].num-input:focus {
            border-color: var(--vscode-focusBorder, #0078d4);
        }
        #btn-goto-layer {
            flex-shrink: 0;
        }

        /* ─── Current-Layer Move Scrubber ───────────────────────────── */
        #panel-move {
            flex: 1 1 100%;
            padding: 8px 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .move-row input[type="range"] {
            flex: 1;
        }
        .move-row .slider-value {
            width: auto;
            min-width: 56px;
        }
        .move-detail {
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #888);
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        input[type="range"]#layer-move-slider::-webkit-slider-thumb {
            background: #ff2d55;
        }

        /* ─── Playback Speed ─────────────────────────────────────────── */
        #panel-playback {
            min-width: 152px;
        }
        .speed-control {
            margin-top: 4px;
            padding-top: 6px;
            border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .speed-control-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .speed-value-wrap {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }
        .speed-value-wrap .num-input {
            width: 40px;
            flex: none;
            text-align: right;
            padding: 2px 5px;
        }
        .speed-value-wrap .unit {
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #888);
        }
        input[type="range"]#play-speed-slider::-webkit-slider-thumb {
            background: var(--vscode-charts-orange, #d18616);
        }

        /* ─── Info Panel ─────────────────────────────────────────────── */
        #panel-info {
            padding: 8px 14px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 5px;
            min-width: 130px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: auto auto;
            gap: 2px 10px;
            align-items: center;
        }
        .info-key {
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #888);
            white-space: nowrap;
        }
        .info-val {
            font-size: 11px;
            font-weight: 700;
            color: var(--vscode-editor-foreground, #e0e0e0);
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
        }
        .info-val .unit {
            font-size: 9px;
            font-weight: 400;
            color: var(--vscode-descriptionForeground, #888);
        }

        /* ─── BOTTOM BAR ─────────────────────────────────────────────── */
        #bottom-bar {
            position: absolute;
            bottom: 12px;
            left: 12px;
            display: flex;
            gap: 8px;
            align-items: stretch;
        }

        /* ─── View Options Panel ─────────────────────────────────────── */
        #panel-view {
            padding: 8px 14px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 6px;
        }
        .toggle-group {
            display: flex;
            align-items: center;
            gap: 7px;
            transition: opacity 0.15s;
        }
        .toggle-group.subgroup {
            margin-left: 4px;
            padding-left: 10px;
            border-left: 2px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
        }
        .toggle-group.disabled {
            opacity: 0.4;
            pointer-events: none;
        }
        .toggle-label {
            font-size: 11px;
            color: var(--vscode-editor-foreground, #ccc);
            cursor: pointer;
            user-select: none;
        }
        /* Custom checkbox toggle */
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 30px;
            height: 16px;
            flex-shrink: 0;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .toggle-track {
            position: absolute;
            inset: 0;
            background: var(--vscode-scrollbarSlider-background, rgba(255,255,255,0.15));
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .toggle-track::after {
            content: '';
            position: absolute;
            width: 12px; height: 12px;
            top: 2px; left: 2px;
            background: #fff;
            border-radius: 50%;
            transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle-switch input:checked + .toggle-track {
            background: var(--vscode-button-background, #0078d4);
        }
        .toggle-switch input:checked + .toggle-track::after {
            transform: translateX(14px);
        }

        /* ─── Recovery Panel ─────────────────────────────────────────── */
        #panel-recovery {
            padding: 8px 14px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .recovery-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .recovery-layer-display {
            font-size: 11px;
            font-weight: 700;
            color: var(--vscode-editor-foreground, #e0e0e0);
            font-variant-numeric: tabular-nums;
        }
        .recovery-sublabel {
            font-size: 9px;
            color: var(--vscode-descriptionForeground, #888);
        }
        .recover-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: transparent;
            border: 1px solid var(--vscode-charts-orange, #e8a030);
            color: var(--vscode-charts-orange, #e8a030);
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            font-family: inherit;
            transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
            white-space: nowrap;
            line-height: 1;
        }
        .recover-btn:hover {
            background: rgba(232, 160, 48, 0.12);
            transform: translateY(-1px);
            box-shadow: 0 3px 12px rgba(232, 160, 48, 0.2);
        }
        .recover-btn:active { transform: scale(0.97); }
        .recover-btn svg { width: 14px; height: 14px; fill: currentColor; flex-shrink: 0; }

        /* ─── Loading Overlay ────────────────────────────────────────── */
        #loading-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.72);
            display: none;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            gap: 16px;
            pointer-events: none;
        }
        .loading-spinner {
            width: 36px; height: 36px;
            border: 3px solid rgba(255,255,255,0.12);
            border-top-color: var(--vscode-button-background, #0078d4);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text {
            font-size: 13px;
            font-weight: 500;
            color: rgba(255,255,255,0.8);
            letter-spacing: 0.03em;
        }
    </style>
</head>
<body>
    <div id="canvas-container"></div>

    <div id="ui-layer">

        <!-- ── TOP BAR ──────────────────────────────────────────── -->
        <div id="top-bar">

            <!-- Playback Controls -->
            <div id="panel-playback" class="panel">
                <div class="section-label">Playback</div>
                <div class="playback-buttons">
                    <button id="btn-play" class="icon-btn primary" title="Play layer animation">
                        <svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>
                    </button>
                    <button id="btn-pause" class="icon-btn" title="Pause animation">
                        <svg viewBox="0 0 16 16"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
                    </button>
                </div>
                <div class="speed-control">
                    <div class="speed-control-header">
                        <span class="slider-label">Speed</span>
                        <span class="speed-value-wrap">
                            <input type="number" id="play-speed-input" class="num-input" min="0.1" max="500" step="0.1" value="10" title="Layers per second — type for an exact value" />
                            <span class="unit">L/s</span>
                        </span>
                    </div>
                    <input type="range" id="play-speed-slider" min="0" max="200" value="0" title="Drag for quick speed adjustment" />
                </div>
            </div>

            <!-- Layer Range Sliders -->
            <div id="panel-layers" class="panel">
                <div class="section-label">Layer Range</div>
                <div class="slider-row">
                    <span class="slider-label">Start</span>
                    <input type="range" id="layer-slider-start" min="0" max="100" value="0" />
                    <span class="slider-value" id="slider-start-val">0</span>
                </div>
                <div class="slider-row">
                    <span class="slider-label">End</span>
                    <input type="range" id="layer-slider-end" min="0" max="100" value="100" />
                    <span class="slider-value" id="slider-end-val">0</span>
                </div>
                <div class="slider-row goto-row">
                    <span class="slider-label">Go to</span>
                    <input type="number" id="layer-goto-input" class="num-input" min="0" max="100" value="0" />
                    <button id="btn-goto-layer" class="icon-btn" title="Jump to layer (Enter)">
                        <svg viewBox="0 0 16 16"><path d="M2 8h10M8 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </div>

            <!-- Layer & Z Info -->
            <div id="panel-info" class="panel">
                <div class="section-label">Info</div>
                <div class="info-grid">
                    <span class="info-key">Layers</span>
                    <span class="info-val"><span id="layer-value">0–0</span>&nbsp;/&nbsp;<span id="layer-max">0</span></span>
                    <span class="info-key">Z start</span>
                    <span class="info-val"><span id="layer-z-start">0.00</span> <span class="unit">mm</span></span>
                    <span class="info-key">Z end</span>
                    <span class="info-val"><span id="layer-z">0.00</span> <span class="unit">mm</span></span>
                </div>
            </div>

            <!-- Move scrubber: scrubs through individual moves of the currently
                 displayed (top) layer, so the nozzle's exact path can be inspected
                 move-by-move instead of jumping whole layers at a time. -->
            <div id="panel-move" class="panel">
                <div class="section-label">Current Layer — Move Scrubber</div>
                <div class="slider-row move-row">
                    <span class="slider-label">Move</span>
                    <input type="range" id="layer-move-slider" min="0" max="0" value="0" title="Scrub through this layer's moves in order" />
                    <span class="slider-value" id="move-value-label">0/0</span>
                </div>
                <div class="move-detail" id="move-detail-label">Full layer shown</div>
            </div>

        </div>

        <!-- ── BOTTOM BAR ────────────────────────────────────────── -->
        <div id="bottom-bar">

            <!-- View Options -->
            <div id="panel-view" class="panel">
                <div class="section-label">View</div>
                <div class="toggle-group">
                    <label class="toggle-switch" for="toggle-travel" title="Show or hide travel moves">
                        <input type="checkbox" id="toggle-travel" checked />
                        <span class="toggle-track"></span>
                    </label>
                    <label class="toggle-label" for="toggle-travel">Travel moves</label>
                </div>
                <div class="toggle-group subgroup" id="travel-current-layer-group">
                    <label class="toggle-switch" for="toggle-travel-current-layer" title="Only show travel moves on the currently displayed (top) layer — useful for spotting the nozzle striking earlier layers">
                        <input type="checkbox" id="toggle-travel-current-layer" />
                        <span class="toggle-track"></span>
                    </label>
                    <label class="toggle-label" for="toggle-travel-current-layer">This layer only</label>
                </div>
            </div>

            <!-- Recovery Tool -->
            <div id="panel-recovery" class="panel">
                <div class="recovery-info">
                    <div class="section-label">Recovery</div>
                    <div class="recovery-layer-display">From layer <span id="recovery-layer-display">0</span></div>
                    <div class="recovery-sublabel">Crops file at the Start layer</div>
                </div>
                <div class="divider"></div>
                <button id="btn-recover" class="recover-btn" title="Generate a recovery GCode starting from the selected Start layer">
                    <svg viewBox="0 0 16 16">
                        <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1H10a.5.5 0 0 1 0 1H2.5A.5.5 0 0 0 2 2.5V14a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V7.5a.5.5 0 0 1 1 0V14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 14V2.5z"/>
                        <path d="M16 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8.5 10.854l-2.147 2.146a.5.5 0 0 1-.707-.707l3-3a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1-.707.707L9.5 10.854V15a.5.5 0 0 1-1 0v-4.146z"/>
                    </svg>
                    Crop &amp; Recover
                </button>
            </div>

        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Parsing GCode…</div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
