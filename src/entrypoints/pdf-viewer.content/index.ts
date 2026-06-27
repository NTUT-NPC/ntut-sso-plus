export default defineContentScript({
    matches: ['https://istudy.ntut.edu.tw/*'],
    runAt: 'document_start',
    allFrames: true,
    matchAboutBlank: true,
    world: 'MAIN',
    main() {
        // 1. Force Download variable to 1
        function lockDownload() {
            try {
                if (!(window as any).__ntut_sso_locked) {
                    Object.defineProperty(window, 'Download', { get: () => 1, configurable: false });
                    (window as any).__ntut_sso_locked = true;
                }
            } catch (e) {
                (window as any).Download = 1;
            }
        }

        // 2. Intercept document.write to patch the variable in dynamic frames
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

        // 3. Unhide the native download and print buttons
        function unhide() {
            const selectors = ['#download', '#print', '#secondaryDownload', '#secondaryPrint'];
            selectors.forEach(s => {
                const el = document.querySelector(s) as HTMLElement;
                if (el) {
                    el.style.setProperty('display', 'inline-block', 'important');
                    el.style.setProperty('visibility', 'visible', 'important');
                    el.classList.remove('hiddenMediumView', 'hiddenSmallView', 'hiddenLargeView', 'hidden');
                }
            });
        }

        // Run immediately and periodically for a few seconds
        lockDownload();
        let count = 0;
        const interval = setInterval(() => {
            lockDownload();
            unhide();
            if (++count > 20) clearInterval(interval);
        }, 500);

        new MutationObserver(unhide).observe(document.documentElement, { childList: true, subtree: true });
    },
});
