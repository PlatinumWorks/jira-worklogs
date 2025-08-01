/**
 * API модуль для работы с Jira
 */

import { CONFIG } from './config.js';
import { formatDateForJiraWorklog } from '../utils/dates.js';
import { formatTimeSpent } from '../utils/formatters.js';

/**
 * Класс для работы с Jira API
 */
export class JiraAPI {
    /**
     * Получает информацию о текущем пользователе
     */
    async getCurrentUser() {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.CURRENT_USER, {
                headers: { Accept: "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                console.error("Не удалось получить информацию о текущем пользователе:", response.status);
                return null;
            }

            const data = await response.json();
            return {
                accountId: data.accountId,
                name: data.name,
                displayName: data.displayName,
                email: data.name
            };
        } catch (error) {
            console.error("Error getting current user:", error);
            return null;
        }
    }

    /**
     * Получает информацию о задаче
     */
    async getIssue(issueKey, fields = 'id,key,summary') {
        try {
            const response = await fetch(`/rest/api/2/issue/${issueKey}?fields=${fields}`, {
                headers: { Accept: "application/json" },
                credentials: "include"
            });

            if (response.ok) {
                return await response.json();
            }

            return null;
        } catch (error) {
            console.error(`Error getting issue ${issueKey}:`, error);
            return null;
        }
    }

    /**
     * Получает ID задачи
     */
    async getIssueId(issueKey) {
        try {
            const issue = await this.getIssue(issueKey, 'id');
            if (issue) {
                return issue.id;
            }

            // Fallback - поиск в мета-тегах
            const issueIdMeta = document.querySelector('meta[name="ajs-issue-id"]');
            if (issueIdMeta) {
                return issueIdMeta.content;
            }

            return null;
        } catch (error) {
            console.error('Error getting issue ID:', error);
            return null;
        }
    }

    /**
     * Получает все worklog'и для задачи
     */
    async fetchAllWorklogsForIssue(issueKey) {
        const allWorklogs = [];
        let startAt = 0;
        const maxResults = 100;

        while (true) {
            const url = CONFIG.API_ENDPOINTS.WORKLOG.replace('{issueKey}', issueKey) + 
                       `?startAt=${startAt}&maxResults=${maxResults}`;

            try {
                const response = await fetch(url, {
                    headers: { Accept: "application/json" },
                    credentials: "include"
                });

                if (!response.ok) {
                    console.error(`Ошибка загрузки worklogs для ${issueKey}, startAt=${startAt}:`, response.status);
                    break;
                }

                const data = await response.json();
                const fetched = data.worklogs || [];
                allWorklogs.push(...fetched);

                if (data.startAt + data.maxResults >= data.total) {
                    break;
                }

                startAt += maxResults;
            } catch (error) {
                console.error(`Error fetching worklogs for ${issueKey}:`, error);
                break;
            }
        }

        return allWorklogs;
    }

