import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

import { browser } from 'wxt/browser';

const isAlreadyMobileTab = window.location.search.includes('mobile=1');
let redirected = false;

const doRedirect = () => {
    if (redirected) return;
    redirected = true;
    browser.tabs.create({ url: browser.runtime.getURL('/popup.html?mobile=1') });
    window.close();
};

// 1. Fast synchronous check to prevent UI flash
if (!isAlreadyMobileTab && navigator.userAgent.includes('Android')) {
    doRedirect();
}

// 2. Secondary verification using Extension API (as a fallback)
const checkPlatform = async () => {
    try {
        const info = await browser.runtime.getPlatformInfo();
        if (info.os === 'android' && !isAlreadyMobileTab) {
            doRedirect();
        }
    } catch (e) {
        // Fallback or ignore
    }
};

checkPlatform();

createApp(App).mount('#app');
