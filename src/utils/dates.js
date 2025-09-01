/**
 * Утилиты для работы с датами
 */

const MONTHS_RU = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const MONTHS_NAMES_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Форматирует дату для API (YYYY-MM-DD)
 */
export function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Форматирует дату для input[type="date"]
 */
export function formatDateForInput(date) {
    return formatDateForAPI(date);
}

/**
 * Форматирует дату на русском языке
 */
export function formatDateRu(date) {
    const day = date.getDate();
    const month = MONTHS_RU[date.getMonth()];
    const year = date.getFullYear();
    const weekday = WEEKDAYS_RU[date.getDay()];

    return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Возвращает название месяца на русском
 */
export function getMonthName(monthIndex) {
    return MONTHS_NAMES_RU[monthIndex];
}

/**
 * Проверяет, является ли день рабочим (пн-пт)
 */
export function isWorkday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}

/**
 * Возвращает все рабочие дни в периоде
 */
export function getAllWorkdays(startDate, endDate) {
    const workdays = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        if (isWorkday(currentDate)) {
            workdays.push(new Date(currentDate));
        }
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1)); // Явная переназначение
    }

    return workdays;
}

/**
 * Форматирует дату для кнопки (день недели + число)
 */
export function formatDateForButton(date) {
    const day = date.getDate();
    const weekday = WEEKDAYS_RU[date.getDay()];
    return `${day}\n${weekday}`;
}

/**
 * Возвращает все даты текущего месяца для календарной сетки
 */
export function getCurrentMonthDates() {
    const now = new Date();
    return getMonthDates(now.getFullYear(), now.getMonth());
}

/**
 * Возвращает все даты указанного месяца для календарной сетки
 */
export function getMonthDates(year, month) {
    // Получаем первый и последний день месяца
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

    // Добавляем все дни указанного месяца
    let currentDate = new Date(firstDay);
    while (currentDate <= lastDay) {
        dates.push(new Date(currentDate));
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }

    return dates;
}

/**
 * Форматирует дату для Jira worklog API (DD/MMM/YY HH:MM AM/PM)
 */
export function formatDateForJiraWorklog(date) {
    const worklogDate = new Date(date);
    worklogDate.setHours(12, 51, 0, 0);

    const day = String(worklogDate.getDate()).padStart(2, '0');
    const month = MONTH_NAMES_EN[worklogDate.getMonth()];
    const year = String(worklogDate.getFullYear()).slice(-2);

    return `${day}/${month}/${year} 12:51 PM`;
}