    /**
     * Ищет задачи по JQL
     */
    async searchIssues(jql, fields = 'key,summary', maxResults = 1000) {
        try {
            const url = `${CONFIG.API_ENDPOINTS.SEARCH}?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=${maxResults}`;
            
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Search API Error:", response.status, errorText);
                throw new Error(`Ошибка запроса Jira API: ${response.status}\n${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error searching issues:", error);
            throw error;
        }
    }

    /**
     * Получает atlassian-token из мета-тегов
     */
    getAtlToken() {
        const meta = document.querySelector('meta[name="atlassian-token"]');
        return meta ? meta.content : null;
    }

    /**
     * Получает formToken из диалога создания worklog'а
     */
    async getFormToken(issueId) {
        try {
            console.log('Opening worklog dialog to get formToken...');

            const dialogUrl = CONFIG.API_ENDPOINTS.CREATE_WORKLOG_DIALOG + `?id=${issueId}`;
            const response = await fetch(dialogUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (response.ok) {
                const html = await response.text();
                console.log('Dialog HTML received, length:', html.length);

                // Ищем formToken по паттерну
                const formTokenMatch = html.match(/name="formToken"[\s\S]*?value="([^"]+)"/i);

                if (formTokenMatch) {
                    console.log('Found formToken:', formTokenMatch[1]);
                    return formTokenMatch[1];
                }

                console.log('FormToken not found in HTML');
                // Показываем фрагмент с формой для отладки
                const formMatch = html.match(/<form[\s\S]*?<\/form>/i);
                if (formMatch) {
                    console.log('Form HTML:', formMatch[0].substring(0, 500));
                }
            } else {
                console.error('Failed to get dialog HTML:', response.status, response.statusText);
            }

            return null;
        } catch (error) {
            console.error('Error getting formToken from dialog:', error);
            return null;
        }
    }

    /**
     * Добавляет worklog к задаче
     */
    async addWorklog(issueKey, date, hours, comment = '') {
        // Получаем ID задачи
        const issueId = await this.getIssueId(issueKey);
        if (!issueId) {
            throw new Error('Не удалось получить ID задачи');
        }

        // Получаем токены
        const atlToken = this.getAtlToken();
        const formToken = await this.getFormToken(issueId);

        console.log('Tokens:', { 
            atlToken: atlToken ? 'найден' : 'не найден', 
            formToken: formToken ? 'найден' : 'не найден' 
        });

        if (!formToken) {
            throw new Error('Не удалось получить formToken из диалога. Возможно нет прав на создание worklog\'ов.');
        }

        // Форматируем дату для Jira
        const formattedDate = formatDateForJiraWorklog(date);

        // Создаем данные формы
        const formData = new URLSearchParams({
            'inline': 'true',
            'decorator': 'dialog',
            'worklogId': '',
            'id': issueId,
            'formToken': formToken,
            'timeLogged': formatTimeSpent(hours),
            'startDate': formattedDate,
            'adjustEstimate': 'auto',
            'dnd-dropzone': '',
            'comment': comment || '',
            'commentLevel': '',
            'atl_token': atlToken || ''
        });

        console.log('Submitting worklog...');

        const response = await fetch(CONFIG.API_ENDPOINTS.CREATE_WORKLOG, {
            method: 'POST',
            headers: {
                'Accept': 'text/html, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': window.location.href
            },
            credentials: 'include',
            body: formData.toString()
        });

        console.log(`Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();

        if (responseText.includes('error') || responseText.includes('Error')) {
            console.log('Response contains errors');
            throw new Error('Сервер вернул ошибку при создании worklog\'а.');
        }

        return {
            success: true,
            issueKey,
            hours,
            date: new Date(date),
            comment
        };
    }
}

/**
 * Утилиты для извлечения информации о текущей странице Jira
 */
export class JiraPageUtils {
    /**
     * Получает ключ текущей задачи
     */
    static getCurrentIssueKey() {
        // Пробуем извлечь из URL
        const urlMatch = window.location.href.match(/\/browse\/([A-Z]+-\d+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        // Пробуем найти в breadcrumbs
        const breadcrumbs = document.querySelector('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]');
        if (breadcrumbs) {
            const keyElement = breadcrumbs.querySelector('span');
            if (keyElement) {
                return keyElement.textContent.trim();
            }
        }

        // Пробуем найти в мета-тегах
        const issueKeyMeta = document.querySelector('meta[name="ajs-issue-key"]');
        if (issueKeyMeta) {
            return issueKeyMeta.content;
        }

        return null;
    }

    /**
     * Получает заголовок текущей задачи
     */
    static getCurrentIssueTitle() {
        const summaryElement = document.querySelector('#summary-val');
        if (summaryElement) {
            // Клонируем элемент и удаляем все дочерние элементы, оставляя только текст
            const clonedElement = summaryElement.cloneNode(true);
            const childElements = clonedElement.querySelectorAll('*');
            childElements.forEach(child => child.remove());
            return clonedElement.textContent.trim() || 'Без описания';
        }
        return 'Без описания';
    }
}

// Создаем глобальный экземпляр API
export const jiraAPI = new JiraAPI();