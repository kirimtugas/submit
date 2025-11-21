// Student Dashboard Logic

let currentUser = null;
let currentClassId = null;
let currentTaskId = null;

// Check Auth
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify Role & Get User Data
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().role !== 'student') {
        window.location.href = 'index.html';
        return;
    }

    currentUser = doc.data();
    currentUser.uid = user.uid;
    currentClassId = currentUser.classId;

    document.getElementById('user-info').textContent = `Halo, ${currentUser.name}`;
    loadDashboardData();
});

function logout() {
    auth.signOut().then(() => window.location.href = 'index.html');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'tasks': 'Tugas Saya',
        'history': 'Riwayat Pengumpulan'
    };
    document.getElementById('page-title').textContent = titles[tabName];

    if (tabName === 'tasks') loadTasks();
    if (tabName === 'history') loadHistory();
}

// --- Data Loading ---

async function loadDashboardData() {
    if (!currentClassId) return;

    // Get all tasks for this class
    const tasksSnap = await db.collection('tasks')
        .where('assignedClasses', 'array-contains', currentClassId)
        .get();

    // Get all submissions by this student
    const subsSnap = await db.collection('submissions')
        .where('studentId', '==', currentUser.uid)
        .get();

    const submissionsMap = {};
    let totalScore = 0;
    let gradedCount = 0;

    subsSnap.forEach(doc => {
        const data = doc.data();
        submissionsMap[data.taskId] = data;
        if (data.grade !== undefined && data.grade !== null) {
            totalScore += parseInt(data.grade);
            gradedCount++;
        }
    });

    let pending = 0;
    let completed = 0;

    tasksSnap.forEach(doc => {
        if (submissionsMap[doc.id]) {
            completed++;
        } else {
            pending++;
        }
    });

    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-average').textContent = gradedCount > 0 ? Math.round(totalScore / gradedCount) : 0;

    // Load recent tasks
    const recentSubsSnap = await db.collection('submissions')
        .where('studentId', '==', currentUser.uid)
        .orderBy('submittedAt', 'desc')
        .get();

    const recentList = document.getElementById('recent-tasks-list');
    recentList.innerHTML = '';

    if (recentSubsSnap.empty) {
        recentList.innerHTML = '<p>Belum ada riwayat pengumpulan.</p>';
        // We don't return here because we want to finish the function
    } else {
        // Need to fetch task details manually
        const tasksPromises = recentSubsSnap.docs.map(doc => db.collection('tasks').doc(doc.data().taskId).get());
        const tasksDocs = await Promise.all(tasksPromises);
        const tasksMap = {};
        tasksDocs.forEach(doc => tasksMap[doc.id] = doc.data());

        recentSubsSnap.forEach(doc => {
            const sub = doc.data();
            const task = tasksMap[sub.taskId];

            if (!task) return; // Task might be deleted

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <h3>${task.title}</h3>
                    <span style="font-weight: bold; color: ${sub.grade ? 'green' : 'grey'}">
                        Nilai: ${sub.grade !== null ? sub.grade : 'Belum dinilai'}
                    </span>
                </div>
                <p style="color: var(--text-secondary);">Diserahkan: ${formatDate(sub.submittedAt)}</p>
            `;
            recentList.appendChild(div);
        });
    }
}

// --- Actions ---

async function loadTasks(isRecent = false) {
    const containerId = isRecent ? 'recent-tasks-list' : 'active-tasks-list';
    const list = document.getElementById(containerId);
    if (!list) return;

    list.innerHTML = '<p>Loading...</p>';

    try {
        // DEBUG: Show what we are querying
        if (!isRecent) {
            console.log(`Querying tasks for classId: ${currentClassId}`);
        }

        const tasksSnap = await db.collection('tasks')
            .where('assignedClasses', 'array-contains', currentClassId)
            .orderBy('deadline', 'asc')
            .get();

        list.innerHTML = '';

        if (tasksSnap.empty) {
            list.innerHTML = `<p>Tidak ada tugas aktif.</p>`;
            if (!isRecent) {
                list.innerHTML += `
                <small style="color: #999; display: block; margin-top: 1rem;">
                    Debug Info:<br>
                    Class ID: ${currentClassId}<br>
                    Tasks Found: 0
                </small>`;
            }
            return;
        }

        // Get submissions to check status
        const subsSnap = await db.collection('submissions')
            .where('studentId', '==', currentUser.uid)
            .get();
        const submissionsMap = {};
        subsSnap.forEach(doc => submissionsMap[doc.data().taskId] = doc.data());

        tasksSnap.forEach(doc => {
            const task = doc.data();
            const sub = submissionsMap[doc.id];

            // Filter for "Active Tasks" tab: show only if not submitted
            if (!isRecent && sub) return;

            const isLate = new Date(task.deadline) < new Date();
            const statusHtml = sub
                ? `<span class="task-status status-submitted">Diserahkan</span>`
                : (isLate ? `<span class="task-status status-late">Terlambat</span>` : `<span class="task-status status-pending">Belum Dikerjakan</span>`);

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${task.title}</h3>
                    ${statusHtml}
                </div>
                <p style="color: var(--text-secondary); margin: 0.5rem 0;">Deadline: ${formatDate(task.deadline)}</p>
                <button class="btn btn-primary" onclick="openTaskDetail('${doc.id}')">Lihat Detail</button>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error("Error loading tasks:", error);
        list.innerHTML = `<p style="color: red;">Gagal memuat tugas: ${error.message}</p>`;
        if (error.code === 'failed-precondition') {
            showToast('Perlu membuat Index Firestore. Cek Console browser.', 'error');
        }
    }
}

async function loadHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '<p>Loading...</p>';

    const subsSnap = await db.collection('submissions')
        .where('studentId', '==', currentUser.uid)
        .orderBy('submittedAt', 'desc')
        .get();

    list.innerHTML = '';

    if (subsSnap.empty) {
        list.innerHTML = '<p>Belum ada riwayat pengumpulan.</p>';
        return;
    }

    // Need to fetch task details manually
    const tasksPromises = subsSnap.docs.map(doc => db.collection('tasks').doc(doc.data().taskId).get());
    const tasksDocs = await Promise.all(tasksPromises);
    const tasksMap = {};
    tasksDocs.forEach(doc => tasksMap[doc.id] = doc.data());

    subsSnap.forEach(doc => {
        const sub = doc.data();
        const task = tasksMap[sub.taskId];

        if (!task) return; // Task might be deleted

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <h3>${task.title}</h3>
                <span style="font-weight: bold; color: ${sub.grade ? 'green' : 'grey'}">
                    Nilai: ${sub.grade !== null ? sub.grade : 'Belum dinilai'}
                </span>
            </div>
            <p style="color: var(--text-secondary);">Diserahkan: ${formatDate(sub.submittedAt)}</p>
            ${sub.teacherComment ? `<p style="background: #eee; padding: 0.5rem; margin-top: 0.5rem; border-radius: 4px;">Feedback: ${sub.teacherComment}</p>` : ''}
        `;
        list.appendChild(div);
    });
}

// --- Actions ---

async function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    const task = taskDoc.data();

    document.getElementById('detail-title').textContent = task.title;
    document.getElementById('detail-deadline').textContent = `Deadline: ${formatDate(task.deadline)}`;
    document.getElementById('detail-desc').textContent = task.description;

    // Check if already submitted
    const subQuery = await db.collection('submissions')
        .where('studentId', '==', currentUser.uid)
        .where('taskId', '==', taskId)
        .get();

    const formContainer = document.getElementById('submission-form-container');
    const gradeContainer = document.getElementById('grade-view-container');
    const contentInput = document.getElementById('submission-content');

    if (!subQuery.empty) {
        const sub = subQuery.docs[0].data();
        contentInput.value = sub.content;
        contentInput.disabled = true;

        if (sub.grade !== null) {
            formContainer.classList.add('hidden');
            gradeContainer.classList.remove('hidden');
            document.getElementById('grade-score').textContent = sub.grade;
            document.getElementById('grade-comment').textContent = sub.teacherComment || '-';
        } else {
            formContainer.classList.remove('hidden');
            gradeContainer.classList.add('hidden');
            // Change button to "Update" or disable it? Let's disable for simplicity
            document.querySelector('#submission-form-container button.btn-primary').textContent = 'Sudah Diserahkan';
            document.querySelector('#submission-form-container button.btn-primary').disabled = true;
        }
    } else {
        contentInput.value = '';
        contentInput.disabled = false;
        formContainer.classList.remove('hidden');
        gradeContainer.classList.add('hidden');
        document.querySelector('#submission-form-container button.btn-primary').textContent = 'Kirim';
        document.querySelector('#submission-form-container button.btn-primary').disabled = false;
    }

    toggleElement('modal-task-detail', true);
}

async function submitTask() {
    const content = document.getElementById('submission-content').value;
    if (!content) {
        showToast('Mohon isi jawaban', 'error');
        return;
    }

    try {
        await db.collection('submissions').add({
            taskId: currentTaskId,
            studentId: currentUser.uid,
            studentName: currentUser.name,
            content: content,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            grade: null,
            teacherComment: null
        });

        showToast('Tugas berhasil dikumpulkan!', 'success');
        toggleElement('modal-task-detail', false);
        loadDashboardData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}
