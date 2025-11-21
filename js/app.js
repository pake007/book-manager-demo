// app.js - 主应用逻辑
class BookManager {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            // 初始化 Supabase
            await this.initSupabase();
            
            // 设置事件监听
            this.setupEventListeners();
            
            // 加载初始数据
            await this.loadBooks();
            
            // 设置实时订阅
            this.setupRealtimeSubscription();
            
        } catch (error) {
            this.showError('初始化失败: ' + error.message);
        }
    }

    async initSupabase() {
        // 检查配置
        if (!CONFIG.supabase.url || !CONFIG.supabase.key) {
            throw new Error('Supabase 配置未设置');
        }

        // 动态导入 Supabase
        const { createClient } = window.supabase;
        this.supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.key);
        
        // 测试连接
        const { data, error } = await this.supabase
            .from('books')
            .select('count')
            .limit(1);

        if (error) throw error;
        
        this.isInitialized = true;
        console.log('Supabase 初始化成功');
    }

    setupEventListeners() {
        // 添加图书表单
        const addBookForm = document.getElementById('addBookForm');
        if (addBookForm) {
            addBookForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addBook();
            });
        }

        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderBooks();
            });
        }

        // 状态筛选
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.renderBooks();
            });
        }
    }

    async loadBooks() {
        if (!this.isInitialized) return;

        this.showLoading();
        
        try {
            let query = this.supabase
                .from('books')
                .select('*')
                .order('created_at', { ascending: false });

            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
            const statusFilter = document.getElementById('statusFilter')?.value;

            if (searchTerm) {
                query = query.or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%`);
            }

            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }

            const { data: books, error } = await query;

            if (error) throw error;
            
            this.books = books || [];
            this.renderBooks();
            this.updateStats();
            
        } catch (error) {
            this.showError('加载图书失败: ' + error.message);
        }
    }

    async addBook() {
        if (!this.isInitialized) {
            this.showError('系统未初始化完成');
            return;
        }

        const title = document.getElementById('bookTitle')?.value.trim();
        const author = document.getElementById('bookAuthor')?.value.trim();
        const description = document.getElementById('bookDescription')?.value.trim();
        const status = document.getElementById('bookStatus')?.value;

        if (!title) {
            this.showError('请输入书名');
            return;
        }

        const submitBtn = document.querySelector('#addBookForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = '添加中...';

            const { data, error } = await this.supabase
                .from('books')
                .insert([
                    {
                        title: title,
                        author: author || '未知作者',
                        description: description,
                        status: status || 'available'
                    }
                ])
                .select();

            if (error) throw error;

            // 清空表单
            document.getElementById('addBookForm').reset();

            this.showSuccess(`《${title}》添加成功！`);

            // 刷新图书列表
            await this.loadBooks();
            
        } catch (error) {
            this.showError('添加图书失败: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async updateBook(id, updates) {
        if (!this.isInitialized) return;

        try {
            const { error } = await this.supabase
                .from('books')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

        } catch (error) {
            this.showError('更新图书失败: ' + error.message);
        }
    }

    async deleteBook(id) {
        if (!this.isInitialized) return;

        const book = this.books.find(b => b.id === id);
        if (!book) return;

        if (!confirm(`确定要删除《${book.title}》吗？此操作不可撤销！`)) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('books')
                .delete()
                .eq('id', id);

            if (error) throw error;

            this.showSuccess('图书删除成功！');

        } catch (error) {
            this.showError('删除图书失败: ' + error.message);
        }
    }

    renderBooks() {
        const container = document.getElementById('booksContainer');
        if (!container) return;

        const filteredBooks = this.getFilteredBooks();
        
        document.getElementById('booksCount').textContent = filteredBooks.length;

        if (filteredBooks.length === 0) {
            const searchTerm = document.getElementById('searchInput')?.value;
            const statusFilter = document.getElementById('statusFilter')?.value;
            
            let message = '暂无图书，赶快添加第一本书吧！';
            if (searchTerm || statusFilter) {
                message = '没有找到符合条件的图书';
            }
            
            container.innerHTML = `
                <div class="empty-state">
                    <h3>📚 ${message}</h3>
                    ${searchTerm || statusFilter ? '<button onclick="bookManager.clearFilters()" style="margin-top: 10px;">清除筛选条件</button>' : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = filteredBooks.map(book => `
            <div class="book-card">
                <div class="book-title">《${this.escapeHtml(book.title)}》</div>
                <div class="book-author">作者：${this.escapeHtml(book.author)}</div>
                ${book.description ? `<div class="book-description">${this.escapeHtml(book.description)}</div>` : ''}
                <div class="book-status status-${book.status}">
                    ${this.getStatusText(book.status)}
                </div>
                <div class="book-added">添加于：${new Date(book.created_at).toLocaleDateString('zh-CN')}</div>
                <div class="book-actions">
                    <select onchange="bookManager.updateBookStatus(${book.id}, this.value)" class="status-select">
                        <option value="available" ${book.status === 'available' ? 'selected' : ''}>可借阅</option>
                        <option value="borrowed" ${book.status === 'borrowed' ? 'selected' : ''}>已借出</option>
                        <option value="reserved" ${book.status === 'reserved' ? 'selected' : ''}>已预订</option>
                    </select>
                    <button class="btn-delete" onclick="bookManager.deleteBook(${book.id})">删除</button>
                </div>
            </div>
        `).join('');
    }

    getFilteredBooks() {
        if (!this.books) return [];
        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter')?.value;

        return this.books.filter(book => {
            const matchesSearch = !searchTerm || 
                book.title.toLowerCase().includes(searchTerm) || 
                book.author.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || book.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }

    async updateBookStatus(id, newStatus) {
        await this.updateBook(id, { status: newStatus });
    }

    updateStats() {
        if (!this.books) return;

        const totalBooks = this.books.length;
        const availableBooks = this.books.filter(book => book.status === 'available').length;
        const borrowedBooks = this.books.filter(book => book.status === 'borrowed').length;

        document.getElementById('totalBooks').textContent = totalBooks;
        document.getElementById('availableBooks').textContent = availableBooks;
        document.getElementById('borrowedBooks').textContent = borrowedBooks;
    }

    setupRealtimeSubscription() {
        if (!this.isInitialized) return;

        this.supabase
            .channel('books-changes')
            .on('postgres_changes', 
                { 
                    event: '*',
                    schema: 'public', 
                    table: 'books' 
                }, 
                () => {
                    // 重新加载数据
                    this.loadBooks();
                }
            )
            .subscribe();
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = '';
        this.renderBooks();
    }

    // 工具函数
    showLoading() {
        const container = document.getElementById('booksContainer');
        if (container) {
            container.innerHTML = '<div class="loading">加载中...</div>';
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
        console.error(message);
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        // 移除现有消息
        const existingMsg = document.querySelector('.error-message, .success-message');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        messageDiv.textContent = message;

        const container = document.querySelector('.container');
        const bookForm = document.querySelector('.book-form');
        container.insertBefore(messageDiv, bookForm.nextSibling);

        // 自动隐藏成功消息
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }
    }

    getStatusText(status) {
        const statusMap = {
            'available': '可借阅',
            'borrowed': '已借出', 
            'reserved': '已预订'
        };
        return statusMap[status] || status;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
let bookManager;

document.addEventListener('DOMContentLoaded', function() {
    bookManager = new BookManager();
});