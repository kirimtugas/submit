// Teacher Dashboard Logic

// Check Auth
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Verify Role
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().role !== 'teacher') {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('user-info').textContent = `Halo, ${doc.data().name}`;
    loadDashboardData();
});

function logout() {
    auth.signOut().then(() => window.location.href = 'index.html');
}

// Tab Switching
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    // Update Nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Update Title
    const titles = {
        'overview': 'Ringkasan',
        'classes': 'Manajemen Kelas',
        'students': 'Daftar Siswa',
        'tasks': 'Daftar Tugas',
        'gradebook': 'Rekap Nilai'
    };
    document.getElementById('page-title').textContent = titles[tabName];

    // Load specific data if needed
    // Load specific data if needed
    if (tabName === 'overview') loadDashboardData();
    if (tabName === 'classes') loadClasses();
    if (tabName === 'students') loadStudents();
    if (tabName === 'tasks') loadTasks();
    if (tabName === 'gradebook') loadGradebook();
}

async function loadDashboardData() {
    try {
        // Stats
        const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
        document.getElementById('stat-students').textContent = studentsSnap.size;

        const classesSnap = await db.collection('classes').get();
        document.getElementById('stat-classes').textContent = classesSnap.size;

        const tasksSnap = await db.collection('tasks').get();
        document.getElementById('stat-tasks').textContent = tasksSnap.size;

        // Pending Grading
        const submissionsSnap = await db.collection('submissions').where('grade', '==', null).get();
        const pendingList = document.getElementById('pending-grading-list');
        if (submissionsSnap.empty) {
            pendingList.innerHTML = '<p class="text-secondary">Tidak ada tugas yang perlu dinilai.</p>';
        } else {
            pendingList.innerHTML = `<p class="text-primary" style="font-weight: 500;">${submissionsSnap.size} tugas menunggu penilaian.</p>`;
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

async function loadClasses() {
    const list = document.getElementById('classes-list');
    list.innerHTML = '<p>Loading...</p>';

    try {
        const snapshot = await db.collection('classes').orderBy('createdAt', 'desc').get();
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p>Belum ada kelas.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const div = document.createElement('div');
            div.className = 'card';
            div.style.borderLeft = '4px solid var(--primary-color)';
            div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4>${data.name}</h4>
                <div>
                    <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="deleteClass('${doc.id}')">Hapus</button>
                </div>
            </div>
        `;
            list.appendChild(div);
        });

        // Also populate class select in Add Task modal
        const select = document.getElementById('task-class');
        select.innerHTML = '';
        snapshot.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading classes:", error);
        document.getElementById('classes-list').innerHTML = '<p class="text-danger">Gagal memuat kelas.</p>';
    }
}

async function loadStudents() {
    const list = document.getElementById('students-list');
    list.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    const snapshot = await db.collection('users').where('role', '==', 'student').get();
    list.innerHTML = '';

    // Need to fetch class names manually since we only store classId
    const classesSnap = await db.collection('classes').get();
    const classesMap = {};
    classesSnap.forEach(doc => classesMap[doc.id] = doc.data().name);

    snapshot.forEach(doc => {
        const data = doc.data();
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.innerHTML = `
            <td style="padding: 1rem;">${data.name}</td>
            <td style="padding: 1rem;">${classesMap[data.classId] || '-'}</td>
            <td style="padding: 1rem;">${data.email}</td>
            <td style="padding: 1rem;">
                <button class="btn btn-outline" style="padding: 0.25rem 0.5rem;" onclick="deleteStudent('${doc.id}')">Hapus</button>
            </td>
        `;
        list.appendChild(tr);
    });
}

async function loadTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '<p>Loading...</p>';

    const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
    list.innerHTML = '';

    if (snapshot.empty) {
        list.innerHTML = '<p>Belum ada tugas.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <h3>${data.title}</h3>
                <span style="color: ${new Date(data.deadline) < new Date() ? 'red' : 'green'}">
                    Deadline: ${formatDate(data.deadline)}
                </span>
            </div>
            <p style="color: var(--text-secondary); margin: 0.5rem 0;">${data.description}</p>
            <div style="margin-top: 1rem;">
                <button class="btn btn-primary" onclick="openGrading('${doc.id}')">Nilai</button>
                <button class="btn btn-primary" style="background-color: #fbc02d; color: black;" onclick="editTask('${doc.id}')">Edit</button>
                <button class="btn btn-outline" style="border-color: #b00020; color: #b00020;" onclick="deleteTask('${doc.id}')">Hapus</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- Action Functions ---

function showAddClassModal() {
    toggleElement('modal-add-class', true);
}

function showAddTaskModal() {
    editingTaskId = null;
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-deadline').value = '';
    document.getElementById('task-class').selectedIndex = -1;

    const btn = document.querySelector('#modal-add-task .btn-primary');
    btn.textContent = 'Tugaskan';
    btn.onclick = createTask;

    document.querySelector('#modal-add-task h3').textContent = 'Buat Tugas Baru';
    toggleElement('modal-add-task', true);
}

let editingTaskId = null;

async function editTask(id) {
    editingTaskId = id;
    try {
        const doc = await db.collection('tasks').doc(id).get();
        const data = doc.data();

        document.getElementById('task-title').value = data.title;
        document.getElementById('task-desc').value = data.description;
        document.getElementById('task-deadline').value = data.deadline;

        // Handle multi-select for classes
        const select = document.getElementById('task-class');
        Array.from(select.options).forEach(opt => {
            opt.selected = data.assignedClasses.includes(opt.value);
        });

        // Change button to Update
        const btn = document.querySelector('#modal-add-task .btn-primary');
        btn.textContent = 'Simpan Perubahan';
        btn.onclick = updateTask;

        document.querySelector('#modal-add-task h3').textContent = 'Edit Tugas';

        toggleElement('modal-add-task', true);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function updateTask() {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const deadline = document.getElementById('task-deadline').value;
    const classSelect = document.getElementById('task-class');
    const selectedClasses = Array.from(classSelect.selectedOptions).map(opt => opt.value);

    if (!title || !deadline || selectedClasses.length === 0) {
        showToast('Mohon lengkapi data tugas', 'error');
        return;
    }

    try {
        await db.collection('tasks').doc(editingTaskId).update({
            title: title,
            description: desc,
            deadline: deadline,
            assignedClasses: selectedClasses,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Tugas berhasil diperbarui', 'success');
        toggleElement('modal-add-task', false);
        loadTasks();
        loadDashboardData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function createClass() {
    const name = document.getElementById('new-class-name').value;
    if (!name) return;

    try {
        await db.collection('classes').add({
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Kelas berhasil dibuat', 'success');
        toggleElement('modal-add-class', false);
        loadClasses();
        loadDashboardData(); // Update stats
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function createTask() {
    const title = document.getElementById('task-title').value;
    const desc = document.getElementById('task-desc').value;
    const deadline = document.getElementById('task-deadline').value;
    const classSelect = document.getElementById('task-class');
    const selectedClasses = Array.from(classSelect.selectedOptions).map(opt => opt.value);

    if (!title || !deadline || selectedClasses.length === 0) {
        showToast('Mohon lengkapi data tugas', 'error');
        return;
    }

    try {
        await db.collection('tasks').add({
            title: title,
            description: desc,
            deadline: deadline,
            assignedClasses: selectedClasses,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Tugas berhasil dibuat', 'success');
        toggleElement('modal-add-task', false);
        loadTasks();
        loadDashboardData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteTask(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus tugas ini?')) return;
    try {
        await db.collection('tasks').doc(id).delete();
        showToast('Tugas dihapus', 'success');
        loadTasks();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteClass(id) {
    if (!confirm('Hapus kelas ini?')) return;
    try {
        await db.collection('classes').doc(id).delete();
        showToast('Kelas dihapus', 'success');
        loadClasses();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// --- Grading System ---

let currentGradingTaskId = null;
let currentGradingSubmissionId = null;
let currentSubmissionsList = [];
let currentSubmissionIndex = -1;

async function openGrading(taskId) {
    currentGradingTaskId = taskId;
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    const task = taskDoc.data();

    document.getElementById('grading-task-info').innerHTML = `
        <h4>${task.title}</h4>
        <p style="color: var(--text-secondary); font-size: 0.9rem;">${task.description}</p>
    `;

    // Load submissions
    const subsSnap = await db.collection('submissions')
        .where('taskId', '==', taskId)
        .get();

    const list = document.getElementById('grading-students-list');
    list.innerHTML = '';
    currentSubmissionsList = [];

    if (subsSnap.empty) {
        list.innerHTML = '<p style="padding: 0.5rem; font-size: 0.9rem;">Belum ada pengumpulan.</p>';
    }

    subsSnap.forEach(doc => {
        const sub = doc.data();
        sub.id = doc.id; // Store ID
        currentSubmissionsList.push(sub);

        const div = document.createElement('div');
        div.id = `sub-item-${doc.id}`;
        div.style.padding = '0.5rem';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.style.backgroundColor = sub.grade ? '#e8f5e9' : 'transparent';
        div.innerHTML = `
            <div style="font-weight: 500;">${sub.studentName}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
                ${sub.grade ? `Nilai: ${sub.grade}` : 'Belum dinilai'}
            </div>
        `;
        div.onclick = () => loadSubmissionDetail(doc.id, sub);
        list.appendChild(div);
    });

    // Reset view
    document.getElementById('grading-content-view').innerHTML = '<p class="text-secondary" style="text-align: center; margin-top: 2rem;">Pilih siswa untuk menilai</p>';
    document.getElementById('grading-form').classList.add('hidden');

    toggleElement('modal-grading', true);
}

function loadSubmissionDetail(subId, sub) {
    currentGradingSubmissionId = subId;
    currentSubmissionIndex = currentSubmissionsList.findIndex(s => s.id === subId);

    const contentView = document.getElementById('grading-content-view');
    contentView.innerHTML = `
        <h4>Jawaban ${sub.studentName}</h4>
        <p style="white-space: pre-wrap; margin-top: 1rem;">${sub.content}</p>
        <p style="margin-top: 2rem; font-size: 0.8rem; color: var(--text-secondary);">
            Diserahkan: ${formatDate(sub.submittedAt)}
        </p>
    `;

    document.getElementById('grading-form').classList.remove('hidden');
    document.getElementById('grade-input').value = sub.grade || '';
    document.getElementById('grade-comment').value = sub.teacherComment || '';

    updateNavigationButtons();
}

function updateNavigationButtons() {
    const btnPrev = document.getElementById('btn-prev-submission');
    const btnNext = document.getElementById('btn-next-submission');

    if (btnPrev) btnPrev.disabled = currentSubmissionIndex <= 0;
    if (btnNext) btnNext.disabled = currentSubmissionIndex < 0 || currentSubmissionIndex >= currentSubmissionsList.length - 1;
}

function prevSubmission() {
    if (currentSubmissionIndex > 0) {
        const prevSub = currentSubmissionsList[currentSubmissionIndex - 1];
        loadSubmissionDetail(prevSub.id, prevSub);
    }
}

function nextSubmission() {
    if (currentSubmissionIndex < currentSubmissionsList.length - 1) {
        const nextSub = currentSubmissionsList[currentSubmissionIndex + 1];
        loadSubmissionDetail(nextSub.id, nextSub);
    }
}

async function submitGrade() {
    const score = document.getElementById('grade-input').value;
    const comment = document.getElementById('grade-comment').value;

    if (score === '' || score < 0 || score > 100) {
        showToast('Nilai harus antara 0 - 100', 'error');
        return;
    }

    try {
        await db.collection('submissions').doc(currentGradingSubmissionId).update({
            grade: parseInt(score),
            teacherComment: comment,
            gradedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local data
        if (currentSubmissionIndex > -1) {
            currentSubmissionsList[currentSubmissionIndex].grade = parseInt(score);
            currentSubmissionsList[currentSubmissionIndex].teacherComment = comment;
        }

        // Update UI list item
        const listItem = document.getElementById(`sub-item-${currentGradingSubmissionId}`);
        if (listItem) {
            listItem.style.backgroundColor = '#e8f5e9';
            listItem.querySelector('div:nth-child(2)').textContent = `Nilai: ${score}`;
        }

        showToast('Nilai berhasil disimpan', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// --- Gradebook & Export ---

let gradebookData = {
    students: [],
    tasks: [],
    submissions: {}
};

async function loadGradebook() {
    const classId = document.getElementById('gradebook-class-filter').value;
    const headerRow = document.getElementById('gradebook-header');
    const body = document.getElementById('gradebook-body');

    body.innerHTML = '<tr><td colspan="100%">Loading...</td></tr>';

    // 1. Get Students
    let studentsQuery = db.collection('users').where('role', '==', 'student');
    if (classId) {
        studentsQuery = studentsQuery.where('classId', '==', classId);
    }
    const studentsSnap = await studentsQuery.get();
    const students = studentsSnap.docs.map(doc => doc.data());

    // 2. Get Tasks
    let tasksQuery = db.collection('tasks').orderBy('deadline', 'asc');
    if (classId) {
        tasksQuery = tasksQuery.where('assignedClasses', 'array-contains', classId);
    }
    const tasksSnap = await tasksQuery.get();
    const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Get Submissions
    const submissionsSnap = await db.collection('submissions').get();
    const submissions = {};
    submissionsSnap.forEach(doc => {
        const data = doc.data();
        if (!submissions[data.studentId]) submissions[data.studentId] = {};
        submissions[data.studentId][data.taskId] = data;
    });

    // Store for Export
    gradebookData = { students, tasks, submissions };

    // Build Header
    headerRow.innerHTML = `
        <th style="padding: 1rem; border: 1px solid #ddd; min-width: 200px;">Nama Siswa</th>
        <th style="padding: 1rem; border: 1px solid #ddd;">Kelas</th>
    `;
    tasks.forEach(task => {
        headerRow.innerHTML += `<th style="padding: 1rem; border: 1px solid #ddd; min-width: 150px;">${task.title}</th>`;
    });

    // Build Body
    body.innerHTML = '';

    // Sort students by name
    students.sort((a, b) => a.name.localeCompare(b.name));

    students.forEach(student => {
        const tr = document.createElement('tr');
        let rowHtml = `
            <td style="padding: 1rem; border: 1px solid #ddd;">${student.name}</td>
            <td style="padding: 1rem; border: 1px solid #ddd;">${student.classId || '-'}</td>
        `;

        tasks.forEach(task => {
            const sub = submissions[student.uid] ? submissions[student.uid][task.id] : null;
            let cellContent = '-';
            let cellStyle = '';

            if (sub) {
                if (sub.grade !== null) {
                    cellContent = sub.grade;
                    cellStyle = 'font-weight: bold; color: var(--primary-color);';
                } else {
                    cellContent = '⏳'; // Submitted but not graded
                    cellStyle = 'color: orange;';
                }
            } else {
                // Check if late
                if (new Date(task.deadline) < new Date()) {
                    cellContent = '❌';
                    cellStyle = 'color: red;';
                }
            }

            rowHtml += `<td style="padding: 1rem; border: 1px solid #ddd; text-align: center; ${cellStyle}">${cellContent}</td>`;
        });

        tr.innerHTML = rowHtml;
        body.appendChild(tr);
    });
}

function exportToCSV() {
    if (gradebookData.students.length === 0) {
        showToast('Tidak ada data untuk diexport', 'error');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";

    // Header
    let header = ["Nama Siswa", "Kelas"];
    gradebookData.tasks.forEach(t => header.push(t.title));
    csvContent += header.join(",") + "\r\n";

    // Rows
    gradebookData.students.forEach(student => {
        let row = [`"${student.name}"`, `"${student.classId || '-'}"`];

        gradebookData.tasks.forEach(task => {
            const sub = gradebookData.submissions[student.uid] ? gradebookData.submissions[student.uid][task.id] : null;
            let val = '';
            if (sub && sub.grade !== null) val = sub.grade;
            else if (sub) val = 'Submitted';
            else val = 'Missing';
            row.push(val);
        });

        csvContent += row.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rekap_nilai_stms.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
