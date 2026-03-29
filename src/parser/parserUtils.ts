// ─────────────────────────────────────────────────────────────────────────────
// Shared GCode Parsing Utilities
// Used by both parser.ts (visualisation) and recovery.ts (print recovery).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedLine {
    raw: string;
    /** Uppercase command token, e.g. "G0", "M104", or "" for comment/blank lines. */
    command: string;
    params: Map<string, number>;
    comment: string;
    isCommentOnly: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command classification sets
// ─────────────────────────────────────────────────────────────────────────────

/** Standard motion commands (G0/G1/G2/G3). */
export const MOTION_COMMANDS = new Set(['G0', 'G1', 'G2', 'G3']);

// ─────────────────────────────────────────────────────────────────────────────
// Core parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a single raw GCode line into its structured components.
 * Handles comment extraction, command token and parameter map.
 */
export function parseLine(raw: string): ParsedLine {
    let code = raw;
    let comment = '';

    const commentIdx = raw.indexOf(';');
    if (commentIdx !== -1) {
        comment = raw.substring(commentIdx);
        code = raw.substring(0, commentIdx);
    }

    const trimmedCode = code.trim();
    const parts = trimmedCode.split(/\s+/).filter(Boolean);
    const command = parts.length > 0 ? parts[0].toUpperCase() : '';
    const params = new Map<string, number>();

    for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (p.length < 2) { continue; }
        const letter = p[0].toUpperCase();
        const val = parseFloat(p.substring(1));
        if (!isNaN(val)) {
            params.set(letter, val);
        }
    }

    return {
        raw,
        command,
        params,
        comment,
        isCommentOnly: trimmedCode === '' && comment !== ''
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extrusion detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the given E parameter value results in extrusion.
 * @param extruderRelative - whether the extruder is in relative mode (M83)
 * @param eVal - the E parameter value from the parsed command (undefined if absent)
 * @param currentE - the current absolute E position
 */
export function isExtrudingMove(
    extruderRelative: boolean,
    eVal: number | undefined,
    currentE: number
): boolean {
    if (eVal === undefined) { return false; }
    if (extruderRelative) { return eVal > 0; }
    return eVal > currentE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer comment parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a slicer-injected `;LAYER:N` comment and return the layer index.
 * Returns null if the comment is not a layer marker.
 */
export function parseLayerComment(comment: string): number | null {
    if (comment.toUpperCase().startsWith(';LAYER:')) {
        const idx = parseInt(comment.substring(7), 10);
        if (!isNaN(idx)) { return idx; }
    }
    return null;
}
