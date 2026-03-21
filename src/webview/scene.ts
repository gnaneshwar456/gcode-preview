import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PreviewConfig } from '../parser/types';

export let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
export let renderer: THREE.WebGLRenderer;
export let controls: OrbitControls;

export let sceneStaticLayer: THREE.Group;
export let sceneModelLayer: THREE.Group;

export let currentConfig: PreviewConfig = { bedSize: 220, theme: 'dark', extrusionColor: '#ff7a00' };

export function setupScene(container: HTMLElement) {
    scene = new THREE.Scene();
    
    sceneStaticLayer = new THREE.Group();
    sceneModelLayer = new THREE.Group();
    scene.add(sceneStaticLayer);
    scene.add(sceneModelLayer);

    // Camera setup profissional
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.up.set(0, 0, 1);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio); // Antialias ativo e nítido
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // OrbitControls melhorados
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; // Impede descer além da mesa (não atravessar)
    
    rebuildSceneFromConfig(currentConfig);
    fitCameraToBed();

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

export function rebuildSceneFromConfig(config: PreviewConfig) {
    currentConfig = config;

    // Clear static elements
    while(sceneStaticLayer.children.length > 0) {
        const child = sceneStaticLayer.children[0];
        sceneStaticLayer.remove(child);
        const mesh = child as THREE.Mesh | THREE.LineSegments | THREE.Light;
        if ((mesh as any).geometry) (mesh as any).geometry.dispose();
        if ((mesh as any).material) {
            if (Array.isArray((mesh as any).material)) {
                (mesh as any).material.forEach((m: THREE.Material) => m.dispose());
            } else {
                (mesh as any).material.dispose();
            }
        }
    }

    const isDark = config.theme === 'dark';
    const bgColor = isDark ? '#2b2b2b' : '#f0f0f0';

    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 200, 1000);

    const bedSize = config.bedSize;

    const bedGeo = new THREE.PlaneGeometry(bedSize, bedSize);
    bedGeo.translate(bedSize / 2, bedSize / 2, 0); // Translate origin to bottom-left corner

    const bedMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x303030 : 0xe8e8e8,
        roughness: 0.85,
        metalness: 0.05,
        depthWrite: false
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    sceneStaticLayer.add(bedMesh);

    // Secondary lines (every 1mm)
    const gridHelperSecondary = new THREE.GridHelper(bedSize, bedSize, isDark ? 0x3f3f3f : 0xc0c0c0, isDark ? 0x3f3f3f : 0xc0c0c0);
    gridHelperSecondary.rotation.x = Math.PI / 2;
    gridHelperSecondary.position.set(bedSize / 2, bedSize / 2, 0.01);
    sceneStaticLayer.add(gridHelperSecondary); 

    // Primary lines (every 10mm)
    const gridHelperPrimary = new THREE.GridHelper(bedSize, Math.max(1, Math.floor(bedSize / 10)), isDark ? 0x6a6a6a : 0x808080, isDark ? 0x6a6a6a : 0x808080);
    gridHelperPrimary.rotation.x = Math.PI / 2;
    gridHelperPrimary.position.set(bedSize / 2, bedSize / 2, 0.02);
    sceneStaticLayer.add(gridHelperPrimary);

    // Contorno da mesa
    const edgesGeo = new THREE.EdgesGeometry(bedGeo);
    const outlineMat = new THREE.LineBasicMaterial({ color: isDark ? '#9a9a9a' : '#555555', linewidth: 2 });
    const bedOutline = new THREE.LineSegments(edgesGeo, outlineMat);
    bedOutline.position.z = 0.03;
    sceneStaticLayer.add(bedOutline);

    // Cruz de orientação
    const axesHelper = new THREE.AxesHelper(Math.max(20, bedSize * 0.1));
    axesHelper.position.z = 0.04;
    sceneStaticLayer.add(axesHelper);

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.7 : 0.9);
    sceneStaticLayer.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 0.9 : 0.7);
    dirLight.position.set(200, 300, 200);
    sceneStaticLayer.add(dirLight);
}

export function fitCameraToBed() {
    const center = currentConfig.bedSize / 2;
    controls.target.set(center, center, 0);
    camera.position.set(center, -currentConfig.bedSize * 0.5, currentConfig.bedSize * 1.2);
    controls.update();
}

export function addToScene(object: THREE.Object3D) {
    sceneModelLayer.add(object);
}

export function removeFromScene(object: THREE.Object3D) {
    sceneModelLayer.remove(object);
}

export function clearScenePaths() {
    const toRemove: THREE.Object3D[] = [];
    sceneModelLayer.children.forEach(child => {
        toRemove.push(child);
    });
    toRemove.forEach(child => {
        sceneModelLayer.remove(child);
        const mesh = child as THREE.Mesh | THREE.LineSegments | THREE.InstancedMesh;
        if (mesh.geometry) {
            mesh.geometry.dispose();
        }
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    });
}

export function resizeScene() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function centerCamera(bboxMin: { x: number, y: number, z: number }, bboxMax: { x: number, y: number, z: number }) {
    if (!isFinite(bboxMin.x)) return;
    const cx = (bboxMin.x + bboxMax.x) / 2;
    const cy = (bboxMin.y + bboxMax.y) / 2;
    const cz = (bboxMin.z + bboxMax.z) / 2;

    controls.target.set(cx, cy, cz);
    camera.position.set(cx + 80, cy + 80, cz + 80);
    controls.update();
}
