# 🏠 IoT Smarthome Kitchen Backend

Backend server for IoT-based smart home system that manages kitchen automation, cooking system, washing, and monitoring of room entry and exit in real-time.

---

## 📋 Description

This system is a Node.js-based backend integrated with IoT devices (ESP8266/ESP32) using HTTP methods. This backend handles reasoner logic, service management, and notifications via Telegram Bot to automatically monitor kitchen conditions.

---

## 🗂️ Project Structure

```
IoT-smarthome-kitchen-backend/
├── bot/
│   └── telegramBot.js        # Telegram Bot integration for notifications
├── cookproto/                #
│   └── cookproto.ino         # Arduino firmware code - cooking system
├── inoutproto/
│   └── inoutproto.ino        # Arduino firmware code - exit/entry sensor
├── logs/                     # System log storage
├── routes/
│   ├── backendCook.js        # Route API - cooking system
│   ├── backendInout.js       # Route API - in/out system
│   ├── backendWash.js        # Route API - washing system
│   ├── reasonerCook.js       # Reasoner Logic - cooking
│   ├── reasonerInout.js      # Reasoner Logic - in/out
│   └── reasonerWash.js       # Reasoner Logic - washing
├── services/
│   ├── cookServices.js       # Service layer - cooking
│   ├── inoutServices.js      # Service layer - in/out
│   └── washServices.js       # Service layer - washing
├── utils/                    # Utility functions
├── washproto/
│   └── washproto.ino         # Arduino firmware code - washing system
├── backendSystemStatus.js    # Backend system monitoring status
└── mainServer.js             # Main entry point server
```

---

## 🛠️ Tools

| Tech                 | Function                                |
| -------------------- | --------------------------------------- |
| **Node.js**          | Runtime server backend                  |
| **Express.js**       | Framework HTTP server                   |
| **Telegram Bot API** | Notifikasi real-time                    |
| **Arduino / C++**    | Firmware mikrokontroler (ESP8266/ESP32) |

---

## ⚙️ Installation & Running the server

### prerequisite

- Node.js v16
- npm
- SPARQL / apache jena fuseki
- nodeMCU / other mcu

### Installation Step

1. **Clone repository**

   ```bash
   git clone https://github.com/GalvaNova/IoT-smarthome-kitchen-backend.git
   cd IoT-smarthome-kitchen-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**

   Buat file `.env` di root project:

   ```env
   PORT=3000
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```

4. **Run server**
   ```bash
   node mainServer.js
   ```

---

## 📡 Fitur Utama

- **🍳 Cook System** – Monitoring and otomation control of cooking system
- **🚪 In-Out System** – Motion detection in/out at kitchen
- **🫧 Wash System** – Monitoring activity
- **🤖 Telegram Bot** – Real-time notification to smartphone
- **📊 System Status** – Monitor the overall status of the backend system
- **📝 Logging** – Automatic logging of system activity

---

## 🔌 Upload Firmware Arduino

Firmware for the microcontroller is available in the respective folders:

- `cookproto/cookproto.ino` → Upload to the cooking system device
- `inoutproto/inoutproto.ino` → Upload to the door sensor device
- `washproto/washproto.ino` → Upload to the washing system device

Use **Arduino IDE** or **PlatformIO** to upload firmware to ESP8266/ESP32 device.

---

## 👤 Author

**GalvaNova**

- GitHub: [@GalvaNova](https://github.com/GalvaNova)

---

## 📄 License

This project was created for the purposes of Master's Thesis research at Gadjah Mada University (UGM).
