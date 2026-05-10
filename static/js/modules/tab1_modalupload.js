// static/js/modules/tab1_modalupload.js
import { addWorkspaceItem } from './tab1_table.js';
import { addWorkspaceLayer } from '../map.js';

/**
 * Инициализация состояния модального окна загрузки и сброс input'ов
 * @param {Object} state
 */
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

/**
 * Установка файлов для спутников или полигонов
 * @param {string} type - 'satellite' или 'polygon'
 * @param {FileList} files
 * @param {Object} state
 */
export function setUploadFiles(type, files, state) {
    if (type === 'satellite') {
        state.uploadModal.satelliteFiles = Array.from(files);
    } else {
        state.uploadModal.polygonFiles = Array.from(files);
    }
}

/**
 * Добавить аэрофото в список
 * @param {FileList} files
 * @param {Object} state
 */
export function addAeroEntries(files, state) {
    const arr = Array.from(files);
    for (const file of arr) {
        state.uploadModal.aeroEntries.push({ image: file, kml: null });
    }
}

/**
 * Прикрепить KML к конкретному аэрофото
 * @param {number} index
 */
export function attachKmlToAeroEntry(index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.kml';
    input.onchange = (e) => {
        if (e.target.files.length > 0) {
            // Доступ к state через замыкание или глобально?
            // Лучше пробросить через window или передать колбэк.
            // Проще: использовать window.__uploadModalState (см. ниже)
            const state = window.__uploadModalState;
            if (state) {
                state.uploadModal.aeroEntries[index].kml = e.target.files[0];
            }
        }
    };
    input.click();
}

/**
 * Удалить аэрофото из списка
 * @param {number} index
 * @param {Object} state
 */
export function removeAeroEntry(index, state) {
    state.uploadModal.aeroEntries.splice(index, 1);
}

/**
 * Главный обработчик: создание объектов в workspaceItems
 * @param {Object} state
 */
export async function processUploadModal(state) {
    const { satelliteFiles, polygonFiles, aeroEntries } = state.uploadModal;
    const totalFiles =
        satelliteFiles.length +
        polygonFiles.length +
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
        const newItem = await addWorkspaceItem(state, entry.image);
        if (!newItem) continue;

        if (newItem.polygonCoords) {
            const layerId = addWorkspaceLayer(newItem);
            newItem.layerId = layerId;
        }

        if (entry.kml) {
            const kmlItem = await addWorkspaceItem(state, entry.kml);
            if (kmlItem && kmlItem.polygonCoords) {
                newItem.associatedKml = kmlItem.id;
                const layerId = addWorkspaceLayer(kmlItem);
                kmlItem.layerId = layerId;
            }
        }
    }

    state.uploadModalOpen = false;
}

