import {
    saveWorkspaceItem, updateWorkspaceItem, deleteWorkspaceItem,
    linkItems, unlinkItems
} from './api_workspace.js';

export function detectFileType(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.kml')) return { type: 'polygon', format: 'kml' };
    if (name.endsWith('.tif') || name.endsWith('.tiff')) return { type: 'satellite', format: 'geotiff' };
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png'))
        return { type: 'aero', format: name.split('.').pop() };
    return { type: 'unknown', format: 'unknown' };
}

export async function parseKmlCoordinates(file) {
    const text = await file.text();
    const parser = new DOMParser();
    const kml = parser.parseFromString(text, 'application/xml');

    // Проверяем на наличие ошибок парсинга XML
    const parseError = kml.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
        console.error('Ошибка парсинга KML:', parseError[0].textContent);
        return null;
    }

    const coordNodes = kml.getElementsByTagName('coordinates');
    if (coordNodes.length === 0) {
        console.warn('KML не содержит тегов <coordinates>');
        return null;
    }

    const coordText = coordNodes[0].textContent.trim();
    const points = coordText.split(/\s+/).filter(p => p.includes(','));

    // KML использует порядок [lng, lat, alt], конвертируем в [lat, lng] для Leaflet
    const coords = points.map(p => {
        const parts = p.split(',').map(Number);
        const lng = parts[0];
        const lat = parts[1];
        return [lat, lng];  // [lat, lng] для Leaflet
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));  // Фильтруем некорректные точки

    return coords.length >= 3 ? coords : null;
}

export function createWorkspaceItemObject(file, type, format, polygonCoords = null) {
    return {
        id: Date.now() + Math.random(),
        name: file.name,
        type,
        format,
        dateAdded: new Date().toISOString(),
        sourceFile: file,
        polygonCoords,
        visibleOnMap: !!polygonCoords,
        layerId: null,
        associatedKml: null,
        imageThumbnail: null,
        children_ids: []
    };
}

export async function addWorkspaceItem(state, file) {
    const { type, format } = detectFileType(file);
    if (type === 'unknown') {
        console.warn('Неподдерживаемый формат:', file.name);
        return null;
    }
    let polygonCoords = null;
    if (type === 'polygon' && format === 'kml')
        polygonCoords = await parseKmlCoordinates(file);
    else if (type === 'satellite' && format === 'geotiff')
        polygonCoords = await extractSatelliteBounds(file);

    // Проверяем, что координаты корректны перед добавлением
    if (polygonCoords && (!Array.isArray(polygonCoords) || polygonCoords.length < 3)) {
        console.error('Некорректные координаты для файла:', file.name, polygonCoords);
        return null;
    }

    const newItem = createWorkspaceItemObject(file, type, format, polygonCoords);
    state.workspaceItems.push(newItem);

    if (window.userRole && window.userRole !== 'guest') {
        const saved = await saveWorkspaceItem(newItem);
        if (saved?.id) newItem.id = saved.id;
    }
    return newItem;
}

async function extractSatelliteBounds(file) {
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

    // Проверяем размер файла перед отправкой на сервер
    if (file.size > MAX_FILE_SIZE) {
        alert(`Файл "${file.name}" превышает максимальный размер в 500 MB и не будет обработан.`);
        console.warn(`Файл ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) превышен лимит 500 MB`);
        return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/geotiff/bounds', { method: 'POST', body: formData });

        // Обрабатываем ошибку 413 Payload Too Large
        if (response.status === 413) {
            alert(`Файл "${file.name}" слишком большой для обработки. Максимальный размер: 500 MB.`);
            return null;
        }

        const data = await response.json();
        if (data.success) return data.coordinates;
        console.error('Ошибка сервера при чтении GeoTIFF:', data.error);
        return null;
    } catch (err) {
        console.error('Ошибка запроса к серверу:', err);
        return null;
    }
}

export async function addPolygonFromCoords(state, coords, name = null) {
    const newItem = {
        id: Date.now() + Math.random(),
        name: name || 'Полигон (коорд.)',
        type: 'polygon',
        format: 'manual',
        dateAdded: new Date().toISOString(),
        sourceFile: null,
        polygonCoords: coords,
        visibleOnMap: true,
        layerId: null,
        associatedKml: null,
        imageThumbnail: null,
        children_ids: []
    };
    state.workspaceItems.push(newItem);

    if (window.userRole && window.userRole !== 'guest') {
        const saved = await saveWorkspaceItem(newItem);
        if (saved?.id) newItem.id = saved.id;
    }
    return newItem;
}

