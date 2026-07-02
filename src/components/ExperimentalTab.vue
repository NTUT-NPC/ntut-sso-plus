<script setup lang="ts">
import { ref, onMounted, toRaw } from 'vue';
import { browser } from 'wxt/browser';
import { startSSO } from '@/utils/sso';
import CollapsibleGuide from './CollapsibleGuide.vue';
import FileDownloadPreview from './FileDownloadPreview.vue';
import CourseSelectorPreview from './CourseSelectorPreview.vue';
import VideoDownloadPreview from './VideoDownloadPreview.vue';
import ToggleSwitch from './ToggleSwitch.vue';
import EditTab from './EditTab.vue';

defineProps<{
  isLoggedIn?: boolean;
}>();

const emit = defineEmits(['favorites-changed']);

const isDarkMode = ref(false);
const debugMode = ref(false);
const isUserCssEnabled = ref(false);

onMounted(async () => {
  const data = await browser.storage.local.get(['debugMode', 'theme', 'isUserCssEnabled', 'uid']) as { 
    debugMode?: boolean; 
    theme?: string; 
    isUserCssEnabled?: boolean;
    uid?: string;
  };
  debugMode.value = !!data.debugMode;
  isDarkMode.value = data.theme === 'dark';
  isUserCssEnabled.value = data.isUserCssEnabled === true;

  if (data.uid) {
    vpnUsername.value = data.uid;
  }
});

const toggleDebugMode = async () => {
  await browser.storage.local.set({ debugMode: debugMode.value });
};

const toggleCss = async () => {
  await browser.storage.local.set({ isUserCssEnabled: isUserCssEnabled.value });
};

const toggleDarkMode = async () => {
  const newTheme = isDarkMode.value ? 'dark' : 'light';
  document.body.setAttribute('data-theme', newTheme);
  await browser.storage.local.set({ theme: newTheme });
};

const handleSSO = (code: string) => {
  startSSO(code);
};

const selectedDistro = ref<'debian' | 'fedora' | 'arch'>('debian');
const vpnUsername = ref('');

const copyStatus = ref({
  install: false,
  nmcli: false,
});

