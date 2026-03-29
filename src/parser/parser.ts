import { Point3D, MoveType, GCodeLayer, GCodeParsedData } from './types';
import { parseLine, isExtrudingMove, parseLayerComment } from './parserUtils';

export class GCodeParser {
    /** Parse a full GCode string into layers and bounding box. */
    public parse(gcode: string): GCodeParsedData {
        const lines = gcode.split(/\r?\n/);
        const layers: GCodeLayer[] = [];
        
        let currentPos: Point3D = { x: 0, y: 0, z: 0 };
        let currentLayerIndex = -1;
        let currentLayer: GCodeLayer | null = null;
        let ePos = 0;
        let extruderRelative = false;
        let absolutePositioning = true;

        let currentPrintZ: number | null = null;
        let pendingLayerFromComment: number | null = null;
        
        const minPos: Point3D = { x: Infinity, y: Infinity, z: Infinity };
        const maxPos: Point3D = { x: -Infinity, y: -Infinity, z: -Infinity };

        const createLayer = (z: number) => {
            currentLayerIndex++;
            currentLayer = { index: currentLayerIndex, zHeight: z, commands: [] };
            layers.push(currentLayer);
            currentPrintZ = z;
            pendingLayerFromComment = null;
        };

        for (const line of lines) {
            const pl = parseLine(line);

            // Track layer hints from slicer comments (e.g. ;LAYER:3)
            const layerIdx = parseLayerComment(pl.comment);
            if (layerIdx !== null) { pendingLayerFromComment = layerIdx; }

            // Skip blank lines and comment-only lines
            if (pl.isCommentOnly || pl.command === '') { continue; }

            const cmd = pl.command;

            // Update positioning/extruder mode (mutually exclusive groups)
            switch (cmd) {
                case 'G90': absolutePositioning = true;  break;
                case 'G91': absolutePositioning = false; break;
                case 'M82': extruderRelative = false;    break;
                case 'M83': extruderRelative = true;     break;
            }

            if (cmd === 'G0' || cmd === 'G1') {
                const nextPos = { ...currentPos };
                let extrudingThisMove = false;
                
                for (const [letter, val] of pl.params) {
                    if (letter === 'X') {
                        nextPos.x = absolutePositioning ? val : currentPos.x + val;
                    } else if (letter === 'Y') {
                        nextPos.y = absolutePositioning ? val : currentPos.y + val;
                    } else if (letter === 'Z') {
                        nextPos.z = absolutePositioning ? val : currentPos.z + val;
                    } else if (letter === 'E') {
                        extrudingThisMove = isExtrudingMove(extruderRelative, val, ePos);
                        ePos = extruderRelative ? ePos + val : val;
                    }
                }
                
                const type = extrudingThisMove ? MoveType.Print : MoveType.Travel;

                if (type === MoveType.Print) {
                    const targetZ = nextPos.z;
                    if (currentLayer === null || targetZ !== currentPrintZ || pendingLayerFromComment !== null) {
                        createLayer(targetZ);
                    }
                }
                
                if (currentPos.x !== nextPos.x || currentPos.y !== nextPos.y || currentPos.z !== nextPos.z) {
                    minPos.x = Math.min(minPos.x, nextPos.x);
                    minPos.y = Math.min(minPos.y, nextPos.y);
                    minPos.z = Math.min(minPos.z, nextPos.z);
                    maxPos.x = Math.max(maxPos.x, nextPos.x);
                    maxPos.y = Math.max(maxPos.y, nextPos.y);
                    maxPos.z = Math.max(maxPos.z, nextPos.z);

                    // Re-read currentLayer; TypeScript cannot track that createLayer()
                    // (a closure) mutated the outer variable, so we use a cast.
                    const layer = currentLayer as GCodeLayer | null;
                    if (layer) {
                        layer.commands.push({
                            type,
                            start: { ...currentPos },
                            end: { ...nextPos },
                            layerIndex: currentLayerIndex,
                            extruding: extrudingThisMove
                        });
                    }
                }
                currentPos = nextPos;
            } else if (cmd === 'G92') {
                for (const [letter, val] of pl.params) {
                    if (letter === 'E') {
                        ePos = val;
                    } else if (letter === 'X') {
                        currentPos.x = val;
                    } else if (letter === 'Y') {
                        currentPos.y = val;
                    } else if (letter === 'Z') {
                        currentPos.z = val;
                        currentPrintZ = val; // sync target Z
                    }
                }
            }
        }

        const validLayers = layers.filter(l => l.commands.length > 0);
        return { layers: validLayers, boundingBox: { min: minPos, max: maxPos } };
    }
}
