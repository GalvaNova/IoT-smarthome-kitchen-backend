#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 25200, 60000);

// ==========================
// Pin Setup
// ==========================
#define TRIG_PIN_1 D2
#define ECHO_PIN_1 D1
#define TRIG_PIN_2 D7
#define ECHO_PIN_2 D6
#define RELAY_PIN  D5
#define RELAY_ACTIVE HIGH

// ==========================
// WiFi Setup
// ==========================
const char* ssid = "Sitanggang";
const char* password = "qwertyuiop";

// ==========================
// Reasoner Endpoint
// ==========================
#define REASONER_HOST "192.168.43.238"
#define REASONER_PORT 5000

String reasonerSensorURL  = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-wash/input";
String reasonerCommandURL = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-wash/command";
String reasonerEndToEndURL = "http://" + String(REASONER_HOST) + ":" + String(REASONER_PORT) + "/api/reasoner-wash/endtoend";

// ==========================
// Fungsi Baca Sensor
// ==========================
float bacaJarak(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  
  long durasi = pulseIn(echo, HIGH, 30000);
  if (durasi == 0) return 400;
  return durasi * 0.034 / 2.0;
}

String getFormattedTimestamp() {
  timeClient.update();
  unsigned long epochTime = timeClient.getEpochTime();
  unsigned long rawTime = epochTime;

  int sec = rawTime % 60;
  rawTime /= 60;
  int min = rawTime % 60;
  rawTime /= 60;
  int hours = rawTime % 24;
  unsigned long days = rawTime / 24;

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
    if (i == 1) {
      bool leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
      if (leap) dim = 29;
    }
    if (days >= dim) days -= dim;
    else {
      month = i + 1;
      break;
    }
  }
  int day = days + 1;

  char buffer[25];
  sprintf(buffer, "%04d-%02d-%02d:%02d-%02d-%02d", year, month, day, hours, min, sec);
  return String(buffer);
}

// ==========================
// Setup
// ==========================
void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  pinMode(TRIG_PIN_1, OUTPUT);
  pinMode(ECHO_PIN_1, INPUT);
  pinMode(TRIG_PIN_2, OUTPUT);
  pinMode(ECHO_PIN_2, INPUT);
  pinMode(RELAY_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, !RELAY_ACTIVE);

  Serial.print("🔌 Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi terkoneksi");

  timeClient.begin();
}

// ==========================
// Loop
// ==========================
void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi terputus. Mencoba ulang...");
    WiFi.begin(ssid, password);
    delay(2000);
    return;
  }

  String timestamp_iot = getFormattedTimestamp();
  unsigned long startTime = millis();

  // Baca sensor
  float jarakObjek = bacaJarak(TRIG_PIN_1, ECHO_PIN_1);
  delay(40);
  float jarakOrang = bacaJarak(TRIG_PIN_2, ECHO_PIN_2);


  // Kirim Data Sensor
  WiFiClient client;
  HTTPClient http;
  http.setTimeout(3000);

  StaticJsonDocument<200> jsonData;
  jsonData["jarakObjek"] = jarakObjek;
  jsonData["jarakOrang"] = jarakOrang;
  jsonData["timestamp_iot"] = timestamp_iot;

  String payload;
  serializeJson(jsonData, payload);

  http.begin(client, reasonerSensorURL);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(payload);
  String resp = http.getString();
  http.end();

  Serial.printf("📤 POST sensor → %d | %s\n", code, resp.c_str());

  // POLLING HASIL REASONING
  bool commandReady = false;
  String cmdResp = "";
  int cmdCode = 0;
  unsigned long deadline = millis() + 1500;   // tunggu max 1.5 detik

  while (millis() < deadline) {
    http.begin(client, reasonerCommandURL);
    cmdCode = http.GET();
    if (cmdCode == 200) {
      cmdResp = http.getString();
      commandReady = true;
      http.end();
      break;
    }
    http.end();
    delay(50);
  }
  if (!commandReady) {
    Serial.println("⚠️ Timeout: Command reasoning tidak tersedia.");
    delay(800);
    return;
  }

  // Proses Command
  StaticJsonDocument<300> cmdJson;
  DeserializationError err = deserializeJson(cmdJson, cmdResp);

  if (err) {
    Serial.println("⚠️ JSON command corrupt.");
    delay(800);
    return;
  }

  String valveStatus = cmdJson["valveStatus"].as<String>();
  unsigned long endToEnd = millis() - startTime;
  Serial.printf("🔁 Command: %s | ⏱ %lu ms\n", valveStatus.c_str(), endToEnd);

  // Kirim end-to-end time
  http.begin(client, reasonerEndToEndURL);
  http.addHeader("Content-Type", "application/json");
  String timePayload = "{\"endToEndTime\": " + String(endToEnd) + "}";
  http.POST(timePayload);
  http.end();

  // Kontrol relay
  digitalWrite(RELAY_PIN, valveStatus == "st_actON" ? RELAY_ACTIVE : !RELAY_ACTIVE);

  Serial.println(valveStatus == "st_actON" ? "🚰 Valve AKTIF" : "🛑 Valve NONAKTIF");

  delay(600);
}
