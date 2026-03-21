import * as vscode from 'vscode';
import * as path from 'path';

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
            
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'gcode') {
                lastActiveGCodeUri = editor.document.uri.toString();
                updateWebview(currentPanel, false);
            }
        }
    });

    context.subscriptions.push(openPreviewCommand);

    let timeout: NodeJS.Timeout | undefined = undefined;

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document && event.document.languageId === 'gcode') {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (currentPanel) {
                    lastActiveGCodeUri = editor.document.uri.toString();
                    updateWebview(currentPanel, true);
                }
            }, 500);
        }
    }, null, context.subscriptions);

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'gcode' && currentPanel) {
            const uri = editor.document.uri.toString();
            if (uri !== lastActiveGCodeUri) {
                lastActiveGCodeUri = uri;
                updateWebview(currentPanel, false);
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
        extrusionColor: config.get<string>('extrusionColor', '#ff7a00')
    };
}

function updateWebview(panel: vscode.WebviewPanel, isUpdate: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'gcode') {
        const text = editor.document.getText();
        panel.webview.postMessage({ type: 'parse-gcode', text, isUpdate, config: getConfig() });
    }
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
        body { margin: 0; padding: 0; overflow: hidden; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
        #canvas-container { width: 100vw; height: 100vh; display: block; }
        #ui-layer { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
        .ui-panel { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); padding: 10px; border-radius: 4px; pointer-events: auto; display: flex; gap: 10px; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        input[type="range"] { flex: 1; }
        .layer-info { font-size: 12px; min-width: 100px; text-align: right; }
        #loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; z-index: 9999; color: white; font-size: 20px; font-weight: bold; pointer-events: none; }
    </style>
</head>
<body>
    <div id="ui-layer">
        <div class="ui-panel">
            <button id="btn-play">Play</button>
            <button id="btn-pause">Pause</button>
            <input type="range" id="layer-slider" min="0" max="100" value="100" />
            <div class="layer-info">Layer: <span id="layer-value">0</span> / <span id="layer-max">0</span> (<span id="layer-z">0.00</span>mm)</div>
        </div>
        <div class="ui-panel" style="width: fit-content;">
            <label><input type="checkbox" id="toggle-travel" checked> Show Travel</label>
        </div>
    </div>
    <div id="loading-overlay">Parsing GCode...</div>
    <div id="canvas-container"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

