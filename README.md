# 🏠 IoT Smarthome Kitchen Backend

Backend server untuk sistem smart home berbasis IoT yang mengelola otomasi dapur, sistem masak, pencucian, dan monitoring keluar-masuk ruangan secara real-time.

---

## 📋 Deskripsi

Sistem ini merupakan backend berbasis **Node.js** yang terintegrasi dengan perangkat IoT (ESP8266/ESP32) melalui protokol MQTT. Backend ini menangani logika reasoner, manajemen layanan, dan notifikasi via Telegram Bot untuk memantau kondisi dapur secara otomatis.

---

## 🗂️ Struktur Proyek

```
IoT-smarthome-kitchen-backend/
├── bot/
│   └── telegramBot.js        # Integrasi Telegram Bot untuk notifikasi
├── cookproto/                # Kode firmware Arduino - sistem memasak
├── inoutproto/
│   └── inoutproto.ino        # Kode firmware Arduino - sensor keluar/masuk
├── logs/                     # Penyimpanan log sistem
├── routes/
│   ├── backendCook.js        # Route API - sistem memasak
│   ├── backendInout.js       # Route API - sistem keluar/masuk
│   ├── backendWash.js        # Route API - sistem pencucian
│   ├── reasonerCook.js       # Logika reasoner - memasak
│   ├── reasonerInout.js      # Logika reasoner - keluar/masuk
│   └── reasonerWash.js       # Logika reasoner - pencucian
├── services/
│   ├── cookServices.js       # Service layer - memasak
│   ├── inoutServices.js      # Service layer - keluar/masuk
│   └── washServices.js       # Service layer - pencucian
├── utils/                    # Utility functions
├── washproto/
│   └── washproto.ino         # Kode firmware Arduino - sistem pencucian
├── backendSystemStatus.js    # Monitor status sistem backend
└── mainServer.js             # Entry point server utama
```

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Kegunaan |
|-----------|----------|
| **Node.js** | Runtime server backend |
| **Express.js** | Framework HTTP server |
| **MQTT** | Komunikasi dengan perangkat IoT |
| **Telegram Bot API** | Notifikasi real-time |
| **Arduino / C++** | Firmware mikrokontroler (ESP8266/ESP32) |

---

## ⚙️ Instalasi & Menjalankan Server

### Prasyarat
- Node.js v16 atau lebih baru
- npm
- Broker MQTT (contoh: Mosquitto)

### Langkah Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/GalvaNova/IoT-smarthome-kitchen-backend.git
   cd IoT-smarthome-kitchen-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi environment**

   Buat file `.env` di root project:
   ```env
   PORT=3000
   MQTT_BROKER=mqtt://localhost:1883
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

4. **Jalankan server**
   ```bash
   node mainServer.js
   ```

---

## 📡 Fitur Utama

- **🍳 Cook System** – Monitoring dan kontrol otomasi sistem memasak
- **🚪 In-Out System** – Deteksi pergerakan keluar/masuk ruangan dapur
- **🫧 Wash System** – Monitoring sistem pencucian peralatan
- **🤖 Telegram Bot** – Notifikasi real-time kondisi dapur ke smartphone
- **📊 System Status** – Monitor status keseluruhan sistem backend
- **📝 Logging** – Pencatatan aktivitas sistem secara otomatis

---

## 🔌 Upload Firmware Arduino

Firmware untuk mikrokontroler tersedia di folder masing-masing:

- `cookproto/` → Upload ke perangkat sistem memasak
- `inoutproto/inoutproto.ino` → Upload ke perangkat sensor pintu
- `washproto/washproto.ino` → Upload ke perangkat sistem pencucian

Gunakan **Arduino IDE** atau **PlatformIO** untuk upload firmware ke perangkat ESP8266/ESP32.

---

## 👤 Author

**GalvaNova**
- GitHub: [@GalvaNova](https://github.com/GalvaNova)

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan penelitian Tesis S2 Universitas Gadjah Mada (UGM).
