# LLM Follow-up

Застосунок для створення сфокусованих follow-up гілок на основі окремих
фрагментів розмови з великою мовною моделлю.

## Поточний функціонал

- FastAPI backend;
- React + TypeScript frontend;
- чат із текстовими повідомленнями;
- виклик OpenAI-compatible LLM API;
- окрема конфігурація секретів через `.env`;
- базова підготовка до follow-up гілок.

## Структура проєкту

```text
llm-followup/
├── backend/   # FastAPI та інтеграція з LLM
├── frontend/  # React + TypeScript інтерфейс
├── docker-compose.yml
└── README.md
```

## Налаштування backend

Перейди до директорії backend:

```powershell
cd D:\AIProjects\llm-followup\backend
```

Створи локальний файл конфігурації на основі шаблону:

```powershell
Copy-Item .env.example .env
```

Відкрий `.env` і вкажи власний API-ключ:

```env
LLM_API_KEY=твій-реальний-ключ
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Файл `.env` містить секрети й не повинен потрапляти до Git. Для публічного
репозиторію використовується безпечний шаблон `backend/.env.example`.

## Запуск через Docker

Це рекомендований спосіб запуску застосунку. Потрібні Docker Desktop і
підтримка Docker Compose.

Переконайся, що файл `backend/.env` створений і містить API-ключ. Якщо файл
ще не створений, виконай:

```powershell
cd D:\AIProjects\llm-followup\backend
Copy-Item .env.example .env
```

Після цього вкажи реальний ключ у `backend/.env` і запусти команди з кореня
проєкту:

```powershell
cd D:\AIProjects\llm-followup
docker compose up --build
```

Docker Compose збере та запустить два контейнери:

- `backend` — FastAPI і підключення до LLM;
- `frontend` — production-збірка React, яку роздає Nginx.

Адреси запущених сервісів:

- frontend: <http://localhost:8080>;
- backend: <http://localhost:8000>;
- Swagger-документація: <http://localhost:8000/docs>;
- health check: <http://localhost:8000/health>.

Щоб запустити контейнери у фоновому режимі:

```powershell
docker compose up --build -d
```

Переглянути логи:

```powershell
docker compose logs -f
```

Зупинити та видалити контейнери:

```powershell
docker compose down
```

## Локальний запуск для розробки

### Backend

Виконай команду з кореня backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend буде доступний за адресою <http://127.0.0.1:8000>.

Перевірка стану застосунку:

<http://127.0.0.1:8000/health>

Інтерактивна документація API:

<http://127.0.0.1:8000/docs>

### Frontend

Відкрий друге вікно PowerShell і перейди до frontend:

```powershell
cd D:\AIProjects\llm-followup\frontend
npm run dev
```

Frontend буде доступний за адресою, яку покаже Vite, зазвичай:

<http://localhost:5173>

Backend і frontend потрібно запускати паралельно в окремих вікнах
термінала.

## API чату

Endpoint `POST /chat` приймає:

```json
{
  "message": "Поясни простими словами, що таке машинне навчання"
}
```

і повертає:

```json
{
  "reply": "Відповідь мовної моделі"
}
```

## Подальший розвиток

Наступні функції проєкту:

- streaming-відповіді від моделі;
- виділення фрагмента повідомлення;
- створення follow-up гілки;
- передавання виділеного тексту та контексту в окремий чат;
- збереження історії діалогів.
