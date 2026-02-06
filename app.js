// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDGqokQSRvNhfg76Q-80OBU1Hhnw2nPLQc",
    authDomain: "bus-eticketing-system.firebaseapp.com",
    databaseURL: "https://bus-eticketing-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bus-eticketing-system",
    storageBucket: "bus-eticketing-system.firebasestorage.app",
    messagingSenderId: "843365338878",
    appId: "1:843365338878:web:0f1e280f23228d1c37dfaf"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Hardcoded Users
const USERS = {
    'admin': { pass: 'admin123', role: 'admin' },
    'user1': { pass: 'user1', role: 'user' },
    'user2': { pass: 'user2', role: 'user' },
    'user3': { pass: 'user3', role: 'user' },
    'user4': { pass: 'user4', role: 'user' },
    'user5': { pass: 'user5', role: 'user' }
};

let currentUser = JSON.parse(localStorage.getItem('adminUser')) || null;
let monthlyTarget = parseFloat(localStorage.getItem('monthlyTarget')) || 100000;
let allTickets = [];
let currentFilter = 'all';
let salesChart = null;

// --- Auth Functions ---
function checkAuth() {
    if (currentUser) {
        document.getElementById('login-overlay').classList.add('hidden');
        applyRBAC();
    } else {
        document.getElementById('login-overlay').classList.remove('hidden');
    }
}

function handleLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    if (USERS[user] && USERS[user].pass === pass) {
        currentUser = { username: user, role: USERS[user].role };
        localStorage.setItem('adminUser', JSON.stringify(currentUser));
        errorMsg.style.display = 'none';
        checkAuth();
    } else {
        errorMsg.style.display = 'block';
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('adminUser');
    location.reload();
}

function applyRBAC() {
    const adminElements = document.querySelectorAll('.admin-only');
    if (currentUser.role === 'admin') {
        adminElements.forEach(el => el.classList.remove('hidden'));
    } else {
        adminElements.forEach(el => el.classList.add('hidden'));
    }
}

// --- Target Functions ---
function openTargetModal() {
    document.getElementById('new-target-input').value = monthlyTarget;
    document.getElementById('target-modal').style.display = 'flex';
}

function closeTargetModal() {
    document.getElementById('target-modal').style.display = 'none';
}

function saveNewTarget() {
    const val = parseFloat(document.getElementById('new-target-input').value);
    if (!isNaN(val) && val > 0) {
        monthlyTarget = val;
        localStorage.setItem('monthlyTarget', monthlyTarget);
        renderDashboard();
        closeTargetModal();
    }
}

// --- Data Listeners ---
database.ref('tickets').on('value', (snapshot) => {
    updateTickets(snapshot, false);
});

database.ref('deleted_tickets').on('value', (snapshot) => {
    updateTickets(snapshot, true);
});

function updateTickets(snapshot, isDeletedBranch) {
    const data = snapshot.val();
    const branchTickets = [];

    if (data) {
        Object.keys(data).forEach(id => {
            const ticket = data[id];
            ticket.isDeleted = isDeletedBranch || ticket.isDeleted;
            branchTickets.push(ticket);
        });
    }

    allTickets = allTickets.filter(t => t.isDeleted !== isDeletedBranch);
    allTickets = [...allTickets, ...branchTickets];
    allTickets.sort((a, b) => b.createdAt - a.createdAt);

    renderDashboard();
    updateChart();
}

// --- Rendering ---
function renderDashboard() {
    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const activeTickets = allTickets.filter(t => !t.isDeleted);
    const deletedTicketsCount = allTickets.length - activeTickets.length;

    const todaySales = activeTickets.filter(t => new Date(t.createdAt).toDateString() === today)
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    const monthSales = activeTickets.filter(t => {
        const d = new Date(t.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Update UI Stats
    document.getElementById('today-sales').innerText = `₱${todaySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('month-sales').innerText = `₱${monthSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('total-tickets').innerText = activeTickets.length;
    document.getElementById('deleted-tickets').innerText = deletedTicketsCount;

    // Update Progress Bar
    const progress = Math.min(100, (monthSales / monthlyTarget) * 100);
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('target-percentage').innerText = `${progress.toFixed(1)}%`;
    document.getElementById('target-status').innerText = `₱${monthSales.toLocaleString()} / ₱${monthlyTarget.toLocaleString()}`;

    // Render Table
    const tableBody = document.getElementById('ticket-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const filteredTickets = allTickets.filter(t => {
        if (currentFilter === 'active') return !t.isDeleted;
        if (currentFilter === 'deleted') return t.isDeleted;
        return true;
    });

    filteredTickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${ticket.id}</td>
            <td>${ticket.name || 'Anonymous'}</td>
            <td>${ticket.origin} &rarr; ${ticket.destination}</td>
            <td>₱${(ticket.totalAmount || 0).toLocaleString()}</td>
            <td>
                <span class="status-tag ${ticket.isDeleted ? 'status-deleted' : 'status-active'}">
                    ${ticket.isDeleted ? 'Deleted' : 'Active'}
                </span>
            </td>
            <td>${ticket.createdBy || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// --- Chart.js Integration ---
function updateChart() {
    const activeTickets = allTickets.filter(t => !t.isDeleted);
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toDateString());
    }

    const dataPoints = last7Days.map(day => {
        return activeTickets.filter(t => new Date(t.createdAt).toDateString() === day)
            .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    });

    const ctx = document.getElementById('salesChart').getContext('2d');

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.split(' ').slice(0, 3).join(' ')),
            datasets: [{
                label: 'Daily Sales (₱)',
                data: dataPoints,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 3,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

// --- PDF Generation ---
function downloadSalesReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('BusMobticket Sales Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Generated by: ${currentUser.username} (${currentUser.role})`, 14, 34);

    const activeTickets = allTickets.filter(t => !t.isDeleted);
    const deletedTickets = allTickets.filter(t => t.isDeleted);

    const activeRevenue = activeTickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const deletedRevenue = deletedTickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    doc.text(`Total Active Revenue: ${activeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, 44);
    doc.text(`Total Deleted Revenue: ${deletedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 14, 50);

    const tableData = allTickets.map(t => [
        t.id,
        t.name || 'Anonymous',
        `${t.origin} -> ${t.destination}`,
        `${(t.totalAmount || 0).toFixed(2)}`,
        t.isDeleted ? 'Deleted' : 'Active',
        t.createdBy || 'Unknown'
    ]);

    doc.autoTable({
        startY: 56,
        head: [['ID', 'Name', 'Route', 'Amount', 'Status', 'User']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`sales-report-${new Date().toISOString().split('T')[0]}.pdf`);
}

// --- Initialization ---
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderDashboard();
    });
});

checkAuth();
