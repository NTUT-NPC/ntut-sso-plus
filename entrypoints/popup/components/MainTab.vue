<script setup lang="ts">
import { browser } from 'wxt/browser';
import { ref, onMounted } from 'vue';
import { SERVICES, DEFAULT_FAVORITES } from '../constants';
import { startSSO } from '../sso';

const favorites = ref<string[]>([]);

onMounted(async () => {
  const result = await browser.storage.local.get({ custom_favorites: DEFAULT_FAVORITES });
  favorites.value = result.custom_favorites as string[];
});

const getServiceName = (code: string) => {
  for (const cat in SERVICES) {
    const category = SERVICES[cat as keyof typeof SERVICES];
    for (const [name, c] of Object.entries(category)) {
      if (c === code) return name;
    }
  }
  return code;
};

const handleSSO = (code: string) => {
  startSSO(code);
};
</script>

<template>
  <div id="service-container">
    <div class="priority-section">
      <div class="category-title">
        <span>推薦服務</span>
      </div>
      
      <!-- Big Hero Card for iStudy PLUS -->
      <div class="hero-card" @click="handleSSO('ischool_plus_oauth')">
        <div class="sub-card-content">
          <div class="sub-icon-box">
            <div class="sub-icon-svg mask school"></div>
          </div>
          <div class="sub-info">
            <h4>北科 i 學園 PLUS</h4>
            <p>輕鬆下載 PDF 和上課錄影</p>
          </div>
        </div>
        <span class="sub-arrow">➔</span>
      </div>
      
      <!-- Sub-cards for Email and Student Query -->
      <div class="sub-cards-grid">
        <div class="sub-card" @click="handleSSO('zimbrasso_oauth')">
          <div class="sub-card-content">
            <div class="sub-icon-box">
              <div class="sub-icon-svg mask mail"></div>
            </div>
            <div class="sub-info">
              <h4>電子郵件</h4>
              <p>Zimbra 電子郵件</p>
            </div>
          </div>
          <span class="sub-arrow">➔</span>
        </div>
        
        <div class="sub-card" @click="handleSSO('sa_003_oauth')">
          <div class="sub-card-content">
            <div class="sub-icon-box">
              <div class="sub-icon-svg mask search"></div>
            </div>
            <div class="sub-info">
              <h4>學生查詢專區</h4>
              <p>請假、成績與學籍資料</p>
            </div>
          </div>
          <span class="sub-arrow">➔</span>
        </div>
      </div>
    </div>

    <div class="category-title">
      <span>常用服務</span>
    </div>
    
    <div v-if="favorites.length === 0" class="empty-favorites-msg glass-card">
      尚未設定常用服務
    </div>
    <div v-else class="grid-layout">
      <div 
        v-for="code in favorites" 
        :key="code" 
        class="grid-item glass-card active"
        @click="handleSSO(code)"
      >
        {{ getServiceName(code) }}
      </div>
    </div>

    <div v-for="(items, category) in SERVICES" :key="category">
      <div class="category-title">
        {{ category }}
      </div>
      <div class="grid-layout">
        <div 
          v-for="(code, name) in items" 
          :key="code" 
          class="grid-item glass-card active"
          @click="handleSSO(code)"
        >
          {{ name }}
        </div>
      </div>
    </div>
    
    <a 
      class="repo-link" 
      href="https://github.com/NTUT-NPC/ntut-sso-plus" 
      target="_blank" 
      rel="noopener noreferrer"
    >
      GitHub Repository
    </a>
  </div>
</template>

<style scoped>
#service-container {
    padding: var(--spacing-xs) 0;
}

.repo-link {
    display: block;
    text-align: center;
    margin-top: var(--spacing-xl);
    padding: var(--spacing-md);
    font-size: 11px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--transition-fast);
}

.repo-link:hover {
    color: var(--text-main);
    text-decoration: underline;
}

.empty-favorites-msg {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-sub);
    font-size: 14px;
    margin-bottom: var(--spacing-md);
}
.sub-icon-svg.mask {
  stroke: none;
  background-color: var(--primary);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.sub-icon-svg.school {
  mask-image: url('/icons/school.svg');
  -webkit-mask-image: url('/icons/school.svg');
}

.sub-icon-svg.mail {
  mask-image: url('/icons/mail.svg');
  -webkit-mask-image: url('/icons/mail.svg');
}

.sub-icon-svg.search {
  mask-image: url('/icons/search.svg');
  -webkit-mask-image: url('/icons/search.svg');
}

:global(body[data-theme="dark"] .sub-icon-svg.mask) {
  background-color: var(--accent);
}
</style>
