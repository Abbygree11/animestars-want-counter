// Кэш для хранения данных о картах (сохраняется между обновлениями страницы)
const cardsCache = new Map();

const lockCardBorder = '6px solid #fc363b';
const unlockCardBorder = '6px solid #4CAF50';

// Запускаем при загрузке страницы
async function init() {
    // Проверяем, что мы на нужной странице
    const [isPackPage, isTradePage] = isAutoPages()
    const [isUserCardsPage, isAnimePage, isCardsLibraryPage, isTradeOfferPage, isUserNeedPage, isUserTradePage, isDeckCardsPage] = isButtonPages()

    // Универсальный наблюдатель для модальных окон
    const modalObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('ui-dialog-content') && node.classList?.contains('ui-widget-content')) {
                    processModalCards();
                }
            });
        });
    });
    // Начинаем наблюдение за всем документом
    modalObserver.observe(document.body, {
        childList: true, subtree: true
    });

    if (isAnimePage) {
        // Универсальный наблюдатель для модальных окон
        const cardNotificationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('card-notification')) {
                        processCardNotification();
                    }
                });
            });
        });
        // Начинаем наблюдение за всем документом
        cardNotificationObserver.observe(document.body, {
            childList: true, subtree: true
        });
    }

    if (isPackPage || isTradePage) {
        // Ждем полной загрузки страницы
        await waitForPageLoad();

        // Обрабатываем карты
        await processCardsAuto();

        if (isPackPage) {
            // Для динамически подгружаемых карт
            new MutationObserver((mutations) => {
                // Игнорируем изменения, если они содержат только счетчики
                const hasNonCounterChanges = mutations.some(mutation => {
                    return !mutation.addedNodes || Array.from(mutation.addedNodes).some(node => !node.classList?.contains('card-counters'));
                });
                if (hasNonCounterChanges) {
                    console.log('processCardsAuto()');
                    processCardsAuto();
                }
            }).observe(document.body, {
                childList: true, subtree: true
            });
        }
    } else if (isUserCardsPage || isAnimePage || isCardsLibraryPage || isTradeOfferPage || isUserNeedPage || isUserTradePage || isDeckCardsPage) {
        await waitForPageLoad();

        const loadButton = createLoadButton();
        document.body.appendChild(loadButton);

        loadButton.addEventListener('click', async () => {
            loadButton.disable(); // Делаем кнопку неактивной
            await processCardsButton();
            loadButton.enable(); // Включаем кнопку обратно
        });

        // Для динамически подгружаемых карт
        new MutationObserver((mutations) => {
            // Проверяем, что кнопка еще не скрыта (загрузка не начата)
            if (document.getElementById('load-counters-btn')?.style.display !== 'none') {
                // Пересоздаем кнопку, если она была удалена
                if (!document.getElementById('load-counters-btn')) {
                    const newButton = createLoadButton();
                    document.body.appendChild(newButton);
                    newButton.addEventListener('click', async () => {
                        newButton.style.display = 'none';
                        await processCardsButton();
                    });
                }
            }
        }).observe(document.body, {
            childList: true, subtree: true
        });
    }
}

// Обрабатываем карты на странице
async function processCardsAuto() {
    // Определяем тип страницы
    const [isPackPage, isTradePage] = isAutoPages()
    let timeout = 10

    let cards;
    if (isPackPage) {
        cards = document.querySelectorAll('.lootbox__card[data-id]');
    } else if (isTradePage) {
        cards = document.querySelectorAll('.trade__main-item[href*="/cards/"]');
    }

    // Добавляем счетчики для каждой карты по очереди
    for (const card of cards) {
        let cardId;
        if (isPackPage) {
            cardId = card.getAttribute('data-id');

            // Добавляем кнопку выбора только на странице пакета
            if (!card.querySelector('.choose-card-btn')) {
                const chooseButton = createLockButton(card);
                card.style.position = 'relative';
                card.appendChild(chooseButton);
            }
        } else if (isTradePage) {
            const href = card.getAttribute('href');
            const match = href.match(/\/cards\/(\d+)/);
            cardId = match ? match[1] : null;
        }

        console.log('setCounter()');
        await setCounter(card, cardId, timeout);
    }
}


