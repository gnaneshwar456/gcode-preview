import * as THREE from 'three';
import { GCodeParsedData, MoveType, Point3D } from '../parser/types';
import { addToScene, clearScenePaths, centerCamera, currentConfig } from './scene';

let currentDataRef: GCodeParsedData | null = null;
let instancedCylinders: THREE.InstancedMesh | null = null;
let instancedSpheres: THREE.InstancedMesh | null = null;
let travelLines: THREE.LineSegments | null = null;
let nozzleMarker: THREE.Mesh | null = null;
let lastStartLayer = -1;
let lastEndLayer = -1;
let lastTravelCurrentOnly = false;
let lastLayerMoveIndex = -1;

/**
 * @param layerMoveIndex How many commands of the TOP layer (endLayerIndex) to draw,
 *        in gcode order — e.g. 50 draws only the first 50 moves of that layer.
 *        Pass Infinity (or the layer's full command count) to show the whole layer,
 *        which matches the original/default behavior. Layers strictly below the top
 *        layer are always drawn in full, same as before.
 */
export function renderGCode(
    data: GCodeParsedData,
    startLayerIndex: number,
    endLayerIndex: number,
    showTravel: boolean,
    travelCurrentLayerOnly: boolean = false,
    layerMoveIndex: number = Infinity,
    isUpdate: boolean = false
) {
    if (!data || data.layers.length === 0) return;

    if (
        currentDataRef !== data ||
        lastStartLayer !== startLayerIndex ||
        lastEndLayer !== endLayerIndex ||
        lastTravelCurrentOnly !== travelCurrentLayerOnly ||
        lastLayerMoveIndex !== layerMoveIndex
    ) {
        // Center camera when loading a new dataset (not on slider updates)
        if (!isUpdate && currentDataRef !== data) {
            centerCamera(data.boundingBox.min, data.boundingBox.max);
        }

        clearScenePaths();
        currentDataRef = data;
        lastStartLayer = startLayerIndex;
        lastEndLayer = endLayerIndex;
        lastTravelCurrentOnly = travelCurrentLayerOnly;
        lastLayerMoveIndex = layerMoveIndex;

        const printMoves: Array<{start: Point3D, end: Point3D}> = [];
        const travelVertices: number[] = [];
        let lastShownCommand: { start: Point3D, end: Point3D } | null = null;
        let firstTopLayerCommand: { start: Point3D, end: Point3D } | null = null;

        for (let i = 0; i < data.layers.length; i++) {
            const layer = data.layers[i];

            if (i >= startLayerIndex && i <= endLayerIndex) {
                const isTopLayer = (i === endLayerIndex);
                // Only the top (currently displayed) layer gets cut short mid-layer;
                // every earlier layer in the range is always drawn in full.
                const commandLimit = isTopLayer
                    ? Math.max(0, Math.min(layerMoveIndex, layer.commands.length))
                    : layer.commands.length;

                if (isTopLayer && layer.commands.length > 0) {
                    firstTopLayerCommand = layer.commands[0];
                }

                for (let c = 0; c < commandLimit; c++) {
                    const cmd = layer.commands[c];
                    if (cmd.type === MoveType.Print) {
                        printMoves.push({ start: cmd.start, end: cmd.end });
                    } else if (cmd.type === MoveType.Travel) {
                        // When isolating, only keep travel from the topmost layer, so the
                        // user can see exactly which rapid moves belong to it — e.g. to
                        // spot ones that dip back through already-printed material.
                        if (!travelCurrentLayerOnly || isTopLayer) {
                            travelVertices.push(cmd.start.x, cmd.start.y, cmd.start.z);
                            travelVertices.push(cmd.end.x, cmd.end.y, cmd.end.z);
                        }
                    }
                    if (isTopLayer) { lastShownCommand = cmd; }
                }
            }
        }

        const printCount = printMoves.length;
        if (printCount > 0) {
            const radius = 0.2; 
            const radialSegments = 5;

            const cylinderGeo = new THREE.CylinderGeometry(radius, radius, 1, radialSegments, 1, false);
            const sphereGeo = new THREE.SphereGeometry(radius, radialSegments, radialSegments);
            
            const printMat = new THREE.MeshStandardMaterial({ 
                color: currentConfig.extrusionColor,
                roughness: 0.6,
                metalness: 0.1
            });

            instancedCylinders = new THREE.InstancedMesh(cylinderGeo, printMat, printCount);
            instancedSpheres = new THREE.InstancedMesh(sphereGeo, printMat, printCount);

            const dummy = new THREE.Object3D();
            const pStart = new THREE.Vector3();
            const pEnd = new THREE.Vector3();
            const vecHelper = new THREE.Vector3();
            const upVector = new THREE.Vector3(0, 1, 0);

            for (let i = 0; i < printCount; i++) {
                const move = printMoves[i];
                pStart.set(move.start.x, move.start.y, move.start.z);
                pEnd.set(move.end.x, move.end.y, move.end.z);
                
                vecHelper.subVectors(pEnd, pStart);
                const dist = vecHelper.length();
                
                if (dist > 0.0001) {
                    vecHelper.normalize();
                    dummy.position.copy(pStart).lerp(pEnd, 0.5);
                    dummy.quaternion.setFromUnitVectors(upVector, vecHelper);
                    dummy.scale.set(1, dist, 1);
                    dummy.updateMatrix();
                    instancedCylinders.setMatrixAt(i, dummy.matrix);
                }

                dummy.position.copy(pStart);
                dummy.scale.set(1, 1, 1);
                dummy.quaternion.identity();
                dummy.updateMatrix();
                instancedSpheres.setMatrixAt(i, dummy.matrix);
            }

            instancedCylinders.instanceMatrix.needsUpdate = true;
            instancedSpheres.instanceMatrix.needsUpdate = true;

            addToScene(instancedCylinders);
            addToScene(instancedSpheres);
        } else {
            instancedCylinders = null;
            instancedSpheres = null;
        }

        if (travelVertices.length > 0) {
            const travelGeo = new THREE.BufferGeometry();
            travelGeo.setAttribute('position', new THREE.Float32BufferAttribute(travelVertices, 3));
            const travelMat = new THREE.LineBasicMaterial({ 
                color: '#8a8a8a',  
                transparent: true, 
                opacity: 0.5 
            });
            travelLines = new THREE.LineSegments(travelGeo, travelMat);
            addToScene(travelLines);
        } else {
            travelLines = null;
        }

        // "You are here" marker — a pin with its sharp tip placed at the exact
        // nozzle coordinate. Orientation is fixed (tip straight down, body
        // straight up) rather than rotating per move direction, so it's easy
        // to track at a glance and reads the same way every time.
        const markerSource = lastShownCommand ?? firstTopLayerCommand;
        if (markerSource) {
            const tipPoint = lastShownCommand ? lastShownCommand.end : markerSource.start;

            const dartLength = 1.7;
            const dartRadius = 0.32;
            const markerGeo = new THREE.ConeGeometry(dartRadius, dartLength, 10);
            // Default cone is centered on its own axis with the apex at +height/2.
            // Shift it down so the apex sits exactly at local (0,0,0) — that point
            // becomes the marker's position, i.e. the precise nozzle coordinate.
            markerGeo.translate(0, -dartLength / 2, 0);

            const markerMat = new THREE.MeshStandardMaterial({
                color: '#ff2d55',
                emissive: '#ff2d55',
                emissiveIntensity: 0.55,
                roughness: 0.25,
                metalness: 0.2
            });
            nozzleMarker = new THREE.Mesh(markerGeo, markerMat);
            nozzleMarker.position.set(tipPoint.x, tipPoint.y, tipPoint.z);
            // Cone's default axis (apex direction) is local +Y; aim that straight
            // down (-Z) so the tip always points down into the exact coordinate
            // and the body always stands straight up, regardless of move direction.
            nozzleMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
            addToScene(nozzleMarker);
        } else {
            nozzleMarker = null;
        }
    }

    if (travelLines) {
        travelLines.visible = showTravel;
    }
}
