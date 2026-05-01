// static/js/modules/tab2_modal_find.js

/**
 * Открыть модальное окно поиска снимков
 * @param {Object} state
 */
export function openFindImagesModal(state) {
    if (!state.selectedItem || state.selectedItem.type !== 'area') return;
    state.currentModalStep = 1;
    state.selectedImageIds = [];
    state.isFindModalOpen = true;
}

/**
 * Закрыть модальное окно
 * @param {Object} state
 */
export function closeFindImagesModal(state) {
    state.isFindModalOpen = false;
}

/**
 * Получить выбранные изображения
 * @param {Object} state
 * @returns {Array}
 */
export function getSelectedImages(state) {
    return state.fakeFoundImages.filter(img => state.selectedImageIds.includes(img.id));
}

/**
 * Переключить выбор изображения
 * @param {number} id
 * @param {Object} state
 */
export function toggleImageSelection(id, state) {
    if (state.selectedImageIds.includes(id)) {
        state.selectedImageIds = state.selectedImageIds.filter(i => i !== id);
    } else {
        state.selectedImageIds.push(id);
    }
}

/**
 * Убрать изображение из списка подтверждения
 * @param {number} id
 * @param {Object} state
 */
export function removeFromConfirm(id, state) {
    state.selectedImageIds = state.selectedImageIds.filter(i => i !== id);
}

/**
 * Показать экран «снимки не найдены»
 * @param {Object} state
 */
export function showNoImagesFound(state) {
    state.currentModalStep = 4;
}

/**
 * Перейти к следующему шагу модального окна
 * @param {Object} state
 * @param {Object} callbacks
 */
export function nextModalStep(state, callbacks) {
    if (state.currentModalStep === 4) {
        state.currentModalStep = 1;
        return;
    }
    if (state.currentModalStep === 3) {
        if (callbacks.addSelectedImagesToPolygon) {
            callbacks.addSelectedImagesToPolygon(state);
        }
        closeFindImagesModal(state);
        return;
    }
    state.currentModalStep++;
}

/**
 * Вернуться к предыдущему шагу
 * @param {Object} state
 */
export function prevModalStep(state) {
    if (state.currentModalStep === 1 || state.currentModalStep === 4) return;
    state.currentModalStep--;
}

/**
 * Добавить выбранные снимки в подсписок полигона
 * @param {Object} state
 */
export function addSelectedImagesToPolygon(state) {
    console.log('✅ Снимки добавлены в подсписок полигона (заглушка)');
    // В будущем здесь будет реальная логика добавления
}

/**
 * Получить текст заголовка модального окна
 * @param {Object} state
 * @returns {string}
 */
export function getModalTitleText(state) {
    if (state.currentModalStep === 1) return 'Необходима настройка для скачки спутникового снимка?';
    if (state.currentModalStep === 2) return `Найдено ${state.fakeFoundImages.length} снимков. Выберите даты для предпросмотра`;
    if (state.currentModalStep === 3) return 'Подтвердите выбор снимка / снимков';
    return 'Снимки не найдены';
}