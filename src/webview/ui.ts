import { MoveType } from '../parser/types';

// acquireVsCodeApi() must be called exactly once per webview session.
// Calling it more than once throws: "An instance of the VS Code API has already been acquired".
// @ts-ignore – acquireVsCodeApi is injected by the VS Code webview runtime.
const vscode = acquireVsCodeApi();

const SPEED_MIN = 0.1;
const SPEED_MAX = 500;
const SPEED_SLIDER_RES = 200; // matches the #play-speed-slider max attribute

/** Maps a layers/sec value onto the 0..SPEED_SLIDER_RES slider range using a log
 *  scale, so the slider feels equally useful at 0.5 L/s and at 200 L/s. */
function speedToSliderPos(speed: number): number {
    const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
    const t = Math.log(clamped / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN);
    return Math.round(t * SPEED_SLIDER_RES);
}
function sliderPosToSpeed(pos: number): number {
    const t = pos / SPEED_SLIDER_RES;
    return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, t);
}
function formatSpeed(speed: number): string {
    return speed < 10 ? speed.toFixed(2) : speed.toFixed(1);
}

type StateChange = Partial<{
    startLayer: number,
    endLayer: number,
    showTravel: boolean,
    travelCurrentLayerOnly: boolean,
    layerMoveIndex: number,
    isPlaying: boolean
}>;