const copyToClipboard = async (text: string, key: 'install' | 'nmcli') => {
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.value[key] = true;
    setTimeout(() => {
      copyStatus.value[key] = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
};

const getInstallCommand = () => {
  switch (selectedDistro.value) {
    case 'debian':
      return 'sudo apt update && sudo apt install -y network-manager-openconnect-gnome';
    case 'fedora':
      return 'sudo dnf install -y NetworkManager-openconnect-gnome';
    case 'arch':
      return 'sudo pacman -S --needed --noconfirm networkmanager-openconnect';
  }
};

const getNmcliCommand = () => {
  const user = vpnUsername.value.trim() || '<學號>';
  let vpnData = 'gateway=vpn.ntut.edu.tw, protocol=gp, useragent=PAL GlobalProtect';
  let vpnSecrets = `form:_login:user=${user}`;

  return `sudo nmcli connection add type vpn con-name "NTUT-VPN" ifname "*" vpn-type openconnect -- vpn.data "${vpnData}" vpn.secrets "${vpnSecrets}"`;
};
</script>

<template>
  <div class="exp-section animate-fade-in">
    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">編輯常用服務</div>
        <div class="exp-card-desc">點擊下方服務，將其加入或移出您的「常用服務」清單（最多 12 個）。</div>
        <CollapsibleGuide title="展開/收合編輯清單">
          <EditTab @favorites-changed="emit('favorites-changed')" />
        </CollapsibleGuide>
      </div>
    </div>

    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">擴充功能樣式</div>
        <div class="exp-card-desc">切換深色模式以獲得更舒適的夜間使用體驗。</div>
        <ToggleSwitch 
          v-model="isDarkMode"
          label="深色模式"
          description="啟用深色背景與明亮文字的配色方案。"
          @update:modelValue="toggleDarkMode"
        />
      </div>
    </div>

    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">Linux VPN 設定指南</div>
        <div class="exp-card-desc">快速產生在 Linux 系統下透過 NetworkManager 連線至北科大校園 VPN 的指令與安裝說明。</div>

        <div class="distro-selector-container">
          <span class="selector-label">選擇 Linux 發行版：</span>
          <div class="distro-tabs">
            <button 
              type="button"
              class="distro-tab-btn" 
              :class="{ active: selectedDistro === 'debian' }" 
              @click="selectedDistro = 'debian'"
            >
              Ubuntu / Debian
            </button>
            <button 
              type="button"
              class="distro-tab-btn" 
              :class="{ active: selectedDistro === 'fedora' }" 
              @click="selectedDistro = 'fedora'"
            >
              Fedora
            </button>
            <button 
              type="button"
              class="distro-tab-btn" 
              :class="{ active: selectedDistro === 'arch' }" 
              @click="selectedDistro = 'arch'"
            >
              Arch Linux
            </button>
          </div>
        </div>

        <div class="vpn-steps">
          <div class="vpn-step">
            <div class="step-num">Step 1: 安裝套件</div>
            <div class="code-block-wrapper">
              <pre class="code-content"><code>{{ getInstallCommand() }}</code></pre>
              <button 
                class="copy-btn" 
                :class="{ copied: copyStatus.install }" 
                @click="copyToClipboard(getInstallCommand(), 'install')"
              >
                <span>{{ copyStatus.install ? '已複製 ✓' : '複製' }}</span>
              </button>
            </div>
          </div>

          <div class="vpn-step">
            <div class="step-num">Step 2: 建立連線設定</div>
            <p class="step-desc">複製並在終端機中執行下方指令，即可直接建立 VPN 設定：</p>
            <div class="code-block-wrapper">
              <pre class="code-content"><code>{{ getNmcliCommand() }}</code></pre>
              <button 
                class="copy-btn" 
                :class="{ copied: copyStatus.nmcli }" 
                @click="copyToClipboard(getNmcliCommand(), 'nmcli')"
              >
                <span>{{ copyStatus.nmcli ? '已複製 ✓' : '複製' }}</span>
              </button>
            </div>
            <div class="step-tip" style="margin-top: 6px;">
              建立後，您可直接使用 <code>nmcli connection up NTUT-VPN</code> 進行連線，或自系統的網路狀態列選單點擊 <strong>NTUT-VPN</strong> 連線。
            </div>
          </div>
        </div>
      </div>
    </div>


    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">自訂網站樣式</div>
        <div class="exp-card-desc">全域開啟或關閉由本擴充功能提供的網站樣式優化。</div>
        <ToggleSwitch 
          v-model="isUserCssEnabled"
          label="啟用樣式優化"
          description="關閉此選項將停用所有自訂 CSS。變更後請重新整理網頁。"
          @update:modelValue="toggleCss"
        />
      </div>
    </div>

    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">加退選快速填課</div>
        <div class="exp-card-desc">在加退選頁面輸入課號，一鍵自動填入欄位並查詢。</div>
        
        <CollapsibleGuide title="使用方式">
          <div class="guide-split">
            <div class="guide-preview">
              <CourseSelectorPreview />
            </div>
            <div class="guide-info">
              <b>Step 1: 進入加退選</b>
              <p>進入學校的加退選系統頁面，外掛會自動新增一個課號輸入區。</p>
              <b>Step 2: 輸入課號</b>
              <p>在輸入區輸入您想要選的所有課號（可以用空白或逗號分開）。</p>
              <b>Step 3: 自動填表</b>
              <p>點擊「自動填入」，外掛會幫您填好頁面上所有的課號欄位並立刻送出查詢。</p>
            </div>
          </div>
        </CollapsibleGuide>

        <div class="exp-card-actions" v-if="isLoggedIn">
          <button class="modern-btn" @click="handleSSO('aa_030_oauth')">前往加退選一機</button>
          <button class="modern-btn" @click="handleSSO('aa_030_2_oauth')">前往加退選二機</button>
          <button class="modern-btn" @click="handleSSO('aa_030_3_oauth')">前往加退選三機</button>
        </div>
      </div>
    </div>

    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">i 學園檔案下載</div>
        <div class="exp-card-desc">在 i 學園下載檔案。</div>

        <CollapsibleGuide title="使用方式">
          <div class="guide-split">
            <div class="guide-preview">
              <FileDownloadPreview />
            </div>
            <div class="guide-info">
              <b>Step 1: 進入課程</b>
              <p>在 i 學園中進入課程。外掛會自動在側邊欄注入功能區塊。</p>
              <b>Step 2: 載入清單</b>
              <p>點擊左側模擬畫面中的「檔案下載」標題，系統將自動獲取該課程的所有教材檔案。</p>
              <b>Step 3: 一鍵下載</b>
              <p>載入完成後，直接點擊檔案名稱即可下載。</p>
            </div>
          </div>
        </CollapsibleGuide>

        <div class="exp-card-actions" v-if="isLoggedIn">
          <button class="modern-btn" @click="handleSSO('ischool_plus_oauth')">前往北科 i 學園</button>
        </div>
      </div>
    </div>

    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">i 學園影片下載</div>
        <div class="exp-card-desc">在 i 學園下載上課影片。</div>

        <CollapsibleGuide title="使用方式">
          <div class="guide-split">
            <div class="guide-preview">
              <VideoDownloadPreview />
            </div>
            <div class="guide-info">
              <b>Step 1: 進入課程</b>
              <p>在 i 學園中進入課程並播放想要下載的影片。外掛會自動在播放器左上角注入功能區塊。</p>
              <b>Step 2: 下載影片</b>
              <p>點擊左側模擬畫面中的「講師」或「簡報」按鈕，系統將自動下載對應軌道的影片。</p> 
            </div>
          </div>
        </CollapsibleGuide>

        <div class="exp-card-actions" v-if="isLoggedIn">
          <button class="modern-btn" @click="handleSSO('ischool_plus_oauth')">前往北科 i 學園</button>
        </div>
      </div>
    </div>
    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">自動填寫教學評量</div>
        <div class="exp-card-desc">進入教學評量頁面後，自動出現同意/不同意快速填寫按鈕。</div>

        <div class="exp-card-actions" v-if="isLoggedIn">
          <button class="modern-btn" @click="handleSSO('aa_009_oauth')">期末教學評量 1</button>
          <button class="modern-btn" @click="handleSSO('aa_009_2_oauth')">期末教學評量 2</button>
        </div>
      </div>
    </div>



    <div class="glass-card exp-card">
      <div class="exp-card-body">
        <div class="category-title">偵錯模式</div>
        <div class="exp-card-desc">開啟後可在 console 查看 JSON。</div>
        <ToggleSwitch 
          v-model="debugMode"
          label="Debug Mode"
          description="記錄詳細的 API 請求與響應資訊到開發者主控台。"
          @update:modelValue="toggleDebugMode"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.exp-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-xl);
}

