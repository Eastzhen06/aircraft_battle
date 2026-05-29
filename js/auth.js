// ============================================
// 飞机大战 - 认证与存档模块
// 依赖：supabase-config.js（提供 SUPABASE_URL, SUPABASE_ANON_KEY）
// ============================================

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 用户名 → 虚拟邮箱（用户看不到，仅内部使用）
function toEmail(username) {
    return username.toLowerCase().trim() + '@local.username';
}

// ========== 认证 ==========

// 注册
async function authRegister(username, password) {
    const { data, error } = await db.auth.signUp({
        email: toEmail(username),
        password: password
    });
    if (error) throw error;
    // 注册成功后自动创建空存档
    if (data.user) {
        await db.from('game_saves').insert({
            user_id: data.user.id,
            unlocked_planes: ['Ranger'],
            unlocked_wingmen: ['none'],
            max_cleared_level: 0
        });
    }
    return data.user;
}

// 登录
async function authLogin(username, password) {
    const { data, error } = await db.auth.signInWithPassword({
        email: toEmail(username),
        password: password
    });
    if (error) throw error;
    return data.user;
}

// 登出
async function authLogout() {
    await db.auth.signOut();
}

// 获取当前用户（返回 user 对象或 null）
async function authGetUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
}

// 修改密码（先验证旧密码，再更新新密码）
async function authChangePassword(username, oldPassword, newPassword) {
    const { error: verifyError } = await db.auth.signInWithPassword({
        email: toEmail(username),
        password: oldPassword
    });
    if (verifyError) throw new Error('旧密码错误');
    const { error: updateError } = await db.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
    return true;
}

// ========== 存档 ==========

// 从云端加载存档
async function loadCloudSave() {
    const user = await authGetUser();
    if (!user) return null;
    const { data, error } = await db
        .from('game_saves')
        .select('unlocked_planes, unlocked_wingmen, max_cleared_level')
        .eq('user_id', user.id)
        .single();
    if (error) return null;
    return data;
}

// 保存存档到云端
async function saveToCloud(saveData) {
    const user = await authGetUser();
    if (!user) { console.warn('[SYNC] saveToCloud: 用户未登录，跳过'); return; }
    const { error } = await db.from('game_saves').upsert({
        user_id: user.id,
        unlocked_planes: saveData.unlocked_planes,
        unlocked_wingmen: saveData.unlocked_wingmen,
        max_cleared_level: saveData.max_cleared_level,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) {
        console.error('[SYNC] saveToCloud 失败:', error);
        throw error;
    }
}
