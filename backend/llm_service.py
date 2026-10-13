from collections.abc import Iterator

from openai import OpenAI
from settings import Settings


class LLMService:
    def __init__(self, settings: Settings) -> None:
        if not settings.llm_api_key:
            raise ValueError("LLM_API_KEY is not configured")

        self._client = OpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self._model = settings.llm_model

    def generate_reply(self, message: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": message}],
        )
        reply = response.choices[0].message.content

        if not reply:
            raise RuntimeError("The LLM returned an empty response")

        return reply

    def generate_reply_stream(self, message: str) -> Iterator[str]:
        stream = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": message}],
            stream=True,
        )

        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
