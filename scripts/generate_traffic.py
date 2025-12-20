import requests
import time
import random
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# Конфигурация
try:
    settings_resp = requests.get("http://localhost:3000/api/settings")
    settings = settings_resp.json()
    endpoint = settings.get("endpoint", "/track")
    TARGET_URL = f"http://localhost:8081{endpoint}"
    print(f"✅ Loaded settings: endpoint={endpoint}")
except Exception as e:
    print(f"⚠️ Failed to load settings from backend: {e}. Using default.")
    TARGET_URL = "http://localhost:8081/track"

THREADS = 100  # Увеличиваем кол-во потоков для 10k RPS
DELAY_MIN = 0.05
DELAY_MAX = 0.1  # Без задержек

# Глобальный счетчик для RPS
import threading
request_count = 0
count_lock = threading.Lock()

def monitor_rps():
    global request_count
    while True:
        time.sleep(1)
        with count_lock:
            current = request_count
            request_count = 0
        print(f"🔥 Current RPS: {current}")

# Данные для генерации
PAGES = [
    "/",
    "/features",
    "/pricing",
    "/blog/post-1",
    "/blog/post-2",
    "/contact",
    "/app/dashboard",
    "/app/settings",
]

REFERRERS = [
    "https://google.com",
    "https://twitter.com",
    "https://linkedin.com",
    "https://yandex.ru",
    "direct",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; SM-A505FN) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
]

EVENTS = ["pageview", "click", "scroll", "signup", "purchase", "error"]
WEIGHTS = [60, 20, 10, 5, 3, 2]  # Вероятность событий (pageview чаще всего)


def get_random_user():
    return {
        "uid": str(uuid.uuid4()),
        "sid": str(uuid.uuid4()),
        "ua": random.choice(USER_AGENTS),
        "lang": random.choice(["en-US", "ru-RU", "de-DE", "es-ES"]),
    }


def simulate_user_session():
    user = get_random_user()
    # Используем сессию для keep-alive соединений = выше скорость
    session = requests.Session()
    session.headers.update({"User-Agent": user["ua"], "Content-Type": "application/json"})
    
    session_length = random.randint(5, 50) # Длиннее сессии = меньше overhead на старт

    # print(f"🚀 New session: {user['uid'][:8]}") # Меньше логов в консоль

    global request_count

    for _ in range(session_length):
        event_type = random.choices(EVENTS, weights=WEIGHTS, k=1)[0]
        current_page = random.choice(PAGES)

        payload = {
            "user_id": user["uid"],
            "session_id": user["sid"],
            "timestamp": time.time(),
            "event_name": event_type,
            "url": f"https://spykit.example.com{current_page}",
            "referrer": random.choice(REFERRERS),
            "data": {
                "page": current_page,
                "viewport": f"{random.randint(320, 1920)}x{random.randint(600, 1080)}",
                "lang": user["lang"]
            }
        }

        if event_type == "purchase":
            payload["value"] = random.randint(10, 500)
            payload["currency"] = "USD"

        try:
            resp = session.post(TARGET_URL, json=payload, timeout=5)
            status = resp.status_code
            if status not in [200, 204]:
                print(f"⚠️ Error {status}: {resp.text}")
            
            with count_lock:
                request_count += 1
                
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            break

        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))


def run_load_test():
    print(f"🔥 Starting HIGH LOAD test on {TARGET_URL} (~500+ RPS target)")
    print(f"Threads: {THREADS}, Delays: {DELAY_MIN}-{DELAY_MAX}s")
    print(f"Press Ctrl+C to stop")

    # Запускаем мониторинг RPS в отдельном потоке
    threading.Thread(target=monitor_rps, daemon=True).start()

    with ThreadPoolExecutor(max_workers=THREADS) as executor:
        while True:
            # Запускаем новую сессию, если есть свободные слоты
            executor.submit(simulate_user_session)
            # time.sleep(0.01) # Убираем sleep главного потока для макс скорости


if __name__ == "__main__":
    try:
        run_load_test()
    except KeyboardInterrupt:
        print("\n🛑 Test stopped")
