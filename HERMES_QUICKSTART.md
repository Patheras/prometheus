# 🏛️ Hermes Quick Start Guide

## 🎯 Gemini'a Login Olma (Tek Seferlik)

### Adım 1: Login Script'ini Çalıştır

```bash
npm run hermes:login
```

### Adım 2: Browser'da Login Ol

Script çalıştığında:

1. ✅ **Browser otomatik açılır** (Chrome/Chromium)
2. ✅ **Gemini sayfası yüklenir** (gemini.google.com)
3. ✅ **Google hesabınla giriş yap**
   - "Sign in" butonuna tıkla
   - Google hesabını seç
   - Şifreni gir
4. ✅ **"Stay signed in" seç** (önemli!)
5. ✅ **Gemini chat arayüzü yüklenene kadar bekle**

### Adım 3: Session Kaydedildi!

Terminal'de şunu göreceksin:

```
✅ Login detected! Gemini app loaded.
✅ Session saved to: ./browser-data/olympus-hermes
🎉 Setup complete! You can now close this window (Ctrl+C).
```

**Ctrl+C** ile kapat. Session kaydedildi! 🎉

---

## 🏛️ Genesis: 20 Özel Oda Oluşturma (Tek Seferlik)

Genesis, Olympus Arsenal'ı oluşturan 20 özel Gemini odasını (Gem) otomatik olarak başlatır. Her oda farklı bir uzmanlık alanına sahiptir.

### Genesis'i Çalıştır

```bash
npm run genesis
```

### Ne Yapar?

Genesis script'i:

1. ✅ **Browser'ı açar** (mevcut session'ı kullanır)
2. ✅ **Gemini'a bağlanır** (login kontrolü yapar)
3. ✅ **20 odayı sırayla oluşturur**:
   - 6 Forge odası (özel yetenekler)
   - 14 Mind odası (uzmanlık alanları)
4. ✅ **Her odaya "ruh" verir** (soul-defining prompt)
5. ✅ **Oda URL'lerini kaydeder** (database'e)
6. ✅ **Özet rapor gösterir** (başarılı/başarısız sayısı)

### Olympus Prime Korunması

**Önemli:** Eğer Olympus Prime (ilk oda) zaten mevcutsa, Genesis mevcut URL'i korur ve yeni bir konuşma oluşturmaz. Bu, komuta merkezinin sürekliliğini sağlar.

### 20 Özel Oda

**Forge Odaları (6)** - Özel yetenekler:
1. **Olympus Prime** - Orkestrasyon merkezi
2. **Image Studio** - Görsel oluşturma (Imagen 3)
3. **Video Studio** - Video oluşturma (Veo)
4. **Deep Search Operations** - Derin araştırma
5. **Canvas Writer** - Uzun içerik yazımı
6. **Canvas Coder** - Karmaşık kod geliştirme

**Mind Odaları (14)** - Uzmanlık alanları:
7. **Social Media Master** - Viral içerik
8. **Marketing & Funnels** - Satış stratejileri
9. **DevOps & Backend** - Sunucu ve altyapı
10. **Frontend & UI/UX** - Arayüz geliştirme
11. **Data Analytics** - Veri analizi
12. **Idea Lab** - Beyin fırtınası
13. **Project Manager** - Proje yönetimi
14. **Finance & Monetization** - Gelir modelleri
15. **Copywriting & Email** - İçerik yazımı
16. **Legal & Compliance** - Hukuki danışmanlık
17. **Learning Center** - Eğitim ve öğretim
18. **Personal Assistant** - Günlük planlama
19. **Optimization & SEO** - SEO optimizasyonu
20. **Web Scraper Logic** - Veri çıkarma

### Örnek Çıktı

```
Configuration:
  Database:        ./data/prometheus.db
  Browser Profile: ./browser-data/olympus-hermes
  Headless:        false

🏛️  Hermes Genesis - Initializing 20 Specialized Rooms

🔍 Checking Gemini login status...
✅ Already logged in to Gemini!

🎯 Initializing Olympus Prime (1/20)...
✅ Olympus Prime initialized successfully (3.2s)

🎯 Initializing Image Studio (2/20)...
✅ Image Studio initialized successfully (4.1s)

🎯 Initializing Video Studio (3/20)...
✅ Video Studio initialized successfully (4.3s)

...

📊 Genesis Summary:
  Total rooms:      20
  Successful:       20
  Failed:           0
  Total duration:   78.5s

✅ Genesis complete! All rooms are ready.
```

### Komut Satırı Seçenekleri

```bash
# Headless modda çalıştır (görünmez browser)
npm run genesis -- --headless

# Özel database yolu
tsx examples/hermes-genesis.ts --db ./custom/path.db

# Özel browser profili
tsx examples/hermes-genesis.ts --profile ./custom-profile

# Yardım
tsx examples/hermes-genesis.ts --help
```

