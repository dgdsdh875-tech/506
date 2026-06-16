// قاعدة بيانات تتضمن الفئات الآن
let db = { products: [], customers: [], cart: [], invoices: [], categories: [] };

// استرجاع البيانات من التخزين المحلي (مع حماية تهيئة البيانات لحل مشكلة عدم الظهور)
if (localStorage.getItem('pos_db_abu_amir')) {
    try {
        let savedDb = JSON.parse(localStorage.getItem('pos_db_abu_amir'));
        if(savedDb) {
            db.products = savedDb.products || [];
            db.customers = savedDb.customers || [];
            db.cart = savedDb.cart || [];
            db.invoices = savedDb.invoices || [];
            db.categories = savedDb.categories || [];
            
            // محاولة ضغط الصور القديمة الكبيرة لتقليل المساحة
            let needsSave = false;
            db.products.forEach(p => {
                if (p.img && p.img.length > 200000) {
                    let img = new Image();
                    img.onload = function() {
                        let canvas = document.createElement('canvas');
                        let ctx = canvas.getContext('2d');
                        let MAX_WIDTH = 300; let MAX_HEIGHT = 300;
                        let width = img.width; let height = img.height;
                        if (width > height) {
                            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                        } else {
                            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                        }
                        canvas.width = width; canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        p.img = canvas.toDataURL('image/jpeg', 0.6);
                        saveLocal();
                    };
                    img.src = p.img;
                    needsSave = true;
                }
            });
        }
    } catch(e) { console.error("خطأ في قراءة البيانات", e); }
}

// دالة لحفظ أي تغيير جديد محلياً فوراً
function saveLocal() {
    try {
        localStorage.setItem('pos_db_abu_amir', JSON.stringify(db));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.error("Quota Exceeded!");
            customAlert("مساحة التخزين ممتلئة! يرجى أخذ نسخة احتياطية ومسح المتصفح أو مسح بعض المنتجات القديمة.");
        } else {
            console.error("خطأ في الحفظ", e);
        }
    }
}

let activeCategoryFilter = 'الكل'; // متغير لتتبع الفئة المحددة

// ==========================================
// 1. المظهر والنسخ الاحتياطي
// ==========================================
let isLightMode = false;
function toggleTheme() {
    isLightMode = !isLightMode;
    document.body.classList.toggle('light-mode', isLightMode);
    document.getElementById('themeToggleBtn').innerHTML = isLightMode ? '<i class="fas fa-sun"></i> المظهر: نهاري' : '<i class="fas fa-moon"></i> المظهر: ليلي (أساسي)';
}

function exportBackup() {
    let dataStr = JSON.stringify(db);
    let dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'backup_sales_app.json');
    document.body.appendChild(linkElement); linkElement.click(); document.body.removeChild(linkElement);
    customAlert('تم تحميل النسخة الاحتياطية بنجاح!');
}

function importBackup() { document.getElementById('backupInput').click(); }
document.getElementById('backupInput').addEventListener('change', function(event) {
    let file = event.target.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let importedDb = JSON.parse(e.target.result);
            if(importedDb && importedDb.products) {
                db.products = importedDb.products || [];
                db.customers = importedDb.customers || [];
                db.cart = importedDb.cart || [];
                db.invoices = importedDb.invoices || [];
                db.categories = importedDb.categories || [];
                saveLocal(); 
                renderCategories(); renderProducts(); renderCustomers(); updateCartCustomerSelect(); updateCartUI();
                customAlert('تم استعادة النسخة الاحتياطية بنجاح!');
            }
        } catch(err) { customAlert('حدث خطأ أثناء قراءة الملف!'); }
    };
    reader.readAsText(file); event.target.value = '';
});

// ==========================================
// 2. التحكم بالنوافذ والتنقل
// ==========================================
function switchTab(tabId, navElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(navElement) navElement.classList.add('active');
}
function triggerFlip(btn, callback) {
    btn.classList.add('flip-animate');
    setTimeout(() => { btn.classList.remove('flip-animate'); if(callback) callback(); }, 400);
}
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ==========================================
// 3. إدارة الفئات
// ==========================================
function saveCategory() {
    let name = document.getElementById('newCategoryName').value;
    if(!name) { customAlert('يرجى إدخال اسم الفئة'); return; }
    db.categories.push({ id: Date.now(), name: name });
    saveLocal();
    document.getElementById('newCategoryName').value = '';
    renderCategories();
}