export async function addDrawnPolygonToWorkspace(state, coords, layer) {
    const newItem = {
        id: Date.now() + Math.random(),
        name: 'Нарисованный полигон',
        type: 'polygon',
        format: 'manual',
        dateAdded: new Date().toISOString(),
        sourceFile: null,
        polygonCoords: coords,
        visibleOnMap: true,
        layerId: null,
        associatedKml: null,
        imageThumbnail: null,
        children_ids: []
    };
    state.workspaceItems.push(newItem);
    newItem.layerId = 'workspace_' + newItem.id;
    layer._workspaceLayerId = newItem.layerId;
    newItem._leafletLayer = layer;

    if (window.registerWorkspaceLayer) window.registerWorkspaceLayer(newItem.layerId, layer);
    if (window.attachLayerEventsToLayer) window.attachLayerEventsToLayer(layer, newItem.id);

    if (window.userRole && window.userRole !== 'guest') {
        const saved = await saveWorkspaceItem(newItem);
        if (saved?.id) newItem.id = saved.id;
    }
    return newItem;
}

// Новая функция для добавления аэро+KML с серверной связью
export async function addAeroWithKml(state, aeroFile, kmlFile) {
    // Создаём временные объекты
    const aeroItem = createWorkspaceItemObject(aeroFile, 'aero', aeroFile.name.split('.').pop().toLowerCase(), null);
    const kmlItem = createWorkspaceItemObject(kmlFile, 'polygon', 'kml', await parseKmlCoordinates(kmlFile));

    // 1. Сохраняем KML на сервер (пока без родителя)
    let kmlId = kmlItem.id;
    if (window.userRole && window.userRole !== 'guest') {
        const saved = await saveWorkspaceItem({ ...kmlItem, parent_id: null });
        if (saved?.id) kmlId = saved.id;
    }
    kmlItem.id = kmlId;

    // Добавляем слой KML на карту
    if (window.addWorkspaceLayer) {
        const kmlLayerId = window.addWorkspaceLayer(kmlItem);
        kmlItem.layerId = kmlLayerId;
    }

    // 2. Сохраняем аэро на сервер (тоже без родителя)
    let aeroId = aeroItem.id;
    if (window.userRole && window.userRole !== 'guest') {
        const savedAero = await saveWorkspaceItem({ ...aeroItem, parent_id: null });
        if (savedAero?.id) aeroId = savedAero.id;
    }
    aeroItem.id = aeroId;

    // 3. Устанавливаем связь родитель-потомок на сервере
    await linkItems(aeroId, kmlId);

    // 4. Формируем локальный стейт:
    //    - добавляем KML в общий массив
    //    - у аэро проставляем children_ids
    //    - добавляем аэро в массив
    if (!state.workspaceItems.find(i => i.id === kmlId)) {
        state.workspaceItems.push(kmlItem);
    }
    aeroItem.children_ids = [kmlId];
    state.workspaceItems.push(aeroItem);
}

export function removeWorkspaceItem(state, itemId) {
    if (state.editingItemId === itemId) {
        const item = state.workspaceItems.find(i => i.id === itemId);
        if (item && window.cancelLayerEdit) window.cancelLayerEdit(item.layerId);
        state.editingItemId = null;
    }

    const index = state.workspaceItems.findIndex(item => item.id === itemId);
    if (index === -1) return;
    const item = state.workspaceItems[index];

    // Удаляем связанные дочерние элементы (KML) — они станут независимыми
    if (item.children_ids && item.children_ids.length > 0) {
        for (const childId of item.children_ids) {
            const child = state.workspaceItems.find(i => i.id === childId);
            if (child) {
                // Убираем связь на сервере
                if (window.userRole && window.userRole !== 'guest') {
                    unlinkItems(item.id, child.id);
                }
                // Ребёнок остаётся в общем списке
                child.children_ids = [];
            }
        }
    }

    if (item.layerId && window.removeWorkspaceLayer) window.removeWorkspaceLayer(item.layerId);
    state.workspaceItems.splice(index, 1);

    if (window.userRole && window.userRole !== 'guest') {
        deleteWorkspaceItem(itemId);
    }
}

