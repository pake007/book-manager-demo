const CONFIG = {
    supabase: {
        url: window.env?.SUPABASE_URL || '',
        key: window.env?.SUPABASE_KEY || ''
    }
};

// 验证配置
if (!CONFIG.supabase.url || !CONFIG.supabase.key) {
    console.error('Supabase 配置缺失！请设置环境变量。');
}