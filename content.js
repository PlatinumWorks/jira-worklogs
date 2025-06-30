(function () {
    'use strict';

    // ============================================================================
    // КОНСТАНТЫ И КОНФИГУРАЦИЯ
    // ============================================================================

    const CONFIG = {
        WORK_HOURS_PER_DAY: 8,
        TIME_PRESETS: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8],
        STORAGE_PREFIX: 'jira-worklog-',
        BUTTON_STYLES: {
            report: {
                id: 'jira-worklog-report-btn',
                text: 'Worklog отчёт',
                backgroundColor: '#0052CC',
                bottom: '20px'
            },
            addWorklog: {
                id: 'jira-add-worklog-btn',
                text: 'Добавить worklog',
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

    function getLastLoggedHours(issueKey) {
        try {
            const stored = localStorage.getItem(`${CONFIG.STORAGE_PREFIX}${issueKey}`);
            return stored ? parseFloat(stored) : null;
        } catch (error) {
            console.error('Error reading last logged hours:', error);
            return null;
        }
    }

    function saveLastLoggedHours(issueKey, hours) {
        try {
            localStorage.setItem(`${CONFIG.STORAGE_PREFIX}${issueKey}`, hours.toString());
        } catch (error) {
            console.error('Error saving last logged hours:', error);
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
            const loader = showSimpleLoader('Получаем токены и добавляем worklog...');

            // Получаем ID задачи
            const issueId = await getIssueId(issueKey);
            if (!issueId) {
                hideSimpleLoader(loader);
                alert('Не удалось получить ID задачи');
                return;
            }

            // Получаем токены
            const atlToken = getAtlToken();
            const formToken = await getFormTokenFromDialog(issueId);

            console.log('Tokens:', { atlToken: atlToken ? 'найден' : 'не найден', formToken: formToken ? 'найден' : 'не найден' });

            if (!formToken) {
                hideSimpleLoader(loader);
                alert('Не удалось получить formToken из диалога. Возможно нет прав на создание worklog\'ов.');
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
                    hideSimpleLoader(loader);
                    alert('Сервер вернул ошибку при создании worklog\'а.');
                } else {
                    hideSimpleLoader(loader);
                    alert(`✅ Worklog добавлен!\nВремя: ${formatTimeSpent(hours)}\nДата: ${formatDateRu(worklogDate)}`);

                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            } else {
                hideSimpleLoader(loader);
                console.error('Error response:', response.status, response.statusText);
                alert(`❌ Ошибка ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            hideSimpleLoader();
            console.error('Critical error:', error);
            alert(`❌ Критическая ошибка: ${error.message}`);
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
            alert("Откройте страницу задачи, чтобы добавить worklog.");
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

        const today = new Date();
        const todayStr = formatDateForInput(today);
        const lastHours = getLastLoggedHours(issueKey);

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333;">Добавить worklog в ${issueKey}</h3>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: bold;">Дата:</label>
                <input type="date" id="worklog-date" value="${todayStr}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
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

        document.getElementById("cancel-worklog-btn").onclick = () => dialog.remove();
        document.getElementById("save-worklog-btn").onclick = async () => {
            const date = document.getElementById('worklog-date').value;
            const customHours = parseFloat(document.getElementById('custom-hours').value);
            const hours = customHours || dialog._selectedHours();
            const comment = document.getElementById('worklog-comment').value.trim();

            if (!hours) {
                alert('Выберите количество часов');
                return;
            }

            if (!date) {
                alert('Выберите дату');
                return;
            }

            saveLastLoggedHours(issueKey, hours);
            dialog.remove();
            await addWorklogToIssue(issueKey, date, hours, comment);
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
                0% { transform: translateX(-100vw) translateY(0px); }
                100% { transform: translateX(100vw) translateY(-50px); }
            }
            @keyframes dataFlow {
                0% { transform: translateX(-50px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        for (let i = 0; i < 12; i++) {
            const particle = document.createElement("div");
            particle.style.cssText = `
                position: absolute; width: 6px; height: 6px; background: rgba(255,255,255,0.3);
                border-radius: 50%; top: ${Math.random() * 100}%; left: -10px;
                animation: drift ${8 + Math.random() * 6}s linear infinite;
                animation-delay: ${Math.random() * 8}s;
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
                alert("Не удалось получить данные текущего пользователя.");
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
                alert(`Ошибка запроса Jira API: ${response.status}\n${errorText}`);
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
            alert(`Ошибка при генерации отчета: ${error.message}`);
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
                            <strong>${log.issueKey}</strong>: ${log.timeSpent}
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