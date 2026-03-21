import { setupScene, resizeScene, rebuildSceneFromConfig } from './scene';
import { renderGCode } from './renderer';
import { setupUI, updateUIMaxLayer, showLoading, hideLoading } from './ui';
import { GCodeParsedData } from '../parser/types';
import { GCodeParser } from '../parser/parser';

const state = {
    data: null as GCodeParsedData | null,
    currentLayer: 0,
    isPlaying: false,
    showTravel: true,
    config: null as any
};

function init() {
    setupScene(document.getElementById('canvas-container')!);
    setupUI(state, (newState) => {
        Object.assign(state, newState);
        if (state.data) {
            renderGCode(state.data, state.currentLayer, state.showTravel, true);
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'parse-gcode') {
            if (message.config) {
                state.config = message.config;
                rebuildSceneFromConfig(state.config);
            }
            showLoading();
            setTimeout(() => {
                const parser = new GCodeParser();
                state.data = parser.parse(message.text);
                
                if (state.data && state.data.layers.length > 0) {
                    const maxLayer = state.data.layers.length - 1;
                    
                    if (message.isUpdate) {
                        if (state.currentLayer > maxLayer) state.currentLayer = maxLayer;
                    } else {
                        state.currentLayer = maxLayer;
                    }
                    
                    updateUIMaxLayer(maxLayer, state.currentLayer, state.data.layers[state.currentLayer].zHeight);
                    renderGCode(state.data, state.currentLayer, state.showTravel, message.isUpdate);
                }
                hideLoading();
            }, 50);
        } else if (message.type === 'config-update') {
            state.config = message.config;
            rebuildSceneFromConfig(state.config);
            if (state.data) {
                renderGCode(state.data, state.currentLayer, state.showTravel, true); // true to skip centering camera on theme change
            }
        }
    });

    window.addEventListener('resize', resizeScene);
}

init();