.exp-card-desc {
    font-size: 13px;
    color: var(--text-sub);
    margin-bottom: var(--spacing-md);
    line-height: 1.5;
}

.exp-card-actions {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    margin-top: var(--spacing-md);
}

.guide-placeholder {
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: var(--spacing-sm);
}

.guide-split {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-start;
}

.guide-preview {
    flex: 1;
    min-width: 0;
}

.guide-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    color: var(--text-main);
    font-size: 13px;
}

.guide-info b {
    color: var(--text-main);
    margin-top: var(--spacing-xs);
}

.guide-info p {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-sub);
    line-height: 1.6;
}

@media (max-width: 600px) {
    .guide-split {
        flex-direction: column;
    }
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.distro-selector-container {
  margin-bottom: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.selector-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.distro-tabs {
  display: flex;
  gap: var(--spacing-xs);
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 3px;
}

.distro-tab-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  border-radius: calc(var(--radius-sm) - 2px);
  transition: all var(--transition-fast);
}

.distro-tab-btn:hover {
  color: var(--text-main);
  background: var(--border);
}

.distro-tab-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

body[data-theme="dark"] .distro-tab-btn.active {
  background: var(--primary);
  color: var(--text-on-primary);
}

.vpn-input-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.vpn-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.vpn-input {
  max-width: 100%;
}

.vpn-steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.vpn-step {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.step-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.sub-step-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-sub);
  margin-top: var(--spacing-xs);
}

.code-block-wrapper {
  position: relative;
  background: #1e1e1e;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  display: flex;
  align-items: center;
}

body[data-theme="dark"] .code-block-wrapper {
  background: #161b22;
  border-color: #30363d;
}

.code-content {
  flex: 1;
  margin: 0;
  padding: 12px 60px 12px 12px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: #e3e6eb;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
}

.copy-btn.copied {
  background: #10b981;
  border-color: #10b981;
  color: #ffffff;
}

.step-tip {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  line-height: 1.4;
}

.vpn-notes {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.6;
  padding: var(--spacing-sm) 0;
}

.vpn-notes ol, .vpn-notes ul {
  padding-left: 20px;
  margin-bottom: var(--spacing-sm);
}

.vpn-notes li {
  margin-bottom: 4px;
}

.warning-tip {
  background: rgba(239, 68, 68, 0.08);
  border-left: 4px solid var(--error);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 12.5px;
  color: var(--text-main);
  margin-top: var(--spacing-md);
}

body[data-theme="dark"] .warning-tip {
  background: rgba(248, 81, 73, 0.1);
}

.vpn-checkbox-group {
  margin-top: var(--spacing-xs);
  display: flex;
  align-items: center;
}

.vpn-checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 12px;
  color: var(--text-sub);
  cursor: pointer;
  user-select: none;
}

.vpn-checkbox-label input {
  cursor: pointer;
  accent-color: var(--primary);
}

.step-desc {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-bottom: var(--spacing-xs);
  line-height: 1.4;
}
</style>
