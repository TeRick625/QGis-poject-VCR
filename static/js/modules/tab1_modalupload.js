import { addWorkspaceItem, createWorkspaceItemObject, parseKmlCoordinates, addAeroWithKml } from './tab1_table.js';
import { addWorkspaceLayer } from '../map.js';
import { saveWorkspaceItem, updateWorkspaceItem } from './api_workspace.js';

export function openUploadModal(state) {
    state.uploadModal = {
        satelliteFiles: [],
        polygonFiles: [],
        aeroEntries: [],
        activeSection: null
    };
    state.uploadModalOpen = true;

    setTimeout(() => {
        const modal = document.querySelector('[data-upload-modal]');
        if (modal) {
            const inputs = modal.querySelectorAll('input[type="file"]');
            inputs.forEach(input => { input.value = ''; });
        }
    }, 50);
}

export function setUploadFiles(type, files, state) {
    if (type === 'satellite') {
        state.uploadModal.satelliteFiles = Array.from(files);
    } else {
        state.uploadModal.polygonFiles = Array.from(files);
    }
}

export function addAeroEntries(files, state) {
    const arr = Array.from(files);
    for (const file of arr) {
        state.uploadModal.aeroEntries.push({ image: file, kml: null });
    }
}

export function attachKmlToAeroEntry(index) {
    const state = window.__uploadModalState;
    if (!state) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml';
    input.onchange = (e) => {
        if (e.target.files.length > 0 && state.uploadModal.aeroEntries[index]) {
            state.uploadModal.aeroEntries[index].kml = e.target.files[0];
        }
    };
    input.click();
}

export function removeAeroEntry(index, state) {
    state.uploadModal.aeroEntries.splice(index, 1);
}

export async function processUploadModal(state) {
    const { satelliteFiles, polygonFiles, aeroEntries } = state.uploadModal;
    const totalFiles = satelliteFiles.length + polygonFiles.length +
        aeroEntries.reduce((sum, entry) => sum + 1 + (entry.kml ? 1 : 0), 0);
    if (totalFiles === 0) {
        alert('Не выбрано ни одного файла для загрузки.');
        return;
    }

    // Спутниковые снимки
    for (const file of satelliteFiles) {
        const newItem = await addWorkspaceItem(state, file);
        if (newItem && newItem.polygonCoords) {
            const layerId = addWorkspaceLayer(newItem);
            newItem.layerId = layerId;
        }
    }

    // Полигоны (KML)
    for (const file of polygonFiles) {
        const newItem = await addWorkspaceItem(state, file);
        if (newItem && newItem.polygonCoords) {
            const layerId = addWorkspaceLayer(newItem);
            newItem.layerId = layerId;
        }
    }

    // Аэрофото (с возможным KML)
    for (const entry of aeroEntries) {
        if (entry.kml) {
            // Пара аэро+KML – используем новую функцию с серверной связью
            await addAeroWithKml(state, entry.image, entry.kml);
        } else {
            // Обычное аэро без KML
            const newItem = await addWorkspaceItem(state, entry.image);
            if (newItem && newItem.polygonCoords) {
                const layerId = addWorkspaceLayer(newItem);
                newItem.layerId = layerId;
            }
        }
    }

    state.uploadModalOpen = false;
}