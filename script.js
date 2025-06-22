document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN Y CONSTANTES ---
    const API_URL = "https://script.google.com/macros/s/AKfycbxOpc9kmJly3hzq_mJmMeQrpGIEoysWjIhuO1ju6ZjfDjvtWRerY5yCkf2M2ZnrEkxu/exec";
    const OFFER_PASSWORD = "314";
    const ABBREVIATIONS = {"1 Galón": "1g", "2 galones (medio cuñete)": "2g", "4 galones (cuñete)": "4g", "5 galones (cuñete)": "5g", ".¼ galón (cuarto)": "1/4g", ".½ galón (medio)": "1/2g", ".¾ galón (trilón)": "Tri.", "Unidad": "Un.", "(Parte A galón) base": "A", "(Parte B cuarto) catalizador aducto amina": "B", "(Parte B galón) catalizador": "B", "Juego": "Jg.", "Octavo de galón": "1/8g"};
    
    const STORE_DISPLAY_NAMES = { "Manongo": "Pinturas Mañongo", "Sureinca": "Pinturas Sureinca Aragua" };
    const STORE_PASSWORDS = { "Manongo": "314214772", "Sureinca": "314498711" };
    
    const STORE_DETAILS = {
        "Manongo": {
            rif: "J-31421477-2",
            contact: "Tlf: 0414-9409606   pinturasmanongo@gmail.com"
        },
        "Sureinca": {
            rif: "J-31449871-1",
            contact: "Tlf: 0243-2367809   sureinca_aragua@hotmail.com"
        }
    };
    
    const BS_FORMATTER = new Intl.NumberFormat('es-ES', { useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const state = { 
        fullStoreData: [], storeData: {}, selectedStore: null, isOfferMode: false, 
        activeMenu: null, activeTipo: null, searchTerm: '', bcvRate: 0,
        quote: [], productForDetailModal: null 
    };

    const elements = {
        body: document.body, initialWelcomeMessage: document.getElementById('initial-welcome-message'),
        logoSpan: document.querySelector('.logo span'), menuTabsContainer: document.getElementById('menu-tabs-container'),
        tipoTabsContainer: document.getElementById('tipo-tabs-container'), contentContainer: document.getElementById('catalog-content-container'),
        offerToggle: document.getElementById('offer-toggle'), loadingIndicator: document.getElementById('loading-indicator'),
        bcvRateDisplay: document.getElementById('bcv-rate-display'), storeModalOverlay: document.getElementById('store-modal-overlay'),
        storeButtonsContainer: document.getElementById('store-buttons-container'), rateModalOverlay: document.getElementById('rate-modal-overlay'),
        rateForm: document.getElementById('rate-form'), rateInput: document.getElementById('rate-input'),
        searchInput: document.getElementById('search-input'), clearSearchBtn: document.getElementById('clear-search-btn'),
        productDetailModalOverlay: document.getElementById('product-detail-modal-overlay'), detailModalProductName: document.getElementById('detail-modal-product-name'),
        productDetailContent: document.getElementById('product-detail-content'), closeDetailModalBtn: document.getElementById('close-detail-modal-btn'),
        addToQuoteBtn: document.getElementById('add-to-quote-btn'), 
        quantityInput: document.getElementById('quantity-input'),
        colorInput: document.getElementById('color-input'),
        quoteFab: document.getElementById('quote-fab'), quoteItemCount: document.getElementById('quote-item-count'),
        quoteModalOverlay: document.getElementById('quote-modal-overlay'), closeQuoteModalBtn: document.getElementById('close-quote-modal-btn'),
        quoteContentContainer: document.getElementById('quote-content-container'), quoteFooter: document.getElementById('quote-footer'),
        clearQuoteBtn: document.getElementById('clear-quote-btn'),
        downloadQuotePdfBtn: document.getElementById('download-quote-pdf-btn'),
        clientInfoModalOverlay: document.getElementById('client-info-modal-overlay'),
        closeClientInfoModalBtn: document.getElementById('close-client-info-modal-btn'),
        cancelClientInfoBtn: document.getElementById('cancel-client-info-btn'),
        clientInfoForm: document.getElementById('client-info-form'),
        clientNameInput: document.getElementById('client-name-input'),
        clientRifInput: document.getElementById('client-rif-input')
    };
    
    // --- RENDERIZADO ---
    function renderUI() { renderTabs(); renderProductTable(); }
    
    function renderTabs() {
        const createTab = (text, dataKey, isActive, className) => {
            const tab = document.createElement('button');
            tab.className = className;
            if (isActive && !state.searchTerm) tab.classList.add('active');
            tab.textContent = text;
            tab.dataset[dataKey] = text;
            return tab;
        };
        elements.menuTabsContainer.innerHTML = '';
        Object.keys(state.storeData).forEach(menuName => elements.menuTabsContainer.appendChild(createTab(menuName, 'menu', menuName === state.activeMenu, 'menu-button')));
        elements.tipoTabsContainer.innerHTML = '';
        if (state.activeMenu && state.storeData[state.activeMenu]) {
            Object.keys(state.storeData[state.activeMenu]).sort((a,b) => a.localeCompare(b)).forEach(tipoName => {
                elements.tipoTabsContainer.appendChild(createTab(tipoName, 'tipo', tipoName === state.activeTipo, 'tipo-button'));
            });
        }
    }

    function renderProductTable() {
        let products = [];
        if (state.searchTerm) {
            products = state.fullStoreData.filter(p => p.tienda === state.selectedStore && p.name.toLowerCase().includes(state.searchTerm));
        } else if (state.activeMenu && state.activeTipo && state.storeData[state.activeMenu]?.[state.activeTipo]?.products) {
            products = [...state.storeData[state.activeMenu][state.activeTipo].products];
        }

        const sortedProducts = products.sort((a, b) => a.name.localeCompare(b.name));
        const groupedProducts = sortedProducts.reduce((acc, p) => ({...acc, [p.name]: [...(acc[p.name] || []), p]}), {});
        
        let cardsHtml = '<div class="product-card-container">';
        let productsFound = false;

        Object.values(groupedProducts).forEach(productGroup => {
            const hasValidPrice = productGroup.some(p => p.normalPrice > 0);
            if (hasValidPrice) {
                productsFound = true;
                const firstProduct = productGroup[0];
                cardsHtml += `<div class="product-card"><h3 class="product-card-title">${firstProduct.name}</h3><div class="table-responsive-wrapper"><table class="presentations-table"><thead><tr><th></th>`;
                productGroup.forEach(p => { cardsHtml += `<th>${ABBREVIATIONS[p.pres] || p.pres}</th>`; });
                cardsHtml += `</tr></thead><tbody>`;
                
                // Fila Precio $
                cardsHtml += `<tr class="price-row"><td>Precio $</td>`;
                productGroup.forEach(p => {
                    const priceParts = p.normalPrice.toFixed(2).split('.');
                    const priceHtml = `<span class="price-integer">${priceParts[0]}</span><span class="price-decimal">.${priceParts[1]}</span>`;
                    cardsHtml += `<td class="price-cell" data-name="${p.name}" data-pres="${p.pres}" data-price-normal="${p.normalPrice}" data-price-special="${p.specialPrice}">${priceHtml}</td>`;
                });
                cardsHtml += `</tr>`;

                // Fila Precio Bs.
                cardsHtml += `<tr class="price-row"><td>Precio Bs.</td>`;
                productGroup.forEach(p => {
                    const precioEnBs = p.normalPrice * state.bcvRate;
                    const bsPriceString = BS_FORMATTER.format(precioEnBs);
                    const priceParts = bsPriceString.split(',');
                    const priceHtml = `<span class="price-bs"><span class="price-integer">${priceParts[0]}</span><span class="price-decimal">,${priceParts[1]}</span></span>`;
                    cardsHtml += `<td class="price-cell" data-name="${p.name}" data-pres="${p.pres}" data-price-normal="${p.normalPrice}" data-price-special="${p.specialPrice}">${priceHtml}</td>`;
                });
                cardsHtml += `</tr>`;

                // Fila Oferta Pago en $
                cardsHtml += `<tr class="offer-row price-row"><td>Pago en $</td>`;
                productGroup.forEach(p => {
                    const priceParts = p.specialPrice.toFixed(2).split('.');
                    const priceHtml = `<span class="price-integer">${priceParts[0]}</span><span class="price-decimal">.${priceParts[1]}</span>`;
                    cardsHtml += `<td class="price-cell" data-name="${p.name}" data-pres="${p.pres}" data-price-normal="${p.normalPrice}" data-price-special="${p.specialPrice}">${priceHtml}</td>`;
                });
                cardsHtml += `</tr></tbody></table></div></div>`;
            }
        });
        cardsHtml += '</div>';

        if (!productsFound && products.length > 0) {
            const message = state.searchTerm ? `No se encontraron productos con precio que coincidan con "${state.searchTerm}".` : `No hay productos con precios definidos en esta categoría.`;
            elements.contentContainer.innerHTML = `<p style="text-align:center; padding: 2rem;">${message}</p>`;
        } else if (products.length === 0) {
            elements.contentContainer.innerHTML = `<p style="text-align:center; padding: 2rem;">No se encontraron productos.</p>`;
        }
        else {
            elements.contentContainer.innerHTML = cardsHtml;
        }
    }
    
    function showLoading(isLoading, message = '') {
        elements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
        if (isLoading) elements.loadingIndicator.textContent = message;
    }
    
    function updateBodyClasses() {
        elements.body.classList.toggle('offer-mode-on', state.isOfferMode);
    }

    function handleContentClick(event) {
        const cell = event.target.closest('td.price-cell');
        if (!cell || !cell.dataset.name) return;
        const { name, pres } = cell.dataset;
        
        const product = state.fullStoreData.find(p => 
            p.tienda === state.selectedStore && p.name === name && p.pres === pres
        );
        if (!product) return;

        state.productForDetailModal = product;
        
        const normalPrice = product.normalPrice;
        const specialPrice = product.specialPrice;
        const priceInBs = normalPrice * state.bcvRate;
        
        elements.detailModalProductName.textContent = product.name;
        
        let detailsHtml = '<ul>';
        detailsHtml += `<li><span class="detail-label">Presentación:</span><strong class="detail-value">${product.pres}</strong></li>`;
        detailsHtml += `<li><span class="detail-label">Precio $:</span><strong class="detail-value">${normalPrice.toFixed(2)}</strong></li>`;
        detailsHtml += `<li><span class="detail-label">Precio Bs:</span><strong class="detail-value">${BS_FORMATTER.format(priceInBs)}</strong></li>`;
        if (state.isOfferMode && specialPrice > 0) {
            detailsHtml += `<li><span class="detail-label offer-label">Pago en $:</span><strong class="detail-value">${specialPrice.toFixed(2)}</strong></li>`;
        }
        detailsHtml += '</ul>';
        
        elements.productDetailContent.innerHTML = detailsHtml;
        elements.quantityInput.value = 1;
        elements.colorInput.value = '';
        elements.productDetailModalOverlay.classList.add('visible');
    }

    function closeDetailModal() { 
        elements.productDetailModalOverlay.classList.remove('visible'); 
        state.productForDetailModal = null;
    }
    
    // --- FUNCIONES DE COTIZACIÓN ---

    function updateQuoteIndicator() {
        const count = state.quote.reduce((sum, item) => sum + item.quantity, 0);
        elements.quoteItemCount.textContent = count;
        elements.quoteItemCount.style.display = count > 0 ? 'flex' : 'none';
    }

    function handleAddToQuote() {
        const productToAdd = state.productForDetailModal;
        if (!productToAdd) return;

        const quantity = parseInt(elements.quantityInput.value, 10);
        const color = elements.colorInput.value.trim();

        if (isNaN(quantity) || quantity < 1) {
            alert("Por favor, ingrese una cantidad válida.");
            return;
        }
        
        const itemId = `${productToAdd.name}-${productToAdd.pres}-${color}`;

        const existingQuoteItemIndex = state.quote.findIndex(item => item.id === itemId);

        if (existingQuoteItemIndex > -1) {
            state.quote[existingQuoteItemIndex].quantity += quantity;
        } else {
            state.quote.push({ 
                id: itemId,
                product: productToAdd, 
                quantity: quantity,
                color: color 
            });
        }

        updateQuoteIndicator();
        closeDetailModal();
    }

    function renderQuoteModal() {
        if (state.quote.length === 0) {
            elements.quoteContentContainer.innerHTML = `<p class="quote-empty-message">Aún no has añadido productos a la cotización.</p>`;
            elements.quoteFooter.style.display = 'none';
            return;
        }

        elements.quoteFooter.style.display = 'flex';
        let grandTotal = 0;
        let offerTotal = 0;

        const sortedQuote = [...state.quote].sort((a, b) => 
            a.product.name.localeCompare(b.product.name)
        );

        const tableRows = sortedQuote.map(item => {
            const price = item.product.normalPrice;
            const lineTotal = item.quantity * price;
            grandTotal += lineTotal;
            
            if (state.isOfferMode && item.product.specialPrice > 0) {
                offerTotal += item.quantity * item.product.specialPrice;
            }
            
            const colorHtml = item.color ? `<span class="quote-product-color">(${item.color})</span>` : '';

            return `
                <tr data-id="${item.id}">
                    <td class="col-product">
                        <div class="quote-product-name">${item.product.name} ${colorHtml}</div>
                        <div class="quote-product-pres">${item.product.pres}</div>
                    </td>
                    <td class="col-qty">
                        <div class="quote-qty-controls">
                            <button class="quote-qty-btn" data-action="decrease">-</button>
                            <span class="quote-qty-value">${item.quantity}</span>
                            <button class="quote-qty-btn" data-action="increase">+</button>
                        </div>
                    </td>
                    <td class="col-price">$${price.toFixed(2)}</td>
                    <td class="col-total"><strong>$${lineTotal.toFixed(2)}</strong></td>
                    <td class="col-delete">
                        <button class="quote-delete-btn" data-action="delete" title="Eliminar">×</button>
                    </td>
                </tr>
            `;
        }).join('');

        elements.quoteContentContainer.innerHTML = `
            <table class="quote-table">
                <thead>
                    <tr>
                        <th class="col-product">Producto</th>
                        <th class="col-qty">Cantidad</th>
                        <th class="col-price">P. Unit.</th>
                        <th class="col-total">Total</th>
                        <th class="col-delete"></th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
        
        const grandTotalBs = grandTotal * state.bcvRate;
        let totalsHtml = `
            <div class="total-line">
                <span class="total-label">Total en Bs:</span>
                <span class="total-value">${BS_FORMATTER.format(grandTotalBs)}</span>
            </div>
            <div class="total-line">
                <span class="total-label">Total en $:</span>
                <span class="total-value">${grandTotal.toFixed(2)}</span>
            </div>
        `;

        if (state.isOfferMode && offerTotal > 0) {
            totalsHtml += `
                <div class="total-line offer-total-line">
                    <span class="total-label">OFERTA SOLO PAGO EN $:</span>
                    <span class="total-value">${offerTotal.toFixed(2)}</span>
                </div>
            `;
        }

        document.getElementById('quote-totals').innerHTML = totalsHtml;
    }
    
    function handleQuoteActions(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const row = button.closest('tr');
        if (!row) return;
        
        const itemId = row.dataset.id;
        const action = button.dataset.action;

        const itemIndex = state.quote.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        if (action === 'increase') {
            state.quote[itemIndex].quantity++;
        } else if (action === 'decrease') {
            state.quote[itemIndex].quantity--;
            if (state.quote[itemIndex].quantity <= 0) {
                state.quote.splice(itemIndex, 1);
            }
        } else if (action === 'delete') {
            state.quote.splice(itemIndex, 1);
        }

        renderQuoteModal();
        updateQuoteIndicator();
    }
    
    function clearQuote() {
        if (confirm("¿Estás seguro de que quieres limpiar toda la cotización?")) {
            state.quote = [];
            renderQuoteModal();
            updateQuoteIndicator();
        }
    }
    
    function generateQuotePDF(clientName, clientRif) { 
        if (state.quote.length === 0) {
            alert("La cotización está vacía. Añade productos para generar un PDF.");
            return;
        }

        if (!clientName || !clientRif) {
            alert("Los datos del cliente son necesarios para generar el PDF.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const page_width = doc.internal.pageSize.getWidth();
        const TAX_DIVISOR = 1.16;
        const TAX_MULTIPLIER = 0.16;

        // --- CABECERA ---
        const storeName = STORE_DISPLAY_NAMES[state.selectedStore] || state.selectedStore;
        const storeDetails = STORE_DETAILS[state.selectedStore];
        const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(storeName, 14, 22);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("Cotización", page_width - 14, 22, { align: 'right' });
        
        let startY = 30;
        
        if (storeDetails) {
            doc.setFontSize(9);
            doc.text(`RIF: ${storeDetails.rif}`, 14, startY);
            startY += 5;
            doc.text(storeDetails.contact, 14, startY);
            startY += 5;
        }

        doc.setFontSize(10);
        doc.text(`Fecha: ${date}`, 14, startY);
        startY += 5;
        doc.text(`Tasa BCV: ${state.bcvRate.toFixed(4)}`, 14, startY);
        startY += 8;

        doc.setFont('helvetica', 'bold');
        doc.text('Cliente:', 14, startY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${clientName} / RIF: ${clientRif}`, 30, startY); 
        startY += 10;

        // --- TABLA DE PRODUCTOS ---
        const head = [['Producto', 'Presentación', 'Cant.', 'P. Unit. ($)', 'Total ($)']];
        let subTotal = 0;
        
        const sortedQuoteForPDF = [...state.quote].sort((a, b) => 
            a.product.name.localeCompare(b.product.name)
        );

        const body = sortedQuoteForPDF.map(item => {
            const listPrice = item.product.normalPrice;
            
            const unitPrice = listPrice / TAX_DIVISOR;
            const lineTotal = unitPrice * item.quantity;
            subTotal += lineTotal;
            
            const productNameWithColor = item.color 
                ? `${item.product.name} (${item.color})` 
                : item.product.name;

            return [
                productNameWithColor,
                item.product.pres,
                item.quantity,
                unitPrice.toFixed(2),
                lineTotal.toFixed(2)
            ];
        });

        doc.autoTable({
            head: head,
            body: body,
            startY: startY,
            theme: 'striped',
            headStyles: { fillColor: [0, 83, 156] },
            columnStyles: {
                0: { cellWidth: 70 },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });

        // --- TOTALES ---
        let finalY = doc.lastAutoTable.finalY + 10;

        const ivaAmount = subTotal * TAX_MULTIPLIER;
        const grandTotal = subTotal + ivaAmount;
        
        const grandTotalBs = grandTotal * state.bcvRate;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        doc.text('SubTotal:', 120, finalY, { align: 'right' });
        doc.text(`$ ${subTotal.toFixed(2)}`, page_width - 14, finalY, { align: 'right' });
        finalY += 6;

        doc.text('IVA (16%):', 120, finalY, { align: 'right' });
        doc.text(`$ ${ivaAmount.toFixed(2)}`, page_width - 14, finalY, { align: 'right' });
        finalY += 6;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total a Pagar:', 120, finalY, { align: 'right' });
        doc.text(`$ ${grandTotal.toFixed(2)}`, page_width - 14, finalY, { align: 'right' });
        
        finalY += 6;
        doc.text(`Bs. ${BS_FORMATTER.format(grandTotalBs)}`, page_width - 14, finalY, { align: 'right' });
        
        // --- GUARDAR ARCHIVO ---
        const safeClientName = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `cotizacion-${safeClientName}-${date.replace(/\//g, '-')}.pdf`;
        doc.save(fileName);
    }

    // --- MANEJADORES DE EVENTOS Y FLUJO PRINCIPAL ---
    function handleStoreSelection(event) {
        if (!event.target.matches('.store-button')) return;
        const storeName = event.target.dataset.store;
        const expectedPassword = STORE_PASSWORDS[storeName];
        if (!expectedPassword || prompt(`Por favor, ingrese la contraseña para la tienda ${STORE_DISPLAY_NAMES[storeName] || storeName}:`) === expectedPassword) {
            proceedToNextStep(storeName);
        } else {
            alert("Contraseña incorrecta.");
        }
    }

    function proceedToNextStep(storeName) {
        state.selectedStore = storeName;
        elements.logoSpan.textContent = STORE_DISPLAY_NAMES[storeName] || storeName;
        processDataForStore();
        elements.storeModalOverlay.classList.remove('visible');
        elements.rateModalOverlay.classList.add('visible');
        elements.rateInput.focus();
    }

    function handleInitialRateSubmit(event) {
        event.preventDefault();
        if (validateAndSetRate(elements.rateInput.value)) {
            elements.rateModalOverlay.classList.remove('visible');
            initializeAppUI();
        } else {
            elements.rateInput.select();
        }
    }

    function handleRateClick() {
        if (!state.selectedStore) return;
        const newRateInput = prompt("Modificar Tasa BCV:", state.bcvRate.toFixed(4));
        if (newRateInput !== null && validateAndSetRate(newRateInput)) {
            renderProductTable();
            if (elements.quoteModalOverlay.classList.contains('visible')) {
                renderQuoteModal();
            }
        }
    }

    function handleOfferToggle(event) {
        const checkbox = event.target;
        if (checkbox.checked) {
            const pwd = prompt("Ingrese la clave para ver los precios de pago en $: ");
            state.isOfferMode = pwd === OFFER_PASSWORD;
            if (!state.isOfferMode) { alert("Clave incorrecta."); checkbox.checked = false; }
        } else {
            state.isOfferMode = false;
        }
        updateBodyClasses();
        renderProductTable();
        if (elements.quoteModalOverlay.classList.contains('visible')) {
            renderQuoteModal();
        }
    }
    
    function handleSearchInput(event) {
        state.searchTerm = event.target.value.trim().toLowerCase();
        elements.clearSearchBtn.style.display = state.searchTerm ? 'block' : 'none';
        if (state.searchTerm) {
            document.querySelectorAll('.menu-button.active, .tipo-button.active').forEach(b => b.classList.remove('active'));
        }
        renderProductTable();
    }
    
    function handleClearSearch() {
        elements.searchInput.value = '';
        state.searchTerm = '';
        elements.clearSearchBtn.style.display = 'none';
        const firstMenu = Object.keys(state.storeData)[0];
        if (firstMenu) {
            state.activeMenu = firstMenu;
            const tipos = Object.keys(state.storeData[firstMenu]).sort((a,b) => a.localeCompare(b));
            state.activeTipo = tipos.length > 0 ? tipos[0] : null;
        }
        renderUI();
        elements.searchInput.focus();
    }

    function validateAndSetRate(rawInput) {
        if (!rawInput || rawInput.trim() === "") { alert("Por favor, introduce un valor para la tasa."); return false; }
        const parsedRate = parseFloat(rawInput.replace(',', '.'));
        if (!isNaN(parsedRate) && parsedRate > 0) {
            state.bcvRate = parsedRate;
            elements.bcvRateDisplay.innerHTML = `<span class="rate-title">Tasa BCV</span><span class="rate-value">${state.bcvRate.toFixed(4)}</span>`;
            return true;
        }
        alert("El valor introducido no es un número válido."); return false;
    }

    function processDataForStore() {
        const storeProducts = state.fullStoreData.filter(item => item.tienda === state.selectedStore);
        const nestedData = storeProducts.reduce((acc, product) => {
            const { menu, tipo, ...restOfProduct } = product;
            if (!acc[menu]) acc[menu] = {};
            if (!acc[menu][tipo]) acc[menu][tipo] = { products: [] };
            acc[menu][tipo].products.push(restOfProduct);
            return acc;
        }, {});
        state.storeData = nestedData;
        const menus = Object.keys(state.storeData);
        if (menus.length > 0) {
            state.activeMenu = menus[0];
            const tipos = Object.keys(state.storeData[state.activeMenu] || {}).sort((a,b) => a.localeCompare(b));
            state.activeTipo = tipos.length > 0 ? tipos[0] : null;
        }
    }
    
    function initializeAppUI() {
        elements.body.classList.remove('app-loading');
        showLoading(false);
        renderUI();
        updateQuoteIndicator();
    }
    
    async function initialFetchAndSetup() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Error de red: ${response.status} ${response.statusText}`);
            const rawData = await response.json();
            if (!Array.isArray(rawData)) throw new Error("El formato de datos del servidor es incorrecto.");
            state.fullStoreData = rawData;
            const stores = [...new Set(state.fullStoreData.map(item => item.tienda).filter(Boolean))].sort();
            if (stores.length > 0) {
                elements.storeButtonsContainer.innerHTML = '';
                stores.forEach(storeKey => {
                    const button = document.createElement('button');
                    button.className = 'store-button';
                    button.textContent = STORE_DISPLAY_NAMES[storeKey] || storeKey;
                    button.dataset.store = storeKey;
                    elements.storeButtonsContainer.appendChild(button);
                });
                elements.initialWelcomeMessage.classList.add('hidden');
                setTimeout(() => elements.storeModalOverlay.classList.add('visible'), 500);
            } else { throw new Error("No se encontraron tiendas en los datos."); }
        } catch (error) {
            console.error("Error en initialFetchAndSetup:", error);
            elements.initialWelcomeMessage.querySelector('span').textContent = `Error: ${error.message}. Recargue la página.`;
        }
    }

    function setupEventListeners() {
        elements.rateForm.addEventListener('submit', handleInitialRateSubmit);
        elements.storeButtonsContainer.addEventListener('click', handleStoreSelection);
        elements.bcvRateDisplay.addEventListener('click', handleRateClick);
        elements.offerToggle.addEventListener('change', handleOfferToggle);
        elements.searchInput.addEventListener('input', handleSearchInput);
        elements.clearSearchBtn.addEventListener('click', handleClearSearch);
        elements.menuTabsContainer.addEventListener('click', (e) => { 
            if (e.target.matches('.menu-button')) {
                state.searchTerm = ''; elements.searchInput.value = ''; elements.clearSearchBtn.style.display = 'none';
                state.activeMenu = e.target.dataset.menu; 
                const tipos = Object.keys(state.storeData[state.activeMenu] || {}).sort((a,b) => a.localeCompare(b));
                state.activeTipo = tipos.length > 0 ? tipos[0] : null; 
                renderUI(); 
            }
        });
        elements.tipoTabsContainer.addEventListener('click', (e) => { 
            if (e.target.matches('.tipo-button')) {
                state.searchTerm = ''; elements.searchInput.value = ''; elements.clearSearchBtn.style.display = 'none';
                state.activeTipo = e.target.dataset.tipo; 
                renderUI(); 
            }
        });
        elements.contentContainer.addEventListener('click', handleContentClick);
        elements.closeDetailModalBtn.addEventListener('click', closeDetailModal);
        elements.productDetailModalOverlay.addEventListener('click', (e) => e.target === elements.productDetailModalOverlay && closeDetailModal());
        
        elements.addToQuoteBtn.addEventListener('click', handleAddToQuote);
        elements.quoteFab.addEventListener('click', () => {
            renderQuoteModal();
            elements.quoteModalOverlay.classList.add('visible');
        });
        elements.closeQuoteModalBtn.addEventListener('click', () => elements.quoteModalOverlay.classList.remove('visible'));
        elements.quoteModalOverlay.addEventListener('click', (e) => e.target === elements.quoteModalOverlay && elements.quoteModalOverlay.classList.remove('visible'));
        elements.quoteContentContainer.addEventListener('click', handleQuoteActions);
        elements.clearQuoteBtn.addEventListener('click', clearQuote);

        elements.downloadQuotePdfBtn.addEventListener('click', () => {
            if (state.quote.length === 0) {
                alert("Añade productos a la cotización antes de generar un PDF.");
                return;
            }
            // Limpia el formulario y muestra el modal de datos del cliente
            elements.clientInfoForm.reset();
            elements.clientInfoModalOverlay.classList.add('visible');
            elements.clientNameInput.focus();
        });

        // Listeners para el nuevo modal de info de cliente
        elements.clientInfoForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const clientName = elements.clientNameInput.value.trim();
            const clientRif = elements.clientRifInput.value.trim();
            
            elements.clientInfoModalOverlay.classList.remove('visible');
            generateQuotePDF(clientName, clientRif);
        });

        const closeClientInfoModal = () => elements.clientInfoModalOverlay.classList.remove('visible');
        elements.closeClientInfoModalBtn.addEventListener('click', closeClientInfoModal);
        elements.cancelClientInfoBtn.addEventListener('click', closeClientInfoModal);
        elements.clientInfoModalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.clientInfoModalOverlay) {
                closeClientInfoModal();
            }
        });
    }

    setupEventListeners();
    initialFetchAndSetup();
});