### Sorun Giderme

#### Problem: "Not logged in" hatası

**Çözüm:**
```bash
# Önce login ol
npm run hermes:login

# Sonra Genesis'i çalıştır
npm run genesis
```

#### Problem: Bazı odalar başarısız oldu

**Neden:** Timeout, ağ sorunu, veya Gemini yanıt vermedi.

**Çözüm:**
```bash
# Genesis'i tekrar çalıştır
# Başarısız odalar tekrar denenecek
npm run genesis
```

Genesis, başarısız odaları database'de günceller (upsert), bu yüzden tekrar çalıştırmak güvenlidir.

#### Problem: Browser açılmıyor

**Çözüm:**
```bash
# Playwright browser'ları yükle
npx playwright install chromium
```

#### Problem: Timeout çok kısa

**Açıklama:** Farklı oda tipleri farklı timeout sürelerine sahiptir:
- Mind odaları: 30 saniye
- Image/Video Studio: 60 saniye
- Deep Search: 60 saniye
- Canvas odaları: 45 saniye

Timeout süreleri `src/olympus/hermes/room-catalog.ts` dosyasında yapılandırılabilir.

#### Problem: Oda URL'leri çalışmıyor

**Kontrol:**
```typescript
import { GeminiTabManager } from './src/olympus/hermes/index.js';

const tabManager = new GeminiTabManager(db);
const url = await tabManager.getRoomUrl('Image Studio');

if (url) {
  console.log('Image Studio URL:', url);
  // URL'e git: https://gemini.google.com/app/...
} else {
  console.log('Image Studio not initialized');
}
```

**Çözüm:** Genesis'i tekrar çalıştır veya manuel olarak odayı oluştur.

### Doğrulama

Genesis tamamlandıktan sonra, odaların doğru şekilde oluşturulduğunu kontrol et:

```typescript
import Database from 'better-sqlite3';

const db = new Database('./data/prometheus.db');

// Tüm odaları listele
const rooms = db.prepare(`
  SELECT category, url, status, last_used 
  FROM gemini_tabs 
  ORDER BY last_used DESC
`).all();

console.log(`Total rooms: ${rooms.length}/20`);
rooms.forEach(room => {
  console.log(`✅ ${room.category}: ${room.status}`);
});
```

Beklenen çıktı: 20 oda, hepsi `active` durumunda.

---

## 🚀 Hermes'i Kullanma (Her Zaman)

### İlk Mesajı Gönder

```bash
npm run hermes:hello
```

Bu script:
1. ✅ Browser'ı açar (otomatik login!)
2. ✅ Gemini'a "Hello, I am Hermes!" mesajı gönderir
3. ✅ Gemini'ın cevabını alır ve gösterir

### Örnek Çıktı:

```
🏛️  Hermes: Initializing...
✅ Loaded 0 tabs
✅ Created tab: Coding (tab-coding)
✅ Created tab: Design (tab-design)
...
🎯 Total tabs: 20/20
✅ Hermes initialized!

🔍 Checking Gemini login status...
✅ Already logged in to Gemini!

📤 Sending message to Gemini...
⏳ Waiting for Gemini response...
✅ Response received in 3456ms

✅ Response from Gemini:

Hello Hermes! I'm Gemini, a large language model from Google AI...

📊 Metrics:
  Messages sent: 1
  Responses received: 1
  Average response time: 3456ms
```

---

## 💻 Kendi Kodunda Kullanma

### Basit Örnek:

```typescript
import { chromium } from 'playwright';
import Database from 'better-sqlite3';
import { GeminiMessenger, HERMES_BROWSER_PROFILE } from './src/olympus/hermes/index.js';

// Database
const db = new Database('./data/prometheus.db');

// Initialize Hermes
const hermes = new GeminiMessenger(db);
await hermes.initialize();

// Browser
const browser = await chromium.launchPersistentContext(
  HERMES_BROWSER_PROFILE.userDataDir,
  { headless: false }
);

const page = await browser.newPage();
hermes.setPage(page);

// Send message
const response = await hermes.sendToGemini(
  'Coding',
  'Write a React component for a todo list'
);

console.log(response);
```

---

## 📋 Odalar ve Kategoriler

Genesis ile oluşturulan 20 özel odaya mesaj gönderebilirsin:

### Forge Odaları (Özel Yetenekler)

1. **Olympus Prime** - Orkestrasyon ve yönetim
2. **Image Studio** - Görsel oluşturma (Imagen 3)
3. **Video Studio** - Video oluşturma (Veo)
4. **Deep Search Operations** - Derin araştırma
5. **Canvas Writer** - Uzun içerik yazımı
6. **Canvas Coder** - Karmaşık kod geliştirme

### Mind Odaları (Uzmanlık Alanları)

