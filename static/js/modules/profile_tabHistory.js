// static/js/modules/profile_tabHistory.js

export function getSatelliteCount(state) {
    return state.history.filter(h => h.type === 'satellite').length;
}

export function getAeroCount(state) {
    return state.history.filter(h => h.type === 'aero').length;
}

export function getMultidateCount(state) {
    return state.history.filter(h => h.type === 'multidate').length;
}

export function getFilteredHistory(state) {
    let items = state.history;

    // Фильтр по типу
    if (state.historyFilter !== 'all') {
        items = items.filter(h => h.type === state.historyFilter);
    }

    // Поиск по названию объекта
    const search = state.historySearch.trim().toLowerCase();
    if (search) {
        items = items.filter(h => h.objectName.toLowerCase().includes(search));
    }

    // Сортировка по дате
    items = items.slice().sort((a, b) => {
        const da = new Date(a.timestamp);
        const db = new Date(b.timestamp);
        return state.historySortAsc ? da - db : db - da;
    });

    return items;
}

export function enterHistoryEditMode(state) {
    state.selectedHistoryIds = [];
    state.mode = 'edit';
}

export function toggleHistoryExpand(item) {
    item.expanded = !item.expanded;
}

export function repeatAnalysis(item) {
    // === РЕАЛЬНАЯ ПЕРЕДАЧА СЕССИИ АНАЛИЗА ===
    if (item.algorithm_data) {
        localStorage.setItem('repeat_analysis_config', JSON.stringify(item.algorithm_data));
        alert(`Конфигурация анализа "${item.algorithmName}" загружена. Переход в анализатор...`);
        window.location.href = '/analyzer'; // Перенаправляем на анализатор
    } else {
        alert('Не удалось загрузить параметры этого анализа (данные повреждены или отсутствуют).');
    }
}

export function exportResults(item) {
    alert(`Выгрузка результатов для анализа #${item.id} (Функция в разработке)`);
}

export function confirmDeleteHistory(state) {
    if (state.selectedHistoryIds.length === 0) return;
    state.deleteConfirmModalOpen = true;
}

export async function deleteSelectedHistory(state) {
    const idsToDelete = [...state.selectedHistoryIds];
    let successCount = 0;

    for (const id of idsToDelete) {
        try {
            const res = await fetch(`/api/analysis/${id}`, { method: 'DELETE' });
            if (res.ok) successCount++;
        } catch (error) {
            console.error(`Ошибка удаления анализа ${id}:`, error);
        }
    }

    // Обновляем локальный стейт, убирая удаленные элементы
    state.history = state.history.filter(h => !idsToDelete.includes(h.id));
    state.selectedHistoryIds = [];
    state.deleteConfirmModalOpen = false;

    if (successCount === idsToDelete.length) {
        alert(`Успешно удалено записей: ${successCount}`);
    } else {
        alert(`Удалено ${successCount} из ${idsToDelete.length}. Некоторые записи не найдены.`);
    }
}