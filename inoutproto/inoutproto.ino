#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP8266WebServer.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 25200, 60000);

//Pin Setup
#define PIR_IN  D1
#define PIR_OUT D2
#define RELAY_PIN D5
#define RELAY_ACTIVE_STATE HIGH

//WiFi Setup
const char* ssid = "..";
const char* password = "..";


//Reasoner Endpoint
#define REASONER_HOST "url"
// #define REASONER_HOST "url"
#define REASONER_PORT 5000

String reasonerSensorURL   = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-inout/input";
String reasonerCommandURL  = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-inout/command";
String reasonerEndToEndURL = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-inout/endtoend";
String reasonerPersonURL   = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-inout/person";

//Variables
int personCount = 0;
int lastSentCount = -1;

unsigned long inTriggerTime = 0;
unsigned long outTriggerTime = 0;
const unsigned long triggerWindow = 2000;

unsigned long lastPersonCheck = 0;
const unsigned long personCheckInterval = 2000;

unsigned long lastLampCheck = 0;
const unsigned long lampCheckInterval = 2500;

int prevPirInState = LOW;
int prevPirOutState = LOW;

bool waitingForOut = false;
bool waitingForIn = false;

const unsigned long debounceDelay = 50;
unsigned long lastDebounce = 0;

ESP8266WebServer server(80);

String getFormattedTimestamp() {
  timeClient.update();
  unsigned long epochTime = timeClient.getEpochTime();

  // Konversi manual dari epoch ke tanggal dan waktu
  unsigned long rawTime = epochTime ;  // offset GMT+7 (7 jam * 3600 detik)

  int sec = rawTime % 60;
  rawTime /= 60;
  int min = rawTime % 60;
  rawTime /= 60;
  int hours = rawTime % 24;
  unsigned long days = rawTime / 24;

  // Hitung tanggal
  int year = 1970;
  while (true) {
    bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    unsigned long daysInYear = leap ? 366 : 365;
    if (days >= daysInYear) {
      days -= daysInYear;
      year++;
    } else break;
  }

  const int daysInMonth[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  int month = 0;
  for (int i = 0; i < 12; i++) {
    int dim = daysInMonth[i];
    if (i == 1) { // Februari, cek kabisat
      bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
      if (leap) dim = 29;
    }
    if (days >= dim) {
      days -= dim;
    } else {
      month = i + 1;
      break;
    }
  }
  int day = days + 1;

  char buffer[25];
  sprintf(buffer, "%04d-%02d-%02d:%02d-%02d-%02d", year, month, day, hours, min, sec);
  return String(buffer);
}

//Setup
void setup() {
  Serial.begin(115200);
  // PIN MODE
  pinMode(PIR_IN, INPUT);
  pinMode(PIR_OUT, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, !RELAY_ACTIVE_STATE);  // Lampu OFF saat awal

  // WiFi connection
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke WiFi");
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ Gagal konek WiFi, reboot...");
    ESP.restart();
  }

  Serial.println("\n✅ Terhubung ke WiFi");
  Serial.print("📡 IP NodeMCU: ");
  Serial.println(WiFi.localIP());

  server.on("/reset-person", HTTP_POST, []() {
    personCount = 0;
    server.send(200, "text/plain", "Reset OK");
  });
  server.begin();
  timeClient.begin();

  delay(10000); // Kalibrasi PIR
}

//Loop utama
void loop() {
  handleSensorLogic();
  pollLampStatus();
  pollPersonCount();
  server.handleClient();
}

