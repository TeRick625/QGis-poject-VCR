// static/js/modules/tab2_result.js

/**
 * Применить состояние активного результата к глобальному state
 * @param {Object} state
 */
export function applyResultState(state) {
    if (!state.activeResult) return;

    state.resultViewType = state.activeResult.resultViewType;
    state.polygonOpacity = state.activeResult.polygonOpacity;
    state.aeroOverlayOpacity = state.activeResult.aeroOverlayOpacity;
    state.uploadedAeroFile = state.activeResult.uploadedAeroFile;
    state.deepAnalysisEnabled = state.activeResult.deepAnalysisEnabled;
}

/**
 * Отрисовать режим результата (пока логирование)
 * @param {Object} state
 */
export function renderResultMode(state) {
    console.log(`Режим результата активирован. Всего записей в истории: ${state.analysisHistory.length}`);
}

/**
 * Выбрать элемент истории по индексу
 * @param {number} index
 * @param {Object} state
 */
export function selectHistoryItem(index, state) {
    if (index < 0 || index >= state.analysisHistory.length) return;

    state.currentResultIndex = index;
    state.activeResult = state.analysisHistory[index];

    applyResultState(state);
    renderResultMode(state);
}

/**
 * Обработчик загрузки аэрофото
 * @param {Event} event
 * @param {Object} state
 */
export function handleAeroUpload(event, state) {
    const file = event.target.files[0];
    if (!file) return;

    state.uploadedAeroFile = file;
    if (state.activeResult) {
        state.activeResult.uploadedAeroFile = file;
    }
    console.log('📷 Загружено аэрофото:', file.name);
}

/**
 * Активировать углублённый анализ
 * @param {Object} state
 */
export function activateDeepAnalysis(state) {
    if (!state.uploadedAeroFile) return;

    state.deepAnalysisEnabled = true;
    state.resultViewType = 'satellite_with_aero';

    if (state.activeResult) {
        state.activeResult.deepAnalysisEnabled = true;
        state.activeResult.resultViewType = 'satellite_with_aero';
    }

    console.log('🚀 Углубленный анализ активирован');
}

/**
 * Определить режим отображения результата
 * @param {Object} state
 * @returns {'satellite'|'aero'|'multidate'|null}
 */
export function determineAlgorithmMode(state) {
    if (!state.activeResult) return null;
    // В activeResult.type хранится 'satellite' или 'aero'
    if (state.activeResult.type === 'satellite') return 'satellite';
    if (state.activeResult.type === 'aero') return 'aero';
    // Для многодатного анализа позже
    return null;
}