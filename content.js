// Кэш для хранения данных о картах (сохраняется между обновлениями страницы)
const cardsCache = new Map();

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
function createCounterElement(count) {
    const counter = document.createElement('div');
    counter.className = 'card-want-counter';
    counter.textContent = count;
    counter.title = `${count} пользователей хотят эту карту`;

    Object.assign(counter.style, {
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: getCounterColor(count),
        color: count > 50 ? '#000' : '#fff',
        borderRadius: '50%',
        width: '25px',
        height: '25px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: '10',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        border: count === 0 ? '1px solid #999' : 'none'
    });

    return counter;
}

// Получаем базовый URL для запросов
function getBaseUrl() {
    const currentOrigin = window.location.origin;
    return currentOrigin.includes('animestars.org')
        ? 'https://animestars.org'
        : currentOrigin.includes('asstars.tv')
            ? 'https://asstars.tv'
            : 'https://astars.club';
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
            const firstPageResponse = await fetch(`${baseUrl}/cards/${cardId}/users/need/`);
            const firstPageHtml = await firstPageResponse.text();
            const parser = new DOMParser();
            const firstPageDoc = parser.parseFromString(firstPageHtml, 'text/html');

            // Получаем общее количество страниц
            const totalPages = getTotalPages(firstPageDoc);

            // Считаем пользователей на первой странице
            let totalCount = firstPageDoc.querySelectorAll('.profile__friends--full .profile__friends-item').length;

            // Если есть другие страницы, загружаем их
            if (totalPages > 1) {
                const pagePromises = [];

                for (let page = 2; page <= totalPages; page++) {
                    pagePromises.push(
                        fetch(`${baseUrl}/cards/${cardId}/users/need/page/${page}/`)
                            .then(response => response.text())
                            .then(html => {
                                const doc = parser.parseFromString(html, 'text/html');
                                return doc.querySelectorAll('.profile__friends--full .profile__friends-item').length;
                            })
                            .catch(() => 0) // В случае ошибки считаем 0 пользователей на этой странице
                    );
                }

                // Суммируем результаты всех страниц
                const pageCounts = await Promise.all(pagePromises);
                totalCount += pageCounts.reduce((sum, count) => sum + count, 0);
            }

            cardsCache.set(cardId, totalCount);
        } catch (error) {
            console.error(`Ошибка для карты ${cardId}:`, error);
            cardsCache.set(cardId, 0);
        }
    }
    return cardsCache.get(cardId);
}

// Обрабатываем карты на странице
async function processCards() {
    // Определяем тип страницы
    const isPackPage = window.location.pathname.includes('/cards/pack');
    const isTradePage = window.location.pathname.includes('/trades/');
    const isUserCardsPage = /\/user\/\w+\/cards\/?$/.test(window.location.pathname);
    const isAnimePage = /\/aniserials\/video\/\w+\/\d+-/.test(window.location.pathname);
    const isCardsPage = /\/cards\/?(\?|$)/.test(window.location.pathname);
    const isTradeOfferPage = /\/cards\/\d+\/trade\/?$/.test(window.location.pathname);

    // Находим карты в зависимости от типа страницы
    let cards;
    if (isPackPage) {
        cards = document.querySelectorAll('.lootbox__card[data-id]');
    } else if (isTradePage) {
        cards = document.querySelectorAll('.trade__main-item[href*="/cards/"]');
    } else if (isUserCardsPage) {
        cards = document.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item');
    } else if (isAnimePage) {
        // Для страниц аниме ищем карточки в карусели
        const carousel = document.querySelector('.sect.pmovie__related.sbox.fixidtab.cards-carousel');
        if (carousel) {
            cards = carousel.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item');
        }
    } else if (isCardsPage) {
        // Для страницы со всеми картами
        cards = document.querySelectorAll('.anime-cards__item-wrapper .anime-cards__item');
    } else if (isTradeOfferPage) {
        // Для страницы предложения обмена
        cards = document.querySelectorAll('.trade__inventory-item[data-card-id]');
    }

    // Добавляем счетчики для каждой карты по очереди
    for (const card of cards) {
        let cardId;
        if (isPackPage) {
            cardId = card.getAttribute('data-id');
        } else if (isTradePage) {
            const href = card.getAttribute('href');
            const match = href.match(/\/cards\/(\d+)/);
            cardId = match ? match[1] : null;
        } else if (isUserCardsPage || isAnimePage || isCardsPage || isTradeOfferPage) {
            cardId = card.getAttribute(isTradeOfferPage ? 'data-card-id' : 'data-id');
        }

        if (cardId) {
            card.dataset.cardId = cardId;

            // Создаем временный счетчик с индикатором загрузки
            const tempCounter = createCounterElement('...');
            card.style.position = 'relative';
            card.appendChild(tempCounter);

            try {
                // Загружаем данные для текущей карты
                const count = await fetchCardData(cardId);

                // Заменяем временный счетчик на финальный
                const finalCounter = createCounterElement(count);
                card.replaceChild(finalCounter, tempCounter);

                // Добавляем небольшую задержку между загрузками карт
                await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error) {
                console.error(`Ошибка при загрузке данных для карты ${cardId}:`, error);
                // В случае ошибки оставляем временный счетчик с 0
                const errorCounter = createCounterElement(0);
                card.replaceChild(errorCounter, tempCounter);
            }
        }
    }
}

// Ждем полной загрузки страницы и динамического контента
async function waitForPageLoad() {
    // Проверяем, что страница полностью загружена
    if (document.readyState === 'complete') {
        // Дополнительная задержка для динамического контента
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true;
    }

    return new Promise(resolve => {
        window.addEventListener('load', async () => {
            // Дополнительная задержка для динамического контента
            await new Promise(resolve => setTimeout(resolve, 1000));
            resolve(true);
        }, { once: true });
    });
}

// Запускаем при загрузке страницы
async function init() {
    // Проверяем, что мы на нужной странице
    const isPackPage = window.location.pathname.includes('/cards/pack');
    const isTradePage = window.location.pathname.includes('/trades/');
    const isUserCardsPage = /\/user\/\w+\/cards\/?$/.test(window.location.pathname);
    const isAnimePage = /\/aniserials\/video\/\w+\/\d+-/.test(window.location.pathname);
    const isCardsPage = /\/cards\/?(\?|$)/.test(window.location.pathname);
    const isTradeOfferPage = /\/cards\/\d+\/trade\/?$/.test(window.location.pathname);

    if (isPackPage || isTradePage || isUserCardsPage || isAnimePage || isCardsPage || isTradeOfferPage) {
        // Ждем полной загрузки страницы
        await waitForPageLoad();

        // Обрабатываем карты
        await processCards();

        // Для динамически подгружаемых карт
        new MutationObserver(processCards).observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Запускаем расширение
init();