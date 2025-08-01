/**
 * Базовый класс для диалогов
 */

export class BaseDialog {
    constructor(id, options = {}) {
        this.id = id;
        this.options = {
            width: '400px',
            title: '',
            closeOnEscape: true,
            closeOnBackdrop: false,
            ...options
        };
        this.element = null;
        this.escapeHandler = null;
    }

    /**
     * Создает базовую структуру диалога
     */
    createElement() {
        if (this.element) {
            this.remove();
        }

        this.element = document.createElement('div');
        this.element.id = this.id;
        this.element.style.cssText = `
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%);
            background: #fff; 
            border: 1px solid #ccc; 
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); 
            padding: 24px; 
            z-index: 10001;
            font-family: Arial, sans-serif; 
            font-size: 14px; 
            min-width: ${this.options.width};
        `;

        return this.element;
    }

    /**
     * Создает заголовок диалога
     */
    createHeader(title, subtitle = '') {
        const header = document.createElement('div');
        header.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #333;">${title}</h3>
            ${subtitle ? `<p style="margin: 0 0 20px 0; color: #666; font-size: 13px; line-height: 1.3;">${subtitle}</p>` : ''}
        `;
        return header;
    }

    /**
     * Создает футер с кнопками
     */
    createFooter(buttons = []) {
        const footer = document.createElement('div');
        footer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;';

        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.textContent = button.text;
            btn.style.cssText = `
                padding: 8px 16px; 
                border: ${button.primary ? 'none' : '1px solid #ddd'}; 
                background: ${button.primary ? '#36B37E' : '#f5f5f5'}; 
                color: ${button.primary ? 'white' : '#333'};
                border-radius: 4px; 
                cursor: pointer;
            `;

            if (button.onclick) {
                btn.onclick = button.onclick;
            }

            footer.appendChild(btn);
        });

        return footer;
    }

    /**
     * Создает поле ввода
     */
    createField(label, input) {
        const field = document.createElement('div');
        field.style.cssText = 'margin-bottom: 16px;';

        const labelEl = document.createElement('label');
        labelEl.style.cssText = 'display: block; margin-bottom: 6px; font-weight: bold;';
        labelEl.textContent = label;

        field.appendChild(labelEl);
        field.appendChild(input);

        return field;
    }

    /**
     * Создает текстовое поле
     */
    createInput(options = {}) {
        const input = document.createElement('input');
        input.type = options.type || 'text';
        input.value = options.value || '';
        input.placeholder = options.placeholder || '';
        input.style.cssText = `
            width: 100%; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px;
        `;

        if (options.id) input.id = options.id;
        if (options.min !== undefined) input.min = options.min;
        if (options.max !== undefined) input.max = options.max;
        if (options.step !== undefined) input.step = options.step;

        return input;
    }

    /**
     * Создает текстовую область
     */
    createTextarea(options = {}) {
        const textarea = document.createElement('textarea');
        textarea.value = options.value || '';
        textarea.placeholder = options.placeholder || '';
        textarea.style.cssText = `
            width: 100%; 
            height: ${options.height || '80px'}; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            resize: vertical;
        `;

        if (options.id) textarea.id = options.id;

        return textarea;
    }

    /**
     * Создает выпадающий список
     */
    createSelect(options = [], attributes = {}) {
        const select = document.createElement('select');
        select.style.cssText = `
            width: 100%; 
            padding: 8px; 
            border: 1px solid #ddd; 
            border-radius: 4px;
        `;

        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            if (option.selected) optionEl.selected = true;
            select.appendChild(optionEl);
        });

        if (attributes.id) select.id = attributes.id;

        return select;
    }

    /**
     * Показывает диалог
     */
    show() {
        document.body.appendChild(this.element);

        if (this.options.closeOnEscape) {
            this.escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.remove();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
        }
    }

    /**
     * Удаляет диалог
     */
    remove() {
        if (this.element?.parentNode) {
            this.element.remove();
        }

        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }

    /**
     * Находит элемент внутри диалога
     */
    find(selector) {
        return this.element ? this.element.querySelector(selector) : null;
    }

    /**
     * Находит все элементы внутри диалога
     */
    findAll(selector) {
        return this.element ? this.element.querySelectorAll(selector) : [];
    }
}