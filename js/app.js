class BookManager {
    constructor() {
        this.books = this.loadBooks();
        this.init();
    }

    init() {
        this.renderBooks();
        this.setupEventListeners();
        this.updateStats();
    }

    loadBooks() {
        const books = localStorage.getItem('personalLibrary');
        return books ? JSON.parse(books) : [];
    }

    saveBooks() {
        localStorage.setItem('personalLibrary', JSON.stringify(this.books));
        this.updateStats();
    }

    setupEventListeners() {
        // 添加图书表单
        document.getElementById('addBookForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });

        // 搜索和筛选
        document.getElementById('searchInput').addEventListener('input', () => {
            this.renderBooks();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.renderBooks();
        });
    }

    addBook() {
        const title = document.getElementById('bookTitle').value.trim();
        const author = document.getElementById('bookAuthor').value.trim();
        const year = document.getElementById('bookYear').value;
        const status = document.getElementById('bookStatus').value;
        const rating = document.getElementById('bookRating').value;

        if (!title) {
            alert('请输入书名！');
            return;
        }

        const book = {
            id: Date.now().toString(),
            title,
            author: author || '未知作者',
            year: year || '未知年份',
            status: status || '未读',
            rating: rating || '未评分',
            addedDate: new Date().toLocaleDateString('zh-CN')
        };

        this.books.unshift(book);
        this.saveBooks();
        this.renderBooks();
        this.resetForm();
        
        alert(`《${title}》添加成功！`);
    }

    resetForm() {
        document.getElementById('addBookForm').reset();
    }

    editBook(id) {
        const book = this.books.find(b => b.id === id);
        if (!book) return;

        const newTitle = prompt('修改书名：', book.title);
        if (newTitle === null) return;

        const newAuthor = prompt('修改作者：', book.author);
        const newYear = prompt('修改出版年份：', book.year);
        const newStatus = prompt('修改阅读状态（未读/阅读中/已读完）：', book.status);
        const newRating = prompt('修改评分（1-5）：', book.rating);

        if (newTitle) book.title = newTitle;
        if (newAuthor !== null) book.author = newAuthor;
        if (newYear !== null) book.year = newYear;
        if (newStatus !== null) book.status = newStatus;
        if (newRating !== null) book.rating = newRating;

        this.saveBooks();
        this.renderBooks();
    }

    deleteBook(id) {
        if (!confirm('确定要删除这本书吗？')) return;

        this.books = this.books.filter(book => book.id !== id);
        this.saveBooks();
        this.renderBooks();
    }

    getFilteredBooks() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;

        return this.books.filter(book => {
            const matchesSearch = book.title.toLowerCase().includes(searchTerm) || 
                                book.author.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || book.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }

    renderBooks() {
        const container = document.getElementById('booksContainer');
        const filteredBooks = this.getFilteredBooks();
        
        document.getElementById('booksCount').textContent = filteredBooks.length;

        if (filteredBooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📚 暂无图书</h3>
                    <p>${this.books.length === 0 ? '赶快添加你的第一本书吧！' : '没有找到符合条件的图书'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredBooks.map(book => `
            <div class="book-card">
                <div class="book-title">《${this.escapeHtml(book.title)}》</div>
                <div class="book-author">作者：${this.escapeHtml(book.author)}</div>
                <div class="book-year">出版年份：${this.escapeHtml(book.year)}</div>
                <div class="book-rating">评分：${book.rating} ⭐</div>
                <div class="book-status status-${this.getStatusClass(book.status)}">
                    ${book.status}
                </div>
                <div class="book-added">添加于：${book.addedDate}</div>
                <div class="book-actions">
                    <button class="btn-edit" onclick="bookManager.editBook('${book.id}')">编辑</button>
                    <button class="btn-delete" onclick="bookManager.deleteBook('${book.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getStatusClass(status) {
        const statusMap = {
            '未读': 'unread',
            '阅读中': 'reading',
            '已读完': 'finished'
        };
        return statusMap[status] || 'unread';
    }

    updateStats() {
        const totalBooks = this.books.length;
        const readBooks = this.books.filter(book => book.status === '已读完').length;
        const readingBooks = this.books.filter(book => book.status === '阅读中').length;

        document.getElementById('totalBooks').textContent = totalBooks;
        document.getElementById('readBooks').textContent = readBooks;
        document.getElementById('readingBooks').textContent = readingBooks;
    }
}

// 工具函数
function exportData() {
    const books = bookManager.books;
    if (books.length === 0) {
        alert('没有数据可以导出！');
        return;
    }

    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = '我的图书库备份.json';
    link.click();
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = event => {
            try {
                const importedBooks = JSON.parse(event.target.result);
                if (Array.isArray(importedBooks)) {
                    if (confirm(`确定要导入 ${importedBooks.length} 本书吗？这将覆盖现有数据。`)) {
                        bookManager.books = importedBooks;
                        bookManager.saveBooks();
                        bookManager.renderBooks();
                        alert('数据导入成功！');
                    }
                } else {
                    throw new Error('文件格式不正确');
                }
            } catch (error) {
                alert('导入失败：文件格式不正确！');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function clearAllData() {
    if (confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) {
        bookManager.books = [];
        bookManager.saveBooks();
        bookManager.renderBooks();
        alert('所有数据已清空！');
    }
}

// 初始化应用
const bookManager = new BookManager();