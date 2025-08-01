/**
 * Система уведомлений (Toast)
 */

import { CONFIG } from '../../core/config.js';
import { getToastColor, getToastIcon } from '../../utils/formatters.js';

/**
 * Класс для управления уведомлениями
 */
export class ToastManager {
    constructor() {
        this.toasts = new Map();
    }

    /**
     * Показывает уведомление
     */
    show(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
        const toastId = 'jira-toast-' + Date.now();

        const toast = this.createToast(toastId, message, type, duration);
        this.toasts.set(toastId, toast);

        document.body.appendChild(toast.element);
        this.updatePositions();

        // Анимация появления
        setTimeout(() => {
            toast.element.style.transform = 'translateX(0)';
        }, 10);

        // Запуск прогресс-бара
        setTimeout(() => {
            const progressBar = toast.element.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }, 50);

        // Автоудаление
        setTimeout(() => {
            this.remove(toastId);
        }, duration);

        return { id: toastId, remove: () => this.remove(toastId) };
    }

    /**
     * Создает элемент уведомления
     */
    createToast(id, message, type, duration) {
        const element = document.createElement('div');
        element.id = id;
        element.className = 'jira-toast';

        const topPosition = this.calculatePosition();

        element.style.cssText = `
            position: fixed; 
            top: ${topPosition}px; 
            right: 20px; 
            width: 400px; 
            min-height: 80px;
            background: #fff; 
            border-left: 4px solid ${getToastColor(type)}; 
            border-radius: 6px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10004; 
            font-family: Arial, sans-serif; 
            font-size: 14px;
            transform: translateX(100%); 
            transition: transform 0.3s ease-in-out, top 0.3s ease-in-out;
            display: flex; 
            flex-direction: column;
        `;

        element.innerHTML = `
            <div style="padding: 16px; padding-bottom: 12px; display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 18px; flex-shrink: 0; margin-top: 2px;">
                    ${getToastIcon(type)}
                </div>
                <div style="flex: 1; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word;">
                    ${message}
                </div>
                <button class="toast-close-btn" 
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

        // Обработчик закрытия
        const closeBtn = element.querySelector('.toast-close-btn');
        closeBtn.onclick = (e) => {
            e.preventDefault();
            this.remove(id);
        };

        return { element, type, id };
    }

    /**
     * Удаляет уведомление
     */
    remove(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        toast.element.style.transform = 'translateX(100%)';

        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.remove();
                this.toasts.delete(toastId);
                this.updatePositions();
            }
        }, 300);
    }

    /**
     * Вычисляет позицию для нового уведомления
     */
    calculatePosition() {
        const existingToasts = document.querySelectorAll('.jira-toast');
        if (existingToasts.length === 0) {
            return 20;
        }

        let maxBottom = 20;
        existingToasts.forEach(toast => {
            const rect = toast.getBoundingClientRect();
            const currentBottom = parseInt(toast.style.top) + rect.height;
            if (currentBottom > maxBottom) {
                maxBottom = currentBottom;
            }
        });

        return maxBottom + 10;
    }

    /**
     * Обновляет позиции всех уведомлений
     */
    updatePositions() {
        const toasts = document.querySelectorAll('.jira-toast');
        let currentTop = 20;

        toasts.forEach((toast) => {
            toast.style.top = currentTop + 'px';
            const rect = toast.getBoundingClientRect();
            currentTop += rect.height + 10;
        });
    }

    /**
     * Удаляет все уведомления
     */
    clear() {
        this.toasts.forEach((toast, id) => {
            this.remove(id);
        });
    }
}

// Создаем глобальный экземпляр
export const toastManager = new ToastManager();

// Удобные методы для быстрого использования
export function showToast(message, type = 'info', duration) {
    return toastManager.show(message, type, duration);
}

export function showSuccess(message, duration) {
    return toastManager.show(message, 'success', duration);
}

export function showError(message, duration) {
    return toastManager.show(message, 'error', duration);
}

export function showWarning(message, duration) {
    return toastManager.show(message, 'warning', duration);
}

export function showInfo(message, duration) {
    return toastManager.show(message, 'info', duration);
}