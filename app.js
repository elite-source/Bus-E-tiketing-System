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

let allTickets = [];
let currentFilter = 'all';

// Real-time listener for active tickets
database.ref('tickets').on('value', (snapshot) => {
    updateTickets(snapshot, false);
});

// Real-time listener for deleted tickets
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

    // Replace old tickets from this branch in the global array
    allTickets = allTickets.filter(t => t.isDeleted !== (isDeletedBranch));
    allTickets = [...allTickets, ...branchTickets];

    // Sort by createdAt descending
    allTickets.sort((a, b) => b.createdAt - a.createdAt);

    renderDashboard();
}

function renderDashboard() {
    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Stats calculations
    const activeTickets = allTickets.filter(t => !t.isDeleted);
    const deletedTicketsCount = allTickets.length - activeTickets.length;

    const todaySales = activeTickets.filter(t => new Date(t.createdAt).toDateString() === today)
        .reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    const monthSales = activeTickets.filter(t => {
        const d = new Date(t.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Update UI Stats
    document.getElementById('today-sales').innerText = `₱${todaySales.toFixed(2)}`;
    document.getElementById('month-sales').innerText = `₱${monthSales.toFixed(2)}`;
    document.getElementById('total-tickets').innerText = activeTickets.length;
    document.getElementById('deleted-tickets').innerText = deletedTicketsCount;

    // Update Progress Bar
    const target = 100000;
    const progress = Math.min(100, (monthSales / target) * 100);
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('target-percentage').innerText = `${progress.toFixed(1)}%`;
    document.getElementById('target-status').innerText = `₱${monthSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} / ₱${target.toLocaleString()}`;

    // Render Table
    const tableBody = document.getElementById('ticket-table-body');
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
            <td>₱${(ticket.totalAmount || 0).toFixed(2)}</td>
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

// Filter handling
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderDashboard();
    });
});