function deleteCategory(id) {
    db.categories = db.categories.filter(c => c.id !== id);
    if(activeCategoryFilter !== 'الكل' && !db.categories.find(c => c.name === activeCategoryFilter)) {
        activeCategoryFilter = 'الكل';
    }
    saveLocal();
    renderCategories();
    renderProducts();
}

function editCategory(id) {
    let cat = db.categories.find(c => c.id == id);
    customPrompt('تعديل اسم الفئة:', cat.name, function(newVal) {
        if(newVal) { 
            if(activeCategoryFilter === cat.name) activeCategoryFilter = newVal;
            cat.name = newVal; 
            saveLocal();
            renderCategories(); 
            renderProducts();
        }
    });
}

function filterProducts(category, element) {
    activeCategoryFilter = category;
    document.querySelectorAll('#pos-categories-pills .pill').forEach(p => p.classList.remove('active'));
    if(element) element.classList.add('active');
    renderProducts();
}

function renderCategories() {
    const listModal = document.getElementById('categories-list-modal');
    listModal.innerHTML = '';
    if(db.categories.length === 0) listModal.innerHTML = '<p style="text-align:center; color:var(--text-muted);">لا توجد فئات.</p>';
    db.categories.forEach(c => {
        listModal.innerHTML += `
            <div class="category-row">
                <strong>${c.name}</strong>
                <div class="action-btns" style="margin:0;">
                    <button class="btn-3d btn-blue" style="padding:6px 12px;" onclick="triggerFlip(this, () => editCategory(${c.id}))"><i class="fas fa-pen"></i></button>
                    <button class="btn-3d btn-red" style="padding:6px 12px;" onclick="triggerFlip(this, () => deleteCategory(${c.id}))"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    });

    const select = document.getElementById('newProdCategory');
    select.innerHTML = '<option value="">اختر الفئة...</option>';
    db.categories.forEach(c => { select.innerHTML += `<option value="${c.name}">${c.name}</option>`; });

    const pills = document.getElementById('pos-categories-pills');
    pills.innerHTML = `<div class="pill ${activeCategoryFilter === 'الكل' ? 'active' : ''}" onclick="filterProducts('الكل', this)">الكل</div>`;
    db.categories.forEach(c => { 
        pills.innerHTML += `<div class="pill ${activeCategoryFilter === c.name ? 'active' : ''}" onclick="filterProducts('${c.name}', this)">${c.name}</div>`; 
    });
}

// ==========================================
// 4. إدارة المنتجات 
// ==========================================
let tempProdImg = "";
document.getElementById('newProdImg').addEventListener('change', function(e) {
    let file = e.target.files[0];
    if(file) {
        let reader = new FileReader();
        reader.onload = function(evt) {
            let img = new Image();
            img.onload = function() {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');
                let MAX_WIDTH = 300;
                let MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                tempProdImg = canvas.toDataURL('image/jpeg', 0.6);
                document.getElementById('prodImgPreview').innerHTML = `<img src="${tempProdImg}" style="width:100%; height:100%; object-fit:cover; border-radius:15px;">`;
            }
            img.src = evt.target.result;
        }
        reader.readAsDataURL(file);
    }
});

function openAddProductModal() {
    document.getElementById('productModalTitle').innerText = 'إضافة منتج';
    document.getElementById('editProdId').value = '';
    document.getElementById('newProdName').value = '';
    document.getElementById('newProdPrice').value = '';
    document.getElementById('newProdCategory').value = '';
    tempProdImg = '';
    document.getElementById('prodImgPreview').innerHTML = '<i class="fas fa-camera"></i>';
    openModal('addProductModal');
}

function openEditProduct(id) {
    let p = db.products.find(x => x.id == id);
    document.getElementById('productModalTitle').innerText = 'تعديل منتج';
    document.getElementById('editProdId').value = p.id;
    document.getElementById('newProdName').value = p.name;
    document.getElementById('newProdPrice').value = p.price;
    document.getElementById('newProdCategory').value = p.category || '';
    
    tempProdImg = p.img;
    if(p.img && !p.img.includes('No+Image')) {
        document.getElementById('prodImgPreview').innerHTML = `<img src="${p.img}" style="width:100%; height:100%; object-fit:cover; border-radius:15px;">`;
    } else {
        document.getElementById('prodImgPreview').innerHTML = '<i class="fas fa-camera"></i>';
    }
    openModal('addProductModal');
}

function saveProduct() {
    let name = document.getElementById('newProdName').value;
    let price = parseFloat(document.getElementById('newProdPrice').value);
    let category = document.getElementById('newProdCategory').value;
    let editId = document.getElementById('editProdId').value;

    if(!name || isNaN(price)) { customAlert('يرجى إدخال اسم وسعر المنتج بشكل صحيح.'); return; }
    
    let imgToSave = tempProdImg || 'https://placehold.co/400x400/2a2a2a/ffffff/png?text=No+Image';

    if(editId) {
        let p = db.products.find(x => x.id == editId);
        p.name = name; p.price = price; p.category = category; p.img = imgToSave;
        
        let c = db.cart.find(x => x.id == editId);
        if(c) { c.name = name; c.price = price; updateCartUI(); }
        
        customAlert('تم تعديل المنتج بنجاح!');
    } else {
        db.products.push({ id: Date.now(), name: name, price: price, category: category, img: imgToSave });
        customAlert('تم إضافة المنتج بنجاح!');
    }
    
    saveLocal();
    renderProducts(); closeModal('addProductModal');
}

function deleteProduct(id) {
    db.products = db.products.filter(p => p.id != id);
    db.cart = db.cart.filter(c => c.id != id);
    saveLocal();
    renderProducts(); updateCartUI(); customAlert('تم حذف المنتج بنجاح!');
}

function renderProducts() {
    const posGrid = document.getElementById('pos-products-grid');
    const adminGrid = document.getElementById('admin-products-grid');
    posGrid.innerHTML = ''; adminGrid.innerHTML = '';

    if(db.products.length === 0) {
        posGrid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--text-muted);">لا توجد منتجات حالياً.</p>';
        adminGrid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--text-muted);">لا توجد منتجات حالياً.</p>';
        return;
    }

    let posHasProducts = false;

    db.products.forEach(p => {
        let catBadge = p.category ? `<div style="font-size:11px; color:var(--text-muted); margin-bottom:5px;">${p.category}</div>` : '';
        
        adminGrid.innerHTML += `
            <div class="card">
                <img src="${p.img}" alt="صورة">
                <h3>${p.name}</h3>
                ${catBadge}
                <div class="price">${p.price.toLocaleString()} د.ع</div>
                <div class="action-btns" style="margin-top: auto;">
                    <button class="btn-3d btn-blue" style="padding: 8px;" onclick="triggerFlip(this, () => openEditProduct(${p.id}))"><i class="fas fa-pen"></i></button>
                    <button class="btn-3d btn-red" style="padding: 8px;" onclick="triggerFlip(this, () => deleteProduct(${p.id}))"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;

        if (activeCategoryFilter === 'الكل' || p.category === activeCategoryFilter) {
            posHasProducts = true;
            let cartItem = db.cart.find(c => c.id == p.id);
            let posActionHtml = '';
            
            if(cartItem) {
                posActionHtml = `
                <div style="font-size: 12px; color: var(--primary-green); margin-top: 5px; font-weight: bold;">الإجمالي: ${(p.price * cartItem.qty).toLocaleString()} د.ع</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; gap: 5px;">
                    <button class="btn-3d btn-red" style="width: 40px; padding: 5px;" onclick="changeQtyById(${p.id}, -1)">-</button>
                    <span style="font-weight: bold; font-size: 18px; cursor: pointer; border-bottom: 1px dashed var(--primary-green);" onclick="editQtyById(${p.id})">${cartItem.qty}</span>
                    <button class="btn-3d btn-blue" style="width: 40px; padding: 5px;" onclick="changeQtyById(${p.id}, 1)">+</button>
                </div>`;
            } else {
                posActionHtml = `<button class="btn-3d btn-green" style="margin-top: 10px; width: 100%;" onclick="triggerFlip(this, () => addToCart(${p.id}))"><i class="fas fa-cart-plus"></i> أضف للسلة</button>`;
            }

            posGrid.innerHTML += `
                <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
                    <button onclick="addToCart(${p.id})" style="background: transparent; border: none; padding: 0; margin: 0; width: 100%; text-align: right; color: inherit; cursor: pointer; flex: 1; user-select: none; -webkit-tap-highlight-color: transparent; display: block;">
                        <img src="${p.img}" alt="صورة" style="pointer-events: none;">
                        <h3 style="pointer-events: none;">${p.name}</h3>
                        <div style="pointer-events: none;">${catBadge}</div>
                        <div class="price" style="pointer-events: none;">${p.price.toLocaleString()} د.ع</div>
                    </button>
                    <div>${posActionHtml}</div>
                </div>`;
        }
    });

    if (!posHasProducts && db.products.length > 0) {
        posGrid.innerHTML = '<p style="grid-column: span 2; text-align: center; color: var(--text-muted); margin-top: 20px;">لا توجد منتجات مسجلة في هذه الفئة.</p>';
    }
}

