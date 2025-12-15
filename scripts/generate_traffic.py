import requests
import time
import random
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# Конфигурация
TARGET_URL = "http://localhost:8081/track"
THREADS = 5  # Количество одновременных "пользователей"
DELAY_MIN = 0.1
DELAY_MAX = 2.0

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
    session_length = random.randint(1, 15)

    print(f"🚀 New session started: {user['uid'][:8]} ({session_length} events)")

    for _ in range(session_length):
        event_type = random.choices(EVENTS, weights=WEIGHTS, k=1)[0]
        current_page = random.choice(PAGES)

        payload = {
            "uid": user["uid"],
            "sid": user["sid"],
            "t": int(time.time() * 1000),
            "e": event_type,
            "url": f"https://spykit.example.com{current_page}",
            "ref": random.choice(REFERRERS),
            "p": current_page,
            "vp": f"{random.randint(320, 1920)}x{random.randint(600, 1080)}",
            "lang": user["lang"],
        }

        # Для событий покупки добавляем сумму
        if event_type == "purchase":
            payload["value"] = random.randint(10, 500)
            payload["currency"] = "USD"

        headers = {"User-Agent": user["ua"], "Content-Type": "application/json"}

        try:
            resp = requests.post(TARGET_URL, json=payload, headers=headers, timeout=5)
            status = resp.status_code
            if status not in [200, 204]:
                print(f"⚠️ Error {status}: {resp.text}")
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            break

        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))

    print(f"🏁 Session finished: {user['uid'][:8]}")


def run_load_test():
    print(f"🔥 Starting load test on {TARGET_URL}")
    print(f"Press Ctrl+C to stop")

    with ThreadPoolExecutor(max_workers=THREADS) as executor:
        while True:
            # Запускаем новую сессию, если есть свободные слоты
            executor.submit(simulate_user_session)
            time.sleep(random.uniform(0.5, 2.0))


if __name__ == "__main__":
    try:
        run_load_test()
    except KeyboardInterrupt:
        print("\n🛑 Test stopped")
