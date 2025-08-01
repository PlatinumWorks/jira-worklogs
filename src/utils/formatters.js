/**
 * Утилиты для форматирования данных
 */

import { CONFIG } from '../core/config.js';

/**
 * Форматирует время в часах в строку (например, 2.5 -> "2h 30m")
 */
export function formatTimeSpent(hours) {
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

/**
 * Возвращает цвет для индикатора прогресса на основе отработанных часов
 */
export function getProgressColor(hours) {
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

/**
 * Возвращает цвет для общего индикатора прогресса
 */
export function getOverallProgressColor(percent) {
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

/**
 * Возвращает цвет для уведомления по типу
 */
export function getToastColor(type) {
    const colors = {
        'success': '#36B37E',
        'error': '#FF5630', 
        'warning': '#FFAB00',
        'info': '#0052CC'
    };
    return colors[type] || colors.info;
}

/**
 * Возвращает иконку для уведомления по типу
 */
export function getToastIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌', 
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || icons.info;
}