// ==========================================
// 5. إدارة الزبائن
// ==========================================
function saveCustomer() {
    let name = document.getElementById('newCustName').value;
    let phone = document.getElementById('newCustPhone').value;
    if(!name) { customAlert('يرجى إدخال اسم الزبون.'); return; }
    
    db.customers.push({ id: Date.now(), name: name, phone: phone });
    saveLocal();
    renderCustomers(); updateCartCustomerSelect(); closeModal('addCustomerModal'); customAlert('تم حفظ الزبون بنجاح!');
    document.getElementById('newCustName').value = ''; document.getElementById('newCustPhone').value = '';
}

function renderCustomers() {
    const list = document.getElementById('customers-list'); list.innerHTML = '';
    if(db.customers.length === 0) { list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">لا يوجد زبائن حالياً.</p>'; return; }

    db.customers.forEach(c => {
        list.innerHTML += `
            <div class="card" style="text-align: right; display: flex; flex-direction: row; justify-content: space-between; align-items: center; margin-bottom: 10px; cursor: pointer;" onclick="openLedger('${c.name}', ${c.id})">
                <div>
                    <h3 style="margin: 0; color: var(--primary-green);"><i class="fas fa-user"></i> ${c.name}</h3>
                    <span style="font-size: 12px; color: var(--text-muted);">${c.phone}</span>
                </div>
            </div>`;
    });
}

function updateCartCustomerSelect() {
    let select = document.getElementById('cart-customer');
    select.innerHTML = '<option value="">اختر الزبون... (أو نقدي)</option>';
    db.customers.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
}


// ==========================================
// 6. نظام السلة والحفظ والتصدير
// ==========================================
function addToCart(productId) {
    let product = db.products.find(p => p.id == productId);
    let existing = db.cart.find(c => c.id == productId);
    if(existing) { existing.qty++; } else { db.cart.push({ ...product, qty: 1 }); }
    saveLocal();
    updateCartUI(); 
}

function changeQtyById(productId, change) {
    let index = db.cart.findIndex(c => c.id == productId);
    if (index !== -1) {
        changeQty(index, change);
    }
}

function editQtyById(productId) {
    let index = db.cart.findIndex(c => c.id == productId);
    if (index !== -1) {
        customPrompt("أدخل الكمية الجديدة لـ " + db.cart[index].name + ":", db.cart[index].qty, function(newQty) {
            if(newQty && !isNaN(newQty)) { 
                let parsedQty = parseInt(newQty);
                if (parsedQty > 0) {
                    db.cart[index].qty = parsedQty;
                } else {
                    db.cart.splice(index, 1);
                }
                saveLocal();
                updateCartUI(); 
            }
        });
    }
}

function updateCartUI() {
    let totalQty = db.cart.reduce((sum, item) => sum + item.qty, 0);
    let totalPrice = db.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    document.getElementById('cart-count').innerText = totalQty; document.getElementById('cart-modal-count').innerText = totalQty;
    document.getElementById('cart-total').innerText = totalPrice.toLocaleString() + ' د.ع';

    let container = document.getElementById('cart-items-container'); container.innerHTML = '';
    db.cart.forEach((item, index) => {
        container.innerHTML += `
            <div class="cart-item">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 15px; margin-bottom: 5px;">${item.name}</div>
                    <div style="font-size: 13px; color: var(--text-muted);">السعر: <span class="editable-price" onclick="editPrice(${index})">${item.price.toLocaleString()}</span></div>
                </div>
                <div class="cart-item-controls">
                    <button onclick="changeQty(${index}, -1)">-</button><span>${item.qty}</span><button onclick="changeQty(${index}, 1)">+</button>
                    <i class="fas fa-trash" style="color: #ff4d4d; margin-right: 10px; cursor: pointer; font-size: 18px;" onclick="removeFromCart(${index})"></i>
                </div>
            </div>`;
    });
    
    renderProducts();
}

function changeQty(index, change) { db.cart[index].qty += change; if(db.cart[index].qty <= 0) db.cart.splice(index, 1); saveLocal(); updateCartUI(); }
function removeFromCart(index) { db.cart.splice(index, 1); saveLocal(); updateCartUI(); }
function editPrice(index) {
    customPrompt("أدخل السعر الجديد لـ " + db.cart[index].name + ":", db.cart[index].price, function(newPrice) {
        if(newPrice && !isNaN(newPrice)) { db.cart[index].price = parseFloat(newPrice); saveLocal(); updateCartUI(); }
    });
}

function selectPayment(btn) {
    document.querySelectorAll('.payment-btn').forEach(b => { b.classList.remove('active'); b.style.background = 'var(--input-bg)'; b.style.color = 'var(--text-light)'; });
    btn.classList.add('active'); btn.style.background = btn.getAttribute('data-color'); btn.style.color = (btn.getAttribute('data-status') === 'مدفوع') ? '#000' : '#fff';
}

function saveOrderAndShowDetails() {
    if(db.cart.length === 0) { customAlert("السلة فارغة!"); return; }
    
    let custSelect = document.getElementById('cart-customer');
    let custName = custSelect.value ? custSelect.options[custSelect.selectedIndex].text : "زبون نقدي";
    let custPhone = "";
    if(custSelect.value) { let c = db.customers.find(x => x.id == custSelect.value); if(c) custPhone = c.phone; }

    let statusBtn = document.querySelector('.payment-btn.active');
    let status = statusBtn ? statusBtn.getAttribute('data-status') : "مدفوع";
    let statusColor = statusBtn ? statusBtn.getAttribute('data-color') : "var(--primary-green)";
    
    let total = db.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let orderId = Math.floor(Math.random() * 9000) + 1000;
    
    let date = new Date();
    let dateString = date.toLocaleDateString('ar-IQ');
    let timeString = date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

    let order = { id: orderId, customer: custName, phone: custPhone, date: dateString, time: timeString, status: status, statusColor: statusColor, total: total, items: [...db.cart] };
    
    db.invoices.push(order); db.cart = []; saveLocal(); updateCartUI(); closeModal('cartModal');
    showOrderDetails(order);
}

function showOrderDetails(order) {
    document.getElementById('od-id').innerText = "طلب #" + order.id;
    document.getElementById('od-status').innerText = order.status; document.getElementById('od-status').style.background = order.statusColor;
    document.getElementById('od-cust').innerText = order.customer;
    document.getElementById('od-datetime').innerText = order.date + " | " + order.time;
    document.getElementById('od-total').innerText = order.total.toLocaleString() + " د.ع";
    document.getElementById('od-grand-total').innerText = order.total.toLocaleString() + " د.ع";

    let itemsHtml = "";
    order.items.forEach(item => {
        let itemTotal = item.price * item.qty;
        itemsHtml += `<div class="order-item-row"><span>${item.name} <span style="color:var(--text-muted); font-size:11px;">x${item.qty}</span></span><span>${itemTotal.toLocaleString()} د.ع</span></div>`;
    });
    document.getElementById('od-items-list').innerHTML = itemsHtml;

    document.getElementById('btn-export-pdf').onclick = () => { triggerFlip(document.getElementById('btn-export-pdf'), () => exportToPDF(order)); };
    document.getElementById('btn-share-wa').onclick = () => { triggerFlip(document.getElementById('btn-share-wa'), () => shareWhatsApp(order)); };
    document.getElementById('btn-delete-order').onclick = () => { triggerFlip(document.getElementById('btn-delete-order'), () => { db.invoices = db.invoices.filter(i => i.id != order.id); saveLocal(); closeModal('orderDetailsModal'); customAlert('تم حذف الطلب نهائياً!'); }); };

    openModal('orderDetailsModal');
}

function exportToPDF(order) {
    let printWindow = window.open('', '_blank'); let itemsRows = "";
    order.items.forEach((item, i) => { itemsRows += `<tr><td style="border:1px solid #ddd; padding:8px;">${i+1}</td><td style="border:1px solid #ddd; padding:8px;">${item.name}</td><td style="border:1px solid #ddd; padding:8px;">${item.qty}</td><td style="border:1px solid #ddd; padding:8px;">${item.price.toLocaleString()}</td><td style="border:1px solid #ddd; padding:8px;">${(item.price * item.qty).toLocaleString()}</td></tr>`; });

    let html = `
    <html dir="rtl" lang="ar">
    <head><title>فاتورة #${order.id}</title><style> body{font-family: Arial; padding:20px;} table{width:100%; border-collapse:collapse; margin-top:20px; text-align:center;} th{background:#f2f2f2; border:1px solid #ddd; padding:10px;} </style></head>
    <body onload="window.print(); window.close();">
        <h2 style="text-align:center;">فاتورة مبيعات</h2>
        <div style="display:flex; justify-content:space-between; margin-top:30px;"><div><strong>رقم الفاتورة:</strong> ${order.id}</div><div><strong>التاريخ:</strong> ${order.date} - ${order.time}</div></div>
        <div style="margin-top:10px;"><strong>العميل:</strong> ${order.customer}</div>
        <table><tr><th>ت</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>${itemsRows}</table>
        <h3 style="text-align:left; margin-top:20px;">الإجمالي الكلي: ${order.total.toLocaleString()} د.ع</h3>
        <p style="text-align:left;">حالة الدفع: ${order.status}</p>
    </body></html>`;
    printWindow.document.write(html); printWindow.document.close();
}

function shareWhatsApp(order) {
    let text = `*فاتورة مبيعات*\nرقم: ${order.id}\nالعميل: ${order.customer}\nالتاريخ: ${order.date} ${order.time}\n\n*المشتريات:*\n`;
    order.items.forEach((item, i) => { text += `${i+1}. ${item.name} - العدد: ${item.qty} - السعر: ${(item.price * item.qty).toLocaleString()} د.ع\n`; });
    text += `\n*الإجمالي الكلي: ${order.total.toLocaleString()} د.ع*\nحالة الدفع: ${order.status}`;
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if(order.phone) url = `https://api.whatsapp.com/send?phone=${order.phone.replace(/^0/, '+964')}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function openLedger(name, custId) {
    document.getElementById('ledger-name').innerText = name;
    let custInvoices = db.invoices.filter(i => i.customer === name);
    let debt = custInvoices.filter(i => i.status !== "مدفوع").reduce((sum, i) => sum + i.total, 0);
    document.getElementById('ledger-debt').innerText = debt.toLocaleString() + " د.ع";
    
    let invHtml = "";
    if(custInvoices.length === 0) { invHtml = `<div class="invoice-row" style="justify-content:center; color:var(--text-muted);">لا توجد معاملات سابقة</div>`; } 
    else {
        custInvoices.forEach(inv => {
            invHtml += `
            <div class="invoice-row">
                <div><strong>فاتورة #${inv.id}</strong><br><span style="font-size: 12px; color: var(--text-muted);">${inv.date} ${inv.time} - ${inv.status}</span></div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-3d btn-blue" style="padding: 8px;" onclick="exportToPDF(${JSON.stringify(inv).replace(/"/g, '&quot;')})"><i class="fas fa-file-pdf"></i></button>
                    <button class="btn-3d" style="padding: 8px; background:#25D366;" onclick="shareWhatsApp(${JSON.stringify(inv).replace(/"/g, '&quot;')})"><i class="fab fa-whatsapp"></i></button>
                </div>
            </div>`;
        });
    }
    document.getElementById('ledger-invoices').innerHTML = invHtml; openModal('customerLedgerModal');
}

// دوال التنبيهات
function customAlert(message) { document.getElementById('customAlertMessage').innerText = message; openModal('customAlertModal'); }
let currentPromptCallback = null;
function customPrompt(message, defaultValue, callback) {
    document.getElementById('customPromptMessage').innerText = message; let inputField = document.getElementById('customPromptInput');
    inputField.value = defaultValue || ''; currentPromptCallback = callback; openModal('customPromptModal'); setTimeout(() => inputField.focus(), 100);
}
document.getElementById('promptConfirmBtn').addEventListener('click', function() {
    let val = document.getElementById('customPromptInput').value; closeModal('customPromptModal'); if(currentPromptCallback) currentPromptCallback(val);
});

// التشغيل المبدئي
renderCategories(); renderProducts(); renderCustomers(); updateCartCustomerSelect(); updateCartUI();
