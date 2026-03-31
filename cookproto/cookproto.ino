#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 25200, 60000);

//PIN SETUP
#define FLAME_PIN D1
#define DHTPIN D2
#define DHTTYPE DHT11
#define TRIG_PIN D7
#define ECHO_PIN D6
#define MQ2_PIN A0
#define RELAY_FAN D5
#define BUZZER_PIN D8

//WIFI CONFIG
const char* ssid = "..";
const char* password = "..";

//SERVER CONFIG
#define REASONER_HOST ".."
// #define REASONER_HOST ".."
#define REASONER_PORT 5000

String reasonerSensorURL   = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-cook/input";
String reasonerCommandURL  = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-cook/command";
String reasonerEndToEndURL = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-cook/endtoend";

WiFiClient client;
DHT dht(DHTPIN, DHTTYPE);

// MQ2 CONFIG
#define RL 0.44
// #define RL 0.22
#define m -0.45
#define b 1.23
float Ro = 2.7;

//VARIABEL GLOBAL
float temp = 0.0;
int flame = 1;
float gasValue = 0.0;
float distance = 0.0;

String buzzerStatus = "st_actOFF";
String exhaustStatus = "st_actOFF";

unsigned long lastSensorSend = 0;
unsigned long lastStatusCheck = 0;
const unsigned long sensorInterval = 4000;
const unsigned long statusInterval = 4000;

//FUNGSI BACA SENSOR
float readMQ2() {
  int analogVal = analogRead(MQ2_PIN);
  float VRL = analogVal * (3.3 / 1023.0);
  if (VRL <= 0.05) return 0; // noise filter
  float Rs = ((3.3 * RL) / VRL) - RL;
  float ratio = Rs / Ro;
  float ppm = pow(10, (log10(ratio) - b) / m);
  return isnan(ppm) ? 0 : ppm;
}

float readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 25000); // 25ms timeout
  if (duration == 0) return 999;
  return duration * 0.034 / 2;
}

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

// 📡 WIFI CONNECT (Auto Retry)
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("\n📶 Menghubungkan ke WiFi...");
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    Serial.print(".");
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Terhubung!");
    Serial.print("📡 IP NodeMCU: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi gagal, akan mencoba lagi nanti...");
  }
}

// KIRIM DATA SENSOR
void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  // timestamp cook
  timeClient.update();
  String timestamp_iot_cook = getFormattedTimestamp();
  Serial.print("timestamp_iot_cook: ");
  Serial.println(timestamp_iot_cook);

  HTTPClient http;
  String url = reasonerSensorURL;

  StaticJsonDocument<256> doc;
  doc["flame"] = flame;
  doc["gas"] = gasValue;
  doc["temp"] = temp;
  doc["dist"] = distance;
  doc["timestamp_iot_cook"] = timestamp_iot_cook;

  String payload;
  serializeJson(doc, payload);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(2000);

  unsigned long start = millis();
  int code = http.POST(payload);
  unsigned long backendTime = millis() - start;

  if (code == 200) {
    Serial.printf("📤 Data sensor terkirim (%lums)\n", backendTime);
  } else {
    Serial.printf("❌ Gagal kirim sensor (HTTP %d)\n", code);
  }

  http.end();
}

//AMBIL STATUS AKTUATOR
void getActuatorStatus() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  HTTPClient http;
  String url = reasonerCommandURL;

  http.begin(client, url);
  http.setTimeout(2000);

  unsigned long start = millis();
  int code = http.GET();

  if (code == 200) {
    String response = http.getString();

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err) {
      buzzerStatus = doc["buzzerStatus"] | "st_actOFF";
      exhaustStatus = doc["exhaustStatus"] | "st_actOFF";

      // Kendalikan aktuator
      digitalWrite(BUZZER_PIN, buzzerStatus == "st_actON" ? HIGH : LOW);
      digitalWrite(RELAY_FAN, exhaustStatus == "st_actON" ? HIGH : LOW);

      Serial.printf("🔄 Buzzer:%s | Exhaust:%s\n",
                    buzzerStatus.c_str(), exhaustStatus.c_str());

      // Kirim end-to-end time
      unsigned long endToEnd = millis() - start;
      HTTPClient http2;
      http2.begin(client, reasonerEndToEndURL);
      http2.addHeader("Content-Type", "application/json");

      StaticJsonDocument<100> tdoc;
      tdoc["endToEndTime"] = endToEnd;
      String body;
      serializeJson(tdoc, body);
      http2.POST(body);
      http2.end();
    } else {
      Serial.println("❌ JSON parse gagal (actuator)");
    }
  } else {
    Serial.printf("❌ HTTP gagal (code %d)\n", code);
  }

  http.end();
}

//SETUP
void setup() {
  Serial.begin(115200);
  dht.begin();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(RELAY_FAN, LOW);

  connectWiFi();
  delay(2000);

  Serial.println("\n🍳 Area Cook System Initialized!");
  timeClient.begin();
}

//LOOP UTAMA
void loop() {
  unsigned long now = millis();

  // Baca sensor setiap 4 detik
  if (now - lastSensorSend >= sensorInterval) {
    lastSensorSend = now;

    flame = digitalRead(FLAME_PIN);
    gasValue = readMQ2();
    temp = dht.readTemperature();
    distance = readDistance();

    Serial.printf("\n🔥 Flame:%d | 🧪 Gas:%.2f ppm | 🌡️ Temp:%.2f°C |Dist:%.1f cm\n",
                  flame, gasValue, temp, distance);

    sendSensorData();
  }

  //Cek status aktuator setiap 4 detik
  if (now - lastStatusCheck >= statusInterval) {
    lastStatusCheck = now;
    getActuatorStatus();
  }
}
