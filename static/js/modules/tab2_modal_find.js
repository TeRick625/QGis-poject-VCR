// static/js/modules/tab2_modal_find.js

export function openFindImagesModal(state) {
    if (!state.selectedItem || state.selectedItem.type !== 'area') return;

    state.currentModalStep = 1;
    state.selectedImageIds = [];
    state.foundImages = []; // Очищаем предыдущий поиск
    state.previewThumbnailUrl = null; // Очищаем превью

    // Инициализируем параметры поиска, если их нет
    if (!state.findModalParams) {
        state.findModalParams = { cloudMax: 30, dateStart: '2023-05-01', dateEnd: '2025-09-01' };
    }

    state.isFindModalOpen = true;
}

export function closeFindImagesModal(state) {
    state.isFindModalOpen = false;
    state.previewThumbnailUrl = null;
}

export function getSelectedImages(state) {
    // Теперь работаем с реальным массивом foundImages
    return state.foundImages.filter(img => state.selectedImageIds.includes(img.id));
}

export function toggleImageSelection(id, state) {
    if (state.selectedImageIds.includes(id)) {
        state.selectedImageIds = state.selectedImageIds.filter(i => i !== id);
    } else {
        state.selectedImageIds.push(id);
    }
}

// Новая функция: показать превью при наведении на карточку снимка
export function setPreviewImage(url, state) {
    state.previewThumbnailUrl = url;
}

export function removeFromConfirm(id, state) {
    state.selectedImageIds = state.selectedImageIds.filter(i => i !== id);
}

export function showNoImagesFound(state) {
    state.currentModalStep = 4;
}

// --- НОВЫЕ АСИНХРОННЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С API ---

export async function triggerSearchImages(state) {
    state.isSearching = true;
    state.foundImages = [];

    // --- ЛОГ ПЕРЕД ОТПРАВКОЙ ---
    console.group("🚀 ОТПРАВКА ЗАПРОСА НА ПОИСК СНИМКОВ");
    console.log("Родительский KML:", state.selectedItem);
    console.log("Параметры фильтрации:", {
        kml_id: state.selectedItem?.id,
        date_start: state.findModalParams?.dateStart,
        date_end: state.findModalParams?.dateEnd,
        max_cloud: state.findModalParams?.cloudMax
    });
    console.groupEnd();

    try {
        const res = await fetch('/api/satellite/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kml_id: state.selectedItem.id,
                date_start: state.findModalParams.dateStart,
                date_end: state.findModalParams.dateEnd,
                max_cloud: state.findModalParams.cloudMax
            })
        });

        const data = await res.json();

        // --- ЛОГ ПОСЛЕ ПОЛУЧЕНИЯ ОТВЕТА ---
        console.group("📥 ОТВЕТ ОТ БЭКЕНДА");
        console.log("Статус ответа сервера:", res.status);
        console.log("Полученные данные JSON:", data);
        console.groupEnd();

        if (data.success && data.images && data.images.length > 0) {
            state.foundImages = data.images.map(img => ({
                id: img.satellite_space_id,
                name: `Sentinel-2 (${img.acquisition_date})`,
                date: img.acquisition_date,
                cloud: img.cloud_percentage,
                satellite_space_id: img.satellite_space_id,
                thumbnail_url: img.thumbnail_url
            }));
            state.currentModalStep = 2;
        } else {
            console.warn("Поиск завершился успехом, но массив снимков пуст или success=false");
            state.currentModalStep = 4;
        }
    } catch (e) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА FETCH:", e);
        state.currentModalStep = 4;
    } finally {
        state.isSearching = false;
    }
}

export async function confirmSelectedImages(state, callbacks) {
    const selected = getSelectedImages(state);
    if (selected.length === 0) return;

    state.isConfirming = true;

    try {
        const res = await fetch('/api/satellite/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kml_id: state.selectedItem.id,
                images: selected
            })
        });

        const data = await res.json();

        if (data.success) {
            console.log(data.message);
            // Важнейший шаг: запрашиваем обновленный список файлов с сервера!
            // Наш KML спроецируется с новыми снимками внутри children_ids
            if (callbacks.loadWorkspaceFromServer) {
                callbacks.loadWorkspaceFromServer();
            }
            closeFindImagesModal(state);
        } else {
            alert(data.error || "Ошибка при привязке снимков");
        }
    } catch (e) {
        console.error("Ошибка при подтверждении:", e);
    } finally {
        state.isConfirming = false;
    }
}

// Обновленная логика переключения шагов (теперь с поддержкой асинхронности)
export async function nextModalStep(state, callbacks) {
    if (state.currentModalStep === 4) {
        state.currentModalStep = 1;
        return;
    }
    if (state.currentModalStep === 1) {
        // Запускаем поиск!
        await triggerSearchImages(state);
        return;
    }
    if (state.currentModalStep === 3) {
        // Запускаем сохранение!
        await confirmSelectedImages(state, callbacks);
        return;
    }
    state.currentModalStep++;
}

export function prevModalStep(state) {
    if (state.currentModalStep === 1 || state.currentModalStep === 4) return;
    state.currentModalStep--;
}

export function getModalTitleText(state) {
    if (state.currentModalStep === 1) return 'Параметры поиска снимков Sentinel-2';
    if (state.currentModalStep === 2) return `Найдено ${state.foundImages.length} снимков. Отметьте нужные`;
    if (state.currentModalStep === 3) return 'Подтвердите загрузку снимков';
    return 'Снимки не найдены';
}