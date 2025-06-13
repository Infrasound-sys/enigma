document.addEventListener('DOMContentLoaded', () => {
    // --- Получение элементов DOM ---
    const dom = {
        matrixCanvas: document.getElementById('matrixCanvas'),
        header: {
            title: document.getElementById('mainHeaderTitle'),
            info: document.getElementById('sideHeaderInfo'),
            infoDate: document.querySelector('.header-info-date'),
            infoCode: document.querySelector('.header-info-code'),
            backButton: document.getElementById('backButton'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut')
        },
        gallery: document.getElementById('imageGallery'),
        detailPanel: {
            panel: document.getElementById('imageDetailPanel'),
            close: document.getElementById('detailCloseButton'),
            image: document.getElementById('detailImage'),
            info: document.getElementById('detailInfo')
        }
    };

    // --- Настройки и состояние ---
    const config = {
        baseUrl: "https://iili.io/",
        codesUrl: 'codes.txt',
        matrixFontSize: 16,
        matrixAnimationInterval: 50, // ms, увеличено для снижения нагрузки
        imageEnlargeDelay: 500 // ms
    };

    let state = {
        allImageMeta: [],
        currentView: 'months', // 'months', 'days', 'images'
        selectedYearMonth: null,
        selectedFullDate: null,
        gridColumns: 9,
        minGridColumns: 3,
        maxGridColumns: 16,
        hoverTimeoutId: null
    };

    // --- Матричный эффект ---
    const ctx = dom.matrixCanvas.getContext('2d');
    const matrixChars = "01";
    let columns, drops;

    function setupMatrix() {
        dom.matrixCanvas.width = window.innerWidth;
        dom.matrixCanvas.height = window.innerHeight;
        columns = dom.matrixCanvas.width / config.matrixFontSize;
        drops = [];
        for (let x = 0; x < columns; x++) drops[x] = 1;
    }

    function drawMatrix() {
        ctx.fillStyle = 'rgba(13, 13, 13, 0.05)';
        ctx.fillRect(0, 0, dom.matrixCanvas.width, dom.matrixCanvas.height);
        ctx.fillStyle = '#00ff00';
        ctx.font = config.matrixFontSize + 'px monospace';
        for (let i = 0; i < drops.length; i++) {
            const text = matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
            ctx.fillText(text, i * config.matrixFontSize, drops[i] * config.matrixFontSize);
            if (drops[i] * config.matrixFontSize > dom.matrixCanvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    // --- Загрузка и обработка данных ---
    async function fetchAndProcessData() {
        try {
            const response = await fetch(config.codesUrl);
            const text = await response.text();
            state.allImageMeta = text.split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => {
                    const [date, time, code] = line.split(' ');
                    const [year, month, day] = date.split('-');
                    return { fullDate: date, year, month, day, time, code };
                });
            render();
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            dom.gallery.innerHTML = '<p>Ошибка загрузки данных.</p>';
        }
    }

    // --- Логика рендеринга ---
    function render() {
        dom.gallery.innerHTML = '';
        switch (state.currentView) {
            case 'months':
                renderMonths();
                break;
            case 'days':
                renderDays();
                break;
            case 'images':
                renderImagesForDay();
                break;
        }
        updateUI();
    }
    
    function renderMonths() {
        const monthsData = state.allImageMeta.reduce((acc, meta) => {
            const yearMonth = `${meta.year}-${meta.month}`;
            if (!acc[yearMonth]) {
                acc[yearMonth] = { year: meta.year, month: meta.month, count: 0 };
            }
            acc[yearMonth].count++;
            return acc;
        }, {});

        Object.values(monthsData)
            .sort((a, b) => b.year.localeCompare(a.year) || b.month.localeCompare(a.month))
            .forEach(data => {
                const monthName = new Date(data.year, data.month - 1).toLocaleString('default', { month: 'long' });
                const folder = createDOMElement('div', 'folder-item', { 'data-id': `${data.year}-${data.month}` });
                folder.innerHTML = `
                    <div class="folder-month">${monthName}</div>
                    <div class="folder-year">${data.year}</div>
                    <div class="folder-img-count">${data.count} images</div>
                `;
                dom.gallery.appendChild(folder);
            });
    }

    function renderDays() {
        const daysData = state.allImageMeta
            .filter(meta => `${meta.year}-${meta.month}` === state.selectedYearMonth)
            .reduce((acc, meta) => {
                if (!acc[meta.day]) {
                    acc[meta.day] = { count: 0 };
                }
                acc[meta.day].count++;
                return acc;
            }, {});

        Object.entries(daysData)
            .sort(([dayA], [dayB]) => dayB.localeCompare(dayA))
            .forEach(([day, data]) => {
                const fullDate = `${state.selectedYearMonth}-${day.padStart(2, '0')}`;
                const folder = createDOMElement('div', 'folder-item', { 'data-id': fullDate });
                folder.innerHTML = `
                    <div class="folder-day">${day}</div>
                    <div class="folder-img-count">${data.count} images</div>
                `;
                dom.gallery.appendChild(folder);
            });
    }

    function renderImagesForDay() {
        state.allImageMeta
            .filter(meta => meta.fullDate === state.selectedFullDate)
            .forEach(meta => {
                const item = createDOMElement('div', 'image-item', { 'data-code': meta.code, 'data-full-date': meta.fullDate, 'data-time': meta.time });
                const img = createDOMElement('img');
                img.loading = 'lazy';
                // АКТУАЛЬНАЯ ПОДГРУЗКА ИЗОБРАЖЕНИЯ
                img.src = `${config.baseUrl}${meta.code}.jpg`;
                img.onerror = () => item.style.display = 'none';
                item.appendChild(img);
                dom.gallery.appendChild(item);
            });
    }
    
    // --- Обновление интерфейса ---
    function updateUI() {
        // Установка класса вида
        dom.gallery.className = 'image-gallery view-' + state.currentView;
        if (dom.detailPanel.panel.classList.contains('active')) {
            dom.gallery.classList.add('panel-active');
        }

        // Обновление колонок грида
        if (state.currentView === 'images') {
            dom.gallery.style.setProperty('--grid-columns', state.gridColumns);
        }

        // Видимость кнопки "Назад"
        dom.header.backButton.classList.toggle('visible', state.currentView !== 'months');
    }

    // --- Обработчики событий ---
    function initializeEventListeners() {
        window.addEventListener('resize', setupMatrix);

        dom.header.title.addEventListener('click', () => {
            closeDetailPanel();
            state.currentView = 'months';
            render();
        });
        
        dom.header.backButton.addEventListener('click', () => {
            closeDetailPanel();
            if (state.currentView === 'images') state.currentView = 'days';
            else if (state.currentView === 'days') state.currentView = 'months';
            render();
        });

        dom.header.zoomIn.addEventListener('click', () => {
            if (state.currentView === 'images' && state.gridColumns < state.maxGridColumns) {
                state.gridColumns++;
                updateUI();
            }
        });
        
        dom.header.zoomOut.addEventListener('click', () => {
            if (state.currentView === 'images' && state.gridColumns > state.minGridColumns) {
                state.gridColumns--;
                updateUI();
            }
        });
        
        dom.detailPanel.close.addEventListener('click', closeDetailPanel);

        // Делегирование событий для галереи
        dom.gallery.addEventListener('click', (e) => {
            const folder = e.target.closest('.folder-item');
            const image = e.target.closest('.image-item');
            
            if (folder) {
                handleFolderClick(folder.dataset.id);
            } else if (image) {
                handleImageClick(image.dataset);
            }
        });
        
        // Эффект увеличения при наведении
        dom.gallery.addEventListener('mouseover', (e) => {
            const imageItem = e.target.closest('.image-item');
            if (imageItem) {
                clearTimeout(state.hoverTimeoutId);
                state.hoverTimeoutId = setTimeout(() => {
                    imageItem.classList.add('enlarged');
                    dom.header.infoDate.textContent = `${imageItem.dataset.fullDate} ${imageItem.dataset.time}`;
                    dom.header.infoCode.textContent = imageItem.dataset.code;
                    dom.header.info.classList.add('visible');
                }, config.imageEnlargeDelay);
            }
        });

        dom.gallery.addEventListener('mouseout', (e) => {
            const imageItem = e.target.closest('.image-item');
            clearTimeout(state.hoverTimeoutId);
            // Убираем увеличение со всех элементов, чтобы избежать "залипания"
             document.querySelectorAll('.image-item.enlarged').forEach(item => item.classList.remove('enlarged'));
            dom.header.info.classList.remove('visible');
        });
    }

    function handleFolderClick(id) {
        if (state.currentView === 'months') {
            state.currentView = 'days';
            state.selectedYearMonth = id;
        } else if (state.currentView === 'days') {
            state.currentView = 'images';
            state.selectedFullDate = id;
        }
        render();
    }
    
    function handleImageClick(dataset) {
        dom.detailPanel.image.src = `${config.baseUrl}${dataset.code}.jpg`;
        dom.detailPanel.info.textContent = `CODE: ${dataset.code} | DATE: ${dataset.fullDate} ${dataset.time}`;
        dom.detailPanel.panel.classList.add('active');
        dom.gallery.classList.add('panel-active');
    }
    
    function closeDetailPanel() {
        dom.detailPanel.panel.classList.remove('active');
        dom.gallery.classList.remove('panel-active');
    }

    // --- Вспомогательные функции ---
    function createDOMElement(tag, className, attributes = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        for (const attr in attributes) {
            element.setAttribute(attr, attributes[attr]);
        }
        return element;
    }

    // --- Инициализация ---
    function init() {
        setupMatrix();
        setInterval(drawMatrix, config.matrixAnimationInterval);
        initializeEventListeners();
        fetchAndProcessData();
    }

    init();
});