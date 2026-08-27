const translations = {
    "zh": {
        // index.html
        "login_doc_title": "登录",
        "login_title": "登录",
        "login_subtitle": "管理你的账户",
        "username_placeholder": "用户名",
        "password_placeholder": "密码",
        "btn_continue": "继续",
        "btn_passkey": "通过通行密钥登录",
        "or_divider": "or",
        
        "msg_verifying": "验证中...",
        "msg_wrong_credentials": "用户名或密码错误",
        "msg_network_error": "网络错误，请重试",
        "msg_no_passkey": "未检测到可用的通行密钥",
        "msg_passkey_failed": "通行密钥验证失败",
        "msg_passkey_canceled": "通行密钥取消或验证失败",

        // 2fa.html (formerly totp.html)
        "twofa_doc_title": "双重认证",
        "twofa_title": "双重认证",
        "totp_doc_title": "双重认证",
        "totp_title": "双重认证",
        "totp_subtitle_app": "请输入身份验证器中显示的 6 位验证码",
        "totp_subtitle_rc": "请输入恢复码（格式：XXXXX-XXXXX）",
        "rc_placeholder": "XXXXX-XXXXX",
        "btn_back": "返回",
        "totp_link_rc": "使用恢复码登录",
        "totp_link_code": "使用验证码登录",
        "msg_verify_failed": "验证失败，请重试",

        // FIDO2 mode keys
        "fido2_title": "安全密钥验证",
        "fido2_subtitle_usb": "请插入并触摸你的安全密钥",
        "fido2_subtitle_nfc": "请将安全密钥靠近手机 NFC 感应区域",
        "fido2_waiting": "正在等待安全密钥...",
        "fido2_btn_retry": "重试",
        "fido2_canceled": "操作已取消",
        "fido2_verify_failed": "验证失败，请重试",

        // admin.html
        "admin_doc_title": "账户安全管理",
        "admin_title": "安全设置",
        
        "section_username_title": "修改用户名",
        "section_username_desc": "更改后需使用新用户名登录。",
        "section_email_title": "绑定邮箱",
        "section_email_desc": "用于单点登录 (SSO) 时识别身份。",
        "section_password_title": "修改密码",
        "section_password_desc": "支持任意特殊字符，包括 & # @ * 等。",
        
        "btn_change": "更改",
        "btn_cancel": "取消",
        "btn_save_username": "保存用户名",
        "btn_save_email": "保存邮箱",
        "btn_save_password": "保存密码",
        
        "placeholder_new_username": "新用户名",
        "placeholder_current_pwd": "当前密码（确认身份）",
        "placeholder_new_email": "你的邮箱地址",
        "placeholder_current_pwd_only": "当前密码",
        "placeholder_new_pwd": "新密码",
        "placeholder_confirm_pwd": "再次输入新密码",

        "msg_enter_new_username": "请输入新用户名",
        "msg_enter_current_pwd": "请输入当前密码",
        "msg_username_changed": "✓ 用户名已更改为「{0}」，下次登录请使用新用户名",
        "msg_enter_email": "请输入邮箱",
        "msg_invalid_email": "邮箱格式不正确",
        "msg_email_changed": "✓ 邮箱已更新，请重新登录！",
        "msg_enter_new_pwd": "请输入新密码",
        "msg_pwd_mismatch": "两次输入的密码不一致",
        "msg_pwd_same": "新密码不能与当前密码相同",
        "msg_pwd_changed": "✓ 密码已成功更改",
        "msg_change_failed": "修改失败",

        "section_pk_title": "通行密钥",
        "section_pk_desc": "使用面容、指纹或设备密码安全登录，更快捷，更安全。",
        "badge_none": "未添加",
        "badge_pk_count": "{0} 把",
        "badge_pk_count_full": "{0} 个通行密钥",
        "btn_add_pk": "＋ 添加通行密钥",
        
        "placeholder_pk_name": "给这把通行密钥起个名字（可留空）",
        "btn_confirm_add_pk": "确认并注册",
        "default_pk_name": "通行密钥",
        "msg_preparing": "准备中…",
        "msg_pk_added": "✓ 「{0}」添加成功！",
        "msg_cancel": "操作取消",
        
        "alert_delete_pk": "确定要删除这把通行密钥吗？",
        "prompt_rename_pk": "请输入新名称：",

        "section_2fa_title": "双重认证",
        "section_2fa_desc": "添加第二道防护。可选择身份验证器（TOTP 动态码）或 FIDO2 安全密钥（YubiKey 等）。",
        "section_2fa_desc_totp": "已启用身份验证器（TOTP 动态码）。",
        "section_2fa_desc_fido2": "已启用 FIDO2 安全密钥验证。",
        "section_fido2_downgraded_desc": "FIDO2 安全密钥不足 2 把，双重认证已被冻结。请添加新密钥至 2 把以上重新启用。",
        "badge_disabled": "未启用",
        "badge_downgraded": "已降级",
        "badge_enabled": "已启用",
        "badge_2fa_totp": "身份验证器",
        "badge_2fa_fido2": "安全密钥",
        "btn_setup_2fa": "＋ 添加双重认证",
        "btn_reset_2fa": "重新设置",
        "btn_disable_2fa": "禁用双重认证",

        // 2FA type selector
        "choose_2fa_method": "选择验证方式",
        "method_fido2_title": "安全密钥",
        "method_fido2_desc": "YubiKey 等 FIDO2 硬件密钥",
        "method_totp_title": "身份验证器",
        "method_totp_desc": "TOTP 动态验证码",

        // TOTP setup
        "step_1_scan": "1. 使用身份验证器扫描下方二维码：",
        "label_manual_secret": "手动输入密钥",
        "step_2_enter": "2. 输入应用中的 6 位验证码：",
        "btn_verify_enable": "验证并启用",
        
        "msg_enter_6_digits": "请输入 6 位验证码",
        "msg_2fa_enabled": "✓ 双重认证已成功启用",
        "msg_2fa_wrong": "验证码错误，请重试",
        "alert_disable_2fa": "确定要禁用双重认证吗？这会降低账户安全性。",

        // FIDO2 key management in admin
        "section_fido2_keys_title": "FIDO2 安全密钥",
        "fido2_key_count_tip": "需要至少 2 把密钥才能启用，最多 6 把",
        "fido2_min_warning": "已低于最少数量（2 把），FIDO2 双重认证已自动关闭",
        "fido2_max_reached": "已达到最大数量（6 把）",
        "btn_add_fido2_key": "＋ 添加安全密钥",
        "btn_enable_fido2": "启用 FIDO2 双重认证",
        "placeholder_fido2_key_name": "给这把安全密钥起个名字（可留空）",
        "default_fido2_key_name": "安全密钥",
        "msg_fido2_key_added": "✓ 「{0}」添加成功！",
        "alert_delete_fido2_key": "确定要删除这把安全密钥吗？",
        "transport_usb": "USB",
        "transport_nfc": "NFC",
        "transport_ble": "蓝牙",
        "transport_internal": "内置",

        "section_rc_title": "恢复码",
        "section_rc_desc": "当你无法使用双重认证设备时，可用恢复码一次性登录。每码只能使用一次，请妥善保存。",
        "badge_not_gen": "未生成",
        "badge_rc_remaining": "剩余 {0} 个",
        "btn_gen_rc": "生成恢复码",
        "rc_warning": "⚠️ 请立即将这些恢复码保存到安全的地方，它们只会显示一次。",
        "btn_copy_all": "复制全部",
        "msg_copied": "✓ 已复制到剪贴板",
        "alert_regen_rc": "生成新恢复码将使旧恢复码全部失效，确定继续吗？",

        "btn_logout": "退出登录",
        "btn_logout_all": "在所有设备上退出",
        "msg_logout_all_confirm": "确定要在所有设备上退出登录吗？此操作会使所有当前已登录的会话立即失效。",

        // Sudo modal
        "sudo_title": "确认你的密码",
        "sudo_desc": "出于安全考虑，请输入当前密码以继续操作。",
        "sudo_btn_confirm": "确认",
        "sudo_btn_cancel": "取消"
    },
    "en": {
        // index.html
        "login_doc_title": "Sign In",
        "login_title": "Sign In",
        "login_subtitle": "Manage your account",
        "username_placeholder": "Username",
        "password_placeholder": "Password",
        "btn_continue": "Continue",
        "btn_passkey": "Sign in with Passkey",
        "or_divider": "or",
        
        "msg_verifying": "Verifying...",
        "msg_wrong_credentials": "Incorrect username or password",
        "msg_network_error": "Network error, please try again",
        "msg_no_passkey": "No available passkey detected",
        "msg_passkey_failed": "Passkey verification failed",
        "msg_passkey_canceled": "Passkey canceled or verification failed",

        // 2fa.html (formerly totp.html)
        "twofa_doc_title": "Two-Factor Authentication",
        "twofa_title": "Two-Factor Authentication",
        "totp_doc_title": "Two-Factor Authentication",
        "totp_title": "Two-Factor Authentication",
        "totp_subtitle_app": "Enter the 6-digit code from your Authenticator",
        "totp_subtitle_rc": "Enter recovery code (Format: XXXXX-XXXXX)",
        "rc_placeholder": "XXXXX-XXXXX",
        "btn_back": "Back",
        "totp_link_rc": "Use a recovery code",
        "totp_link_code": "Use authenticator code",
        "msg_verify_failed": "Verification failed, please try again",

        // FIDO2 mode keys
        "fido2_title": "Security Key",
        "fido2_subtitle_usb": "Insert and touch your security key",
        "fido2_subtitle_nfc": "Hold your security key near the NFC area on your phone",
        "fido2_waiting": "Waiting for security key...",
        "fido2_btn_retry": "Retry",
        "fido2_canceled": "Operation canceled",
        "fido2_verify_failed": "Verification failed, please try again",

        // admin.html
        "admin_doc_title": "Account Security",
        "admin_title": "Security Settings",
        
        "section_username_title": "Change Username",
        "section_username_desc": "You will need to sign in with your new username.",
        "section_email_title": "Bind Email",
        "section_email_desc": "Used for identity recognition during Single Sign-On (SSO).",
        "section_password_title": "Change Password",
        "section_password_desc": "Supports any special characters, including & # @ * etc.",
        
        "btn_change": "Change",
        "btn_cancel": "Cancel",
        "btn_save_username": "Save Username",
        "btn_save_email": "Save Email",
        "btn_save_password": "Save Password",
        
        "placeholder_new_username": "New username",
        "placeholder_current_pwd": "Current password (to verify identity)",
        "placeholder_new_email": "Your email address",
        "placeholder_current_pwd_only": "Current password",
        "placeholder_new_pwd": "New password",
        "placeholder_confirm_pwd": "Re-enter new password",

        "msg_enter_new_username": "Please enter a new username",
        "msg_enter_current_pwd": "Please enter your current password",
        "msg_username_changed": "✓ Username changed to '{0}'. Please use it next time.",
        "msg_enter_email": "Please enter an email address",
        "msg_invalid_email": "Invalid email format",
        "msg_email_changed": "✓ Email updated. Please sign in again!",
        "msg_enter_new_pwd": "Please enter a new password",
        "msg_pwd_mismatch": "Passwords do not match",
        "msg_pwd_same": "New password cannot be the same as the current one",
        "msg_pwd_changed": "✓ Password successfully changed",
        "msg_change_failed": "Update failed",

        "section_pk_title": "Passkeys",
        "section_pk_desc": "Sign in safely and quickly with Face ID, Touch ID, or device passcode.",
        "badge_none": "None",
        "badge_pk_count": "{0} Keys",
        "badge_pk_count_full": "{0} Passkeys",
        "btn_add_pk": "＋ Add a Passkey",
        
        "placeholder_pk_name": "Name this passkey (optional)",
        "btn_confirm_add_pk": "Confirm & Register",
        "default_pk_name": "Passkey",
        "msg_preparing": "Preparing...",
        "msg_pk_added": "✓ '{0}' added successfully!",
        "msg_cancel": "Operation canceled",
        
        "alert_delete_pk": "Are you sure you want to delete this passkey?",
        "prompt_rename_pk": "Enter new name:",

        "section_2fa_title": "Two-Factor Authentication",
        "section_2fa_desc": "Add a second layer of protection — choose between an Authenticator (TOTP) or a FIDO2 Security Key (YubiKey, etc.).",
        "section_2fa_desc_totp": "Authenticator (TOTP) is enabled.",
        "section_2fa_desc_fido2": "FIDO2 Security Key verification is enabled.",
        "section_fido2_downgraded_desc": "FIDO2 Security Keys dropped below 2. Two-Factor Authentication is frozen. Please add keys to re-enable.",
        "badge_disabled": "Disabled",
        "badge_downgraded": "Downgraded",
        "badge_enabled": "Enabled",
        "badge_2fa_totp": "Authenticator",
        "badge_2fa_fido2": "Security Key",
        "btn_setup_2fa": "＋ Add Two-Factor Authentication",
        "btn_reset_2fa": "Reset 2FA",
        "btn_disable_2fa": "Disable 2FA",

        // 2FA type selector
        "choose_2fa_method": "Choose verification method",
        "method_fido2_title": "Security Key",
        "method_fido2_desc": "FIDO2 hardware key (YubiKey, etc.)",
        "method_totp_title": "Authenticator",
        "method_totp_desc": "TOTP time-based code",

        // TOTP setup
        "step_1_scan": "1. Scan the QR code below with your Authenticator:",
        "label_manual_secret": "Manual Secret Key",
        "step_2_enter": "2. Enter the 6-digit code from the app:",
        "btn_verify_enable": "Verify & Enable",
        
        "msg_enter_6_digits": "Please enter a 6-digit code",
        "msg_2fa_enabled": "✓ Two-Factor Authentication successfully enabled",
        "msg_2fa_wrong": "Incorrect code, please try again",
        "alert_disable_2fa": "Are you sure you want to disable Two-Factor Authentication? This will reduce your account security.",

        // FIDO2 key management in admin
        "section_fido2_keys_title": "FIDO2 Security Keys",
        "fido2_key_count_tip": "Minimum 2 keys required to enable; maximum 6",
        "fido2_min_warning": "Below minimum (2 keys) — FIDO2 Two-Factor Authentication has been automatically disabled",
        "fido2_max_reached": "Maximum reached (6 keys)",
        "btn_add_fido2_key": "＋ Add Security Key",
        "btn_enable_fido2": "Enable FIDO2 Two-Factor Authentication",
        "placeholder_fido2_key_name": "Name this key (optional)",
        "default_fido2_key_name": "Security Key",
        "msg_fido2_key_added": "✓ '{0}' added successfully!",
        "alert_delete_fido2_key": "Are you sure you want to delete this security key?",
        "transport_usb": "USB",
        "transport_nfc": "NFC",
        "transport_ble": "Bluetooth",
        "transport_internal": "Built-in",
        
        "section_rc_title": "Recovery Codes",
        "section_rc_desc": "If you lose access to your Two-Factor Authentication device, you can use a recovery code to sign in. Each code can only be used once. Please keep them safe.",
        "badge_not_gen": "None",
        "badge_rc_remaining": "{0} left",
        "btn_gen_rc": "Generate Codes",
        "rc_warning": "⚠️ Please save these recovery codes in a safe place immediately. They will only be shown once.",
        "btn_copy_all": "Copy All",
        "msg_copied": "✓ Copied to clipboard",
        "alert_regen_rc": "Generating new recovery codes will invalidate all existing ones. Continue?",

        "btn_logout": "Sign Out",
        "btn_logout_all": "Sign out from all devices",
        "msg_logout_all_confirm": "Are you sure you want to sign out from all devices? This will immediately invalidate all active sessions.",

        // Sudo modal
        "sudo_title": "Confirm Your Password",
        "sudo_desc": "For security reasons, please enter your current password to continue.",
        "sudo_btn_confirm": "Confirm",
        "sudo_btn_cancel": "Cancel"
    }
};

const currentLang = (navigator.language || navigator.userLanguage).toLowerCase().startsWith('zh') ? 'zh' : 'en';

function t(key, ...args) {
    let str = translations[currentLang][key] || translations['zh'][key] || key;
    args.forEach((arg, i) => {
        str = str.replace(`{${i}}`, arg);
    });
    return str;
}

function applyTranslations() {
    // Update elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            el.textContent = translations[currentLang][key];
        }
    });

    // Update elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLang][key]) {
            el.setAttribute('placeholder', translations[currentLang][key]);
        }
    });

    // Specific logic for document title if present
    if (document.title && document.body.dataset.pageTitleKey) {
        document.title = t(document.body.dataset.pageTitleKey);
    }
}

document.addEventListener('DOMContentLoaded', applyTranslations);
