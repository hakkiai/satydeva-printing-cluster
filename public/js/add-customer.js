document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const customerForm = document.getElementById('customerForm');
    const clearFormBtn = document.getElementById('clearForm');
    const searchResults = document.getElementById('searchResults');
    
    // Search functionality
    searchBtn.addEventListener('click', async () => {
        const searchTerm = document.getElementById('customerSearch').value;
        if (!searchTerm) return;

        try {
            const response = await fetch(`/admin/search-customer?term=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();
            
            if (data.customers.length > 0) {
                displaySearchResults(data.customers);
            } else {
                searchResults.style.display = 'block';
                searchResults.querySelector('#resultContent').innerHTML = '<p>No customers found.</p>';
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    });

    // Form submission
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(customerForm);
        const customerData = Object.fromEntries(formData);

        try {
            const response = await fetch('/admin/save-customer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(customerData)
            });

            const result = await response.json();
            if (result.success) {
                alert(result.message);
                clearForm();
            } else {
                alert(result.message || 'Error saving customer');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Error saving customer');
        }
    });

    // Clear form
    clearFormBtn.addEventListener('click', clearForm);

    function clearForm() {
        customerForm.reset();
        document.getElementById('customerId').value = '';
        searchResults.style.display = 'none';
    }

    function displaySearchResults(customers) {
        searchResults.style.display = 'block';
        const resultContent = searchResults.querySelector('#resultContent');
        resultContent.innerHTML = customers.map(customer => `
            <div class="customer-card">
                <div class="customer-card-info">
                    <h4>${customer.name}</h4>
                    <p>Firm: ${customer.firm_name}</p>
                    <p>Email: ${customer.email || 'N/A'}</p>
                    <p>Phone: ${customer.phone_number || 'N/A'}</p>
                </div>
                <button class="edit-btn" onclick="editCustomer(${JSON.stringify(customer)})">
                    Edit Customer
                </button>
            </div>
        `).join('');
    }

    window.editCustomer = function(customer) {
        document.getElementById('customerId').value = customer.id;
        document.getElementById('name').value = customer.name;
        document.getElementById('firmName').value = customer.firm_name;
        document.getElementById('firmLocation').value = customer.firm_location;
        document.getElementById('gstNumber').value = customer.gst_number;
        document.getElementById('email').value = customer.email || '';
        document.getElementById('phone').value = customer.phone_number || '';
        document.getElementById('address').value = customer.address || '';
    };
}); 