export function setupUI(
    stateRef: { startLayer: number, endLayer: number, showTravel: boolean, data: any },
    onChange: (newState: StateChange) => void
) {
    const sliderStart = document.getElementById('layer-slider-start') as HTMLInputElement;
    const sliderEnd = document.getElementById('layer-slider-end') as HTMLInputElement;
    const toggleTravel = document.getElementById('toggle-travel') as HTMLInputElement;
    const toggleTravelCurrentLayer = document.getElementById('toggle-travel-current-layer') as HTMLInputElement;
    const travelCurrentLayerGroup = document.getElementById('travel-current-layer-group');
    const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    const btnRecover = document.getElementById('btn-recover') as HTMLButtonElement;
    const gotoInput = document.getElementById('layer-goto-input') as HTMLInputElement;
    const btnGoto = document.getElementById('btn-goto-layer') as HTMLButtonElement;
    const playSpeedInput = document.getElementById('play-speed-input') as HTMLInputElement;
    const playSpeedSlider = document.getElementById('play-speed-slider') as HTMLInputElement;
    const moveSlider = document.getElementById('layer-move-slider') as HTMLInputElement;
    const moveValueLabel = document.getElementById('move-value-label');
    const moveDetailLabel = document.getElementById('move-detail-label');

    // Display elements
    const layerValue = document.getElementById('layer-value')!;
    const sliderStartVal = document.getElementById('slider-start-val');
    const sliderEndVal = document.getElementById('slider-end-val');
    const recoveryLayerDisplay = document.getElementById('recovery-layer-display');

    /** Refreshes the "Move N/M · Print → X.. Y.. Z.." caption under the move
     *  scrubber, describing whatever move it's currently parked on. */
    const updateMoveDetailDisplay = () => {
        const end = parseInt(sliderEnd.value, 10);
        const commands: any[] = stateRef.data?.layers?.[end]?.commands ?? [];
        const shown = Math.min(parseInt(moveSlider.value, 10) || 0, commands.length);

        if (moveValueLabel) { moveValueLabel.innerText = `${shown}/${commands.length}`; }
        if (moveDetailLabel) {
            if (shown > 0 && commands[shown - 1]) {
                const cmd = commands[shown - 1];
                const kind = cmd.type === MoveType.Print ? 'Print' : 'Travel';
                moveDetailLabel.innerText =
                    `${kind} → X${cmd.end.x.toFixed(1)} Y${cmd.end.y.toFixed(1)} Z${cmd.end.z.toFixed(2)}`;
            } else if (commands.length > 0) {
                moveDetailLabel.innerText = 'Before this layer\u2019s first move';
            } else {
                moveDetailLabel.innerText = '';
            }
        }
    };

    let lastMoveSyncEnd = -1;

    /** Sync all text displays with current start/end values.
     *  Returns the top layer's full move count if the top (End) layer actually
     *  changed (so the caller can reset layerMoveIndex / re-render), or null if
     *  it didn't (so an in-progress move-scrub position is left untouched). */
    const updateLayerText = (start: number, end: number): number | null => {
        layerValue.innerText = `${start}–${end}`;

        if (sliderStartVal) sliderStartVal.innerText = start.toString();
        if (sliderEndVal)   sliderEndVal.innerText   = end.toString();
        if (recoveryLayerDisplay) recoveryLayerDisplay.innerText = start.toString();
        if (gotoInput && document.activeElement !== gotoInput) gotoInput.value = end.toString();

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

        let resetMoveCount: number | null = null;
        if (end !== lastMoveSyncEnd) {
            lastMoveSyncEnd = end;
            const commands: any[] = stateRef.data?.layers?.[end]?.commands ?? [];
            resetMoveCount = commands.length;
            moveSlider.max   = resetMoveCount.toString();
            moveSlider.value = resetMoveCount.toString();
        }
        updateMoveDetailDisplay();

        return resetMoveCount;
    };

    sliderStart.addEventListener('input', () => {
        let startVal = parseInt(sliderStart.value, 10);
        let endVal   = parseInt(sliderEnd.value, 10);
        if (startVal > endVal) {
            endVal = startVal;
            sliderEnd.value = endVal.toString();
        }
        const resetMoveCount = updateLayerText(startVal, endVal);
        const change: StateChange = { startLayer: startVal, endLayer: endVal };
        if (resetMoveCount !== null) { change.layerMoveIndex = resetMoveCount; }
        onChange(change);
    });

    sliderEnd.addEventListener('input', () => {
        let startVal = parseInt(sliderStart.value, 10);
        let endVal   = parseInt(sliderEnd.value, 10);
        if (endVal < startVal) {
            startVal = endVal;
            sliderStart.value = startVal.toString();
        }
        const resetMoveCount = updateLayerText(startVal, endVal);
        const change: StateChange = { startLayer: startVal, endLayer: endVal };
        if (resetMoveCount !== null) { change.layerMoveIndex = resetMoveCount; }
        onChange(change);
    });

    // Scrubbing through the moves of the currently displayed (top) layer —
    // does NOT touch Start/End, just how much of the top layer is drawn.
    moveSlider.addEventListener('input', () => {
        updateMoveDetailDisplay();
        onChange({ layerMoveIndex: parseInt(moveSlider.value, 10) });
    });

    /** The "this layer only" travel sub-toggle only makes sense while travel
     *  moves are shown at all, so disable + dim it when the master toggle is off. */
    const syncTravelSubToggleAvailability = () => {
        const enabled = toggleTravel.checked;
        toggleTravelCurrentLayer.disabled = !enabled;
        if (travelCurrentLayerGroup) {
            travelCurrentLayerGroup.classList.toggle('disabled', !enabled);
        }
    };
    syncTravelSubToggleAvailability();

    toggleTravel.addEventListener('change', () => {
        onChange({ showTravel: toggleTravel.checked });
        syncTravelSubToggleAvailability();
    });

    toggleTravelCurrentLayer.addEventListener('change', () => {
        onChange({ travelCurrentLayerOnly: toggleTravelCurrentLayer.checked });
    });

    let playInterval: ReturnType<typeof setInterval> | undefined;
    let isPlayingNow = false;
    let lastValidSpeed = parseFloat(playSpeedInput.value) || 10;

    /** Reads the effective playback speed. Falls back to the last valid value
     *  instead of forcibly rewriting the field, so the field doesn't snap back
     *  mid-keystroke while the user is typing something like "0.05". */
    const readSpeedValue = (): number => {
        const raw = parseFloat(playSpeedInput.value);
        if (!isNaN(raw) && raw > 0) {
            lastValidSpeed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, raw));
        }
        return lastValidSpeed;
    };

    const getSpeedIntervalMs = () => Math.max(16, 1000 / readSpeedValue());

    const syncSliderToSpeed = (speed: number) => {
        playSpeedSlider.value = speedToSliderPos(speed).toString();
    };
    syncSliderToSpeed(lastValidSpeed);

    const tick = () => {
        let startVal = parseInt(sliderStart.value, 10);
        let endVal   = parseInt(sliderEnd.value, 10);
        const max    = parseInt(sliderEnd.max, 10);

        if (endVal < max) {
            endVal++;
            sliderEnd.value = endVal.toString();
            const resetMoveCount = updateLayerText(startVal, endVal);
            const change: StateChange = { startLayer: startVal, endLayer: endVal };
            if (resetMoveCount !== null) { change.layerMoveIndex = resetMoveCount; }
            onChange(change);
        } else {
            clearInterval(playInterval);
            isPlayingNow = false;
            onChange({ isPlaying: false });
        }
    };

    const startPlayback = () => {
        clearInterval(playInterval);
        playInterval = setInterval(tick, getSpeedIntervalMs());
    };

    btnPlay.addEventListener('click', () => {
        isPlayingNow = true;
        onChange({ isPlaying: true });
        startPlayback();
    });

    btnPause.addEventListener('click', () => {
        isPlayingNow = false;
        clearInterval(playInterval);
        onChange({ isPlaying: false });
    });

    // Dragging the slider is a coarse, log-scaled adjustment; it's fine to
    // overwrite the number field here since the user isn't typing.
    playSpeedSlider.addEventListener('input', () => {
        const speed = sliderPosToSpeed(parseInt(playSpeedSlider.value, 10));
        lastValidSpeed = speed;
        playSpeedInput.value = formatSpeed(speed);
        if (isPlayingNow) { startPlayback(); }
    });

    // Typing in the number field applies live (so playback speed updates as
    // you type) without rewriting the field's text, which would otherwise
    // interrupt entering values like "0.2".
    playSpeedInput.addEventListener('input', () => {
        const speed = readSpeedValue();
        syncSliderToSpeed(speed);
        if (isPlayingNow) { startPlayback(); }
    });

    // Only normalize/clamp the displayed text once the user is done editing.
    playSpeedInput.addEventListener('blur', () => {
        const speed = readSpeedValue();
        playSpeedInput.value = formatSpeed(speed);
        syncSliderToSpeed(speed);
    });
    playSpeedInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            playSpeedInput.blur();
        }
    });

    btnRecover.addEventListener('click', () => {
        const startVal = parseInt(sliderStart.value, 10);
        vscode.postMessage({ type: 'crop-gcode', startLayer: startVal });
    });

    /** Jump directly to a typed-in layer number, moving the End slider there
     *  (and pulling Start along with it if Start is currently past the target). */
    const goToLayer = () => {
        const max = parseInt(sliderEnd.max, 10);
        let target = parseInt(gotoInput.value, 10);
        if (isNaN(target)) { return; }
        target = Math.max(0, Math.min(max, target));
        gotoInput.value = target.toString();

        let startVal = parseInt(sliderStart.value, 10);
        if (startVal > target) {
            startVal = target;
            sliderStart.value = startVal.toString();
        }
        sliderEnd.value = target.toString();

        const resetMoveCount = updateLayerText(startVal, target);
        const change: StateChange = { startLayer: startVal, endLayer: target };
        if (resetMoveCount !== null) { change.layerMoveIndex = resetMoveCount; }
        onChange(change);
    };

    btnGoto.addEventListener('click', goToLayer);
    gotoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            goToLayer();
        }
    });
}

