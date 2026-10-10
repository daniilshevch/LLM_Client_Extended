# LLM Follow-up

An application for creating focused follow-up threads from selected parts of an LLM conversation.

## Backend

Run the FastAPI development server from the `backend` directory:

```powershell
python -m uvicorn main:app --reload
```

The health endpoint is available at <http://127.0.0.1:8000/health>.

Copy `backend/.env.example` to `backend/.env` and set `LLM_API_KEY` before connecting a real model.
