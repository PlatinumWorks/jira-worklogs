/**
 * Компоненты загрузки (Loaders)
 */

/**
 * Простой загрузчик
 */
export function showSimpleLoader(message) {
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

/**
 * Скрыть простой загрузчик
 */
export function hideSimpleLoader(loader) {
    if (loader?.parentNode) {
        loader.remove();
    }
    const simpleLoader = document.getElementById("jira-simple-loader");
    if (simpleLoader) {
        simpleLoader.remove();
    }
}

/**
 * Загрузчик для worklog операций
 */
export function showWorklogLoader(initialMessage) {
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

    // Анимированные частицы
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

    // Анимированные блоки данных
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

    // Сохраняем ссылки для обновлений
    loader._subText = subText;
    loader._style = style;
    return loader;
}

/**
 * Обновить сообщение worklog загрузчика
 */
export function updateWorklogLoader(loader, message) {
    if (loader?._subText) {
        loader._subText.textContent = message;
    }
}

/**
 * Скрыть worklog загрузчик
 */
export function hideWorklogLoader(loader) {
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

/**
 * Главный загрузчик для отчетов
 */
export function showMainLoader() {
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

    // Анимированные частицы
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

    // Анимированные блоки данных
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

    // Сменяющиеся сообщения
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

/**
 * Скрыть главный загрузчик
 */
export function hideMainLoader() {
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