document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const vendorForm = document.getElementById('vendorForm');
    const clearFormBtn = document.getElementById('clearForm');
    const searchResults = document.getElementById('searchResults');
    
    // Search functionality
    searchBtn.addEventListener('click', async () => {
        const searchTerm = document.getElementById('vendorSearch').value;
        if (!searchTerm) return;

        try {
            const response = await fetch(`/admin/search-vendor?term=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();
            
            if (data.vendors.length > 0) {
                displaySearchResults(data.vendors);
            } else {
                searchResults.style.display = 'block';
                searchResults.querySelector('#resultContent').innerHTML = '<p>No vendors found.</p>';
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    });

    // Form submission
    vendorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(vendorForm);
        const vendorData = Object.fromEntries(formData);

        try {
            const response = await fetch('/admin/save-vendor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(vendorData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                clearForm();
            } else {
                alert(result.message || 'Error saving vendor');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Error saving vendor');
        }
    });

    // Clear form
    clearFormBtn.addEventListener('click', clearForm);

    function clearForm() {
        vendorForm.reset();
        document.getElementById('vendorId').value = '';
        searchResults.style.display = 'none';
    }

    function displaySearchResults(vendors) {
        searchResults.style.display = 'block';
        const resultContent = searchResults.querySelector('#resultContent');
        resultContent.innerHTML = vendors.map(vendor => `
            <div class="vendor-card">
                <div class="vendor-card-info">
                    <h4>${vendor.name}</h4>
                    <p>Email: ${vendor.email || 'N/A'}</p>
                    <p>Phone: ${vendor.phone_number || 'N/A'}</p>
                    <p>GST: ${vendor.gst_number}</p>
                </div>
                <button class="edit-btn" onclick="editVendor(${JSON.stringify(vendor)})">
                    Edit Vendor
                </button>
            </div>
        `).join('');
    }

    window.editVendor = function(vendor) {
        document.getElementById('vendorId').value = vendor.id;
        document.getElementById('name').value = vendor.name;
        document.getElementById('email').value = vendor.email || '';
        document.getElementById('phone').value = vendor.phone_number || '';
        document.getElementById('gstNumber').value = vendor.gst_number;
        document.getElementById('hsnNumber').value = vendor.hsn_number || '';
    };
}); 