export function updateUIMaxLayer(
    maxLayer: number,
    startLayer: number,
    endLayer: number,
    startZHeight: number,
    endZHeight: number,
    topLayerMoveCount: number
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
    const gotoInput        = document.getElementById('layer-goto-input') as HTMLInputElement | null;
    const moveSlider       = document.getElementById('layer-move-slider') as HTMLInputElement | null;
    const moveValueLabel   = document.getElementById('move-value-label');
    const moveDetailLabel  = document.getElementById('move-detail-label');

    sliderStart.max   = maxLayer.toString();
    sliderEnd.max     = maxLayer.toString();
    sliderStart.value = startLayer.toString();
    sliderEnd.value   = endLayer.toString();

    layerMax.innerText   = maxLayer.toString();
    layerValue.innerText = `${startLayer}–${endLayer}`;

    if (sliderStartVal)  sliderStartVal.innerText  = startLayer.toString();
    if (sliderEndVal)    sliderEndVal.innerText     = endLayer.toString();
    if (recoveryLayer)   recoveryLayer.innerText    = startLayer.toString();
    if (gotoInput) {
        gotoInput.max   = maxLayer.toString();
        gotoInput.value = endLayer.toString();
    }
    if (moveSlider) {
        moveSlider.max   = topLayerMoveCount.toString();
        moveSlider.value = topLayerMoveCount.toString();
    }
    if (moveValueLabel) { moveValueLabel.innerText = `${topLayerMoveCount}/${topLayerMoveCount}`; }
    if (moveDetailLabel) { moveDetailLabel.innerText = topLayerMoveCount > 0 ? 'Full layer shown' : ''; }

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
