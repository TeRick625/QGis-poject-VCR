// static/js/modules/tab2.js

/**
 * Инициализация вкладки 2
 * @param {Object} state
 */
export function initTab2(state) {
    console.log("✅ initTab2() вызван — подготовка данных вкладки 2");
    resetAllSelection(state);
}

/**
 * Сброс всего выбора (область, снимок, нейросеть)
 * @param {Object} state
 */
export function resetAllSelection(state) {
    state.selectedItem = null;
    state.selectedNN = null;
    state.selectedAreaId = null;
    state.selectedSatelliteId = null;
    state.selectedAeroId = null;
    state.openAreaId = null;
}

/**
 * Переключение режима (selection / result)
 * @param {string} newMode - 'selection' или 'result'
 * @param {Object} state
 * @param {Object} callbacks — объект с функциями для вызова из модулей
 */

export function switchMode(newMode, state, callbacks) {
    state.mode = newMode;

    if (newMode === 'result') {
        if (state.analysisHistory.length > 0 && !state.activeResult) {
            state.activeResult = state.analysisHistory[0];
            state.currentResultIndex = 0;
        }
        callbacks.applyResultState();
        callbacks.renderResultMode();
    } else {
        resetAllSelection(state);
        if (callbacks.initTab2) {
            callbacks.initTab2(state);
        }
    }
}