/**
 * Диалог добавления worklog
 */

import {BaseDialog} from '../components/dialog.js';
import {CONFIG} from '../../core/config.js';
import {jiraAPI, JiraPageUtils} from '../../core/jira-api.js';
import {
    getLastLoggedHours,
    getLastLoggedDate,
    saveLastLoggedData,
    getSavedComments,
    saveComment
} from '../../core/storage.js';
import {
    formatDateForInput,
    formatDateRu,
    getCurrentMonthDates,
    getMonthDates,
    getMonthName,
    formatDateForButton,
    formatDateForAPI,
    isWorkday
} from '../../utils/dates.js';
import {formatTimeSpent} from '../../utils/formatters.js';
import {showToast} from '../components/toast.js';
import {
    showWorklogLoader,
    updateWorklogLoader,
    hideWorklogLoader
} from '../components/loaders.js';

export class WorklogDialog extends BaseDialog {
    constructor() {
        super('jira-add-worklog-dialog', {
            width: '400px',
            title: 'Добавить worklog'
        });

        this.issueKey = null;
        this.selectedHours = null;
        this.isMultiMode = false;
        this.selectedDates = [];
        
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth();
    }

    /**
     * Показывает диалог добавления worklog
     */
    show() {
        this.issueKey = JiraPageUtils.getCurrentIssueKey();
        if (!this.issueKey) {
            showToast("Откройте страницу задачи, чтобы добавить worklog.", 'warning');
            return;
        }

        // Создаем диалог
        this.createElement();
        this.buildContent();
        super.show();
    }

    /**
     * Строит содержимое диалога
     */
    buildContent() {
        const lastDate = getLastLoggedDate(this.issueKey);
        let defaultDate;

        if (lastDate) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(nextDate.getDate() + 1);
            defaultDate = nextDate;
        } else {
            defaultDate = new Date();
        }

        const defaultDateStr = formatDateForInput(defaultDate);
        const lastHours = getLastLoggedHours(this.issueKey);
        const savedComments = getSavedComments(this.issueKey);
        const issueTitle = JiraPageUtils.getCurrentIssueTitle();

        this.element.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                    <h3 style="margin: 0 0 8px 0; color: #333;">Добавить worklog в ${this.issueKey}</h3>
                    <p style="margin: 0 0 20px 0; color: #666; font-size: 13px; line-height: 1.3;">${issueTitle}</p>
                </div>
                <button id="close-dialog-btn" style="background: none; border: none; font-size: 20px; color: #999; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-top: -4px;" title="Закрыть">
                    ✕
                </button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Режим выбора даты:</label>
                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button type="button" id="single-date-mode" class="date-mode-btn"
                            style="padding: 8px 16px; border: 2px solid #36B37E; background: #36B37E; color: #fff; 
                                   border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">
                        Одна дата
                    </button>
                    <button type="button" id="multi-date-mode" class="date-mode-btn"
                            style="padding: 8px 16px; border: 2px solid #ddd; background: #f5f5f5; color: #333; 
                                   border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">
                        Несколько дат
                    </button>
                </div>
            </div>
            
            <div id="single-date-container" style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Дата:</label>
                <input type="date" id="worklog-date" value="${defaultDateStr}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div id="multi-date-container" style="margin-bottom: 16px; display: none;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Выберите даты:</label>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                    <button type="button" id="prev-month" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ◀ Пред
                    </button>
                    <span id="current-month-display" style="font-weight: bold; font-size: 14px; color: #333;"></span>
                    <button type="button" id="next-month" style="padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        След ▶
                    </button>
                </div>
                
