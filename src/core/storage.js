/**
 * Модуль для работы с локальным хранилищем
 */

import {CONFIG} from './config.js';

/**
 * Формирует ключ для хранения данных последнего worklog'а
 */
function getLastLoggedDataStorageKey(issueKey) {
    return `${CONFIG.STORAGE_PREFIX}${issueKey}${CONFIG.STORAGE_LAST_LOGGED_DATA_SUFFIX}`;
}

/**
 * Формирует ключ для хранения комментариев
 */
function getCommentsStorageKey(issueKey) {
    return `${CONFIG.STORAGE_PREFIX}${issueKey}${CONFIG.STORAGE_COMMENTS_SUFFIX}`;
}

/**
 * Получает данные последнего worklog'а для задачи
 */
export function getLastLoggedData(issueKey) {
    try {
        const stored = localStorage.getItem(getLastLoggedDataStorageKey(issueKey));
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error reading last logged data:', error);
        return null;
    }
}

/**
 * Получает последние отработанные часы для задачи
 */
export function getLastLoggedHours(issueKey) {
    const data = getLastLoggedData(issueKey);
    return data ? data.hours : null;
}

/**
 * Получает последнюю дату worklog'а для задачи
 */
export function getLastLoggedDate(issueKey) {
    const data = getLastLoggedData(issueKey);
    return data?.date ? new Date(data.date) : null;
}

/**
 * Сохраняет данные последнего worklog'а
 */
export function saveLastLoggedData(issueKey, hours, date) {
    try {
        const data = {hours: hours, date: date};
        localStorage.setItem(getLastLoggedDataStorageKey(issueKey), JSON.stringify(data));
    } catch (error) {
        console.error('Error saving last logged data:', error);
    }
}

/**
 * Получает сохраненные комментарии для задачи
 */
export function getSavedComments(issueKey) {
    try {
        const stored = localStorage.getItem(getCommentsStorageKey(issueKey));
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error reading saved comments:', error);
        return [];
    }
}

/**
 * Сохраняет комментарий для задачи
 */
export function saveComment(issueKey, comment) {
    if (!comment?.trim()) return;

    try {
        const comments = getSavedComments(issueKey);
        const trimmedComment = comment.trim();

        // Убираем дубликаты и добавляем новый комментарий в начало
        const updatedComments = [trimmedComment, ...comments.filter(c => c !== trimmedComment)];

        // Ограничиваем количество сохраненных комментариев
        const limitedComments = updatedComments.slice(0, CONFIG.UI.MAX_SAVED_COMMENTS);

        localStorage.setItem(getCommentsStorageKey(issueKey), JSON.stringify(limitedComments));
    } catch (error) {
        console.error('Error saving comment:', error);
    }
}