7. **Social Media Master** - Viral içerik ve engagement
8. **Marketing & Funnels** - Satış ve dönüşüm stratejileri
9. **DevOps & Backend** - Sunucu ve altyapı
10. **Frontend & UI/UX** - Arayüz geliştirme
11. **Data Analytics** - Metrikler ve içgörüler
12. **Idea Lab** - Beyin fırtınası ve konseptler
13. **Project Manager** - Görev ve sprint yönetimi
14. **Finance & Monetization** - Gelir modelleri
15. **Copywriting & Email** - Yazılı iletişim
16. **Legal & Compliance** - Sözleşmeler ve düzenlemeler
17. **Learning Center** - Eğitim ve özetler
18. **Personal Assistant** - Günlük planlama
19. **Optimization & SEO** - Arama ve performans
20. **Web Scraper Logic** - Veri çıkarma kalıpları

### Oda Kullanımı:

```typescript
// Image Studio'ya görsel talebi
await hermes.sendToGemini('Image Studio', 'Create a futuristic city skyline');

// Canvas Coder'a kod refactoring
await hermes.sendToGemini('Canvas Coder', 'Refactor this authentication system');

// Marketing & Funnels'a strateji sorusu
await hermes.sendToGemini('Marketing & Funnels', 'Design a SaaS onboarding funnel');

// Deep Search Operations'a araştırma
await hermes.sendToGemini('Deep Search Operations', 'Research latest AI trends in 2024');
```

### Oda Seçimi İpuçları:

- **Görsel/Video ihtiyacı** → Image Studio veya Video Studio
- **Uzun içerik/kod** → Canvas Writer veya Canvas Coder
- **Derin araştırma** → Deep Search Operations
- **Uzmanlık gerektiren** → İlgili Mind odasını seç
- **Genel koordinasyon** → Olympus Prime

---

## 🔧 Sorun Giderme

### Problem: "Not logged in" hatası

**Çözüm:**
```bash
# Login script'ini tekrar çalıştır
npm run hermes:login
```

### Problem: Browser açılmıyor

**Çözüm:**
```bash
# Playwright browser'ları yükle
npx playwright install chromium
```

### Problem: Session kayboldu

**Çözüm:**
```bash
# Profile klasörünü sil ve tekrar login ol
rm -rf ./browser-data/olympus-hermes
npm run hermes:login
```

---

## 📊 İleri Seviye

### Oda URL'lerine Doğrudan Gitme:

```typescript
import { GeminiTabManager } from './src/olympus/hermes/index.js';

const tabManager = new GeminiTabManager(db);

// Oda URL'ini al
const url = await tabManager.getRoomUrl('Image Studio');
if (url) {
  console.log('Image Studio URL:', url);
  // Doğrudan bu URL'e gidebilirsin
}

// Oda'ya otomatik git
await tabManager.navigateToRoom('Canvas Coder');
```

### Tab Health Kontrolü:

```typescript
const tabManager = hermes.getTabManager();
const health = tabManager.getAllTabHealth();

console.log(health);
// Her tab'ın durumu, context kullanımı, vs.
```

### Metrics:

```typescript
const metrics = hermes.getMetrics();

console.log(`Messages sent: ${metrics.messagesSent}`);
console.log(`Average response time: ${metrics.averageResponseTime}ms`);
console.log(`Errors: ${metrics.errors}`);
```

### Context Management:

```typescript
// Context kullanımını kontrol et
const codingTab = tabManager.getTab('Canvas Coder');
console.log(`Context: ${codingTab.contextEstimate} tokens`);

// Context doluysa reset et
if (codingTab.contextEstimate > 900000) {
  tabManager.resetTabContext('Canvas Coder');
}
```

### Oda Durumunu Kontrol Et:

```typescript
import Database from 'better-sqlite3';

const db = new Database('./data/prometheus.db');

// Tüm odaları listele
const rooms = db.prepare(`
  SELECT category, url, status, last_used, message_count
  FROM gemini_tabs 
  WHERE status = 'active'
  ORDER BY last_used DESC
`).all();

console.log(`Active rooms: ${rooms.length}`);
rooms.forEach(room => {
  console.log(`${room.category}: ${room.message_count} messages`);
});
```

---

## 🎉 Başarılı!

Artık Hermes kullanmaya hazırsın! 

- ✅ Login oldun (bir kez)
- ✅ Session kaydedildi (kalıcı)
- ✅ Genesis ile 20 özel oda oluşturuldu
- ✅ Her oda kendi uzmanlık alanına sahip
- ✅ Odalar database'de kayıtlı
- ✅ Gemini'a mesaj gönderebilirsin

**Sıradaki:** Kendi workflow'larını oluştur! 🚀

---

## 📚 Daha Fazla Bilgi

- [Hermes README](./src/olympus/hermes/README.md)
- [Design Document](./.kiro/specs/olympus-hermes/design.md)
- [API Documentation](./API.md)

---

**Hermes Version**: 0.1.0  
**Status**: ✅ Ready to use!
