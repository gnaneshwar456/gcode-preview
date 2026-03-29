// acquireVsCodeApi() must be called exactly once per webview session.
// Calling it more than once throws: "An instance of the VS Code API has already been acquired".
// @ts-ignore – acquireVsCodeApi is injected by the VS Code webview runtime.
const vscode = acquireVsCodeApi();

export function setupUI(
    stateRef: { startLayer: number, endLayer: number, showTravel: boolean, data: any }, 
    onChange: (newState: Partial<{ startLayer: number, endLayer: number, showTravel: boolean, isPlaying: boolean }>) => void
) {
    const sliderStart = document.getElementById('layer-slider-start') as HTMLInputElement;
    const sliderEnd = document.getElementById('layer-slider-end') as HTMLInputElement;
    const toggleTravel = document.getElementById('toggle-travel') as HTMLInputElement;
    const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    const btnRecover = document.getElementById('btn-recover') as HTMLButtonElement;

    // Display elements
    const layerValue = document.getElementById('layer-value')!;
    const sliderStartVal = document.getElementById('slider-start-val');
    const sliderEndVal = document.getElementById('slider-end-val');
    const recoveryLayerDisplay = document.getElementById('recovery-layer-display');

    /** Sync all text displays with current start/end values */
    const updateLayerText = (start: number, end: number) => {
        layerValue.innerText = `${start}–${end}`;

        if (sliderStartVal) sliderStartVal.innerText = start.toString();
        if (sliderEndVal)   sliderEndVal.innerText   = end.toString();
        if (recoveryLayerDisplay) recoveryLayerDisplay.innerText = start.toString();

        const layerZStart = document.getElementById('layer-z-start');
        const layerZ      = document.getElementById('layer-z');
        if (stateRef.data) {
            if (layerZStart && stateRef.data.layers[start]) {
                layerZStart.innerText = stateRef.data.layers[start].zHeight.toFixed(2);
            }
            if (layerZ && stateRef.data.layers[end]) {
                layerZ.innerText = stateRef.data.layers[end].zHeight.toFixed(2);
            }
        }
    };

    sliderStart.addEventListener('input', () => {
        let startVal = parseInt(sliderStart.value, 10);
        let endVal   = parseInt(sliderEnd.value, 10);
        if (startVal > endVal) {
            endVal = startVal;
            sliderEnd.value = endVal.toString();
        }
        updateLayerText(startVal, endVal);
        onChange({ startLayer: startVal, endLayer: endVal });
    });

    sliderEnd.addEventListener('input', () => {
        let startVal = parseInt(sliderStart.value, 10);
        let endVal   = parseInt(sliderEnd.value, 10);
        if (endVal < startVal) {
            startVal = endVal;
            sliderStart.value = startVal.toString();
        }
        updateLayerText(startVal, endVal);
        onChange({ startLayer: startVal, endLayer: endVal });
    });

    toggleTravel.addEventListener('change', () => {
        onChange({ showTravel: toggleTravel.checked });
    });

    let playInterval: ReturnType<typeof setInterval> | undefined;

    btnPlay.addEventListener('click', () => {
        onChange({ isPlaying: true });
        clearInterval(playInterval);
        playInterval = setInterval(() => {
            let startVal = parseInt(sliderStart.value, 10);
            let endVal   = parseInt(sliderEnd.value, 10);
            const max    = parseInt(sliderEnd.max, 10);

            if (endVal < max) {
                endVal++;
                sliderEnd.value = endVal.toString();
                updateLayerText(startVal, endVal);
                onChange({ startLayer: startVal, endLayer: endVal });
            } else {
                clearInterval(playInterval);
                onChange({ isPlaying: false });
            }
        }, 100);
    });

    btnPause.addEventListener('click', () => {
        clearInterval(playInterval);
        onChange({ isPlaying: false });
    });

    btnRecover.addEventListener('click', () => {
        const startVal = parseInt(sliderStart.value, 10);
        vscode.postMessage({ type: 'crop-gcode', startLayer: startVal });
    });
}

export function updateUIMaxLayer(
    maxLayer: number,
    startLayer: number,
    endLayer: number,
    startZHeight: number,
    endZHeight: number
) {
    const sliderStart      = document.getElementById('layer-slider-start') as HTMLInputElement;
    const sliderEnd        = document.getElementById('layer-slider-end')   as HTMLInputElement;
    const layerMax         = document.getElementById('layer-max')!;
    const layerValue       = document.getElementById('layer-value')!;
    const layerZStart      = document.getElementById('layer-z-start');
    const layerZ           = document.getElementById('layer-z');
    const sliderStartVal   = document.getElementById('slider-start-val');
    const sliderEndVal     = document.getElementById('slider-end-val');
    const recoveryLayer    = document.getElementById('recovery-layer-display');

    sliderStart.max   = maxLayer.toString();
    sliderEnd.max     = maxLayer.toString();
    sliderStart.value = startLayer.toString();
    sliderEnd.value   = endLayer.toString();

    layerMax.innerText   = maxLayer.toString();
    layerValue.innerText = `${startLayer}–${endLayer}`;

    if (sliderStartVal)  sliderStartVal.innerText  = startLayer.toString();
    if (sliderEndVal)    sliderEndVal.innerText     = endLayer.toString();
    if (recoveryLayer)   recoveryLayer.innerText    = startLayer.toString();

    if (layerZ)      layerZ.innerText      = endZHeight.toFixed(2);
    if (layerZStart) layerZStart.innerText = startZHeight.toFixed(2);
}

export function showLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'flex';
}

export function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}
