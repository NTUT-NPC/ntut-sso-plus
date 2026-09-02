<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { browser } from 'wxt/browser';
import jsQR from 'jsqr';
import { SERVICES } from '@/utils/constants';
import { getSsoUrl } from '@/utils/sso';
import { parseQrPayload, aesEncryptGCM, sendToFirebase } from '@/utils/qrLogin';
import type { QrPayload } from '@/utils/qrLogin';

// ============================================================
// State
// ============================================================
type Step = 'scan' | 'select' | 'sending' | 'success' | 'error';

const currentStep = ref<Step>('scan');
const qrPayload = ref<QrPayload | null>(null);

// Camera state
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const cameraError = ref('');
const isCameraActive = ref(false);
let mediaStream: MediaStream | null = null;
let scanAnimId: number | null = null;

// Manual input fallback
const showManualInput = ref(false);
const manualJson = ref('');
const manualError = ref('');

// Service selection
const selectedService = ref('');
const ssoLoading = ref(false);
const ssoError = ref('');

// Send state
const sendError = ref('');

// Theme
onMounted(async () => {
    const result = await browser.storage.local.get(['theme']);
    if (result.theme) {
        document.body.setAttribute('data-theme', result.theme as string);
    }
    await startCamera();
});

onUnmounted(() => {
    stopCamera();
});

// ============================================================
// Step Wizard Helpers
// ============================================================
const stepState = computed(() => ({
    scan: currentStep.value === 'scan' ? 'active' : 'completed',
    select: currentStep.value === 'select' ? 'active'
        : (currentStep.value !== 'scan' ? 'completed' : ''),
    send: ['sending', 'success', 'error'].includes(currentStep.value) ? 'active' : '',
}));

const lineState = computed(() => ({
    line1: currentStep.value !== 'scan' ? 'completed' : '',
    line2: ['sending', 'success', 'error'].includes(currentStep.value) ? 'completed' : '',
}));

// ============================================================
// Camera QR Scanning
// ============================================================
async function startCamera() {
    cameraError.value = '';
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
        });
        isCameraActive.value = true;

        await nextTick();
        if (videoEl.value) {
            videoEl.value.srcObject = mediaStream;
            videoEl.value.play();
            requestAnimationFrame(scanFrame);
        }
    } catch (err: any) {
        isCameraActive.value = false;
        if (err.name === 'NotAllowedError') {
            cameraError.value = '相機權限被拒絕，請在瀏覽器設定中允許存取相機';
        } else if (err.name === 'NotFoundError') {
            cameraError.value = '找不到相機裝置';
        } else {
            cameraError.value = '無法啟動相機：' + (err.message || '未知錯誤');
        }
        // Auto-show manual input as fallback
        showManualInput.value = true;
    }
}

function scanFrame() {
    if (!isCameraActive.value || !videoEl.value || !canvasEl.value) return;

    const video = videoEl.value;
    const canvas = canvasEl.value;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanAnimId = requestAnimationFrame(scanFrame);
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
    });

    if (code && code.data) {
        handleQrResult(code.data);
        return; // Stop scanning
    }

    scanAnimId = requestAnimationFrame(scanFrame);
}

