import { setupScene, resizeScene, rebuildSceneFromConfig } from './scene';
import { renderGCode } from './renderer';
import { setupUI, updateUIMaxLayer, showLoading, hideLoading } from './ui';
import { GCodeParsedData } from '../parser/types';
import { GCodeParser } from '../parser/parser';

interface AppConfig {
    bedSize: number;
    theme: 'dark' | 'light';
    extrusionColor: string;
    recoveryPurgeGCode: string;
}

const state = {
    data: null as GCodeParsedData | null,
    startLayer: 0,
    endLayer: 0,
    isPlaying: false,
    showTravel: true,
    travelCurrentLayerOnly: false,
    layerMoveIndex: 0,
    config: null as AppConfig | null
};

/** Handle to cancel a pending parse (avoid concurrent parses on rapid messages). */
let pendingParseHandle: ReturnType<typeof setTimeout> | undefined;

function init() {
    setupScene(document.getElementById('canvas-container')!);
    setupUI(state, (newState) => {
        Object.assign(state, newState);
        if (state.data) {
            renderGCode(state.data, state.startLayer, state.endLayer, state.showTravel, state.travelCurrentLayerOnly, state.layerMoveIndex, true);
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'parse-gcode') {
            if (message.config) {
                state.config = message.config;
                rebuildSceneFromConfig(state.config!);
            }
            showLoading();
            // Cancel any pending parse to avoid concurrent races
            if (pendingParseHandle !== undefined) { clearTimeout(pendingParseHandle); }
            pendingParseHandle = setTimeout(() => {
                pendingParseHandle = undefined;
                try {
                    const parser = new GCodeParser();
                    state.data = parser.parse(message.text);

                    if (state.data && state.data.layers.length > 0) {
                        const maxLayer = state.data.layers.length - 1;

                        if (message.isUpdate) {
                            if (state.startLayer > maxLayer) { state.startLayer = 0; }
                            if (state.endLayer > maxLayer) { state.endLayer = maxLayer; }
                        } else {
                            state.startLayer = 0;
                            state.endLayer = maxLayer;
                        }

                        const topLayerMoveCount = state.data.layers[state.endLayer].commands.length;
                        state.layerMoveIndex = topLayerMoveCount;

                        updateUIMaxLayer(
                            maxLayer,
                            state.startLayer,
                            state.endLayer,
                            state.data.layers[state.startLayer].zHeight,
                            state.data.layers[state.endLayer].zHeight,
                            topLayerMoveCount
                        );
                        renderGCode(state.data, state.startLayer, state.endLayer, state.showTravel, state.travelCurrentLayerOnly, state.layerMoveIndex, message.isUpdate);
                    }
                } catch (err) {
                    console.error('GCode parse error:', err);
                } finally {
                    hideLoading();
                }
            }, 50);
        } else if (message.type === 'config-update') {
            state.config = message.config;
            rebuildSceneFromConfig(state.config!);
            if (state.data) {
                renderGCode(state.data, state.startLayer, state.endLayer, state.showTravel, state.travelCurrentLayerOnly, state.layerMoveIndex, true);
            }
        }
    });

    window.addEventListener('resize', resizeScene);
}

init();
