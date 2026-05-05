export default defineContentScript({
    matches: ['https://istudy.ntut.edu.tw/*'],
    runAt: 'document_start',
    allFrames: true,
    matchAboutBlank: true,
    world: 'MAIN',
    main() {
        /**
         * NTUT iStudy PDF Restrictions Bypass
         * 
         * [CONTEXT]
         * iStudy disables native PDF.js features (Download/Print) by forcing the global 
         * `Download` variable to 0. It also hides the UI buttons via CSS.
         * 
         * [STRATEGY]
         * To restore these features safely, we implement a multi-layered bypass:
         * 1. Context Guard  : Prevents logic leakage to non-viewer pages.
         * 2. Property Lock : Traps 'Download' assignments using Getters/Setters.
         * 3. HTML Patching : Intercepts document.write for dynamic iframe content.
         * 4. CSS Injection  : Forces button visibility with zero runtime overhead.
         */

        function isPdfJsViewerUrl(urlString: string): boolean {
            try {
                const url = new URL(urlString);
                const path = url.pathname.toLowerCase();
                const search = url.search.toLowerCase();
                const hash = url.hash.toLowerCase();
                return (
                    path.endsWith('/viewer.html') ||
                    path.includes('/viewer.html') ||
                    path.includes('/pdf.js/') ||
                    search.includes('file=') ||
                    hash.includes('file=')
                );
            } catch {
                return false;
            }
        }

        function isPdfJsViewerContext(): boolean {
            if (isPdfJsViewerUrl(window.location.href)) {
                return true;
            }
            if (window.location.href === 'about:blank') {
                try {
                    if (window.parent && window.parent !== window && isPdfJsViewerUrl(window.parent.location.href)) {
                        return true;
                    }
                } catch { }
                try {
                    if (window.top && window.top !== window && isPdfJsViewerUrl(window.top.location.href)) {
                        return true;
                    }
                } catch { }
            }
            return false;
        }

        // STEP 1: RESTRICT EXECUTION CONTEXT
        // We only want to patch the PDF viewer. Running this on normal iStudy pages
        // might break unrelated functionality (like the SSO login itself).
        if (!isPdfJsViewerContext()) {
            return;
        }

        // STEP 2: GLOBAL VARIABLE LOCK
        // We use a Getter/Setter trap on 'window.Download'.
        // - Getter: Always returns 1, overriding any page-level assignments.
        // - Setter: An empty function that "swallows" assignments.
        //   Crucial for preventing TypeErrors in strict-mode scripts when they try 
        //   to run 'Download = 0'.
        function lockDownload() {
            try {
                if (!(window as any).__ntut_sso_locked) {
                    Object.defineProperty(window, 'Download', {
                        get: () => 1,
                        set: () => {
                            // Swallow assignments to prevent the page from disabling features
                            // and to prevent crashes in strict-mode scripts.
                        },
                        configurable: true,
                        enumerable: true,
                    });
                    (window as any).__ntut_sso_locked = true;
                }
            } catch (e) {
                (window as any).Download = 1;
            }
        }

        // STEP 3: DYNAMIC HTML INTERCEPTION
        // Some frames are built dynamically using document.write(). By the time 
        // our script runs, the HTML might already contain hardcoded '<script>Download=0</script>'.
        // We patch 'write' to perform a regex "search-and-replace" on the incoming HTML stream.
        const originalWrite = Document.prototype.write;
        Document.prototype.write = function (this: Document, ...args: any[]) {
            const patchedArgs = args.map(arg => {
                if (typeof arg === 'string' && arg.includes('Download')) {
                    return arg.replace(/Download\s*=\s*0/g, 'Download=1');
                }
                return arg;
            });
            return originalWrite.apply(this, patchedArgs as any);
        };

        // STEP 4: UI VISIBILITY ENFORCEMENT (CSS INJECTION)
        // We inject a style block once. This is more efficient than a MutationObserver
        // because the browser handles the visibility natively for all current and 
        // future elements, with zero JavaScript overhead.
        const style = document.createElement('style');
        style.textContent = `
            #download, #print, #secondaryDownload, #secondaryPrint {
                display: inline-block !important;
                visibility: visible !important;
            }
            /* Override iStudy's responsive hiding classes */
            .hiddenMediumView, .hiddenSmallView, .hiddenLargeView, .hidden {
                display: inline-block !important;
                visibility: visible !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);

        // Run immediately and periodically for a few seconds to ensure variable lock
        lockDownload();
        let count = 0;
        const interval = setInterval(() => {
            lockDownload();
            if (++count > 20) clearInterval(interval);
        }, 500);
    },
});
