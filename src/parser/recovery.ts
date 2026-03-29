import { ParsedLine, MOTION_COMMANDS, parseLine, isExtrudingMove, parseLayerComment } from './parserUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PrinterState {
    x: number;
    y: number;
    z: number;
    e: number;
    f: number | null;
    absolutePositioning: boolean;
    extruderRelative: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command sets
// ─────────────────────────────────────────────────────────────────────────────

/** Homing/probing commands that physically alter Z — removed during recovery setup. */
const Z_ALTERING_SETUP_COMMANDS = new Set([
    'G28', 'G29', 'G30', 'G31', 'G32', 'G33', 'G34',
    'G38.2', 'G38.3', 'G38.4', 'G38.5',
    'G53'
]);

/** Format a number for GCode output (trim trailing zeros). */
const fmt = (n: number) => n.toFixed(3).replace(/\.?0+$/, '');

// ─────────────────────────────────────────────────────────────────────────────
// State helpers
// ─────────────────────────────────────────────────────────────────────────────

function applyMotionToState(state: PrinterState, parsed: ParsedLine): PrinterState {
    const next = { ...state };
    const abs = state.absolutePositioning;

    if (parsed.params.has('X')) { next.x = abs ? parsed.params.get('X')! : state.x + parsed.params.get('X')!; }
    if (parsed.params.has('Y')) { next.y = abs ? parsed.params.get('Y')! : state.y + parsed.params.get('Y')!; }
    if (parsed.params.has('Z')) { next.z = abs ? parsed.params.get('Z')! : state.z + parsed.params.get('Z')!; }
    if (parsed.params.has('E')) {
        const eVal = parsed.params.get('E')!;
        next.e = !state.extruderRelative ? eVal : state.e + eVal;
    }
    if (parsed.params.has('F')) { next.f = parsed.params.get('F')!; }

    return next;
}

function applyCoordinateReset(state: PrinterState, parsed: ParsedLine): PrinterState {
    const next = { ...state };
    if (parsed.params.has('X')) { next.x = parsed.params.get('X')!; }
    if (parsed.params.has('Y')) { next.y = parsed.params.get('Y')!; }
    if (parsed.params.has('Z')) { next.z = parsed.params.get('Z')!; }
    if (parsed.params.has('E')) { next.e = parsed.params.get('E')!; }
    return next;
}

