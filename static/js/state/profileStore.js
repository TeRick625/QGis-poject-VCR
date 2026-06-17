// static/js/state/profileStore.js
export const profileState = {
    // Навигация
    activeTab: 'profile',   // 'profile' | 'history'
    mode: 'view',           // 'view' | 'edit'

    // Данные пользователя (заполняются с сервера)
    user: {
        name: 'Загрузка...',
        email: '...',
        role: '...',
        department: '...',
        registrationDate: '...'
    },

    // Форма редактирования профиля
    editForm: {
        name: '',
        email: '',
        password: ''
    },

    // История анализов (заполняется с сервера)
    history: [],

    // Фильтрация и сортировка истории
    historyFilter: 'all',       // 'all' | 'satellite' | 'aero' | 'multidate'
    historySortAsc: false,
    historySearch: '',

    // Для массового выбора в режиме редактирования истории
    selectedHistoryIds: [],

    // Модальное подтверждение удаления
    deleteConfirmModalOpen: false,

    // Дополнительные флаги
    isSaving: false,
    isLoading: true // Новый флаг для отображения загрузки
};