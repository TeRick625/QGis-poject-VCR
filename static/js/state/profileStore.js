// static/js/state/profileStore.js
export const profileState = {
    // Навигация
    activeTab: 'profile',   // 'profile' | 'history'
    mode: 'view',           // 'view' | 'edit'

    // Данные пользователя (заглушка)
    user: {
        name: 'Иван Петрович Соколов',
        email: 'i.sokolov@binran.ru',
        role: 'Научный сотрудник',
        avatar: null,           // URL или base64
        department: 'Лаборатория геоботаники',
        registrationDate: '15.01.2024'
    },

    // Форма редактирования профиля (заполняется при входе в режим edit)
    editForm: {
        name: '',
        email: '',
        password: ''            // для смены пароля
    },

    // История анализов (заглушка – позже будет загружаться с сервера)
    history: [
        {
            id: 1001,
            timestamp: '2026-04-15 14:30',
            algorithmName: 'Многодатный анализ изменений',
            objectName: 'Полигон Приморский (2 снимка)',
            type: 'multidate',
            resultData: {}
        },
        {
            id: 1002,
            timestamp: '2026-04-14 10:15',
            algorithmName: 'Спутниковый анализ (загруженный)',
            objectName: 'Sentinel-2_2025_05_01.tif',
            type: 'satellite',
            resultData: {}
        },
        {
            id: 1003,
            timestamp: '2026-04-13 16:45',
            algorithmName: 'Аэрофото анализ с геопривязкой',
            objectName: 'Aero_winter_2024.jpg + KML',
            type: 'aero',
            resultData: {}
        }
    ],

    // Фильтрация и сортировка истории
    historyFilter: 'all',       // 'all' | 'satellite' | 'aero' | 'multidate'
    historySortAsc: false,      // false = новые сверху
    historySearch: '',

    // Для массового выбора в режиме редактирования истории
    selectedHistoryIds: [],

    // Модальное подтверждение удаления
    deleteConfirmModalOpen: false,
    historyItemsToDelete: [],

    // Дополнительные флаги
    isSaving: false,
    isDeleting: false
};