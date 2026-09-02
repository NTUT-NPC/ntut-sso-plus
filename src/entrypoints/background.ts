export default defineBackground(() => {
    // 解決手機版瀏覽器（Titanium, Firefox Android, Edge Android）Popup 顯示不完美的問題
    // 如果偵測到是 Android 裝置，我們就把預設的 popup 拔掉，改用開啟新分頁的方式顯示
    browser.runtime.getPlatformInfo().then((info) => {
        if (info.os === 'android') {
            const actionAPI = browser.action || browser.browserAction;
            if (actionAPI) {
                actionAPI.setPopup({ popup: "" });
            }
        }
    });

    const actionAPI = browser.action || browser.browserAction;
    if (actionAPI) {
        actionAPI.onClicked.addListener((tab) => {
            browser.tabs.create({ url: browser.runtime.getURL("/popup.html?mobile=1") });
        });
    }

    let activeDownloads: Record<number, boolean> = {};

    interface DownloadMessage {
        action: string;
        url?: string;
        filename?: string;
    }

    browser.runtime.onMessage.addListener((message: DownloadMessage, sender, sendResponse) => {
        if (message.action === 'download_video') {
            const { url, filename } = message;

            if (!url) {
                sendResponse({ success: false, error: 'No URL provided' });
                return true;
            }

            browser.downloads.download(
                {
                    url: url,
                    filename: filename || 'istream_video.mp4',
                    conflictAction: 'uniquify',
                },
            ).then((downloadId) => {
                console.log('[SSO+ BG] Download started, id:', downloadId);
                activeDownloads[downloadId] = true;
                sendResponse({ success: true, downloadId });
            }).catch((error) => {
                console.error('[SSO+ BG]', error.message);
                sendResponse({ success: false, error: error.message });
            });

            return true;
        }

        if (message.action === 'relay_video_click') {
            if (sender.tab?.id) {
                browser.tabs.sendMessage(sender.tab.id, {
                    action: 'trigger_video_click',
                    identifier: (message as any).identifier
                });
            }
            return true;
        }

        if (message.action === 'get_sso_redirect') {
            const { actionUrl, formData } = message as any;
            
            (async () => {
                let capturedUrl: string | null = null;
                const listener = (details: any): any => {
                    if (details.url !== actionUrl) return undefined;
                    const locationHeader = details.responseHeaders?.find((h: any) => h.name.toLowerCase() === 'location');
                    if (locationHeader?.value) {
                        capturedUrl = new URL(locationHeader.value, details.url).href;
                    }
                    return undefined;
                };
                
                try {
                    const actionUrlObj = new URL(actionUrl);
                    browser.webRequest.onHeadersReceived.addListener(
                        listener,
                        { urls: [`${actionUrlObj.origin}/*`] },
                        ['responseHeaders']
                    );

                    const body = new URLSearchParams(formData);
                    await fetch(actionUrl, {
                        method: 'POST',
                        body: body,
                        redirect: 'manual',
                        credentials: 'include'
                    });
                } catch (err: any) {
                    // Fetch will throw a TypeError for cross-origin opaque redirects.
                    // This is expected! The onHeadersReceived listener should have already caught the Location header.
                    console.warn("[SSO+ BG] Fetch threw (expected for opaque redirects):", err.message);
                } finally {
                    browser.webRequest.onHeadersReceived.removeListener(listener);
                    if (capturedUrl) {
                        sendResponse({ success: true, url: capturedUrl });
                    } else {
                        sendResponse({ success: false, error: 'No redirect Location found' });
                    }
                }
            })();
            
            return true;
        }
    });

    browser.downloads.onChanged.addListener(async (delta) => {
        if (!delta || !delta.id || !activeDownloads[delta.id]) return;

        // Fetch the full DownloadItem to get current progress
        const [item] = await browser.downloads.search({ id: delta.id });
        if (!item) return;

        let status = delta.state?.current || item.state;
        let progress = null;

        if (item.totalBytes > 0) {
            progress = Math.floor((item.bytesReceived / item.totalBytes) * 100);
        }

        browser.runtime.sendMessage({
            action: 'download_progress',
            downloadId: delta.id,
            status,
            progress,
        }).catch(() => {
            // Ignore errors when sending progress (e.g. popup closed)
        });

        if (status === 'complete' || status === 'interrupted') {
            delete activeDownloads[delta.id];
        }
    });
});