export function toggleItemVisibility(state, itemId) {
    const item = state.workspaceItems.find(i => i.id === itemId);
    if (!item || !item.polygonCoords) return;
    item.visibleOnMap = !item.visibleOnMap;
    if (item.visibleOnMap) {
        if (!item.layerId && window.addWorkspaceLayer) {
            const layerId = window.addWorkspaceLayer(item);
            if (layerId) item.layerId = layerId;
        } else if (item.layerId && window.showWorkspaceLayer) {
            window.showWorkspaceLayer(item.layerId);
        }
    } else {
        if (item.layerId && window.hideWorkspaceLayer) window.hideWorkspaceLayer(item.layerId);
    }
    if (window.userRole && window.userRole !== 'guest') {
        updateWorkspaceItem(itemId, { visibleOnMap: item.visibleOnMap });
    }
}

export async function removeAeroItem(state, aeroId) {
    const aero = state.workspaceItems.find(i => i.id === aeroId);
    if (!aero || aero.type !== 'aero') {
        removeWorkspaceItem(state, aeroId);
        return;
    }

    const childIds = aero.children_ids || [];
    // Разрываем серверные связи с детьми
    for (const childId of childIds) {
        if (window.userRole && window.userRole !== 'guest') {
            await unlinkItems(aeroId, childId);
        }
        // Дети становятся самостоятельными
        const child = state.workspaceItems.find(i => i.id === childId);
        if (child) child.children_ids = [];
    }

    // Удаляем аэро с сервера
    if (window.userRole && window.userRole !== 'guest') {
        await deleteWorkspaceItem(aeroId);
    }
    // Удаляем слой аэро
    if (aero.layerId && window.removeWorkspaceLayer) window.removeWorkspaceLayer(aero.layerId);
    // Удаляем из локального массива
    const idx = state.workspaceItems.findIndex(i => i.id === aeroId);
    if (idx !== -1) state.workspaceItems.splice(idx, 1);
}

export async function removeKmlFromAero(state, aeroId) {
    const aero = state.workspaceItems.find(i => i.id === aeroId);
    if (!aero || !aero.children_ids || aero.children_ids.length === 0) return;

    const kmlId = aero.children_ids[0];   // предполагаем один KML
    // Удаляем KML с сервера
    if (window.userRole && window.userRole !== 'guest') {
        await deleteWorkspaceItem(kmlId);
    }
    // Разрываем связь
    await unlinkItems(aeroId, kmlId);
    // Удаляем слой KML и сам объект
    const kml = state.workspaceItems.find(i => i.id === kmlId);
    if (kml) {
        if (kml.layerId && window.removeWorkspaceLayer) window.removeWorkspaceLayer(kml.layerId);
        const kmlIdx = state.workspaceItems.indexOf(kml);
        if (kmlIdx !== -1) state.workspaceItems.splice(kmlIdx, 1);
    }
    // Обновляем aero.children_ids
    aero.children_ids = [];
}

export function highlightTableRow(state, itemId, flag) {
    state.highlightedItemId = flag ? itemId : null;
}

export function selectTableRow(state, itemId) {
    state.selectedWorkspaceItemId = itemId;
}

export function zoomToItem(item) {
    if (window.fitBoundsToLayer) window.fitBoundsToLayer(item.layerId);
}

export function getFilteredSortedItems(state) {
    let items = state.workspaceItems.filter(item => state.workspaceFilter[item.type] === true);
    items.sort((a, b) => {
        let valA, valB;
        if (state.workspaceSort === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            return state.workspaceSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            valA = new Date(a.dateAdded);
            valB = new Date(b.dateAdded);
            return state.workspaceSortAsc ? valA - valB : valB - valA;
        }
    });
    return items;
}

export function startRenameItem(state, itemId) {
    const item = state.workspaceItems.find(i => i.id === itemId);
    if (!item) return;
    state.renamingItemId = itemId;
    state.renamingValue = item.name;
}

export async function applyRename(state) {
    const item = state.workspaceItems.find(i => i.id === state.renamingItemId);
    if (item && state.renamingValue.trim()) {
        const newName = state.renamingValue.trim();
        item.name = newName;
        if (window.userRole && window.userRole !== 'guest') {
            await updateWorkspaceItem(item.id, { name: newName });
        }
    }
    state.renamingItemId = null;
    state.renamingValue = '';
}

export function cancelRename(state) {
    state.renamingItemId = null;
    state.renamingValue = '';
}