(function () {
    'use strict';

    // ============================================================================
    // КОНСТАНТЫ И КОНФИГУРАЦИЯ
    // ============================================================================

    const CONFIG = {
        WORK_HOURS_PER_DAY: 8,
        TIME_PRESETS: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8],
        STORAGE_PREFIX: 'jira-worklog-',
        STORAGE_LAST_LOGGED_DATA_SUFFIX: '-lastLoggedData',
        STORAGE_COMMENTS_SUFFIX: '-comments',
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
        }
    };

    // ============================================================================
    // УТИЛИТЫ ДЛЯ РАБОТЫ С ДАТАМИ
    // ============================================================================

    function formatDateForAPI(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateForInput(date) {
        return formatDateForAPI(date);
    }

    function formatDateRu(date) {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        const weekday = weekdays[date.getDay()];

        return `${weekday}, ${day} ${month} ${year}`;
    }

    function getMonthName(monthIndex) {
        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        return months[monthIndex];
    }

    function isWorkday(date) {
        const day = date.getDay();
        return day >= 1 && day <= 5;
    }

    function getAllWorkdays(startDate, endDate) {
        const workdays = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            if (isWorkday(currentDate)) {
                workdays.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return workdays;
    }

    function formatTimeSpent(hours) {
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);

        let result = '';
        if (wholeHours > 0) {
            result += `${wholeHours}h`;
        }
        if (minutes > 0) {
            if (result) result += ' ';
            result += `${minutes}m`;
        }

        return result || '1m';
    }

    function formatDateForButton(date) {
        const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        const day = date.getDate();
        const weekday = weekdays[date.getDay()];
        return `${day}\n${weekday}`;
    }

    function getCurrentMonthDates() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        // Получаем первый и последний день текущего месяца
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const dates = [];
        
        // Получаем день недели первого дня месяца (0 = воскресенье, 1 = понедельник, ..., 6 = суббота)
        let firstDayOfWeek = firstDay.getDay();
        // Конвертируем в европейский формат (0 = понедельник, 1 = вторник, ..., 6 = воскресенье)
        firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        
        // Добавляем пустые ячейки для дней предыдущего месяца (если нужно)
        for (let i = 0; i < firstDayOfWeek; i++) {
            dates.push(null); // null означает пустую ячейку
        }
        
        // Добавляем все дни текущего месяца
        const currentDate = new Date(firstDay);
        while (currentDate <= lastDay) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }

    // ============================================================================
    // УТИЛИТЫ ДЛЯ РАБОТЫ С ЦВЕТАМИ И ПРОГРЕССОМ
    // ============================================================================

    function getProgressColor(hours) {
        if (hours === 0) return '#e0e0e0';

        const ratio = Math.min(hours / CONFIG.WORK_HOURS_PER_DAY, 1);
        let red, green;

        if (ratio <= 0.5) {
            red = 255;
            green = Math.round(255 * (ratio * 2));
        } else {
            red = Math.round(255 * (1 - (ratio - 0.5) * 2));
            green = 255;
        }

        return `rgb(${red}, ${green}, 0)`;
    }

    function getOverallProgressColor(percent) {
        if (percent === 0) return '#e0e0e0';

        const ratio = Math.min(percent / 100, 1);
        let red, green;

        if (ratio <= 0.5) {
            red = 255;
            green = Math.round(255 * (ratio * 2));
        } else {
            red = Math.round(255 * (1 - (ratio - 0.5) * 2));
            green = 255;
        }

        return `rgb(${red}, ${green}, 0)`;
    }

    // ============================================================================
    // УТИЛИТЫ ДЛЯ РАБОТЫ С ХРАНИЛИЩЕМ
    // ============================================================================

    function getLastLoggedDataStorageKey(issueKey) {
        return `${CONFIG.STORAGE_PREFIX}${issueKey}${CONFIG.STORAGE_LAST_LOGGED_DATA_SUFFIX}`;
    }

    function getLastLoggedData(issueKey) {
        try {
            const stored = localStorage.getItem(getLastLoggedDataStorageKey(issueKey));
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error reading last logged data:', error);
            return null;
        }
    }

    function getLastLoggedHours(issueKey) {
        const data = getLastLoggedData(issueKey);
        return data ? data.hours : null;
    }

    function getLastLoggedDate(issueKey) {
        const data = getLastLoggedData(issueKey);
        return data && data.date ? new Date(data.date) : null;
    }

    function saveLastLoggedData(issueKey, hours, date) {
        try {
            const data = { hours: hours, date: date };
            localStorage.setItem(getLastLoggedDataStorageKey(issueKey), JSON.stringify(data));
        } catch (error) {
            console.error('Error saving last logged data:', error);
        }
    }

    function getCommentsStorageKey(issueKey) {
        return `${CONFIG.STORAGE_PREFIX}${issueKey}${CONFIG.STORAGE_COMMENTS_SUFFIX}`;
    }

    function getSavedComments(issueKey) {
        try {
            const stored = localStorage.getItem(getCommentsStorageKey(issueKey));
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error reading saved comments:', error);
            return [];
        }
    }

    function saveComment(issueKey, comment) {
        if (!comment || !comment.trim()) return;
        
        try {
            const comments = getSavedComments(issueKey);
            const trimmedComment = comment.trim();
            
            // Убираем дубликаты и добавляем новый комментарий в начало
            const updatedComments = [trimmedComment, ...comments.filter(c => c !== trimmedComment)];
            
            // Ограничиваем количество сохраненных комментариев (максимум 10)
            const limitedComments = updatedComments.slice(0, 10);
            
            localStorage.setItem(getCommentsStorageKey(issueKey), JSON.stringify(limitedComments));
        } catch (error) {
            console.error('Error saving comment:', error);
        }
    }

    // ============================================================================
    // УТИЛИТЫ ДЛЯ РАБОТЫ С JIRA
    // ============================================================================

    function getCurrentIssueKey() {
        const urlMatch = window.location.href.match(/\/browse\/([A-Z]+-\d+)/);
        if (urlMatch) {
            return urlMatch[1];
        }

        const breadcrumbs = document.querySelector('[data-test-id="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]');
        if (breadcrumbs) {
            const keyElement = breadcrumbs.querySelector('span');
            if (keyElement) {
                return keyElement.textContent.trim();
            }
        }

        const issueKeyMeta = document.querySelector('meta[name="ajs-issue-key"]');
        if (issueKeyMeta) {
            return issueKeyMeta.content;
        }

        return null;
    }

    function getCurrentIssueTitle() {
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

    async function getCurrentUserAccount() {
        try {
            const response = await fetch("/rest/api/2/myself", {
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

    async function fetchAllWorklogsForIssue(issueKey) {
        const allWorklogs = [];
        let startAt = 0;
        const maxResults = 100;

        while (true) {
            const url = `/rest/api/2/issue/${issueKey}/worklog?startAt=${startAt}&maxResults=${maxResults}`;

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

    // ============================================================================
    // ТОКЕНЫ ДЛЯ ДОБАВЛЕНИЯ WORKLOG
    // ============================================================================

    function getAtlToken() {
        const meta = document.querySelector('meta[name="atlassian-token"]');
        return meta ? meta.content : null;
    }

    async function getFormTokenFromDialog(issueId) {
        try {
            console.log('Opening worklog dialog to get formToken...');

            const dialogUrl = `/secure/CreateWorklog!default.jspa?id=${issueId}`;
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

                // Ищем formToken по паттерну из вашего примера:
                // name="formToken" ... value="ec8eff52fb378baea4688e4bd6071524dfcd9404"
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

    async function getIssueId(issueKey) {
        try {
            const response = await fetch(`/rest/api/2/issue/${issueKey}?fields=id`, {
                headers: { Accept: "application/json" },
                credentials: "include"
            });

            if (response.ok) {
                const data = await response.json();
                return data.id;
            }

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

    // ============================================================================
    // ДОБАВЛЕНИЕ WORKLOG
    // ============================================================================

    async function addWorklogToIssue(issueKey, date, hours, comment) {
        try {
            const loader = showWorklogLoader('Получаем токены и добавляем worklog...');

            // Получаем ID задачи
            const issueId = await getIssueId(issueKey);
            if (!issueId) {
                hideWorklogLoader(loader);
                showToast('Не удалось получить ID задачи', 'error');
                return;
            }

            // Получаем токены
            const atlToken = getAtlToken();
            const formToken = await getFormTokenFromDialog(issueId);

            console.log('Tokens:', { atlToken: atlToken ? 'найден' : 'не найден', formToken: formToken ? 'найден' : 'не найден' });

            if (!formToken) {
                hideWorklogLoader(loader);
                showToast('Не удалось получить formToken из диалога. Возможно нет прав на создание worklog\'ов.', 'error');
                return;
            }

            // Форматируем дату как в веб-интерфейсе: 04/Jun/25 12:51 PM (без двойного URL encoding)
            const worklogDate = new Date(date);
            worklogDate.setHours(12, 51, 0, 0);

            const day = String(worklogDate.getDate()).padStart(2, '0');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[worklogDate.getMonth()];
            const year = String(worklogDate.getFullYear()).slice(-2);
            const formattedDate = `${day}/${month}/${year} 12:51 PM`;

            // Создаем данные формы как в веб-интерфейсе
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

            const response = await fetch('/secure/CreateWorklog.jspa', {
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

            if (response.ok) {
                const responseText = await response.text();

                if (responseText.includes('error') || responseText.includes('Error')) {
                    console.log('Response contains errors');
                    hideWorklogLoader(loader);
                    showToast('Сервер вернул ошибку при создании worklog\'а.', 'error');
                } else {
                    hideWorklogLoader(loader);
                    showToast(`Worklog добавлен!\nВремя: ${formatTimeSpent(hours)}\nДата: ${formatDateRu(worklogDate)}`, 'success');
                    // Сохраняем комментарий для будущего использования
                    if (comment && comment.trim()) {
                        saveComment(issueKey, comment);
                    }
                }
            } else {
                hideWorklogLoader(loader);
                console.error('Error response:', response.status, response.statusText);
                showToast(`Ошибка ${response.status}: ${response.statusText}`, 'error');
            }

        } catch (error) {
            hideWorklogLoader();
            console.error('Critical error:', error);
            showToast(`Критическая ошибка: ${error.message}`, 'error');
        }
    }

    // ============================================================================
    // UI КОМПОНЕНТЫ
    // ============================================================================

    function showSimpleLoader(message) {
        const loader = document.createElement("div");
        loader.id = "jira-simple-loader";
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.7); z-index: 10003; display: flex;
            align-items: center; justify-content: center; font-family: Arial, sans-serif;
            color: #fff; font-size: 18px;
        `;

        loader.innerHTML = `
            <div style="text-align: center;">
                <div style="margin-bottom: 16px; font-size: 32px;">⏳</div>
                <div>${message}</div>
            </div>
        `;

        document.body.appendChild(loader);
        return loader;
    }

    function hideSimpleLoader(loader) {
        if (loader && loader.parentNode) {
            loader.remove();
        }
        const simpleLoader = document.getElementById("jira-simple-loader");
        if (simpleLoader) {
            simpleLoader.remove();
        }
    }

    function createButton(config) {
        const button = document.createElement("button");
        button.id = config.id;
        button.textContent = config.text;
        button.style.cssText = `
            position: fixed; bottom: ${config.bottom}; right: 20px; padding: 10px 20px;
            z-index: 10000; background-color: ${config.backgroundColor}; color: #fff;
            border: none; border-radius: 4px; cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2); font-family: Arial, sans-serif;
        `;
        return button;
    }

    function insertButtons() {
        if (document.getElementById(CONFIG.BUTTON_STYLES.report.id)) return;

        const addWorklogBtn = createButton(CONFIG.BUTTON_STYLES.addWorklog);
        const reportBtn = createButton(CONFIG.BUTTON_STYLES.report);

        document.body.appendChild(addWorklogBtn);
        document.body.appendChild(reportBtn);

        addWorklogBtn.addEventListener("click", showAddWorklogDialog);
        reportBtn.addEventListener("click", showDatePicker);
    }

    function showAddWorklogDialog() {
        const issueKey = getCurrentIssueKey();
        if (!issueKey) {
            showToast("Откройте страницу задачи, чтобы добавить worklog.", 'warning');
            return;
        }

        const existing = document.getElementById("jira-add-worklog-dialog");
        if (existing) existing.remove();

        const dialog = document.createElement("div");
        dialog.id = "jira-add-worklog-dialog";
        dialog.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #fff; border: 1px solid #ccc; border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); padding: 24px; z-index: 10001;
            font-family: Arial, sans-serif; font-size: 14px; min-width: 400px;
        `;

        const lastDate = getLastLoggedDate(issueKey);
        let defaultDate;
        
        if (lastDate) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(nextDate.getDate() + 1);
            defaultDate = nextDate;
        } else {
            defaultDate = new Date();
        }
        
        const defaultDateStr = formatDateForInput(defaultDate);
        const lastHours = getLastLoggedHours(issueKey);
        const savedComments = getSavedComments(issueKey);
        const issueTitle = getCurrentIssueTitle();

        dialog.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #333;">Добавить worklog в ${issueKey}</h3>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 13px; line-height: 1.3;">${issueTitle}</p>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">Режим выбора даты:</label>
                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button type="button" id="single-date-mode" class="date-mode-btn" data-mode="single"
                            style="padding: 8px 16px; border: 2px solid #36B37E; background: #36B37E; color: #fff; 
                                   border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;">
                        Одна дата
                    </button>
                    <button type="button" id="multi-date-mode" class="date-mode-btn" data-mode="multi"
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
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancel-worklog-btn" style="padding: 8px 16px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; cursor: pointer;">
                    Отмена
                </button>
                <button id="save-worklog-btn" style="padding: 8px 16px; border: none; background: #36B37E; color: white; border-radius: 4px; cursor: pointer;">
                    Добавить worklog
                </button>
            </div>
        `;

        document.body.appendChild(dialog);

        setupTimePresets(dialog, lastHours);
        setupCommentSuggestions(dialog, savedComments);
        setupDateModeToggle(dialog, defaultDateStr);

        document.getElementById("cancel-worklog-btn").onclick = () => dialog.remove();
        document.getElementById("save-worklog-btn").onclick = async () => {
            const customHours = parseFloat(document.getElementById('custom-hours').value);
            const hours = customHours || dialog._selectedHours();
            const comment = document.getElementById('worklog-comment').value.trim();

            if (!hours) {
                showToast('Выберите количество часов', 'warning');
                return;
            }

            // Проверяем режим работы с датами
            if (dialog._isMultiMode && dialog._selectedDates) {
                // Режим множественных дат
                if (dialog._selectedDates.length === 0) {
                    showToast('Выберите хотя бы одну дату', 'warning');
                    return;
                }

                dialog.remove();
                
                // Показываем общий прогресс
                const totalDates = dialog._selectedDates.length;
                let completedDates = 0;
                
                const progressLoader = showWorklogLoader(`Добавляем worklog'и: 0/${totalDates}`);
                
                try {
                    for (const date of dialog._selectedDates) {
                        await addWorklogToIssue(issueKey, date, hours, comment);
                        completedDates++;
                        
                        // Обновляем прогресс
                        updateWorklogLoader(progressLoader, `Добавляем worklog'и: ${completedDates}/${totalDates}`);
                    }
                    
                    hideWorklogLoader(progressLoader);
                    showToast(`Успешно добавлено ${completedDates} worklog'ов!\nВремя: ${formatTimeSpent(hours)} за каждый день`, 'success');
                    
                    // Сохраняем данные последнего воркдога (последней даты)
                    const lastDate = dialog._selectedDates[dialog._selectedDates.length - 1];
                    saveLastLoggedData(issueKey, hours, lastDate);
                    
                } catch (error) {
                    hideWorklogLoader(progressLoader);
                    showToast(`Ошибка при добавлении worklog'ов: ${error.message}`, 'error');
                }
                
            } else {
                // Режим одной даты
                const date = document.getElementById('worklog-date').value;
                
                if (!date) {
                    showToast('Выберите дату', 'warning');
                    return;
                }

                dialog.remove();
                await addWorklogToIssue(issueKey, date, hours, comment);
                saveLastLoggedData(issueKey, hours, date);
            }
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function setupTimePresets(dialog, lastHours) {
        let selectedHours = lastHours;
        const presetButtons = dialog.querySelectorAll('.time-preset');
        const customHoursInput = document.getElementById('custom-hours');

        if (lastHours && CONFIG.TIME_PRESETS.includes(lastHours)) {
            const lastButton = Array.from(presetButtons).find(btn => parseFloat(btn.dataset.hours) === lastHours);
            if (lastButton) {
                setButtonActive(lastButton);
            }
        } else if (lastHours) {
            customHoursInput.value = lastHours;
        }

        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                resetAllButtons(presetButtons);
                setButtonActive(btn);

                selectedHours = parseFloat(btn.dataset.hours);
                customHoursInput.value = '';
            });
        });

        customHoursInput.addEventListener('input', () => {
            resetAllButtons(presetButtons);
            selectedHours = null;
        });

        dialog._selectedHours = () => selectedHours;
    }

    function resetAllButtons(buttons) {
        buttons.forEach(btn => {
            btn.style.cssText = `
                padding: 8px 4px !important; border: 2px solid #ddd !important; 
                background: #f5f5f5 !important; color: #333 !important;
                border-radius: 4px !important; cursor: pointer !important; 
                font-size: 12px !important; transition: all 0.2s ease !important;
            `;
        });
    }

    function setButtonActive(button) {
        button.style.cssText = `
            padding: 8px 4px !important; border: 2px solid #36B37E !important; 
            background: #36B37E !important; color: #fff !important;
            border-radius: 4px !important; cursor: pointer !important; 
            font-size: 12px !important; transition: all 0.2s ease !important;
        `;
    }

    function setupCommentSuggestions(dialog, savedComments) {
        if (savedComments.length === 0) return;

        const commentSelect = dialog.querySelector('#comment-suggestions');
        const commentTextarea = dialog.querySelector('#worklog-comment');

        if (!commentSelect || !commentTextarea) return;

        commentSelect.addEventListener('change', (e) => {
            const selectedComment = e.target.value;
            if (selectedComment) {
                commentTextarea.value = selectedComment;
                commentTextarea.focus();
                // Сбрасываем выбор в dropdown
                commentSelect.value = '';
            }
        });
    }

    function setupDateModeToggle(dialog, defaultDateStr) {
        const singleModeBtn = dialog.querySelector('#single-date-mode');
        const multiModeBtn = dialog.querySelector('#multi-date-mode');
        const singleContainer = dialog.querySelector('#single-date-container');
        const multiContainer = dialog.querySelector('#multi-date-container');
        const timeSection = dialog.querySelector('#time-presets').parentElement;
        const commentSection = dialog.querySelector('#worklog-comment').parentElement;
        const buttonsSection = dialog.querySelector('#save-worklog-btn').parentElement;
        
        // Состояние диалога
        let currentMode = 'single';
        let singleDateValue = defaultDateStr;
        let selectedDates = [];
        let multiDateButtons = [];
        
        // Сохраняем исходный HTML single container
        const originalSingleHTML = singleContainer.innerHTML;
        
        function setModeButtonActive(activeBtn, inactiveBtn) {
            activeBtn.style.cssText = `
                padding: 8px 16px; border: 2px solid #36B37E; background: #36B37E; color: #fff; 
                border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;
            `;
            inactiveBtn.style.cssText = `
                padding: 8px 16px; border: 2px solid #ddd; background: #f5f5f5; color: #333; 
                border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s ease;
            `;
        }
        
        function showSingleMode() {
            currentMode = 'single';
            setModeButtonActive(singleModeBtn, multiModeBtn);
            
            // Восстанавливаем исходный HTML
            singleContainer.innerHTML = originalSingleHTML;
            
            singleContainer.style.display = 'block';
            multiContainer.style.display = 'none';
            timeSection.style.display = 'block';
            commentSection.style.display = 'block';
            buttonsSection.style.display = 'flex';
            
            // Восстанавливаем сохраненную дату - используем небольшую задержку для корректной работы
            setTimeout(() => {
                const dateInput = singleContainer.querySelector('#worklog-date') || document.getElementById('worklog-date');
                if (dateInput) {
                    dateInput.value = singleDateValue;
                }
            }, 10);
            
            // Сбрасываем флаги multi режима
            dialog._isMultiMode = false;
            dialog._selectedDates = null;
            // НЕ сбрасываем selectedDates - сохраняем выбор пользователя для возможного возврата в multi режим
            // selectedDates сохраняются как есть
        }
        
        function showMultiMode() {
            currentMode = 'multi';
            setModeButtonActive(multiModeBtn, singleModeBtn);
            
            // Сохраняем текущую дату из single режима
            const currentDateInput = document.getElementById('worklog-date');
            if (currentDateInput) {
                singleDateValue = currentDateInput.value;
            }
            
            singleContainer.style.display = 'none';
            multiContainer.style.display = 'block';
            timeSection.style.display = 'none';
            commentSection.style.display = 'none';
            buttonsSection.style.display = 'none';
            
            // НЕ сбрасываем выбранные даты - сохраняем выбор пользователя
            // selectedDates сохраняются как есть
            
            generateMultiDateSelector();
        }
        
        // Общая функция для сброса/отмены выбора дат
        function toggleDateSelection(dateStr, forceDeselect = false) {
            const isSelected = selectedDates.includes(dateStr);
            const btn = dialog.querySelector(`.multi-date-btn[data-date="${dateStr}"]`);
            
            if (!btn) return;
            
            if (isSelected || forceDeselect) {
                // Убираем дату из выбранных
                selectedDates = selectedDates.filter(d => d !== dateStr);
                btn.style.border = '2px solid #ddd';
                btn.style.background = isWorkday(new Date(dateStr)) ? '#fff' : '#f8f8f8';
                btn.style.color = isWorkday(new Date(dateStr)) ? '#333' : '#999';
            } else {
                // Добавляем дату в выбранные
                selectedDates.push(dateStr);
                btn.style.border = '2px solid #36B37E';
                btn.style.background = '#36B37E';
                btn.style.color = '#fff';
            }
            
            updateSelectedDatesInfo();
        }
        
        // Функция для сброса всех выбранных дат
        function resetAllSelectedDates() {
            const selectedButtons = dialog.querySelectorAll('.multi-date-btn[data-date]');
            selectedButtons.forEach(btn => {
                const dateStr = btn.dataset.date;
                if (selectedDates.includes(dateStr)) {
                    toggleDateSelection(dateStr, true);
                }
            });
        }

        function generateMultiDateSelector() {
            const selector = dialog.querySelector('#multi-date-selector');
            const dates = getCurrentMonthDates();
            
            // Заголовки дней недели (понедельник-воскресенье)
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
                            // Пустая ячейка для дней предыдущего месяца
                            return `<div style="padding: 8px 4px; min-height: 45px;"></div>`;
                        }
                        
                        const dateStr = formatDateForAPI(date);
                        const isSelected = selectedDates.includes(dateStr);
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
            
            // Добавляем обработчики кликов только для кнопок с датами (не пустых ячеек)
            multiDateButtons = selector.querySelectorAll('.multi-date-btn[data-date]');
            multiDateButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const dateStr = btn.dataset.date;
                    toggleDateSelection(dateStr);
                });
            });
            
            updateSelectedDatesInfo();
        }
        
        function updateSelectedDatesInfo() {
            const info = dialog.querySelector('#selected-dates-info');
            const applyBtn = dialog.querySelector('#apply-multi-dates');
            
            if (selectedDates.length === 0) {
                info.textContent = 'Даты не выбраны';
                applyBtn.disabled = true;
                applyBtn.style.opacity = '0.5';
            } else {
                info.textContent = `Выбрано ${selectedDates.length} ${selectedDates.length === 1 ? 'день' : selectedDates.length < 5 ? 'дня' : 'дней'}`;
                applyBtn.disabled = false;
                applyBtn.style.opacity = '1';
            }
        }
        
        // Обработчики переключения режимов
        singleModeBtn.addEventListener('click', showSingleMode);
        multiModeBtn.addEventListener('click', showMultiMode);
        
        // Обработчик применения множественных дат
        dialog.querySelector('#apply-multi-dates').addEventListener('click', () => {
            if (selectedDates.length === 0) {
                showToast('Выберите хотя бы одну дату', 'warning');
                return;
            }
            
            // Скрываем блок множественного выбора дат
            multiContainer.style.display = 'none';
            
            // Показываем остальные элементы
            timeSection.style.display = 'block';
            commentSection.style.display = 'block';
            buttonsSection.style.display = 'flex';
            
            // Заменяем single date container на информацию о выбранных датах
            const info = dialog.querySelector('#selected-dates-info');
            singleContainer.innerHTML = `
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Даты:</label>
                <div style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 14px;">
                    ${info.textContent}
                </div>
            `;
            singleContainer.style.display = 'block';
            
            // Сохраняем выбранные даты в диалоге
            dialog._selectedDates = selectedDates;
            dialog._isMultiMode = true;
        });
        
        // Обработчик кнопки сброса множественных дат
        dialog.querySelector('#reset-multi-dates').addEventListener('click', () => {
            resetAllSelectedDates();
        });
        
        // Устанавливаем начальный режим
        showSingleMode();
    }

    // ============================================================================
    // СИСТЕМА УВЕДОМЛЕНИЙ
    // ============================================================================

    function showToast(message, type = 'info', duration = 5000) {
        const toastId = 'jira-toast-' + Date.now();
        
        const toast = document.createElement('div');
        toast.id = toastId;
        
        // Calculate position based on existing toasts
        const topPosition = calculateToastPosition();
        
        toast.style.cssText = `
            position: fixed; top: ${topPosition}px; right: 20px; width: 400px; min-height: 80px;
            background: #fff; border-left: 4px solid ${getToastColor(type)}; 
            border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10004; font-family: Arial, sans-serif; font-size: 14px;
            transform: translateX(100%); transition: transform 0.3s ease-in-out, top 0.3s ease-in-out;
            display: flex; flex-direction: column;
        `;

        const iconMap = {
            'success': '✅',
            'error': '❌', 
            'warning': '⚠️',
            'info': 'ℹ️'
        };

        toast.innerHTML = `
            <div style="padding: 16px; padding-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 18px; flex-shrink: 0; margin-top: 2px;">
                    ${iconMap[type] || iconMap.info}
                </div>
                <div style="flex: 1; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;">
                    ${message}
                </div>
                <button onclick="this.closest('.jira-toast').remove()" 
                        style="background: none; border: none; font-size: 18px; color: #999; 
                               cursor: pointer; flex-shrink: 0; line-height: 1; padding: 0; margin: 0;">
                    ×
                </button>
            </div>
            <div style="height: 3px; background: rgba(0,0,0,0.1); position: relative; overflow: hidden;">
                <div class="progress-bar" style="height: 100%; background: ${getToastColor(type)}; 
                     width: 100%; transition: width ${duration}ms linear; transform-origin: left;"></div>
            </div>
        `;

        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 10);

        const progressBar = toast.querySelector('.progress-bar');
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 50);

        const removeToast = () => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                    // Обновляем позиции оставшихся уведомлений
                    updateToastPositions();
                }
            }, 300);
        };
        
        // Добавляем обработчик клика на кнопку закрытия
        const closeButton = toast.querySelector('button');
        if (closeButton) {
            closeButton.onclick = (e) => {
                e.preventDefault();
                removeToast();
            };
        }

        setTimeout(removeToast, duration);
        
        // Добавляем toast в DOM
        toast.className = 'jira-toast';
        document.body.appendChild(toast);
        
        // Обновляем позиции всех уведомлений
        updateToastPositions();
        
        return { id: toastId, remove: removeToast };
    }

    function getToastColor(type) {
        const colors = {
            'success': '#36B37E',
            'error': '#FF5630', 
            'warning': '#FFAB00',
            'info': '#0052CC'
        };
        return colors[type] || colors.info;
    }

    function calculateToastPosition() {
        const existingToasts = document.querySelectorAll('.jira-toast');
        if (existingToasts.length === 0) {
            return 20; // Начальная позиция для первого уведомления
        }
        
        // Находим самое нижнее уведомление и добавляем отступ
        let maxBottom = 20;
        existingToasts.forEach(toast => {
            const rect = toast.getBoundingClientRect();
            const currentBottom = parseInt(toast.style.top) + rect.height;
            if (currentBottom > maxBottom) {
                maxBottom = currentBottom;
            }
        });
        
        return maxBottom + 10; // 10px отступ между уведомлениями
    }

    function updateToastPositions() {
        const toasts = document.querySelectorAll('.jira-toast');
        let currentTop = 20;
        
        toasts.forEach((toast, index) => {
            toast.style.top = currentTop + 'px';
            
            // Получаем высоту текущего уведомления
            const rect = toast.getBoundingClientRect();
            currentTop += rect.height + 10; // 10px отступ между уведомлениями
        });
    }

    // ============================================================================
    // ПОКАЗ ОТЧЕТОВ
    // ============================================================================

    function showDatePicker() {
        const existing = document.getElementById("jira-date-picker");
        if (existing) existing.remove();

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const picker = document.createElement("div");
        picker.id = "jira-date-picker";
        picker.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #fff; border: 1px solid #ccc; border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); padding: 24px; z-index: 10001;
            font-family: Arial, sans-serif; font-size: 14px; min-width: 300px;
        `;

        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        const years = [];
        for (let y = currentYear - 2; y <= currentYear + 1; y++) {
            years.push(y);
        }

        picker.innerHTML = `
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

        document.body.appendChild(picker);

        document.getElementById("cancel-btn").onclick = () => picker.remove();
        document.getElementById("generate-btn").onclick = () => {
            const month = parseInt(document.getElementById("month-select").value);
            const year = parseInt(document.getElementById("year-select").value);
            picker.remove();
            generateReport(month, year);
        };

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                picker.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function showWorklogLoader(initialMessage) {
        const existing = document.getElementById("jira-worklog-loader");
        if (existing) existing.remove();

        const loader = document.createElement("div");
        loader.id = "jira-worklog-loader";
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: linear-gradient(135deg, rgba(0,82,204,0.95), rgba(0,50,120,0.95));
            z-index: 10002; display: flex; flex-direction: column; align-items: center;
            justify-content: center; font-family: Arial, sans-serif; color: #fff; overflow: hidden;
        `;

        const style = document.createElement("style");
        style.textContent = `
            @keyframes worklogFloat {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                33% { transform: translateY(-20px) rotate(5deg); }
                66% { transform: translateY(10px) rotate(-3deg); }
            }
            @keyframes worklogPulse {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes worklogDrift {
                0% { transform: translateX(0px) translateY(0px); opacity: 0.5; }
                100% { transform: translateX(100vw) translateY(-50px); opacity: 0; }
            }
            @keyframes worklogDataFlow {
                0% { transform: translateX(-50px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement("div");
            particle.style.cssText = `
                position: absolute; width: 6px; height: 6px; background: rgba(255,255,255,0.4);
                border-radius: 50%; top: ${Math.random() * 100}%; left: -10px;
                animation: worklogDrift ${8 + Math.random() * 6}s linear infinite;
                animation-delay: 0s;
            `;
            loader.appendChild(particle);
        }

        const centerContainer = document.createElement("div");
        centerContainer.style.cssText = "position: relative; text-align: center;";

        const mainIcon = document.createElement("div");
        mainIcon.style.cssText = `
            width: 80px; height: 80px; background: rgba(255,255,255,0.9); border-radius: 50%;
            margin: 0 auto 30px; display: flex; align-items: center; justify-content: center;
            font-size: 32px; color: #0052CC; animation: worklogFloat 3s ease-in-out infinite;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        mainIcon.textContent = "✍";

        const loadingText = document.createElement("div");
        loadingText.style.cssText = `
            font-size: 24px; font-weight: bold; margin-bottom: 10px;
            animation: worklogPulse 2s ease-in-out infinite;
        `;
        loadingText.textContent = "Добавляем worklog";

        const subText = document.createElement("div");
        subText.style.cssText = "font-size: 14px; opacity: 0.8; margin-bottom: 40px;";
        subText.textContent = initialMessage || "Получаем токены и добавляем worklog...";

        const progressContainer = document.createElement("div");
        progressContainer.style.cssText = `
            position: relative; width: 400px; height: 4px; background: rgba(255,255,255,0.3);
            border-radius: 2px; overflow: hidden;
        `;

        for (let i = 0; i < 5; i++) {
            const dataBlock = document.createElement("div");
            dataBlock.style.cssText = `
                position: absolute; width: 60px; height: 4px; border-radius: 2px;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%);
                animation: worklogDataFlow 2s ease-in-out infinite;
                animation-delay: ${i * 0.4}s;
            `;
            progressContainer.appendChild(dataBlock);
        }

        centerContainer.appendChild(mainIcon);
        centerContainer.appendChild(loadingText);
        centerContainer.appendChild(subText);
        centerContainer.appendChild(progressContainer);
        loader.appendChild(centerContainer);

        document.body.appendChild(loader);

        // Store reference to subText for updates
        loader._subText = subText;
        loader._style = style;
        return loader;
    }

    function updateWorklogLoader(loader, message) {
        if (loader && loader._subText) {
            loader._subText.textContent = message;
        }
    }

    function hideWorklogLoader(loader) {
        if (loader) {
            if (loader._style) {
                loader._style.remove();
            }
            loader.remove();
        }
        const worklogLoader = document.getElementById("jira-worklog-loader");
        if (worklogLoader) {
            if (worklogLoader._style) {
                worklogLoader._style.remove();
            }
            worklogLoader.remove();
        }
    }

    function showMainLoader() {
        const existing = document.getElementById("jira-loader");
        if (existing) existing.remove();

        const loader = document.createElement("div");
        loader.id = "jira-loader";
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: linear-gradient(135deg, rgba(0,82,204,0.95), rgba(0,50,120,0.95));
            z-index: 10002; display: flex; flex-direction: column; align-items: center;
            justify-content: center; font-family: Arial, sans-serif; color: #fff; overflow: hidden;
        `;

        const style = document.createElement("style");
        style.textContent = `
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                33% { transform: translateY(-20px) rotate(5deg); }
                66% { transform: translateY(10px) rotate(-3deg); }
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.6; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes drift {
                0% { transform: translateX(0px) translateY(0px); opacity: 0.5; }
                100% { transform: translateX(100vw) translateY(-50px); opacity: 0; }
            }
            @keyframes dataFlow {
                0% { transform: translateX(-50px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement("div");
            particle.style.cssText = `
                position: absolute; width: 6px; height: 6px; background: rgba(255,255,255,0.4);
                border-radius: 50%; top: ${Math.random() * 100}%; left: -10px;
                animation: drift ${8 + Math.random() * 6}s linear infinite;
                animation-delay: 0s;
            `;
            loader.appendChild(particle);
        }

        const centerContainer = document.createElement("div");
        centerContainer.style.cssText = "position: relative; text-align: center;";

        const mainIcon = document.createElement("div");
        mainIcon.style.cssText = `
            width: 80px; height: 80px; background: rgba(255,255,255,0.9); border-radius: 50%;
            margin: 0 auto 30px; display: flex; align-items: center; justify-content: center;
            font-size: 32px; color: #0052CC; animation: float 3s ease-in-out infinite;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        mainIcon.textContent = "⏱";

        const loadingText = document.createElement("div");
        loadingText.style.cssText = `
            font-size: 24px; font-weight: bold; margin-bottom: 10px;
            animation: pulse 2s ease-in-out infinite;
        `;
        loadingText.textContent = "Анализируем worklog'и";

        const subText = document.createElement("div");
        subText.style.cssText = "font-size: 14px; opacity: 0.8; margin-bottom: 40px;";
        subText.textContent = "Загружаем данные из Jira...";

        const progressContainer = document.createElement("div");
        progressContainer.style.cssText = `
            position: relative; width: 400px; height: 4px; background: rgba(255,255,255,0.3);
            border-radius: 2px; overflow: hidden;
        `;

        for (let i = 0; i < 5; i++) {
            const dataBlock = document.createElement("div");
            dataBlock.style.cssText = `
                position: absolute; width: 60px; height: 4px; border-radius: 2px;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%);
                animation: dataFlow 2s ease-in-out infinite;
                animation-delay: ${i * 0.4}s;
            `;
            progressContainer.appendChild(dataBlock);
        }

        centerContainer.appendChild(mainIcon);
        centerContainer.appendChild(loadingText);
        centerContainer.appendChild(subText);
        centerContainer.appendChild(progressContainer);
        loader.appendChild(centerContainer);

        document.body.appendChild(loader);

        const messages = [
            "Загружаем данные из Jira...",
            "Обрабатываем worklog'и...",
            "Фильтруем по пользователю...",
            "Группируем по датам...",
            "Формируем отчёт..."
        ];

        let messageIndex = 0;
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            subText.textContent = messages[messageIndex];
        }, 3000);

        loader._messageInterval = messageInterval;
        loader._style = style;
        return loader;
    }

    function hideMainLoader() {
        const loader = document.getElementById("jira-loader");
        if (loader) {
            if (loader._messageInterval) {
                clearInterval(loader._messageInterval);
            }
            if (loader._style) {
                loader._style.remove();
            }
            loader.remove();
        }
    }

    async function generateReport(month, year) {
        showMainLoader();
        try {
            const startDate = new Date(year, month, 1);
            const endDate = new Date(year, month + 1, 0);

            const startDateStr = formatDateForAPI(startDate);
            const endDateStr = formatDateForAPI(endDate);

            const currentUser = await getCurrentUserAccount();
            if (!currentUser) {
                hideMainLoader();
                showToast("Не удалось получить данные текущего пользователя.", 'error');
                return;
            }

            const jql = `worklogAuthor = currentUser() AND worklogDate >= "${startDateStr}" AND worklogDate <= "${endDateStr}"`;
            const url = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary&maxResults=1000`;

            const response = await fetch(url, {
                headers: { Accept: "application/json" },
                credentials: "include"
            });

            if (!response.ok) {
                hideMainLoader();
                const errorText = await response.text();
                console.error("API Error:", response.status, errorText);
                showToast(`Ошибка запроса Jira API: ${response.status}\n${errorText}`, 'error');
                return;
            }

            const data = await response.json();
            const userWorklogs = [];

            for (const issue of data.issues) {
                const { key, fields } = issue;
                const allWorklogs = await fetchAllWorklogsForIssue(key);

                for (const log of allWorklogs) {
                    const logDate = new Date(log.started);

                    let isCurrentUser = false;
                    if (log.author.accountId && currentUser.accountId) {
                        isCurrentUser = log.author.accountId === currentUser.accountId;
                    } else if (log.author.name && currentUser.name) {
                        isCurrentUser = log.author.name === currentUser.name;
                    } else if (log.author.emailAddress && currentUser.email) {
                        isCurrentUser = log.author.emailAddress === currentUser.email;
                    }

                    const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
                    const isInRange = logDateOnly >= startDate && logDateOnly <= endDate;

                    if (isCurrentUser && isInRange) {
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
            }

            hideMainLoader();

            const totalSeconds = userWorklogs.reduce((sum, w) => sum + w.seconds, 0);
            const totalHours = (totalSeconds / 3600).toFixed(2);
            userWorklogs.sort((a, b) => a.dateSort - b.dateSort);

            renderReport(userWorklogs, month, year, totalHours, startDate, endDate);

        } catch (error) {
            hideMainLoader();
            console.error("Error generating report:", error);
            showToast(`Ошибка при генерации отчета: ${error.message}`, 'error');
        }
    }

    function renderReport(worklogs, month, year, totalHours, startDate, endDate) {
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

    // ============================================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================================

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const dialogs = ['jira-worklog-report', 'jira-date-picker', 'jira-add-worklog-dialog'];
            dialogs.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        }
    });

    window.addEventListener("load", () => {
        setTimeout(insertButtons, 2000);
    });

})();