// static/js/modules/tab1.js
import { addWorkspaceItem, addPolygonFromCoords } from './tab1_table.js';

///**
// * Обработка файлов из input или drop (без привязки к Alpine)
// * @param {FileList} files
// * @param {Object} state
// */
//export async function handleWorkspaceFiles(files, state) {
//    if (!files || files.length === 0) return;
//    for (const file of Array.from(files)) {
//        const newItem = await addWorkspaceItem(state, file);
//        if (newItem && newItem.polygonCoords) {
//            if (window.addWorkspaceLayer) {
//                const layerId = window.addWorkspaceLayer(newItem);
//                newItem.layerId = layerId;
//            }
//        }
//    }
//}

/**
 * Создать полигон из координат, введённых в модальном окне
 * @param {Object} state
 * @returns {boolean} успешно или нет
 */
export function createPolygonFromCoords(state) {
    const coords = [];
    let valid = true;
    for (const point of state.coordInputs) {
        const parts = point.value.split(',').map(s => s.trim());
        if (parts.length !== 2) { valid = false; break; }
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng)) { valid = false; break; }
        coords.push([lat, lng]);
    }
    if (!valid || coords.length < 3) {
        alert('Проверьте координаты. Нужно минимум 3 точки в формате "широта, долгота".');
        return false;
    }

    const newItem = addPolygonFromCoords(state, coords);
    if (newItem && window.addWorkspaceLayer) {
        const layerId = window.addWorkspaceLayer(newItem);
        newItem.layerId = layerId;
        state.coordInputs = [{ value: '' }, { value: '' }, { value: '' }];
        state.coordModalOpen = false;
        return true;
    }
    return false;
}