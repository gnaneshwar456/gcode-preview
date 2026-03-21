import { Point3D, MoveType, GCodeCommand, GCodeLayer, GCodeParsedData } from './types';

export class GCodeParser {
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

        for (let line of lines) {
            const commentIndex = line.indexOf(';');
            let comment = '';
            if (commentIndex !== -1) {
                comment = line.substring(commentIndex);
                line = line.substring(0, commentIndex);
            }
            
            if (comment.toUpperCase().startsWith(';LAYER:')) {
                const idx = parseInt(comment.substring(7), 10);
                if (!isNaN(idx)) {
                    pendingLayerFromComment = idx;
                }
            }

            line = line.trim();
            if (!line) continue;
            
            const parts = line.split(/\s+/);
            const cmd = parts[0].toUpperCase();

            if (cmd === 'G90') absolutePositioning = true;
            if (cmd === 'G91') absolutePositioning = false;
            
            if (cmd === 'M82') extruderRelative = false;
            if (cmd === 'M83') extruderRelative = true;
            
            if (cmd === 'G0' || cmd === 'G1') {
                const nextPos = { ...currentPos };
                let extrudingThisMove = false;
                
                for (let i = 1; i < parts.length; i++) {
                    const p = parts[i];
                    if (p.length < 2) continue;
                    const letter = p[0].toUpperCase();
                    const val = parseFloat(p.substring(1));
                    
                    if (!isNaN(val)) {
                        if (letter === 'X') nextPos.x = absolutePositioning ? val : currentPos.x + val;
                        else if (letter === 'Y') nextPos.y = absolutePositioning ? val : currentPos.y + val;
                        else if (letter === 'Z') {
                            nextPos.z = absolutePositioning ? val : currentPos.z + val;
                        } else if (letter === 'E') {
                            if (
                                (extruderRelative && val > 0) ||
                                (!extruderRelative && val > ePos)
                            ) {
                                extrudingThisMove = true;
                            }
                            ePos = extruderRelative ? ePos + val : val;                        
                        }
                    }
                }
                
                const type = extrudingThisMove ? MoveType.Print : MoveType.Travel;

                if (type === MoveType.Print) {
                    const targetZ = nextPos.z;
                    if (currentLayer === null || targetZ !== currentPrintZ || pendingLayerFromComment !== null) {
                        createLayer(targetZ);
                    }
                } else if (type === MoveType.Travel && currentLayer === null) {
                    createLayer(nextPos.z);
                }
                
                if (currentPos.x !== nextPos.x || currentPos.y !== nextPos.y || currentPos.z !== nextPos.z) {
                    minPos.x = Math.min(minPos.x, nextPos.x);
                    minPos.y = Math.min(minPos.y, nextPos.y);
                    minPos.z = Math.min(minPos.z, nextPos.z);
                    maxPos.x = Math.max(maxPos.x, nextPos.x);
                    maxPos.y = Math.max(maxPos.y, nextPos.y);
                    maxPos.z = Math.max(maxPos.z, nextPos.z);

                    currentLayer!.commands.push({
                        type,
                        start: { ...currentPos },
                        end: { ...nextPos },
                        layerIndex: currentLayerIndex,
                        extruding: extrudingThisMove
                    });
                }
                currentPos = nextPos;
            } else if (cmd === 'G92') {
                for (let i = 1; i < parts.length; i++) {
                    const p = parts[i];
                    if (p.length < 2) continue;
                    const val = parseFloat(p.substring(1));
                    if (isNaN(val)) continue;
                    const letter = p[0].toUpperCase();
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
