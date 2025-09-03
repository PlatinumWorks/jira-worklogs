/**
 * Диалог генерации отчетов
 */

import {BaseDialog} from '../components/dialog.js';
import {CONFIG} from '../../core/config.js';
import {jiraAPI} from '../../core/jira-api.js';
import {
    formatDateForAPI,
    formatDateRu,
    getMonthName,
    getAllWorkdays
} from '../../utils/dates.js';
import {
    getProgressColor,
    getOverallProgressColor
} from '../../utils/formatters.js';
import {showToast} from '../components/toast.js';
import {showMainLoader, hideMainLoader} from '../components/loaders.js';

export class ReportDialog extends BaseDialog {
    constructor() {
        super('jira-date-picker', {
            width: '300px',
            title: 'Выберите период'
        });
    }

    /**
     * Показывает диалог выбора периода
     */
    show() {
        this.createElement();
        this.buildContent();
        super.show();
    }

    /**
     * Строит содержимое диалога
     */
    buildContent() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        const years = [];
        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
            years.push(y);
        }

        this.element.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333;">Выберите период</h3>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Месяц:</label>
                <select id="month-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    ${months.map((month, index) =>
            `<option value="${index}" ${index === currentMonth ? 'selected' : ''}>${month}</option>`
        ).join('')}
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Год:</label>
                <select id="year-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    ${years.map(year =>
            `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
        ).join('')}
                </select>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; cursor: pointer;">
                    Отмена
                </button>
                <button id="generate-btn" style="padding: 8px 16px; border: none; background: #0052CC; color: white; border-radius: 4px; cursor: pointer;">
                    Создать отчёт
                </button>
            </div>
        `;

        this.setupEventHandlers();
    }

    /**
     * Настраивает обработчики событий
     */
    setupEventHandlers() {
        this.find('#cancel-btn').onclick = () => this.remove();
        this.find('#generate-btn').onclick = () => this.handleGenerate();
    }

    /**
     * Обработчик генерации отчета
     */
    async handleGenerate() {
        const month = parseInt(this.find('#month-select').value);
        const year = parseInt(this.find('#year-select').value);

        this.remove();
        await this.generateReport(month, year);
    }

    /**
     * Генерирует отчет
     */
    async generateReport(month, year) {
        showMainLoader();

        try {
            const {startDate, endDate} = this.getDateRange(month, year);
            const currentUser = await this.getCurrentUserSafely();

            if (!currentUser) return;

            const userWorklogs = await this.fetchUserWorklogs(currentUser, startDate, endDate);
            const processedData = this.processWorklogData(userWorklogs);

            hideMainLoader();
            this.renderReport(processedData.worklogs, month, year, processedData.totalHours, startDate, endDate);

        } catch (error) {
            hideMainLoader();
            console.error("Error generating report:", error);
            showToast(`Ошибка при генерации отчета: ${error.message}`, 'error');
        }
    }

    /**
     * Получает диапазон дат для отчета
     */
    getDateRange(month, year) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        return {startDate, endDate};
    }

    /**
     * Безопасно получает данные текущего пользователя
     */
    async getCurrentUserSafely() {
        const currentUser = await jiraAPI.getCurrentUser();
        if (!currentUser) {
            hideMainLoader();
            showToast("Не удалось получить данные текущего пользователя.", 'error');
            return null;
        }
        return currentUser;
    }

    /**
     * Получает worklogs текущего пользователя за период
     */
    async fetchUserWorklogs(currentUser, startDate, endDate) {
        const startDateStr = formatDateForAPI(startDate);
        const endDateStr = formatDateForAPI(endDate);
        const jql = `worklogAuthor = currentUser() AND worklogDate >= "${startDateStr}" AND worklogDate <= "${endDateStr}"`;
        const searchResult = await jiraAPI.searchIssues(jql, 'key,summary', 1000);

        const userWorklogs = [];

        for (const issue of searchResult.issues) {
            const issueWorklogs = await this.processIssueWorklogs(issue, currentUser, startDate, endDate);
            userWorklogs.push(...issueWorklogs);
        }

        return userWorklogs;
    }

    /**
     * Обрабатывает worklogs одной задачи
     */
    async processIssueWorklogs(issue, currentUser, startDate, endDate) {
        const {key, fields} = issue;
        const allWorklogs = await jiraAPI.fetchAllWorklogsForIssue(key);
        const userWorklogs = [];

        for (const log of allWorklogs) {
            if (this.isUserWorklogInRange(log, currentUser, startDate, endDate)) {
                const logDate = new Date(log.started);
                userWorklogs.push({
                    issueKey: key,
                    issueSummary: fields.summary || "No summary",
                    date: formatDateRu(logDate),
                    dateSort: logDate,
                    timeSpent: log.timeSpent,
                    seconds: log.timeSpentSeconds,
                    comment: log.comment || ""
                });
            }
        }

        return userWorklogs;
    }

    /**
     * Проверяет, принадлежит ли worklog текущему пользователю и входит в диапазон
     */
    isUserWorklogInRange(log, currentUser, startDate, endDate) {
        const isCurrentUser = this.isCurrentUserWorklog(log, currentUser);
        const logDate = new Date(log.started);
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const isInRange = logDateOnly >= startDate && logDateOnly <= endDate;

        return isCurrentUser && isInRange;
    }

    /**
     * Проверяет, принадлежит ли worklog текущему пользователю
     */
    isCurrentUserWorklog(log, currentUser) {
        if (log.author.accountId && currentUser.accountId) {
            return log.author.accountId === currentUser.accountId;
        }
        if (log.author.name && currentUser.name) {
            return log.author.name === currentUser.name;
        }
        if (log.author.emailAddress && currentUser.email) {
            return log.author.emailAddress === currentUser.email;
        }
        return false;
    }

    /**
     * Обрабатывает и сортирует данные worklogs
     */
    processWorklogData(userWorklogs) {
        const totalSeconds = userWorklogs.reduce((sum, w) => sum + w.seconds, 0);
        const totalHours = (totalSeconds / 3600).toFixed(2);
        const worklogs = userWorklogs.sort((a, b) => a.dateSort - b.dateSort);

        return {worklogs, totalHours};
    }

    /**
     * Отрисовывает отчет
     */
    renderReport(worklogs, month, year, totalHours, startDate, endDate) {
        // Удаляем существующий отчет
        const existing = document.getElementById("jira-worklog-report");
        if (existing) existing.remove();

        const allWorkdays = getAllWorkdays(startDate, endDate);

        const worklogsByDate = {};
        for (const log of worklogs) {
            const dateKey = formatDateRu(log.dateSort);
            if (!worklogsByDate[dateKey]) {
                worklogsByDate[dateKey] = [];
            }
            worklogsByDate[dateKey].push(log);
        }

        const allDaysData = allWorkdays.map(date => {
            const dateKey = formatDateRu(date);
            const dayWorklogs = worklogsByDate[dateKey] || [];
            const dayTotal = dayWorklogs.reduce((sum, l) => sum + l.seconds, 0);
            const dayHours = dayTotal / 3600;

            return {
                date: dateKey,
                dateSort: date,
                worklogs: dayWorklogs,
                totalSeconds: dayTotal,
                totalHours: dayHours,
                isEmpty: dayWorklogs.length === 0
            };
        });

        const workdaysCount = allDaysData.length;
        const workedDaysCount = allDaysData.filter(d => !d.isEmpty).length;
        const expectedHours = workdaysCount * CONFIG.WORK_HOURS_PER_DAY;
        const completionPercent = expectedHours > 0 ? (totalHours / expectedHours * 100).toFixed(1) : 0;

        const container = document.createElement("div");
        container.id = "jira-worklog-report";
        container.style.cssText = `
            position: fixed; top: 60px; right: 20px; max-height: 80vh; overflow-y: auto;
            width: 700px; background: #fff; border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3); padding: 16px; z-index: 9999;
            font-size: 14px; font-family: Arial, sans-serif;
        `;

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "✕";
        closeBtn.style.cssText = `
            position: absolute; top: 8px; right: 8px; background: #ff4444; color: white;
            border: none; border-radius: 3px; width: 24px; height: 24px; cursor: pointer; font-size: 16px;
        `;
        closeBtn.onclick = () => container.remove();

        container.innerHTML = `
            <h2>Отчёт по времени (${getMonthName(month)} ${year})</h2>
            <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><strong>Отработано:</strong> ${totalHours} ч</span>
                    <span><strong>Норма:</strong> ${expectedHours} ч</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><strong>Рабочих дней:</strong> ${workdaysCount}</span>
                    <span><strong>Дней с логами:</strong> ${workedDaysCount}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Выполнение нормы:</strong> ${completionPercent}%
                </div>
                <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${Math.min(completionPercent, 100)}%; height: 100%; background: ${getOverallProgressColor(completionPercent)}; transition: width 0.3s ease;"></div>
                </div>
            </div>
            <div style="font-family:sans-serif">
              ${allDaysData.map(dayData => {
            const dayHours = dayData.totalHours.toFixed(2);
            const progressPercent = Math.min((dayData.totalHours / CONFIG.WORK_HOURS_PER_DAY) * 100, 100);
            const progressColor = getProgressColor(dayData.totalHours);
            const isEmptyDay = dayData.isEmpty;

            const hoursTextColor = isEmptyDay ? '#999' :
                dayData.totalHours >= 7.5 ? '#2e7d32' :
                    dayData.totalHours >= 4 ? '#f57c00' : '#d32f2f';

            return `
                  <div style="margin-bottom: 16px; border: 1px solid ${isEmptyDay ? '#f0f0f0' : '#ddd'}; border-radius: 6px; padding: 12px; background: ${isEmptyDay ? '#fafafa' : '#fff'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <h3 style="margin: 0; color: ${isEmptyDay ? '#999' : '#0052CC'}; font-size: 16px;">
                        ${dayData.date}
                      </h3>
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: bold; color: ${hoursTextColor}; min-width: 50px;">
                          ${dayHours} ч
                        </span>
                        <div style="width: 120px; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; position: relative;">
                          <div style="width: ${progressPercent}%; height: 100%; background: ${progressColor}; transition: width 0.3s ease, background-color 0.3s ease;"></div>
                          ${dayData.totalHours > CONFIG.WORK_HOURS_PER_DAY ?
                `<div style="position: absolute; top: 0; left: 100%; width: 2px; height: 100%; background: #333; opacity: 0.5;"></div>` :
                ''
            }
                        </div>
                        ${dayData.totalHours > CONFIG.WORK_HOURS_PER_DAY ?
                `<span style="font-size: 12px; color: #2e7d32;">+${(dayData.totalHours - CONFIG.WORK_HOURS_PER_DAY).toFixed(1)}ч</span>` :
                dayData.totalHours > 0 && dayData.totalHours < CONFIG.WORK_HOURS_PER_DAY ?
                    `<span style="font-size: 12px; color: #666;">-${(CONFIG.WORK_HOURS_PER_DAY - dayData.totalHours).toFixed(1)}ч</span>` :
                    ''
            }
                      </div>
                    </div>
                    
                    ${isEmptyDay ?
                `<div style="color: #999; font-style: italic; text-align: center; padding: 8px;">Нет записей времени</div>` :
                `<div style="margin-left: 8px;">
                        ${dayData.worklogs.map(log => `
                          <div style="margin-bottom:6px; padding:8px; background:#f5f5f5; border-left:3px solid #0052CC; border-radius: 0 4px 4px 0;">
                            <strong><a href="/browse/${log.issueKey}" target="_blank" style="color: #0052CC; text-decoration: none;">${log.issueKey}</a></strong>: ${log.timeSpent}
                            <br><small style="color:#666">${log.issueSummary}</small>
                            ${log.comment ? `<br><em style="color:#888">${log.comment}</em>` : ''}
                          </div>
                        `).join("")}
                      </div>`
            }
                  </div>
                `;
        }).join("")}
            </div>
        `;

        container.appendChild(closeBtn);
        document.body.appendChild(container);
    }
}

/**
 * Показывает диалог выбора даты для отчета
 */
export function showDatePicker() {
    // Проверяем, не открыт ли уже диалог
    const existingDialog = document.getElementById('jira-date-picker');
    if (existingDialog) {
        return; // Не создаем новый диалог если уже есть открытый
    }
    
    const reportDialog = new ReportDialog();
    reportDialog.show();
}