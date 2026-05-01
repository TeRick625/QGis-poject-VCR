// static/js/modules/tab2_selection.js

/**
 * Выбор элемента (область / спутник / аэрофото)
 * @param {string} type — 'area', 'satellite', 'aero'
 * @param {Object} item
 * @param {Object} state
 */
export function selectItem(type, item, state) {
    // Сначала сбрасываем всё
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;
    state.openAreaId = null;

    state.selectedItem = {
        type: type,
        id: item.id,
        name: item.name,
        isSubItem: false
    };

    if (type === 'area') state.selectedAreaId = item.id;
    if (type === 'satellite') state.selectedSatelliteId = item.id;
    if (type === 'aero') state.selectedAeroId = item.id;
}

/**
 * Раскрыть/скрыть подсписок полигона
 * @param {number} areaId
 * @param {Object} state
 */
export function toggleSubList(areaId, state) {
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;

    if (state.openAreaId === areaId) {
        state.openAreaId = null;
    } else {
        state.openAreaId = areaId;

        const area = state.areas.find(a => a.id === areaId);
        if (area) {
            state.selectedItem = {
                type: 'area',
                id: area.id,
                name: area.name,
                isSubItem: false
            };
            state.selectedAreaId = area.id;
        }
    }
}

/**
 * Выбор подэлемента (снимка из подсписка полигона)
 * @param {Object} sub
 * @param {Object} area
 * @param {Object} state
 */
export function selectSubItem(sub, area, state) {
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;
    state.openAreaId = null;

    state.selectedItem = {
        type: 'satellite_from_area',
        id: sub.id,
        name: sub.name,
        isSubItem: true,
        parentPolygon: area.name
    };
}

/**
 * Получить отфильтрованный список нейросетей
 * @param {Object} state
 * @returns {Array}
 */
export function getFilteredNN(state) {
    if (!state.selectedItem) return state.neuralNetworks;

    return state.neuralNetworks.filter(nn => {
        if (state.selectedItem.type === 'area' && !state.selectedItem.isSubItem) {
            return nn.type === 'universal';
        }
        if (state.selectedItem.type === 'satellite' || state.selectedItem.type === 'satellite_from_area') {
            return nn.type !== 'aero';
        }
        if (state.selectedItem.type === 'aero') {
            return nn.type !== 'satellite';
        }
        return true;
    });
}

/**
 * Выбор/снятие выбора нейросети
 * @param {Object} nn
 * @param {Object} state
 */
export function selectNN(nn, state) {
    if (state.selectedNN && state.selectedNN.id === nn.id) {
        state.selectedNN = null;
        return;
    }

    state.selectedNN = {
        id: nn.id,
        name: nn.name
    };
}

/**
 * Определить тип отображения результата
 * @param {Object} state
 * @returns {string|null}
 */
export function determineResultViewType(state) {
    if (!state.selectedItem) return null;
    if (state.selectedItem.type === 'satellite_from_area') {
        return 'satellite_with_polygon';
    }
    if (state.selectedItem.type === 'satellite') {
        return 'satellite_basic';
    }
    if (state.selectedItem.type === 'aero') {
        return 'aero_full';
    }
    return 'satellite_basic';
}

/**
 * Запуск анализа
 * @param {Object} state
 * @param {Object} callbacks — функции из компонента
 */
export function runAnalysis(state, callbacks) {
    if (!state.selectedItem || !state.selectedNN) return;

    const viewType = determineResultViewType(state);

    const newResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),

        type: state.selectedItem.type === 'aero' ? 'aero' : 'satellite',
        itemName: state.selectedItem.name,
        nnName: state.selectedNN.name || `NN #${state.selectedNN.id}`,
        hasPolygon: state.selectedItem.isSubItem || state.selectedItem.type === 'area',

        resultViewType: viewType,
        polygonOpacity: 0.5,
        aeroOverlayOpacity: 0.6,
        uploadedAeroFile: null,
        deepAnalysisEnabled: false,
    };

    state.analysisHistory.unshift(newResult);
    state.activeResult = newResult;
    state.currentResultIndex = 0;

    // Синхронизация глобальных UI-состояний
    state.resultViewType = viewType;
    state.uploadedAeroFile = null;
    state.deepAnalysisEnabled = false;
    state.polygonOpacity = 0.5;
    state.aeroOverlayOpacity = 0.6;

    state.mode = 'result';

    if (callbacks.switchMode) {
        callbacks.switchMode('result', state, callbacks);
    }
}

/**
 * Проверка, можно ли запустить анализ
 * @param {Object} state
 * @returns {boolean}
 */
export function getCanRunAnalysis(state) {
    return !!(state.selectedItem && state.selectedNN);
}