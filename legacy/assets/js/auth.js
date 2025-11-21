// Authentication Logic

let currentRole = 'student'; // 'student' or 'teacher'
let isLoginMode = true;

// UI Elements
const btnStudent = document.getElementById('btn-role-student');
const btnTeacher = document.getElementById('btn-role-teacher');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const formTitle = document.getElementById('form-title');
const regFormTitle = document.getElementById('reg-form-title');
const teacherCodeGroup = document.getElementById('teacher-code-group');
const classSelectGroup = document.getElementById('class-select-group');

/**
 * Sets the current role (Student/Teacher) and updates UI
 * @param {string} role 
 */
function setRole(role) {
    currentRole = role;

    // Update Buttons
    if (role === 'student') {
        btnStudent.className = 'btn btn-primary';
        btnTeacher.className = 'btn btn-outline';
        teacherCodeGroup.classList.add('hidden');
        classSelectGroup.classList.remove('hidden');
    } else {
        btnStudent.className = 'btn btn-outline';
        btnTeacher.className = 'btn btn-primary';
        teacherCodeGroup.classList.remove('hidden');
        classSelectGroup.classList.add('hidden');
    }

    // Update Titles
    updateTitles();
}

/**
 * Toggles between Login and Register forms
 */
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
    updateTitles();
}

function updateTitles() {
    const roleText = currentRole === 'student' ? 'Siswa' : 'Guru';
    formTitle.textContent = `Login ${roleText}`;
    regFormTitle.textContent = `Daftar ${roleText}`;
}

// Event Listeners for Forms
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        // Role check and redirection will be handled by auth state observer
        console.log('Logged in:', userCredential.user.uid);
    } catch (error) {
        showToast(error.message, 'error');
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;

    // Teacher Verification
    if (currentRole === 'teacher') {
        const code = document.getElementById('teacher-code').value;
        if (code !== 'weLoveMB2!') {
            showToast('Kode verifikasi guru salah!', 'error');
            return;
        }
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save additional user data to Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: currentRole,
            classId: currentRole === 'student' ? document.getElementById('reg-class').value : null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Registrasi berhasil!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Load Classes for Registration
async function loadClasses() {
    const select = document.getElementById('reg-class');
    // Keep the default option
    select.innerHTML = '<option value="">-- Pilih Kelas --</option>';

    try {
        const snapshot = await db.collection('classes').orderBy('name').get();
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading classes:", error);
        // Fail silently or show toast? Silent is better for initial load
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadClasses();
});

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Get user role from Firestore
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const userData = doc.data();
            if (userData.role === 'teacher') {
                window.location.href = 'teacher.html';
            } else {
                window.location.href = 'student.html';
            }
        }
    }
});
