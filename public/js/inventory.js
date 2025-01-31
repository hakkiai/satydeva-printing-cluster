document.addEventListener('DOMContentLoaded', () => {
    const addItemBtn = document.getElementById('addItemBtn');
    const addItemForm = document.getElementById('addItemForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const categorySelect = document.getElementById('category');
    const subcategorySelect = document.getElementById('subcategory');
    const itemSelect = document.getElementById('item');
    const inventoryForm = document.getElementById('inventoryForm');
    const vendorSearch = document.getElementById('vendorSearch');
    const vendorSearchResults = document.getElementById('vendorSearchResults');
    const selectedVendorInfo = document.getElementById('selectedVendorInfo');
    const addItemSection = document.getElementById('addItemSection');
    let selectedVendorId = null;

    // Show/Hide form
    addItemBtn.addEventListener('click', () => {
        addItemForm.style.display = 'block';
        addItemBtn.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        addItemForm.style.display = 'none';
        addItemBtn.style.display = 'block';
        inventoryForm.reset();
    });

    // Load subcategories when category is selected
    categorySelect.addEventListener('change', async () => {
        const categoryId = categorySelect.value;
        subcategorySelect.disabled = !categoryId;
        itemSelect.disabled = true;
        itemSelect.innerHTML = '<option value="">Select Item</option>';
        
        if (!categoryId) {
            subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
            return;
        }

        try {
            const response = await fetch(`/admin/inventory/subcategories/${categoryId}`);
            const data = await response.json();

            subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
            data.subcategories.forEach(subcat => {
                subcategorySelect.innerHTML += `
                    <option value="${subcat.id}">${subcat.name}</option>
                `;
            });
        } catch (error) {
            console.error('Error loading subcategories:', error);
        }
    });

    // Load items when subcategory is selected
    subcategorySelect.addEventListener('change', async () => {
        const subcategoryId = subcategorySelect.value;
        itemSelect.disabled = !subcategoryId;
        
        if (!subcategoryId) {
            itemSelect.innerHTML = '<option value="">Select Item</option>';
            return;
        }

        try {
            const response = await fetch(`/admin/inventory/items/${subcategoryId}`);
            const data = await response.json();

            itemSelect.innerHTML = '<option value="">Select Item</option>';
            data.items.forEach(item => {
                itemSelect.innerHTML += `
                    <option value="${item.id}" data-unit="${item.unit}">
                        ${item.name}
                    </option>
                `;
            });
        } catch (error) {
            console.error('Error loading items:', error);
        }
    });

    // Add item selection change event to show the unit
    itemSelect.addEventListener('change', () => {
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        const unit = selectedOption.dataset.unit;
        if (unit) {
            document.getElementById('quantity').placeholder = `Enter quantity (${unit})`;
        }
    });

    // Handle form submission
    inventoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(inventoryForm);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/admin/inventory/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Inventory updated successfully');
                inventoryForm.reset();
                addItemForm.style.display = 'none';
                addItemBtn.style.display = 'block';
                loadInventoryData(selectedVendorId);
            } else {
                alert(result.message || 'Error updating inventory');
            }
        } catch (error) {
            console.error('Error updating inventory:', error);
            alert('Error updating inventory');
        }
    });

    // Update the loadInventoryData function to only show data for selected vendor
    async function loadInventoryData(vendorId) {
        if (!vendorId) return;
        
        try {
            const response = await fetch(`/admin/inventory/vendor/${vendorId}`);
            const data = await response.json();
            
            const tbody = document.getElementById('transactionsTableBody');
            tbody.innerHTML = '';
            
            data.transactions.forEach(transaction => {
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(transaction.created_at).toLocaleDateString()}</td>
                        <td>${transaction.item_name}</td>
                        <td>${transaction.quantity} ${transaction.unit}</td>
                        <td>₹${transaction.price}</td>
                        <td>₹${(transaction.quantity * transaction.price).toFixed(2)}</td>
                    </tr>
                `;
            });
            
            document.getElementById('recentTransactions').style.display = 'block';
        } catch (error) {
            console.error('Error loading transaction data:', error);
        }
    }

    // Vendor search functionality
    vendorSearch.addEventListener('input', debounce(async (e) => {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm.length < 2) {
            vendorSearchResults.style.display = 'none';
            return;
        }

        try {
            const response = await fetch(`/admin/search-vendor?term=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();

            if (data.vendors.length > 0) {
                vendorSearchResults.innerHTML = data.vendors.map(vendor => `
                    <div class="vendor-result-item" data-vendor-id="${vendor.id}">
                        <div>${vendor.name}</div>
                        <small>${vendor.gst_number}</small>
                    </div>
                `).join('');
                vendorSearchResults.style.display = 'block';
            } else {
                vendorSearchResults.innerHTML = '<div class="vendor-result-item">No vendors found</div>';
                vendorSearchResults.style.display = 'block';
            }
        } catch (error) {
            console.error('Error searching vendors:', error);
        }
    }, 300));

    // Update vendor selection handler
    vendorSearchResults.addEventListener('click', async (e) => {
        const vendorItem = e.target.closest('.vendor-result-item');
        if (!vendorItem) return;

        const vendorId = vendorItem.dataset.vendorId;
        if (vendorId === 'none') return;

        try {
            const response = await fetch(`/admin/vendor/${vendorId}`);
            const data = await response.json();

            if (data.success) {
                selectedVendorId = vendorId;
                displaySelectedVendor(data.vendor);
                vendorSearch.style.display = 'none';
                vendorSearchResults.style.display = 'none';
                selectedVendorInfo.style.display = 'block';
                addItemSection.style.display = 'block';
                
                // Load transactions for this vendor
                loadInventoryData(vendorId);
            }
        } catch (error) {
            console.error('Error fetching vendor details:', error);
        }
    });

    // Change vendor button
    document.getElementById('changeVendorBtn').addEventListener('click', () => {
        selectedVendorId = null;
        vendorSearch.value = '';
        vendorSearch.style.display = 'block';
        selectedVendorInfo.style.display = 'none';
        addItemSection.style.display = 'none';
    });

    function displaySelectedVendor(vendor) {
        const vendorDetails = selectedVendorInfo.querySelector('.vendor-details');
        vendorDetails.innerHTML = `
            <p><strong>Name:</strong> ${vendor.name}</p>
            <p><strong>GST:</strong> ${vendor.gst_number}</p>
            <p><strong>Phone:</strong> ${vendor.phone_number || 'N/A'}</p>
        `;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}); 