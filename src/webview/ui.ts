export function setupUI(
    stateRef: { currentLayer: number, showTravel: boolean, data: any }, 
    onChange: (newState: Partial<{ currentLayer: number, showTravel: boolean, isPlaying: boolean }>) => void
) {
    const slider = document.getElementById('layer-slider') as HTMLInputElement;
    const toggleTravel = document.getElementById('toggle-travel') as HTMLInputElement;
    const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    const layerValue = document.getElementById('layer-value')!;

    slider.addEventListener('input', () => {
        const val = parseInt(slider.value, 10);
        layerValue.innerText = val.toString();
        
        const layerZ = document.getElementById('layer-z');
        if (layerZ && stateRef.data && stateRef.data.layers[val]) {
            layerZ.innerText = stateRef.data.layers[val].zHeight.toFixed(2);
        }
        
        onChange({ currentLayer: val });
    });

    toggleTravel.addEventListener('change', () => {
        onChange({ showTravel: toggleTravel.checked });
    });

    let playInterval: any;

    btnPlay.addEventListener('click', () => {
        onChange({ isPlaying: true });
        clearInterval(playInterval);
        playInterval = setInterval(() => {
            let val = parseInt(slider.value, 10);
            const max = parseInt(slider.max, 10);
            if (val < max) {
                val++;
                slider.value = val.toString();
                layerValue.innerText = val.toString();
                
                const layerZ = document.getElementById('layer-z');
                if (layerZ && stateRef.data && stateRef.data.layers[val]) {
                    layerZ.innerText = stateRef.data.layers[val].zHeight.toFixed(2);
                }

                onChange({ currentLayer: val });
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
}

export function updateUIMaxLayer(maxLayer: number, currentLayer: number, zHeight: number) {
    const slider = document.getElementById('layer-slider') as HTMLInputElement;
    const layerMax = document.getElementById('layer-max')!;
    const layerValue = document.getElementById('layer-value')!;
    const layerZ = document.getElementById('layer-z');
    
    slider.max = maxLayer.toString();
    slider.value = currentLayer.toString();
    layerMax.innerText = maxLayer.toString();
    layerValue.innerText = currentLayer.toString();
    if (layerZ) {
        layerZ.innerText = zHeight.toFixed(2);
    }
}

export function showLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'flex';
}
export function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}
