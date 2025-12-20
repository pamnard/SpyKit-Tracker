import asyncio
import aiohttp
import random
import uuid
import time
import os

# Конфигурация
TARGET_HOST = "http://localhost:8081"
# Будем получать настройки асинхронно при старте
SETTINGS_API = "http://localhost:3000/api/settings"

# Параметры нагрузки
CONCURRENCY = 500       # Сколько одновременных "пользователей" (запросов в полете)
# 500 concurrent connections can easily generate 5k-10k RPS

# Данные для генерации
PAGES = ["/", "/features", "/pricing", "/blog/post-1", "/blog/post-2", "/contact", "/app/dashboard", "/app/settings"]
REFERRERS = ["https://google.com", "https://twitter.com", "https://linkedin.com", "https://yandex.ru", "direct"]
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/91.0.4472.114 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
]
EVENTS = ["pageview", "click", "scroll", "signup", "purchase", "error"]
WEIGHTS = [60, 20, 10, 5, 3, 2]

stats = {
    "requests": 0,
    "errors": 0,
    "start_time": time.time()
}

async def get_settings():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(SETTINGS_API) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Loaded settings: {data}")
                    return data.get("endpoint", "/track")
    except Exception as e:
        print(f"⚠️ Failed to load settings: {e}")
    return "/track"

def get_random_payload():
    return {
        "uid": str(uuid.uuid4()),
        "sid": str(uuid.uuid4()),
        "t": int(time.time() * 1000),
        "e": random.choices(EVENTS, weights=WEIGHTS, k=1)[0],
        "url": f"https://pixel.example.com{random.choice(PAGES)}",
        "ref": random.choice(REFERRERS),
        "p": random.choice(PAGES),
        "vp": f"{random.randint(320, 1920)}x{random.randint(600, 1080)}",
        "lang": random.choice(["en-US", "ru-RU"]),
        "ua": random.choice(USER_AGENTS)
    }

async def worker(session, url, sem):
    # Бесконечный цикл генерации
    while True:
        payload = get_random_payload()
        # Semaphore ограничивает parallelism
        async with sem:
            try:
                # Отправляем запрос
                async with session.post(url, json=payload) as resp:
                    stats["requests"] += 1
                    if resp.status >= 400:
                        stats["errors"] += 1
                    
                    # Читаем ответ, чтобы освободить соединение в пул
                    await resp.read() 
            except Exception as e:
                stats["errors"] += 1
                # Небольшая пауза при ошибках соединения, чтобы не спамить в бесконечный цикл ошибок
                await asyncio.sleep(0.1)

async def monitor():
    print(f"🔥 Warming up...")
    while True:
        await asyncio.sleep(1)
        rps = stats["requests"]
        errors = stats["errors"]
        stats["requests"] = 0
        stats["errors"] = 0
        print(f"🔥 RPS: {rps} | Errors: {errors}")

async def main():
    endpoint = await get_settings()
    target_url = f"{TARGET_HOST}{endpoint}"
    print(f"🚀 Starting Async Load Test on {target_url}")
    print(f"Concurrency: {CONCURRENCY} connections")
    print("Press Ctrl+C to stop")

    sem = asyncio.Semaphore(CONCURRENCY)

    # Настраиваем пул соединений
    connector = aiohttp.TCPConnector(limit=0, ttl_dns_cache=300)
    
    timeout = aiohttp.ClientTimeout(total=10) # 10 сек таймаут на запрос

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # Запускаем мониторинг
        asyncio.create_task(monitor())
        
        # Запускаем N воркеров, каждый крутится в бесконечном цикле
        # Количество воркеров = Concurrency, чтобы всегда держать N запросов в полете
        tasks = [asyncio.create_task(worker(session, target_url, sem)) for _ in range(CONCURRENCY)]
        
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            pass

if __name__ == "__main__":
    try:
        try:
            import uvloop
            uvloop.install()
            print("🚀 Using uvloop for max performance")
        except ImportError:
            print("ℹ️  uvloop not found, using default asyncio loop")
            pass
            
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Stopped")

