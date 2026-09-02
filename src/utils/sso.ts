import { BASE_URL } from '@/utils/constants';
import { decrypt, isEncryptedFormat } from '@/utils/cryptoUtils';

/**
 * Core SSO flow: login → ssoIndex → form submit → get redirect URL.
 * Returns the final SSO URL without opening a new tab.
 */
export async function getSsoUrl(apOu: string): Promise<string> {
    const storage = await browser.storage.local.get(['uid', 'pwd']);
    const uid = storage.uid as string;
    let pwd = storage.pwd as string;
    if (isEncryptedFormat(pwd)) {
        let decryptedPwd = null;
        try {
            decryptedPwd = await decrypt(pwd);
        } catch (e) {
            decryptedPwd = null;
        }
        if (!decryptedPwd) {
            await browser.storage.local.remove(['uid', 'pwd']);
            throw new Error("登入資訊已失效，請重新登入");
        }
        pwd = decryptedPwd;
    }
    if (!uid || !pwd) throw new Error("請先登入");

    const loginParams = new URLSearchParams({ muid: uid, mpassword: pwd });
    const loginRes = await fetch(`${BASE_URL}login.do?${loginParams.toString()}`, { method: 'POST' });
    const loginText = await loginRes.text();
    const loginBody = JSON.parse(loginText);
    if (!loginBody.success) throw new Error("登入失敗");

    const ssoIndexRes = await fetch(`${BASE_URL}ssoIndex.do?apOu=${apOu}`, {
        headers: { 'Referer': `${BASE_URL}login.do` }
    });
    const html = await ssoIndexRes.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const form = doc.querySelector('form[name="ssoForm"]');
    if (!form) throw new Error("找不到 SSO 表單，請檢查該服務是否目前可用");

    const actionAttr = form.getAttribute('action');
    if (!actionAttr) throw new Error("找不到表單動作");

    const actionUrl = new URL(actionAttr, BASE_URL).href;
    const formData = new URLSearchParams();
    form.querySelectorAll('input').forEach(inp => {
        if (inp.name) formData.append(inp.name, inp.value || "");
    });

    try {
        const bgRes = await browser.runtime.sendMessage({
            action: 'get_sso_redirect',
            actionUrl: actionUrl,
            formData: Array.from(formData.entries())
        });
        
        if (bgRes && bgRes.success && bgRes.url) {
            return bgRes.url.replace('http://', 'https://');
        }
    } catch (err) {
        console.warn("[SSO+] Background redirect capture failed:", err);
    }

    const manualJumpUrl = `${actionUrl}?${formData.toString()}`;
    // Fallback: construct manual jump URL (original behavior)
    return manualJumpUrl;
}

/**
 * Full SSO flow with tab navigation (original behavior).
 * Uses getSsoUrl internally, then opens the result in a new tab.
 */
export async function startSSO(apOu: string) {
    document.body.classList.add('fade-out-exit');

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        const finalUrl = await getSsoUrl(apOu);

        browser.tabs.create({ url: finalUrl }, tab => {
            if (tab && tab.id) monitorFinalRedirect(tab.id);
        });

    } catch (err: any) {
        alert("錯誤: " + err.message);
    }
}

function monitorFinalRedirect(tabId: number) {
    const listener = (updatedTabId: number, changeInfo: Browser.tabs.OnUpdatedInfo) => {
        if (updatedTabId === tabId && changeInfo.url) {
            const url = changeInfo.url;
            if (!url.includes('ssoIndex.do') && !url.includes('login.do')) {
                browser.tabs.update(tabId, { active: true });
                browser.tabs.onUpdated.removeListener(listener);
            }
        }
    };
    browser.tabs.onUpdated.addListener(listener);
}