                <div id="multi-date-selector"></div>
                <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div id="selected-dates-info" style="color: #666; font-size: 14px;"></div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" id="reset-multi-dates" style="padding: 6px 12px; border: 1px solid #ddd; 
                                background: #f5f5f5; color: #333; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Сбросить
                        </button>
                        <button type="button" id="apply-multi-dates" style="padding: 6px 12px; border: 1px solid #0052CC; 
                                background: #0052CC; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Применить выбор
                        </button>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Время (часы):</label>
                <div id="time-presets" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
                    ${CONFIG.TIME_PRESETS.map(hours => `
                        <button type="button" class="time-preset" data-hours="${hours}" 
                                style="padding: 8px 4px !important; border: 2px solid #ddd !important; background: #f5f5f5 !important; 
                                       border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important; 
                                       transition: all 0.2s ease !important; color: #333 !important;">
                            ${hours}ч
                        </button>
                    `).join('')}
                </div>
                <input type="number" id="custom-hours" placeholder="Или введите часы" min="0.1" max="24" step="0.1"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Комментарий:</label>
                ${savedComments.length > 0 ? `
                    <div style="margin-bottom: 8px;">
                        <select id="comment-suggestions" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9;">
                            <option value="">Выберите из предыдущих комментариев...</option>
                            ${savedComments.map((comment, index) =>
            `<option value="${comment.replace(/"/g, '&quot;')}">${comment.length > 50 ? comment.substring(0, 50) + '...' : comment}</option>`
        ).join('')}
                        </select>
                    </div>
                ` : ''}
                <textarea id="worklog-comment" placeholder="Описание выполненной работы..." 
                          style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
            </div>
            
            <div id="action-buttons" style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="save-worklog-btn" style="padding: 8px 16px; border: none; background: #36B37E; color: white; border-radius: 4px; cursor: pointer;">
                    Добавить worklog
                </button>
            </div>
        `;

        this.setupEventHandlers(defaultDateStr, lastHours, savedComments);
    }

    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers(defaultDateStr, lastHours, savedComments) {
        // Обработчики кнопок
        this.find('#close-dialog-btn').onclick = () => this.remove();
        this.find('#save-worklog-btn').onclick = () => this.handleSave();

        // Настройка компонентов
        this.setupTimePresets(lastHours);
        this.setupCommentSuggestions(savedComments);
        this.setupDateModeToggle(defaultDateStr);
    }

    /**
     * Настраивает предустановки времени
     */
    setupTimePresets(lastHours) {
        const presetButtons = this.findAll('.time-preset');
        const customHoursInput = this.find('#custom-hours');

        // Восстанавливаем последнее значение
        if (lastHours && CONFIG.TIME_PRESETS.includes(lastHours)) {
            const lastButton = Array.from(presetButtons).find(btn => parseFloat(btn.dataset.hours) === lastHours);
            if (lastButton) {
                this.setButtonActive(lastButton);
                this.selectedHours = lastHours;
            }
        } else if (lastHours) {
            customHoursInput.value = lastHours;
        }

        // Обработчики предустановок
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.resetAllButtons(presetButtons);
                this.setButtonActive(btn);

                this.selectedHours = parseFloat(btn.dataset.hours);
                customHoursInput.value = '';
            });
        });

        // Обработчик кастомного ввода
        customHoursInput.addEventListener('input', () => {
            this.resetAllButtons(presetButtons);
            this.selectedHours = null;
        });
    }

    /**
     * Настраивает предложения комментариев
     */
    setupCommentSuggestions(savedComments) {
        if (savedComments.length === 0) return;

        const commentSelect = this.find('#comment-suggestions');
        const commentTextarea = this.find('#worklog-comment');

        if (!commentSelect || !commentTextarea) return;

        commentSelect.addEventListener('change', (e) => {
            const selectedComment = e.target.value;
            if (selectedComment) {
                commentTextarea.value = selectedComment;
                commentTextarea.focus();
                commentSelect.value = '';
            }
        });
    }

    /**
     * Настраивает переключение режимов дат
     */
    setupDateModeToggle(defaultDateStr) {
        const singleModeBtn = this.find('#single-date-mode');
        const multiModeBtn = this.find('#multi-date-mode');

        singleModeBtn.addEventListener('click', () => this.showSingleMode(defaultDateStr));
        multiModeBtn.addEventListener('click', () => this.showMultiMode());

        this.find('#apply-multi-dates').addEventListener('click', () => this.applyMultiDates());
        this.find('#reset-multi-dates').addEventListener('click', () => this.resetAllSelectedDates());
        
        this.find('#prev-month').addEventListener('click', () => this.navigateMonth(-1));
        this.find('#next-month').addEventListener('click', () => this.navigateMonth(1));
    }

    /**
     * Показывает режим одной даты
     */
    showSingleMode(defaultDateStr) {
        this.isMultiMode = false;
        this.setModeButtonActive(this.find('#single-date-mode'), this.find('#multi-date-mode'));

        // Восстанавливаем исходное содержимое single-date-container
        const singleContainer = this.find('#single-date-container');
        singleContainer.innerHTML = `
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Дата:</label>
            <input type="date" id="worklog-date" value="${defaultDateStr}" 
                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        `;

        // Показываем/скрываем нужные контейнеры
        singleContainer.style.display = 'block';
        this.find('#multi-date-container').style.display = 'none';

        // Показываем скрытые элементы
        this.showHiddenElements();
    }

    /**
     * Показывает режим нескольких дат
     */
    showMultiMode() {
        this.isMultiMode = true;
        this.setModeButtonActive(this.find('#multi-date-mode'), this.find('#single-date-mode'));

        // Скрываем элементы, которые не нужны в multi режиме
        this.hideElementsForMultiMode();

        this.find('#single-date-container').style.display = 'none';
        this.find('#multi-date-container').style.display = 'block';

        this.generateMultiDateSelector();
    }

    /**
     * Скрывает элементы в multi режиме
     */
    hideElementsForMultiMode() {
        // Скрываем секции времени, комментариев и кнопок
        const timeSection = this.element.querySelector('#time-presets').parentElement;
        const commentSection = this.element.querySelector('#worklog-comment').parentElement;
        const buttonsSection = this.element.querySelector('#action-buttons');

        if (timeSection) timeSection.style.display = 'none';
        if (commentSection) commentSection.style.display = 'none';
        if (buttonsSection) buttonsSection.style.display = 'none';
    }

    /**
     * Показывает скрытые элементы при возврате в single режим
     */
    showHiddenElements() {
        // Показываем секции времени, комментариев и кнопок
        const timeSection = this.element.querySelector('#time-presets').parentElement;
        const commentSection = this.element.querySelector('#worklog-comment').parentElement;
        const buttonsSection = this.element.querySelector('#action-buttons');

        if (timeSection) timeSection.style.display = 'block';
        if (commentSection) commentSection.style.display = 'block';
        if (buttonsSection) buttonsSection.style.display = 'flex';
    }

    /**
     * Генерирует селектор множественных дат
     */
    generateMultiDateSelector() {
        const selector = this.find('#multi-date-selector');
        const monthDisplay = this.find('#current-month-display');
        
        // Используем выбранный месяц и год вместо текущих
        const dates = getMonthDates(this.selectedYear, this.selectedMonth);
        
        // Обновляем отображение месяца
        monthDisplay.textContent = `${getMonthName(this.selectedMonth)} ${this.selectedYear}`;

        const weekDayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

        selector.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; max-width: 100%;">
                ${weekDayHeaders.map(day => `
                    <div style="padding: 8px 4px; text-align: center; font-weight: bold; color: #666; font-size: 12px;">
                        ${day}
                    </div>
                `).join('')}
                ${dates.map(date => {
            if (date === null) {
                return `<div style="padding: 8px 4px; min-height: 45px;"></div>`;
            }

            const dateStr = formatDateForAPI(date);
            const isSelected = this.selectedDates.includes(dateStr);
            const isWeekend = !isWorkday(date);

            return `
                        <button type="button" class="multi-date-btn" data-date="${dateStr}"
                                style="padding: 8px 4px; border: 2px solid ${isSelected ? '#36B37E' : '#ddd'}; 
                                       background: ${isSelected ? '#36B37E' : isWeekend ? '#f8f8f8' : '#fff'}; 
                                       color: ${isSelected ? '#fff' : isWeekend ? '#999' : '#333'};
                                       border-radius: 4px; cursor: pointer; font-size: 11px; 
                                       transition: all 0.2s ease; white-space: pre-line; text-align: center;
                                       min-height: 45px; display: flex; align-items: center; justify-content: center;">
                            ${formatDateForButton(date)}
                        </button>
                    `;
        }).join('')}
            </div>
        `;

        // Добавляем обработчики кликов
        this.findAll('.multi-date-btn[data-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateStr = btn.dataset.date;
                this.toggleDateSelection(dateStr);
            });
        });

        this.updateSelectedDatesInfo();
    }

    /**
     * Переключает выбор даты
     */
    toggleDateSelection(dateStr) {
        const isSelected = this.selectedDates.includes(dateStr);
        const btn = this.find(`.multi-date-btn[data-date="${dateStr}"]`);

        if (!btn) return;

        if (isSelected) {
            this.selectedDates = this.selectedDates.filter(d => d !== dateStr);
            btn.style.border = '2px solid #ddd';
            btn.style.background = isWorkday(new Date(dateStr)) ? '#fff' : '#f8f8f8';
            btn.style.color = isWorkday(new Date(dateStr)) ? '#333' : '#999';
        } else {
            this.selectedDates.push(dateStr);
            btn.style.border = '2px solid #36B37E';
            btn.style.background = '#36B37E';
            btn.style.color = '#fff';
        }

        this.updateSelectedDatesInfo();
    }

    /**
     * Обновляет информацию о выбранных датах
     */
    updateSelectedDatesInfo() {
        const info = this.find('#selected-dates-info');
        const applyBtn = this.find('#apply-multi-dates');

        if (this.selectedDates.length === 0) {
            info.textContent = 'Даты не выбраны';
            applyBtn.disabled = true;
            applyBtn.style.opacity = '0.5';
        } else {
            info.textContent = `Выбрано ${this.selectedDates.length} ${this.selectedDates.length === 1 ? 'день' : this.selectedDates.length < 5 ? 'дня' : 'дней'}`;
            applyBtn.disabled = false;
            applyBtn.style.opacity = '1';
        }
    }

    /**
     * Сбрасывает все выбранные даты
     */
    resetAllSelectedDates() {
        this.selectedDates = [];
        this.generateMultiDateSelector();
    }

    /**
     * Применяет выбор нескольких дат
     */
    applyMultiDates() {
        if (this.selectedDates.length === 0) {
            showToast('Выберите хотя бы одну дату', 'warning');
            return;
        }

        // Скрываем блок выбора дат и показываем информацию
        this.find('#multi-date-container').style.display = 'none';

        const info = this.find('#selected-dates-info');
        const singleContainer = this.find('#single-date-container');
        singleContainer.innerHTML = `
            <label style="display: block; margin-bottom: 6px; font-weight: bold;">Даты:</label>
            <div style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 14px;">
                ${info.textContent}
            </div>
        `;
        singleContainer.style.display = 'block';

        // Показываем скрытые элементы (время, комментарии, кнопки)
        this.showHiddenElements();
    }

    /**
     * Обработчик сохранения
     */
    async handleSave() {
        const customHours = parseFloat(this.find('#custom-hours').value);
        const hours = customHours || this.selectedHours;
        const comment = this.find('#worklog-comment').value.trim();

        if (!hours) {
            showToast('Выберите количество часов', 'warning');
            return;
        }

        if (this.isMultiMode && this.selectedDates.length > 0) {
            await this.handleMultiDateSave(hours, comment);
        } else {
            await this.handleSingleDateSave(hours, comment);
        }
    }

    /**
     * Сохранение для нескольких дат
     */
    async handleMultiDateSave(hours, comment) {
        this.remove();

        const totalDates = this.selectedDates.length;
        let completedDates = 0;

        const progressLoader = showWorklogLoader(`Добавляем worklog'и: 0/${totalDates}`);

        try {
            for (const date of this.selectedDates) {
                await jiraAPI.addWorklog(this.issueKey, date, hours, comment);
                completedDates++;
                updateWorklogLoader(progressLoader, `Добавляем worklog'и: ${completedDates}/${totalDates}`);
            }

            hideWorklogLoader(progressLoader);
            showToast(`Успешно добавлено ${completedDates} worklog'ов!\nВремя: ${formatTimeSpent(hours)} за каждый день`, 'success');

            // Сохраняем данные последнего воркдога
            const lastDate = this.selectedDates[this.selectedDates.length - 1];
            saveLastLoggedData(this.issueKey, hours, lastDate);

            if (comment?.trim()) {
                saveComment(this.issueKey, comment);
            }

        } catch (error) {
            hideWorklogLoader(progressLoader);
            showToast(`Ошибка при добавлении worklog'ов: ${error.message}`, 'error');
        }
    }

    /**
     * Сохранение для одной даты
     */
    async handleSingleDateSave(hours, comment) {
        const date = this.find('#worklog-date').value;

        if (!date) {
            showToast('Выберите дату', 'warning');
            return;
        }

        this.remove();

        // Показываем загрузчик для single worklog
        const loader = showWorklogLoader('Добавляем worklog...');

        try {
            const result = await jiraAPI.addWorklog(this.issueKey, date, hours, comment);
            hideWorklogLoader(loader);
            showToast(`Worklog добавлен!\nВремя: ${formatTimeSpent(hours)}\nДата: ${formatDateRu(result.date)}`, 'success');

            saveLastLoggedData(this.issueKey, hours, date);
            if (comment?.trim()) {
                saveComment(this.issueKey, comment);
            }
        } catch (error) {
            hideWorklogLoader(loader);
            showToast(`Ошибка: ${error.message}`, 'error');
        }
    }

    /**
     * Сбрасывает стили всех кнопок
     */
    resetAllButtons(buttons) {
        buttons.forEach(btn => {
            btn.style.cssText = `
                padding: 8px 4px !important; border: 2px solid #ddd !important; 
                background: #f5f5f5 !important; color: #333 !important;
                border-radius: 4px !important; cursor: pointer !important; 
                font-size: 12px !important; transition: all 0.2s ease !important;
            `;
        });
    }

    /**
     * Устанавливает активную кнопку
     */
    setButtonActive(button) {
        button.style.cssText = `
            padding: 8px 4px !important; border: 2px solid #36B37E !important; 
            background: #36B37E !important; color: #fff !important;
            border-radius: 4px !important; cursor: pointer !important; 
            font-size: 12px !important; transition: all 0.2s ease !important;
        `;
    }

    /**
     * Устанавливает активную кнопку режима
     */
    setModeButtonActive(activeBtn, inactiveBtn) {
        activeBtn.style.cssText = `
            padding: 8px 16px; border: 2px solid #36B37E; background: #36B37E; color: #fff; 
            border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;
        `;
        inactiveBtn.style.cssText = `
            padding: 8px 16px; border: 2px solid #ddd; background: #f5f5f5; color: #333; 
            border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;
        `;
    }

    /**
     * Навигация по месяцам
     */
    navigateMonth(direction) {
        this.selectedMonth += direction;
        
        // Обработка переходов между годами
        if (this.selectedMonth < 0) {
            this.selectedMonth = 11;
            this.selectedYear--;
        } else if (this.selectedMonth > 11) {
            this.selectedMonth = 0;
            this.selectedYear++;
        }
        
        // Перегенерируем календарь с новым месяцем
        this.generateMultiDateSelector();
    }
}