async function processCardsButton() {
    // Определяем тип страницы
    const [isUserCardsPage, isAnimePage, isCardsLibraryPage, isTradeOfferPage, isUserNeedPage, isUserTradePage, isDeckCardsPage] = isButtonPages()
    let timeout = 10

    // Удаляем старые счетчики перед новой загрузкой
    document.querySelectorAll('.card-need-counter').forEach(counter => {
        counter.remove();
    });
    document.querySelectorAll('.card-trade-counter').forEach(counter => {
        counter.remove();
    });

    // Очищаем кэш для принудительной перезагрузки
    cardsCache.clear();

    try {
        // Делаем кнопку неактивной в начале загрузки
        const loadButton = document.getElementById('load-counters-btn');
        if (loadButton) loadButton.disable();

        // Находим карты в зависимости от типа страницы
        /** @type {Element[]} */
        let cards;
        if (isUserCardsPage || isUserNeedPage || isCardsLibraryPage || isUserTradePage) {
            cards = Array.from(document.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item'));
        } else if (isAnimePage) {
            timeout = 400
            // Для страниц аниме ищем карточки в карусели
            const carousel = document.querySelector('.sect.pmovie__related.sbox.fixidtab.cards-carousel');
            if (carousel) {
                cards = Array.from(carousel.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item'));
            }
        } else if (isTradeOfferPage) {
            // Для страницы предложения обмена
            const cards1 = document.querySelectorAll('.trade__inventory-item[data-card-id]');
            const cards2 = document.querySelectorAll('.card-show__wrapper[href*="/cards/"]');

            cards = Array.from(cards1).concat(Array.from(cards2));
        } else if (isDeckCardsPage) {
            cards = Array.from(document.querySelectorAll('.deck__item'));
        }
        // Добавляем счетчики для каждой карты по очереди
        for (const card of cards) {
            let cardId;
            if (isUserCardsPage || isAnimePage || isCardsLibraryPage || isUserNeedPage || isUserTradePage || isDeckCardsPage) {
                cardId = card.getAttribute('data-id');
            } else if (isTradeOfferPage) {
                cardId = card.getAttribute('data-card-id');
                if (cardId == null || cardId === '') {
                    const href = card.getAttribute('href');
                    const match = href.match(/\/cards\/(\d+)/);
                    cardId = match ? match[1] : null;
                }
            }

            await setCounter(card, cardId, timeout);

            if (isUserCardsPage) {
                await addLockButtonAndBorder(card)
            }
        }

    } finally {
        // Всегда включаем кнопку обратно, даже если была ошибка
        const loadButton = document.getElementById('load-counters-btn');
        if (loadButton) loadButton.enable();
    }
}

// Функция для обработки карт в модальном окне
async function processModalCards() {
    const modal = document.querySelector('.ui-dialog-content.ui-widget-content');
    if (!modal) return;

    const card = modal.querySelector('.fav-btn-card[data-id]');
    if (!card) return;

    // Проверяем, не добавлен ли уже счетчик
    if (card.querySelector('.card-need-counter') && card.querySelector('.card-trade-counter')) return;

    const cardId = card.getAttribute('data-id');

    const cardPlaceholder = modal.querySelector('.anime-cards__placeholder');
    await setCounter(cardPlaceholder, cardId, 10);
}

// Функция для обработки карт в модальном окне
async function processCardNotification() {
    const card = document.querySelector('.card-notification');
    card.click()
    await sleep(500);

    const modal = document.querySelector('.ui-button-icon.ui-icon.ui-icon-closethick');
    modal.click()
}

// Функция для обработки выбора карты
async function handleCardSelection(cardElement) {
    const cardId = cardElement.getAttribute('data-id');
    const packRow = document.querySelector('.lootbox__row');
    const packId = packRow?.getAttribute('data-pack-id');
    const userHash = getDleLoginHash();
    const baseUrl = getBaseUrl();

    if (!cardId || !packId || !userHash) {
        console.error('Не удалось получить необходимые данные для выбора карты');
        return;
    }

    try {
        // 1. Выбираем карту
        const chooseFormData = new FormData();
        chooseFormData.append('action', 'lootbox_choose');
        chooseFormData.append('id', cardId);
        chooseFormData.append('pack_id', packId);
        chooseFormData.append('user_hash', userHash);

        await fetch(`${baseUrl}/engine/ajax/controller.php?mod=cards_ajax`, {
            method: 'POST', body: chooseFormData
        });

        // 2. Обновляем список карт в паке
        const loadFormData = new FormData();
        loadFormData.append('action', 'lootbox_load');
        loadFormData.append('user_hash', userHash);

        await fetch(`${baseUrl}/engine/ajax/controller.php?mod=cards_ajax`, {
            method: 'POST', body: loadFormData
        });

        // 3. Получаем ник пользователя
        const userLink = document.querySelector('.lgn__btns a[href^="/user/"]');
        const userNick = userLink?.getAttribute('href')?.split('/')[2];

        if (userNick) {
            // 4. Получаем страницу карт пользователя
            const userCardsResponse = await fetch(`${baseUrl}/user/${userNick}/cards/`);
            const userCardsHtml = await userCardsResponse.text();
            const parser = new DOMParser();
            const userCardsDoc = parser.parseFromString(userCardsHtml, 'text/html');

            // 5. Находим карту по ID и получаем owner-id
            const userCard = userCardsDoc.querySelector(`.anime-cards__item[data-id="${cardId}"]`);
            const ownerId = userCard?.getAttribute('data-owner-id');

            if (ownerId) {
                // 6. Блокируем карту
                const lockFormData = new FormData();
                lockFormData.append('action', 'lock_card');
                lockFormData.append('id', ownerId);
                lockFormData.append('user_hash', userHash);

                await fetch(`${baseUrl}/engine/ajax/controller.php?mod=cards_ajax`, {
                    method: 'POST', body: lockFormData
                });
            }
        }

        // Обновляем страницу после всех действий
        window.location.reload();
    } catch (error) {
        console.error('Ошибка при выборе карты:', error);
    }
}

function getDleLoginHash() {
    // Ищем все script-теги в body
    const scripts = document.body.querySelectorAll('script');

    for (const script of scripts) {
        // Проверяем только текстовые скрипты (без src)
        if (!script.src && script.textContent) {
            // Ищем определение переменной dle_login_hash
            const match = script.textContent.match(/var dle_login_hash\s*=\s*["']([a-f0-9]+)["']/);
            if (match && match[1]) {
                return match[1];
            }
        }
    }

    console.error('Не удалось найти dle_login_hash в скриптах');
    return null;
}


async function setCounter(card, cardId, timeout) {
    if (cardId) {
        card.dataset.cardId = cardId;

        if (cardsCache.has(cardId)) {
            const [need, trade] = cardsCache.get(cardId)
            const tempCounters = createCountersElement(card, need, trade);
            card.style.position = 'relative';
            card.appendChild(tempCounters);
        }

        // Создаем временный счетчик с индикатором загрузки
        const tempCounters = createCountersElement(card, '...', '...');
        card.style.position = 'relative';
        card.appendChild(tempCounters);

        try {
            // Загружаем данные для текущей карты
            const [need, trade] = await fetchCardData(cardId);

            // Заменяем временный счетчик на финальный
            const finalCounters = createCountersElement(card, need, trade);
            card.replaceChild(finalCounters, tempCounters);

            // Добавляем небольшую задержку между загрузками карт
            await new Promise(resolve => setTimeout(resolve, timeout));
        } catch (error) {
            console.error(`Ошибка при загрузке данных для карты ${cardId}:`, error);
            // В случае ошибки оставляем временный счетчик с 0
            const errorCounters = createCountersElement(card, 0, 0);
            card.replaceChild(errorCounters, tempCounters);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isButtonPages() {
    let isUserCardsPage = /\/user\/\w+\/cards\/?$/.test(window.location.pathname) || /\/user\/\w+\/cards\/page\/\d+\/?$/.test(window.location.pathname);
    let isAnimePage = /\/aniserials\/videos\/\w+\/\d+-/.test(window.location.pathname);
    let isCardsLibraryPage = /\/cards\/?(\?|$)/.test(window.location.pathname) || /\/cards\/page\/\d+\/?(\?|$)/.test(window.location.pathname);
    let isTradeOfferPage = /\/cards\/\d+\/trade\/?$/.test(window.location.pathname);
    let isUserNeedPage = /\/user\/\w+\/cards\/need\/?$/.test(window.location.pathname) || /\/user\/\w+\/cards\/need\/page\/\d+\/?$/.test(window.location.pathname);
    let isUserTradePage = /\/user\/\w+\/cards\/trade\/?$/.test(window.location.pathname) || /\/user\/\w+\/cards\/trade\/page\/\d+\/?$/.test(window.location.pathname);
    let isDeckCardsPage = /\/decks\/\d+/.test(window.location.pathname);

    return [isUserCardsPage, isAnimePage, isCardsLibraryPage, isTradeOfferPage, isUserNeedPage, isUserTradePage, isDeckCardsPage]
}

function isAutoPages() {
    const isPackPage = window.location.pathname.includes('/cards/pack');
    const isTradePage = window.location.pathname.includes('/trades/');

    return [isPackPage, isTradePage]
}

// Получаем базовый URL для запросов
function getBaseUrl() {
    return window.location.origin;
}

// Получаем количество страниц пагинации
function getTotalPages(doc) {
    const pagination = doc.querySelector('.pagination__pages');
    if (!pagination) return 1;

    const pageElements = pagination.querySelectorAll('a, span');
    let maxPage = 1;

    pageElements.forEach(el => {
        const pageNum = parseInt(el.textContent);
        if (!isNaN(pageNum) && pageNum > maxPage) {
            maxPage = pageNum;
        }
    });

    return maxPage;
}

// Загружаем данные для карты с учетом пагинации
async function fetchCardData(cardId) {
    if (!cardsCache.has(cardId)) {
        try {
            const baseUrl = getBaseUrl();
            // Сначала загружаем первую страницу
            const cardPage = await fetch(`${baseUrl}/cards/users/?id=${cardId}`);
            const cardPageHtml = await cardPage.text();
            const parser = new DOMParser();
            const cardPageDoc = parser.parseFromString(cardPageHtml, 'text/html');

            const need = cardPageDoc.getElementById('owners-need').textContent;
            const trade = cardPageDoc.getElementById('owners-trade').textContent;

            cardsCache.set(cardId, [need, trade]);
        } catch (error) {
            console.error(`Ошибка для карты ${cardId}:`, error);
            cardsCache.set(cardId, [0, 0]);
        }
    }

    return cardsCache.get(cardId);
}

// Ждем полной загрузки страницы и динамического контента
async function waitForPageLoad() {
    // Проверяем, что страница полностью загружена
    if (document.readyState === 'complete') {
        // Дополнительная задержка для динамического контента
        await sleep(1000);
        return true;
    }

    return new Promise(resolve => {
        window.addEventListener('load', async () => {
            // Дополнительная задержка для динамического контента
            await sleep(1000);
            resolve(true);
        }, {once: true});
    });
}

async function toggleCardLock(button, card) {
    const userHash = getDleLoginHash();
    const baseUrl = getBaseUrl();
    const isCurrentlyLocked = button.querySelector('.fa-lock');
    const ownerId = card.getAttribute('data-owner-id');

    try {
        const formData = new FormData();
        formData.append('action', 'lock_card');
        formData.append('id', ownerId);
        formData.append('user_hash', userHash);

        await fetch(`${baseUrl}/engine/ajax/controller.php?mod=cards_ajax`, {
            method: 'POST', body: formData
        });

        // Обновляем UI после успешного запроса
        const card = button.closest('.anime-cards__item');
        if (isCurrentlyLocked) {
            // Разблокировали карту
            button.innerHTML = '<span class="fal fa-unlock"></span>';
            button.style.backgroundColor = '#fc363b';
            button.title = 'Разблокировать карту';
            card.style.border = unlockCardBorder;

            // Обновляем оригинальную кнопку блокировки
            const originalLockBtn = card.querySelector('.lock-card-btn .fal');
            if (originalLockBtn) {
                originalLockBtn.classList.remove('fa-lock');
                originalLockBtn.classList.add('fa-unlock');
            }
        } else {
            // Заблокировали карту
            button.innerHTML = '<span class="fal fa-lock"></span>';
            button.style.backgroundColor = '#4CAF50';
            button.title = 'Заблокировать карту';
            card.style.border = lockCardBorder;

            // Обновляем оригинальную кнопку блокировки
            const originalLockBtn = card.querySelector('.lock-card-btn .fal');
            if (originalLockBtn) {
                originalLockBtn.classList.remove('fa-unlock');
                originalLockBtn.classList.add('fa-lock');
            }
        }
    } catch (error) {
        console.error('Ошибка при изменении статуса блокировки:', error);
    }
}

//-------------------------------------------------------------------------------------------------------------------------------------------
// PageElements
// Функция для создания кнопки выбора карты
function createLockButton(card) {
    const [isPackPage, isTradePage] = isAutoPages()
    const [isUserCardsPage, isAnimePage, isCardsLibraryPage, isTradeOfferPage, isUserNeedPage, isUserTradePage, isDeckCardsPage] = isButtonPages()

    const button = document.createElement('div');
    button.className = 'choose-card-btn';
    button.title = 'Выбрать эту карту';

    const width = card.offsetWidth * (35/160);  //example - 160*(35/160)= 35
    const diameter = width * (25/35);           //example - 35*(25/35)  = 25
    const topShift = width * (10/35);           //example - 35*(10/35)  = 10
    const rightShift = width * (10/35);         //example - 35*(10/35)  = 10

    Object.assign(button.style, {
        position: 'absolute',
        top: topShift+'px',
        right: rightShift+'px',
        width: diameter+'px',
        height: diameter+'px',
        backgroundColor: '#772ce8',
        borderRadius: '50%',
        cursor: 'pointer',
        zIndex: '10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `url(${chrome.runtime.getURL('lock.png')})`,
        backgroundSize: '100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease'
    });

    // Эффекты при наведении
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    });

    // Обработчик клика
    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isPackPage) {
            await handleCardSelection(card);
        } else if (isUserCardsPage) {
            await toggleCardLock(button, card);
        }
    });

    return button;
}

// Добавляем в начало файла
async function addLockButtonAndBorder(card) {
    const lockBtn = card.querySelector('.lock-card-btn .fal');

    if (lockBtn) {
        // Добавляем окантовку в зависимости от статуса блокировки
        if (lockBtn.classList.contains('fa-lock')) {
            card.style.border = lockCardBorder; // Красная окантовка
        } else if (lockBtn.classList.contains('fa-unlock')) {
            card.style.border = unlockCardBorder; // Зеленая окантовка
        }

        // Добавляем кнопку блокировки/разблокировки
        if (!card.querySelector('.custom-lock-btn')) {
            const customLockBtn = createLockButton(card);
            card.style.position = 'relative';
            card.appendChild(customLockBtn);
        }
    }
}

// Функция для создания кнопки загрузки
function createLoadButton() {
    const button = document.createElement('div');
    button.id = 'load-counters-btn';
    button.title = 'Загрузить счетчики желающих';

    Object.assign(button.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '40px',
        height: '40px',
        backgroundColor: '#772ce8',
        borderRadius: '25%',
        cursor: 'pointer',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        backgroundImage: `url(${chrome.runtime.getURL('icon.png')})`,
        backgroundSize: '100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        transition: 'all 0.3s ease'
    });

    // Функция для отключения кнопки
    const disableButton = () => {
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
        button.style.pointerEvents = 'none';
        button.title = 'Идёт загрузка...';
    };

    // Функция для включения кнопки
    const enableButton = () => {
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
        button.title = 'Загрузить счетчики желающих';
    };

    // Эффекты при наведении (только когда кнопка активна)
    button.addEventListener('mouseenter', () => {
        if (button.style.pointerEvents !== 'none') {
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
        }
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    });

    // Сохраняем ссылки на функции в самой кнопке для доступа извне
    button.disable = disableButton;
    button.enable = enableButton;

    return button;
}

// Функция для определения цвета кружка
function getCounterColor(count) {
    if (count === 0) return '#cccccc';
    if (count <= 25) return '#4CAF50';
    if (count <= 50) return '#8BC34A';
    if (count <= 75) return '#FFEB3B';
    if (count <= 100) return '#FF9800';
    return '#F44336';
}

// Создаем счетчик
function createCountersElement(card, needCount, tradeCount) {
    const width = card.offsetWidth * (35/160)   //example - 160*(35/160)= 35
    const height = width * (25/35)              //example - 35*(25/35)  = 25
    const fontSize = width * (12/35)            //example - 35*(12/35)  = 12
    const xAxisShift = (width / 2) + 1          //example - 35/2 + 1    = 21
    const topShift = width * (10/35);           //example - 35*(10/35)  = 10

    const counters = document.createElement('div');
    counters.className = 'card-counters';

    const needCounter = document.createElement('div');
    needCounter.className = 'card-need-counter';
    needCounter.textContent = 'N:' + needCount;
    needCounter.title = `${needCount} пользователей хотят эту карту`;

    Object.assign(needCounter.style, {
        position: 'absolute',
        top: topShift+'px',
        left: '50%',
        transform: 'translateX(calc(-50% - '+ xAxisShift +'px))',
        backgroundColor: getCounterColor(needCount),
        color: needCount > 50 ? '#000' : '#fff',
        borderRadius: '35%',
        width: width+'px',
        height: height+'px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize+'px',
        fontWeight: 'bold',
        zIndex: '10',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        border: needCount === 0 ? '1px solid #999' : 'none'
    });
    counters.appendChild(needCounter);

    const tradeCounter = document.createElement('div');
    tradeCounter.className = 'card-trade-counter';
    tradeCounter.textContent = 'T:' + tradeCount;
    tradeCounter.title = `${tradeCount} пользователей не хотят эту карту`;

    Object.assign(tradeCounter.style, {
        position: 'absolute',
        top: topShift+'px',
        left: '50%',
        transform: 'translateX(calc(-50% + '+ xAxisShift +'px))',
        backgroundColor: getCounterColor(tradeCount),
        color: tradeCount > 50 ? '#000' : '#fff',
        borderRadius: '35%',
        width: width+'px',
        height: height+'px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize+'px',
        fontWeight: 'bold',
        zIndex: '10',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        border: tradeCount === 0 ? '1px solid #999' : 'none'
    });
    counters.appendChild(tradeCounter);

    return counters;
}

// Запускаем расширение
init();