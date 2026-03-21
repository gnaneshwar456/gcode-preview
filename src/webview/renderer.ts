import * as THREE from 'three';
import { GCodeParsedData, MoveType, Point3D } from '../parser/types';
import { addToScene, clearScenePaths, centerCamera, currentConfig } from './scene';

let currentDataRef: GCodeParsedData | null = null;
let printMoveLayerCounts: number[] = [];
let travelVertexLayerCounts: number[] = [];

let instancedCylinders: THREE.InstancedMesh | null = null;
let instancedSpheres: THREE.InstancedMesh | null = null;
let travelLines: THREE.LineSegments | null = null;

export function renderGCode(data: GCodeParsedData, maxLayerIndex: number, showTravel: boolean, isUpdate: boolean = false) {
    if (!data || data.layers.length === 0) return;

    if (currentDataRef !== data) {
        clearScenePaths();
        currentDataRef = data;
        
        if (!isUpdate) {
            centerCamera(data.boundingBox.min, data.boundingBox.max);
        }

        const printMoves: Array<{start: Point3D, end: Point3D}> = [];
        const travelVertices: number[] = [];
        printMoveLayerCounts = [];
        travelVertexLayerCounts = [];

        for (let i = 0; i < data.layers.length; i++) {
            const layer = data.layers[i];
            for (const cmd of layer.commands) {
                if (cmd.type === MoveType.Print) {
                    printMoves.push({ start: cmd.start, end: cmd.end });
                } else if (cmd.type === MoveType.Travel) {
                    travelVertices.push(cmd.start.x, cmd.start.y, cmd.start.z);
                    travelVertices.push(cmd.end.x, cmd.end.y, cmd.end.z);
                }
            }
            printMoveLayerCounts[i] = printMoves.length;
            travelVertexLayerCounts[i] = travelVertices.length / 3; 
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
    }

    if (maxLayerIndex >= 0 && maxLayerIndex < data.layers.length) {
        const printCountToShow = printMoveLayerCounts[maxLayerIndex] || 0;
        const travelVerticesToShow = travelVertexLayerCounts[maxLayerIndex] || 0;

        if (instancedCylinders && instancedSpheres) {
            instancedCylinders.count = printCountToShow;
            instancedSpheres.count = printCountToShow;
        }

        if (travelLines) {
            if (showTravel) {
                travelLines.visible = true;
                travelLines.geometry.setDrawRange(0, travelVerticesToShow);
            } else {
                travelLines.visible = false;
            }
        }
    }
}
