import { profileState } from '/static/js/state/profileStore.js';

document.addEventListener('alpine:init', () => {
    Alpine.data('profile', () => ({
        profileState,

        initProfile() {
            // Добавляем поле expanded для каждой записи (если еще нет)
            this.profileState.history.forEach(item => {
                if (item.expanded === undefined) {
                    item.expanded = false;
                }
            });
        },

        // ==================== ГЕТТЕРЫ (статистика, фильтрация) ====================
        get satelliteCount() {
            return this.profileState.history.filter(h => h.type === 'satellite').length;
        },
        get aeroCount() {
            return this.profileState.history.filter(h => h.type === 'aero').length;
        },
        get multidateCount() {
            return this.profileState.history.filter(h => h.type === 'multidate').length;
        },
        get filteredHistory() {
            let items = this.profileState.history;
            // Фильтр по типу
            if (this.profileState.historyFilter !== 'all') {
                items = items.filter(h => h.type === this.profileState.historyFilter);
            }
            // Поиск по названию объекта
            const search = this.profileState.historySearch.trim().toLowerCase();
            if (search) {
                items = items.filter(h => h.objectName.toLowerCase().includes(search));
            }
            // Сортировка по дате (преобразуем timestamp в объект Date для сравнения)
            items = items.slice().sort((a, b) => {
                const da = new Date(a.timestamp);
                const db = new Date(b.timestamp);
                return this.profileState.historySortAsc ? da - db : db - da;
            });
            return items;
        },

        // ==================== ПРОФИЛЬ ====================
        enterEditMode() {
            this.profileState.editForm.name = this.profileState.user.name;
            this.profileState.editForm.email = this.profileState.user.email;
            this.profileState.editForm.password = '';
            this.profileState.mode = 'edit';
        },
        cancelEditProfile() {
            this.profileState.mode = 'view';
        },
        saveProfile() {
            this.profileState.isSaving = true;
            // Имитация задержки (в будущем fetch)
            setTimeout(() => {
                this.profileState.user.name = this.profileState.editForm.name || this.profileState.user.name;
                this.profileState.user.email = this.profileState.editForm.email || this.profileState.user.email;
                this.profileState.isSaving = false;
                this.profileState.mode = 'view';
                alert('Изменения сохранены');
            }, 800);
        },
        previewAvatar(event) {
            // Заглушка: в будущем можно показать превью
            const file = event.target.files[0];
            if (file) {
                alert(`Файл "${file.name}" выбран (заглушка)`);
                // Можно отобразить миниатюру через FileReader
            }
        },

        // ==================== ИСТОРИЯ ====================
        enterHistoryEditMode() {
            this.profileState.selectedHistoryIds = [];
            this.profileState.mode = 'edit';
        },
        toggleHistoryExpand(item) {
            item.expanded = !item.expanded;
        },
        repeatAnalysis(item) {
            alert(`Повтор анализа "${item.algorithmName}" для "${item.objectName}" (заглушка)`);
        },
        exportResults(item) {
            alert(`Выгрузка результатов для анализа #${item.id} (заглушка)`);
        },

        // Удаление с модальным подтверждением
        confirmDeleteHistory() {
            if (this.profileState.selectedHistoryIds.length === 0) return;
            this.profileState.deleteConfirmModalOpen = true;
        },
        deleteSelectedHistory() {
            this.profileState.history = this.profileState.history.filter(
                h => !this.profileState.selectedHistoryIds.includes(h.id)
            );
            this.profileState.selectedHistoryIds = [];
            this.profileState.deleteConfirmModalOpen = false;
        }
    }));
});