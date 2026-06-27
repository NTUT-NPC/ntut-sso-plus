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

// 偵測是否為 Firefox Android
const isFirefoxAndroid = navigator.userAgent.includes('Android') && navigator.userAgent.includes('Firefox');

if (!isAlreadyMobileTab && isFirefoxAndroid) {
    doRedirect();
}

createApp(App).mount('#app');
