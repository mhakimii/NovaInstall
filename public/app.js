/**
 * NovaInstall Frontend — Bilingual (FA / EN)
 */

const i18n = {
  fa: {
    loading: 'در حال بارگذاری...',
    welcome_title: 'نصب با موفقیت انجام شد 🎉',
    welcome_desc: 'اطلاعات ورود اولیه شما در زیر آمده است. این صفحه فقط یک‌بار نمایش داده می‌شود.',
    welcome_warning: 'لطفاً این رمز را در جای امنی ذخیره کنید. بعد از ورود حتماً آن را تغییر دهید.',
    go_to_login: 'ورود به پنل',
    login_title: 'ورود به پنل',
    login_subtitle: 'پنل ادمین عمومی',
    username: 'نام کاربری',
    password: 'رمز عبور',
    login_btn: 'ورود',
    change_pass_title: 'تغییر رمز عبور',
    change_pass_desc: 'برای امنیت بیشتر، لطفاً رمز عبور خود را تغییر دهید.',
    current_password: 'رمز فعلی',
    new_password: 'رمز جدید',
    confirm_password: 'تکرار رمز جدید',
    save_password: 'ذخیره رمز جدید',
    dashboard_title: 'داشبورد',
    dashboard_subtitle: 'خوش آمدید به پنل ادمین',
    app_name: 'نام برنامه',
    version: 'نسخه',
    installed_at: 'تاریخ نصب',
    activity: 'فعالیت‌ها',
    account_section: 'حساب کاربری',
    change_password: 'تغییر رمز عبور',
    logout: 'خروج',
    error_login: 'نام کاربری یا رمز عبور اشتباه است',
    error_network: 'خطا در ارتباط با سرور',
    error_pass_mismatch: 'رمزهای جدید یکسان نیستند',
    error_pass_weak: 'رمز جدید باید حداقل ۸ کاراکتر باشد',
    error_wrong_current: 'رمز فعلی اشتباه است',
    pass_changed: 'رمز با موفقیت تغییر کرد',
  },
  en: {
    loading: 'Loading...',
    welcome_title: 'Installation successful 🎉',
    welcome_desc: 'Your initial credentials are shown below. This page is displayed only once.',
    welcome_warning: 'Please save this password securely. Change it after your first login.',
    go_to_login: 'Go to Login',
    login_title: 'Sign in',
    login_subtitle: 'General Admin Panel',
    username: 'Username',
    password: 'Password',
    login_btn: 'Sign in',
    change_pass_title: 'Change Password',
    change_pass_desc: 'For better security, please change your password.',
    current_password: 'Current password',
    new_password: 'New password',
    confirm_password: 'Confirm new password',
    save_password: 'Save new password',
    dashboard_title: 'Dashboard',
    dashboard_subtitle: 'Welcome to the admin panel',
    app_name: 'App name',
    version: 'Version',
    installed_at: 'Installed at',
    activity: 'Activities',
    account_section: 'Account',
    change_password: 'Change password',
    logout: 'Logout',
    error_login: 'Invalid username or password',
    error_network: 'Network error',
    error_pass_mismatch: 'New passwords do not match',
    error_pass_weak: 'New password must be at least 8 characters',
    error_wrong_current: 'Current password is incorrect',
    pass_changed: 'Password changed successfully',
  },
};

let currentLang = localStorage.getItem('nova_lang') || 'fa';
let currentUser = null;

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('nova_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed');
    err.code = data.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function tryBootstrap() {
  if (sessionStorage.getItem('nova_welcome_shown')) return false;
  try {
    const status = await api('/status');
    if (status.hasUsers) return false;
    const result = await api('/bootstrap', { method: 'POST' });
    if (result.ok && result.password) {
      document.getElementById('cred-username').textContent = result.username || 'admin';
      document.getElementById('cred-password').textContent = result.password;
      sessionStorage.setItem('nova_welcome_shown', '1');
      sessionStorage.setItem('nova_temp_pass', result.password);
      showScreen('screen-welcome');
      return true;
    }
  } catch (e) {
    console.warn('Bootstrap check failed', e);
  }
  return false;
}

document.getElementById('btn-go-login')?.addEventListener('click', () => {
  showScreen('screen-login');
  const temp = sessionStorage.getItem('nova_temp_pass');
  if (temp) document.getElementById('login-password').value = temp;
});

document.getElementById('btn-copy-pass')?.addEventListener('click', () => {
  const pass = document.getElementById('cred-password').textContent;
  navigator.clipboard?.writeText(pass).then(() => {
    const btn = document.getElementById('btn-copy-pass');
    btn.textContent = '✓';
    setTimeout(() => (btn.textContent = '📋'), 1500);
  });
});

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    currentUser = data.user;
    sessionStorage.removeItem('nova_temp_pass');
    if (data.user.mustChangePassword) showScreen('screen-change-pass');
    else await loadDashboard();
  } catch (err) {
    errEl.textContent = err.code === 'invalid_credentials' ? i18n[currentLang].error_login : i18n[currentLang].error_network;
    errEl.hidden = false;
  }
});

document.getElementById('form-change-pass')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('cp-error');
  errEl.hidden = true;
  const current = document.getElementById('cp-current').value;
  const next = document.getElementById('cp-new').value;
  const confirm = document.getElementById('cp-confirm').value;
  if (next !== confirm) {
    errEl.textContent = i18n[currentLang].error_pass_mismatch;
    errEl.hidden = false;
    return;
  }
  if (next.length < 8) {
    errEl.textContent = i18n[currentLang].error_pass_weak;
    errEl.hidden = false;
    return;
  }
  try {
    await api('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    await loadDashboard();
  } catch (err) {
    errEl.textContent = err.code === 'wrong_password' ? i18n[currentLang].error_wrong_current : (err.message || i18n[currentLang].error_network);
    errEl.hidden = false;
  }
});

document.getElementById('btn-open-change-pass')?.addEventListener('click', () => {
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-error').hidden = true;
  showScreen('screen-change-pass');
});

async function loadDashboard() {
  try {
    const data = await api('/dashboard');
    document.getElementById('stat-app').textContent = data.app || 'NovaInstall';
    document.getElementById('stat-version').textContent = data.version || '—';
    document.getElementById('stat-installed').textContent = data.installedAt
      ? new Date(data.installedAt + 'Z').toLocaleString(currentLang === 'fa' ? 'fa-IR' : 'en-US')
      : '—';
    document.getElementById('stat-activity').textContent = data.activityCount ?? '—';
    document.getElementById('user-badge').textContent = data.user?.username || 'admin';
    currentUser = data.user;
    showScreen('screen-dashboard');
  } catch (e) {
    if (e.status === 401) showScreen('screen-login');
    else {
      console.error(e);
      showScreen('screen-login');
    }
  }
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch {}
  currentUser = null;
  showScreen('screen-login');
});

async function init() {
  applyLang(currentLang);
  try {
    const me = await api('/me');
    currentUser = me;
    if (me.mustChangePassword) showScreen('screen-change-pass');
    else await loadDashboard();
    return;
  } catch {}
  const showedWelcome = await tryBootstrap();
  if (!showedWelcome) showScreen('screen-login');
}

init();
