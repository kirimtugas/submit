// Utility Functions

/**
 * Formats a Firestore timestamp or Date object to a readable string
 * @param {Date|Object} date - Date object or Firestore Timestamp
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) return '';
    // Handle Firestore Timestamp
    if (date.toDate) {
        date = date.toDate();
    }
    return new Date(date).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Shows a toast notification (simple implementation)
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Basic styles for toast
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '1rem 2rem',
        borderRadius: '4px',
        color: 'white',
        backgroundColor: type === 'error' ? '#b00020' : '#333',
        zIndex: '1000',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        opacity: '0',
        transition: 'opacity 0.3s ease'
    });

    if (type === 'success') toast.style.backgroundColor = '#4caf50';

    document.body.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Toggles visibility of an element
 * @param {string} elementId 
 * @param {boolean} show 
 */
function toggleElement(elementId, show) {
    const el = document.getElementById(elementId);
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}
