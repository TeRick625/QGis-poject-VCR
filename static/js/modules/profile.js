// static/js/modules/profile.js
import { profileState } from '/static/js/state/profileStore.js';

// Импорт функций профиля
import {
    enterEditMode, cancelEditProfile, saveProfile, previewAvatar
} from '/static/js/modules/profile_tabProfile.js';

// Импорт функций истории
import {
    getSatelliteCount, getAeroCount, getMultidateCount, getFilteredHistory,
    enterHistoryEditMode, toggleHistoryExpand, repeatAnalysis, exportResults,
    confirmDeleteHistory, deleteSelectedHistory
} from '/static/js/modules/profile_tabHistory.js';

document.addEventListener('alpine:init', () => {
    Alpine.data('profile', () => ({
        profileState,

        // === Инициализация: загрузка реальных данных с сервера ===
        async initProfile() {
            this.profileState.isLoading = true;
            try {
                // 1. Загружаем данные профиля
                const profileRes = await fetch('/api/profile');
                if (profileRes.ok) {
                    const data = await profileRes.json();
                    this.profileState.user = {
                        name: data.name,
                        email: data.email,
                        role: data.role === 'guest' ? 'Гость' : 'Зарегистрированный пользователь',
                        department: data.department,
                        registrationDate: data.registration_date
                    };
                }

                // 2. Загружаем историю анализов
                const historyRes = await fetch('/api/analysis/history');
                if (historyRes.ok) {
                    const data = await historyRes.json();
                    this.profileState.history = data.history.map(item => ({
                        ...item,
                        expanded: false // Локальный флаг для аккордеона
                    }));
                }
            } catch (error) {
                console.error('Ошибка загрузки данных профиля:', error);
            } finally {
                this.profileState.isLoading = false;
            }
        },

        // === Геттеры (делегируем в модуль истории) ===
        get satelliteCount() { return getSatelliteCount(this.profileState); },
        get aeroCount() { return getAeroCount(this.profileState); },
        get multidateCount() { return getMultidateCount(this.profileState); },
        get filteredHistory() { return getFilteredHistory(this.profileState); },


        // === НОВЫЕ ФУНКЦИИ ДЛЯ АВАТАРА ===
        getInitials(name) {
            if (!name) return '?';
            // Берем первые буквы слов, объединяем и обрезаем до 2 символов, делаем заглавными
            return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        },

        getAvatarBg(name) {
            if (!name) return '#94a3b8'; // fallback серый

            // Простой хеш строки, чтобы цвет был постоянным для одного имени
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }

            // Палитра профессиональных, приятных глазу цветов (Tailwind palette)
            const colors = [
                '#3b82f6', // blue-500
                '#10b981', // emerald-500
                '#8b5cf6', // violet-500
                '#f59e0b', // amber-500
                '#ec4899', // pink-500
                '#06b6d4', // cyan-500
                '#6366f1', // indigo-500
                '#14b8a6', // teal-500
                '#ef4444', // red-500
                '#84cc16'  // lime-500
            ];

            // Выбираем цвет по модулю хеша
            return colors[Math.abs(hash) % colors.length];
        },

        getAvatarTextColor(name) {
            const hex = this.getAvatarBg(name).replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            // Формула восприятия яркости человеком
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // Если фон светлый (> 0.5), текст темный (slate-800), иначе белый
            return luminance > 0.5 ? '#1e293b' : '#ffffff';
        },



        // === Методы Профиля (делегируем в модуль профиля) ===
        enterEditMode() { enterEditMode(this.profileState); },
        cancelEditProfile() { cancelEditProfile(this.profileState); },
        async saveProfile() { await saveProfile(this.profileState); },
        previewAvatar(event) { previewAvatar(event); },

        // === Методы Истории (делегируем в модуль истории) ===
        enterHistoryEditMode() { enterHistoryEditMode(this.profileState); },
        toggleHistoryExpand(item) { toggleHistoryExpand(item); },
        repeatAnalysis(item) { repeatAnalysis(item); },
        exportResults(item) { exportResults(item); },
        confirmDeleteHistory() { confirmDeleteHistory(this.profileState); },
        async deleteSelectedHistory() { await deleteSelectedHistory(this.profileState); }
    }));
});