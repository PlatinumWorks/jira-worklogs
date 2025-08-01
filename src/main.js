/**
 * Главный файл Chrome extension для Jira Worklog Reporter
 * Точка входа для модульной архитектуры
 */

import { CONFIG } from './core/config.js';
import { WorklogDialog } from './ui/dialogs/worklog-dialog.js';
import { showDatePicker } from './ui/dialogs/report-dialog.js';

/**
 * Создает кнопку для интерфейса
 */
function createButton(config) {
    const button = document.createElement("button");
    button.id = config.id;
    button.textContent = config.text;
    button.style.cssText = `
        position: fixed; 
        bottom: ${config.bottom}; 
        right: 20px; 
        padding: 10px 20px;
        z-index: 10000; 
        background-color: ${config.backgroundColor}; 
        color: #fff;
        border: none; 
        border-radius: 4px; 
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2); 
        font-family: Arial, sans-serif;
    `;
    return button;
}

/**
 * Показывает диалог добавления worklog
 */
function showAddWorklogDialog() {
    const worklogDialog = new WorklogDialog();
    worklogDialog.show();
}

/**
 * Вставляет кнопки в интерфейс
 */
function insertButtons() {
    // Проверяем, не добавлены ли уже кнопки
    if (document.getElementById(CONFIG.BUTTON_STYLES.report.id)) return;

    const addWorklogBtn = createButton(CONFIG.BUTTON_STYLES.addWorklog);
    const reportBtn = createButton(CONFIG.BUTTON_STYLES.report);

    document.body.appendChild(addWorklogBtn);
    document.body.appendChild(reportBtn);

    // Подключаем реальные обработчики
    addWorklogBtn.addEventListener("click", showAddWorklogDialog);
    reportBtn.addEventListener("click", showDatePicker);
}

/**
 * Обработчик глобальных горячих клавиш
 */
function setupGlobalKeyHandlers() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Закрытие всех возможных диалогов
            const dialogs = ['jira-worklog-report', 'jira-date-picker', 'jira-add-worklog-dialog'];
            dialogs.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        }
    });
}

/**
 * Инициализация приложения
 */
function initializeApp() {
    // Настраиваем глобальные обработчики
    setupGlobalKeyHandlers();
    
    // Добавляем кнопки через небольшую задержку, чтобы страница успела загрузиться
    setTimeout(() => {
        insertButtons();
        console.log('Jira Worklog Reporter: Buttons inserted');
    }, 2000);
}

// Запуск приложения после загрузки страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // Документ уже загружен
    initializeApp();
}

// Также слушаем событие load для надежности
window.addEventListener("load", () => {
    // Проверяем, не добавлены ли уже кнопки, чтобы избежать дублирования
    if (!document.getElementById(CONFIG.BUTTON_STYLES.report.id)) {
        setTimeout(insertButtons, 1000);
    }
});

console.log('Jira Worklog Reporter: Main module loaded');