function applyPositioningMode(state: PrinterState, command: string): PrinterState {
    const next = { ...state };
    if (command === 'G90') { next.absolutePositioning = true; }
    if (command === 'G91') { next.absolutePositioning = false; }
    if (command === 'M82') { next.extruderRelative = false; }
    if (command === 'M83') { next.extruderRelative = true; }
    return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Header
// ─────────────────────────────────────────────────────────────────────────────

function extractHeader(parsedLines: ParsedLine[]): { headerCount: number } {
    let headerCount = 0;
    for (const pl of parsedLines) {
        if (pl.isCommentOnly || (pl.command === '' && pl.comment === '' && pl.raw.trim() === '')) {
            headerCount++;
        } else {
            break;
        }
    }
    return { headerCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Setup block
// ─────────────────────────────────────────────────────────────────────────────

interface SetupResult {
    lines: string[];
    setupLineCount: number;
    stateAfterSetup: PrinterState;
}

function buildSetupBlock(
    parsedLines: ParsedLine[],
    startIndex: number,
    initialState: PrinterState
): SetupResult {
    const lines: string[] = [];
    let state = { ...initialState };
    let i = startIndex;

    for (; i < parsedLines.length; i++) {
        const pl = parsedLines[i];

        state = applyPositioningMode(state, pl.command);

        if (pl.isCommentOnly || pl.command === '') {
            lines.push(pl.raw);
            continue;
        }

        if (MOTION_COMMANDS.has(pl.command)) {
            const willExtrude = isExtrudingMove(state.extruderRelative, pl.params.get('E'), state.e);

            if (willExtrude) {
                break; // first print move — setup phase ends here
            }

            if (pl.params.has('Z')) {
                // Skip Z moves to preserve the operator's manual Z position
                lines.push(`; [recovery] removed Z move: ${pl.raw.trim()}`);
                const newState = applyMotionToState(state, pl);
                state.x = newState.x;
                state.y = newState.y;
                if (pl.params.has('F')) { state.f = newState.f; }
                // intentionally do NOT update state.z
            } else {
                lines.push(pl.raw);
                state = applyMotionToState(state, pl);
            }
            continue;
        }

        if (pl.command === 'G92') {
            if (pl.params.has('Z')) {
                // Strip Z from G92 to avoid overriding the operator's Z position
                const remaining: string[] = [];
                for (const [k, v] of pl.params) {
                    if (k !== 'Z') { remaining.push(`${k}${fmt(v)}`); }
                }
                const rebuilt = remaining.length > 0
                    ? `G92 ${remaining.join(' ')}${pl.comment ? ' ' + pl.comment : ''}`
                    : `; [recovery] removed G92 Z: ${pl.raw.trim()}`;
                lines.push(rebuilt);

                const newState = applyCoordinateReset(state, pl);
                state.x = newState.x;
                state.y = newState.y;
                state.e = newState.e;
                // intentionally do NOT update state.z
            } else {
                lines.push(pl.raw);
                state = applyCoordinateReset(state, pl);
            }
            continue;
        }

        if (Z_ALTERING_SETUP_COMMANDS.has(pl.command)) {
            lines.push(`; [recovery] removed Z-altering command: ${pl.raw.trim()}`);
            continue;
        }

        lines.push(pl.raw);
    }

    return { lines, setupLineCount: i - startIndex, stateAfterSetup: state };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Print body
// ─────────────────────────────────────────────────────────────────────────────

interface PrintBodyResult {
    lines: string[];
    stateAtCutPoint: PrinterState;
}

function buildPrintBody(
    parsedLines: ParsedLine[],
    startIndex: number,
    targetLayerIndex: number,
    initialState: PrinterState
): PrintBodyResult {
    let state = { ...initialState };
    let currentLayerIndex = -1;
    let currentPrintZ: number | null = null;
    let pendingLayerComment: number | null = null;

    const output: string[] = [];
    let stateAtCutPoint = { ...state };
    let cutReached = false;

    for (let i = startIndex; i < parsedLines.length; i++) {
        const pl = parsedLines[i];

        const layerIdx = parseLayerComment(pl.comment);
        if (layerIdx !== null) { pendingLayerComment = layerIdx; }

        state = applyPositioningMode(state, pl.command);

        if (pl.isCommentOnly || pl.command === '') {
            if (cutReached) { output.push(pl.raw); }
            continue;
        }

        if (MOTION_COMMANDS.has(pl.command)) {
            const willExtrude = isExtrudingMove(state.extruderRelative, pl.params.get('E'), state.e);

            if (willExtrude) {
                const nextState = applyMotionToState(state, pl);

                if (currentLayerIndex === -1 || nextState.z !== currentPrintZ || pendingLayerComment !== null) {
                    currentLayerIndex++;
                    currentPrintZ = nextState.z;
                    pendingLayerComment = null;
                }

                if (!cutReached && currentLayerIndex === targetLayerIndex) {
                    cutReached = true;
                    stateAtCutPoint = { ...state };
                }

                state = nextState;
            } else {
                state = applyMotionToState(state, pl);
            }

            if (cutReached) { output.push(pl.raw); }
            continue;
        }

        if (pl.command === 'G92') {
            state = applyCoordinateReset(state, pl);
            if (cutReached) { output.push(pl.raw); }
            continue;
        }

        if (cutReached) { output.push(pl.raw); }
    }

    return { lines: output, stateAtCutPoint };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Recovery injection block
// ─────────────────────────────────────────────────────────────────────────────

function buildRecoveryBlock(
    purgeGCode: string,
    stateAtCut: PrinterState,
    absolutePositioning: boolean
): string[] {
    const lines: string[] = [];

    lines.push('');
    lines.push('; ── RECOVERY BLOCK ─────────────────────────────────────────────');

    if (purgeGCode && purgeGCode.trim().length > 0) {
        lines.push('; Purge sequence');
        const purgeLines = purgeGCode.replace(/\\n/g, '\n').split('\n');
        for (const pl of purgeLines) {
            if (pl.trim()) { lines.push(pl.trim()); }
        }
    }

    lines.push(`G92 E${fmt(stateAtCut.e)} ; Sync extruder position`);

    // Lift → XY → descend to avoid dragging nozzle across the print
    if (!absolutePositioning) { lines.push('G90 ; Switch to absolute for recovery positioning'); }
    lines.push(`G0 Z${fmt(stateAtCut.z + 2.0)} F3000 ; Lift before XY travel`);
    lines.push(`G0 X${fmt(stateAtCut.x)} Y${fmt(stateAtCut.y)} F3000 ; Move to resume XY`);
    lines.push(`G0 Z${fmt(stateAtCut.z)} F3000 ; Descend to print Z`);
    if (!absolutePositioning) { lines.push('G91 ; Restore relative positioning'); }
    if (stateAtCut.f !== null) { lines.push(`G0 F${fmt(stateAtCut.f)} ; Restore feedrate`); }

    lines.push('; ── END RECOVERY BLOCK ─────────────────────────────────────────');
    lines.push('');

    return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Crop a GCode file at `targetLayerIndex` and inject a recovery block for resuming the print. */
export function recoverGCode(gcode: string, targetLayerIndex: number, purgeGCode: string): string {
    const rawLines = gcode.split(/\r?\n/);
    const parsedLines = rawLines.map(parseLine);

    const initialState: PrinterState = {
        x: 0, y: 0, z: 0, e: 0, f: null,
        absolutePositioning: true,
        extruderRelative: false
    };

    const { headerCount } = extractHeader(parsedLines);
    const headerLines = rawLines.slice(0, headerCount);

    const setupResult = buildSetupBlock(parsedLines, headerCount, initialState);
    const setupEndIndex = headerCount + setupResult.setupLineCount;

    const printResult = buildPrintBody(
        parsedLines,
        setupEndIndex,
        targetLayerIndex,
        setupResult.stateAfterSetup
    );

    const recoveryBlock = buildRecoveryBlock(
        purgeGCode,
        printResult.stateAtCutPoint,
        printResult.stateAtCutPoint.absolutePositioning
    );

    return [
        ...headerLines,
        ...setupResult.lines,
        ...recoveryBlock,
        ...printResult.lines
    ].join('\n');
}