function stopCamera() {
    isCameraActive.value = false;
    if (scanAnimId) {
        cancelAnimationFrame(scanAnimId);
        scanAnimId = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
}

// ============================================================
// QR Result Handling
// ============================================================
function handleQrResult(raw: string) {
    try {
        const payload = parseQrPayload(raw);
        qrPayload.value = payload;
        stopCamera();
        currentStep.value = 'select';
    } catch (err: any) {
        // Invalid QR — keep scanning, don't switch step
        // Could optionally show brief toast here
    }
}

// ============================================================
// Manual Input
// ============================================================
function handleManualSubmit() {
    manualError.value = '';
    const raw = manualJson.value.trim();
    if (!raw) {
        manualError.value = '請輸入 QR Code 內容';
        return;
    }
    try {
        const payload = parseQrPayload(raw);
        qrPayload.value = payload;
        stopCamera();
        currentStep.value = 'select';
    } catch (err: any) {
        manualError.value = err.message;
    }
}

// ============================================================
// Service Selection → SSO → Encrypt → Send
// ============================================================
async function handleServiceSelect(code: string, name: string) {
    if (ssoLoading.value || !qrPayload.value) return;

    selectedService.value = name;
    ssoLoading.value = true;
    ssoError.value = '';

    try {
        // Step 1: Get SSO URL (no tab navigation)
        const ssoUrl = await getSsoUrl(code);

        // Step 2: Encrypt with AES-256-GCM
        // ⚠️ SECURITY: ssoUrl is never logged or displayed
        const encrypted = await aesEncryptGCM(ssoUrl, qrPayload.value.key);

        // Step 3: Send to Firebase
        currentStep.value = 'sending';
        await sendToFirebase(qrPayload.value.id, encrypted);

        // Step 4: Clear sensitive data
        qrPayload.value = { id: qrPayload.value.id, key: '' };

        // Step 5: Success
        currentStep.value = 'success';
    } catch (err: any) {
        ssoError.value = err.message;
        sendError.value = err.message;
        currentStep.value = 'error';
    } finally {
        ssoLoading.value = false;
    }
}

// ============================================================
// Reset / Retry
// ============================================================
function resetToScan() {
    qrPayload.value = null;
    selectedService.value = '';
    ssoError.value = '';
    sendError.value = '';
    manualJson.value = '';
    manualError.value = '';
    showManualInput.value = false;
    currentStep.value = 'scan';
    startCamera();
}

function retryService() {
    ssoError.value = '';
    sendError.value = '';
    currentStep.value = 'select';
}

// ============================================================
// Service Name Lookup
// ============================================================
function getServiceName(code: string): string {
    for (const cat in SERVICES) {
        const category = SERVICES[cat as keyof typeof SERVICES];
        for (const [name, c] of Object.entries(category)) {
            if (c === code) return name;
        }
    }
    return code;
}
</script>

<template>
  <div class="qr-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1 class="page-title">NTUT SSO<span class="plus-sign">+</span> 掃碼登入</h1>
      <p class="page-subtitle">請在電腦瀏覽器打開 <strong>login.ntut.app</strong></p>
    </div>

    <!-- Step Wizard -->
    <div class="wizard-steps">
      <div class="step-item" :class="stepState.scan">
        <div class="step-dot" :class="stepState.scan">1</div>
        <span class="step-label">掃碼</span>
      </div>
      <div class="step-line" :class="lineState.line1"></div>
      <div class="step-item" :class="stepState.select">
        <div class="step-dot" :class="stepState.select">2</div>
        <span class="step-label">選擇服務</span>
      </div>
      <div class="step-line" :class="lineState.line2"></div>
      <div class="step-item" :class="stepState.send">
        <div class="step-dot" :class="stepState.send">3</div>
        <span class="step-label">授權</span>
      </div>
    </div>

    <!-- ========== STEP 1: Camera Scan ========== -->
    <div v-if="currentStep === 'scan'" class="glass-card scanner-card animate-fade-in">
      <div class="category-title">掃描 QR Code</div>

      <!-- Camera Preview -->
      <div class="camera-container" v-if="isCameraActive || !cameraError">
        <video ref="videoEl" playsinline muted></video>
        <canvas ref="canvasEl"></canvas>
        <div class="scan-overlay" v-if="isCameraActive">
          <div class="scan-frame">
            <div class="scan-laser"></div>
            <div class="scan-frame-bottom"></div>
          </div>
        </div>
      </div>

      <!-- Camera Error -->
      <div v-if="cameraError" class="camera-error glass-card">
        <div class="camera-error-icon">📷</div>
        <div>{{ cameraError }}</div>
        <button class="modern-btn secondary" @click="startCamera" style="margin-top: 8px; width: auto;">
          重試相機
        </button>
      </div>

      <!-- Manual Input Fallback -->
      <div class="manual-input-section">
        <div
          class="manual-toggle"
          :class="{ open: showManualInput }"
          @click="showManualInput = !showManualInput"
        >
          <span>📋 手動貼上 QR 內容</span>
          <span class="chevron">▼</span>
        </div>
        <div v-if="showManualInput" class="manual-content animate-fade-in">
          <input
            type="text"
            class="input-field"
            v-model="manualJson"
            placeholder='{"id":"...","key":"..."}'
            @keyup.enter="handleManualSubmit"
          >
          <div v-if="manualError" style="color: var(--error); font-size: 12px; margin-top: 4px;">
            {{ manualError }}
          </div>
          <button
            class="modern-btn"
            style="margin-top: var(--spacing-sm); width: 100%;"
            @click="handleManualSubmit"
          >
            確認
          </button>
        </div>
      </div>
    </div>

    <!-- ========== STEP 2: Service Selection ========== -->
    <div v-if="currentStep === 'select'" class="service-section animate-fade-in">
      <!-- Scanned Info Badge -->
      <div class="scanned-info glass-card">
        <span class="check-icon">✓</span>
        <span>已掃描成功 — 請選擇要登入的服務</span>
      </div>

      <!-- Loading Overlay on service grid when SSO is in progress -->
      <div v-if="ssoLoading" class="glass-card result-card animate-fade-in">
        <div class="result-icon spin">⏳</div>
        <div class="result-title">正在取得「{{ selectedService }}」的授權...</div>
        <div class="result-subtitle">正在執行 SSO 流程，請稍候</div>
      </div>

      <!-- Service Grid -->
      <template v-if="!ssoLoading">
        <div v-for="(items, category) in SERVICES" :key="category">
          <div class="category-title">{{ category }}</div>
          <div class="grid-layout">
            <div
              v-for="(code, name) in items"
              :key="code"
              class="grid-item glass-card active"
              @click="handleServiceSelect(code, String(name))"
            >
              {{ name }}
            </div>
          </div>
        </div>
      </template>

      <!-- Back button -->
      <div style="text-align: center; margin-top: var(--spacing-md);">
        <button class="modern-btn secondary" @click="resetToScan" style="width: auto;">
          ← 重新掃碼
        </button>
      </div>
    </div>

    <!-- ========== STEP 3: Sending ========== -->
    <div v-if="currentStep === 'sending'" class="glass-card result-card animate-fade-in">
      <div class="result-icon spin">🔒</div>
      <div class="result-title">正在加密並傳送授權...</div>
      <div class="result-subtitle">使用 AES-256-CBC 端對端加密，安全傳送至電腦端</div>
    </div>

    <!-- ========== SUCCESS ========== -->
    <div v-if="currentStep === 'success'" class="glass-card result-card animate-fade-in">
      <div class="result-icon">✅</div>
      <div class="result-title">授權成功！</div>
      <div class="result-subtitle">
        已將「{{ selectedService }}」的登入授權安全傳送至電腦端。<br>
        電腦端將自動解密並跳轉。
      </div>
      <div class="result-actions">
        <button class="modern-btn" @click="resetToScan">掃描下一個</button>
      </div>
    </div>

    <!-- ========== ERROR ========== -->
    <div v-if="currentStep === 'error'" class="glass-card result-card animate-fade-in">
      <div class="result-icon">❌</div>
      <div class="result-title">授權失敗</div>
      <div class="result-subtitle">{{ sendError || ssoError }}</div>
      <div class="result-actions">
        <button class="modern-btn secondary" @click="resetToScan">重新掃碼</button>
        <button class="modern-btn" @click="retryService">重試</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Step completed checkmark */
.step-dot.completed::after {
  content: '✓';
  font-size: 14px;
}

/* Hide the number when completed */
.step-dot.completed {
  font-size: 0;
}
</style>