//Logika PIR masuk & keluar
void handleSensorLogic() {
  if (millis() - lastDebounce < debounceDelay) return;
  lastDebounce = millis();

  int pirInState = digitalRead(PIR_IN);
  int pirOutState = digitalRead(PIR_OUT);
  unsigned long currentTime = millis();

  // Masuk
  if (pirInState == HIGH && prevPirInState == LOW && !waitingForOut) {
    inTriggerTime = currentTime;
    waitingForOut = true;
    Serial.println("📥 PIR-IN aktif - menunggu PIR-OUT");
  }

  if (waitingForOut && pirOutState == HIGH && prevPirOutState == LOW && (currentTime - inTriggerTime <= triggerWindow)) {
    personCount++;
    Serial.println("🟢 Orang masuk");
    sendDataToServer();
    resetFlags();
  }

  // Keluar
  if (pirOutState == HIGH && prevPirOutState == LOW && !waitingForIn) {
    outTriggerTime = currentTime;
    waitingForIn = true;
    Serial.println("📤 PIR-OUT aktif - menunggu PIR-IN");
  }

  if (waitingForIn && pirInState == HIGH && prevPirInState == LOW && (currentTime - outTriggerTime <= triggerWindow)) {
    personCount = max(0, personCount - 1);
    Serial.println("🔴 Orang keluar");
    sendDataToServer();
    resetFlags();
  }

  // Timeout
  if (waitingForOut && currentTime - inTriggerTime > triggerWindow) resetFlags();
  if (waitingForIn && currentTime - outTriggerTime > triggerWindow) resetFlags();

  prevPirInState = pirInState;
  prevPirOutState = pirOutState;
}

void resetFlags() {
  waitingForOut = false;
  waitingForIn = false;
}

//Kirim data ke Reasoner
void sendDataToServer() {
  if (personCount == lastSentCount || WiFi.status() != WL_CONNECTED) return;

  // timestamp Inout
  timeClient.update();
  String timestamp_iot_inout = getFormattedTimestamp();
  Serial.print("timestamp_iot_inout: ");
  Serial.println(timestamp_iot_inout);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, reasonerSensorURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(2000);

  StaticJsonDocument<200> doc;
  doc["personCount"] = personCount;
  doc["timestamp_iot_inout"] = timestamp_iot_inout;

  String reqBody;
  serializeJson(doc, reqBody);

  int httpCode = http.POST(reqBody);
  Serial.printf("📡 POST personCount → %d\n", httpCode);
  http.end();

  lastSentCount = personCount;
}

//Ambil status lampu
void pollLampStatus() {
  unsigned long now = millis();
  if (now - lastLampCheck < lampCheckInterval || WiFi.status() != WL_CONNECTED) return;
  lastLampCheck = now;

  WiFiClient client;
  HTTPClient http;

  unsigned long start = millis();
  http.begin(client, reasonerCommandURL);
  http.setTimeout(2000);

  int code = http.GET();
  if (code == HTTP_CODE_OK) {
    String response = http.getString();
    StaticJsonDocument<200> doc;
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      // String status = doc["status"];
      String status = doc["lampStatus"];
      digitalWrite(RELAY_PIN, status == "st_actON" ? RELAY_ACTIVE_STATE : !RELAY_ACTIVE_STATE);
      
      Serial.printf("💡 Status lampu: %s\n", status.c_str());

      unsigned long endToEndTime = millis() - start;

      // Kirim end-to-end time
      HTTPClient http2;
      http2.begin(client, reasonerEndToEndURL);
      http2.addHeader("Content-Type", "application/json");
      StaticJsonDocument<100> out;
      out["endToEndTime"] = endToEndTime;
      String body;
      serializeJson(out, body);
      http2.POST(body);
      http2.end();
    }
  }
  http.end();
}

//Cek jumlah orang dari backend
void pollPersonCount() {
  unsigned long now = millis();
  if (now - lastPersonCheck < personCheckInterval || WiFi.status() != WL_CONNECTED) return;
  lastPersonCheck = now;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, reasonerPersonURL);
  http.setTimeout(2000);

  int code = http.GET();
  if (code == HTTP_CODE_OK) {
    String response = http.getString();
    StaticJsonDocument<200> doc;
    if (deserializeJson(doc, response) == DeserializationError::Ok) {
      int count = doc["personCount"];
      Serial.printf("👥 Jumlah orang (server): %d\n", count);
    }
  }
  http.end();
}
