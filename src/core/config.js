/**
 * Конфигурация приложения
 */

export const CONFIG = {
    // Рабочие настройки
    WORK_HOURS_PER_DAY: 8,
    
    // Предустановленные варианты времени
    TIME_PRESETS: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8],
    
    // Настройки хранилища
    STORAGE_PREFIX: 'jira-worklog-',
    STORAGE_LAST_LOGGED_DATA_SUFFIX: '-lastLoggedData',
    STORAGE_COMMENTS_SUFFIX: '-comments',
    
    // Стили кнопок
    BUTTON_STYLES: {
        report: {
            id: 'jira-worklog-report-btn',
            text: 'Мои Ворклоги',
            backgroundColor: '#0052CC',
            bottom: '20px'
        },
        addWorklog: {
            id: 'jira-add-worklog-btn',
            text: 'Добавить Ворклог',
            backgroundColor: '#36B37E',
            bottom: '70px'
        }
    },
    
    // API endpoints
    API_ENDPOINTS: {
        CURRENT_USER: '/rest/api/2/myself',
        SEARCH: '/rest/api/2/search',
        WORKLOG: '/rest/api/2/issue/{issueKey}/worklog',
        CREATE_WORKLOG: '/secure/CreateWorklog.jspa',
        CREATE_WORKLOG_DIALOG: '/secure/CreateWorklog!default.jspa'
    },
    
    // UI настройки
    UI: {
        TOAST_DURATION: 5000,
        MAX_SAVED_COMMENTS: 10,
        ANIMATION_DURATION: 300
    }
};