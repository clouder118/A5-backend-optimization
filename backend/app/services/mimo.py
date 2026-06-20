from __future__ import annotations

import base64
import json

import httpx


class MimoClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.transport = transport

    def chat_completion(self, model: str, system_prompt: str, user_prompt: str) -> str:
        payload = self._chat_payload(model, system_prompt, user_prompt, stream=False)
        response = self._post_chat_completions(payload)
        return response["choices"][0]["message"]["content"] or ""

    def web_search_completion(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_results: int,
        timeout_seconds: float,
    ) -> dict:
        payload = self._chat_payload(model, system_prompt, user_prompt, stream=False)
        payload["tools"] = [
            {
                "type": "web_search",
                "max_keyword": 2,
                "forced_search": True,
                "force_search": True,
                "limit": max_results,
            }
        ]
        payload["tool_choice"] = "auto"
        payload["thinking"] = {"type": "disabled"}
        response = self._post_chat_completions(payload, timeout=timeout_seconds)
        message = response["choices"][0]["message"]
        return {
            "content": message.get("content", ""),
            "annotations": message.get("annotations") or [],
        }

    def chat_completion_stream(self, model: str, system_prompt: str, user_prompt: str):
        payload = self._chat_payload(model, system_prompt, user_prompt, stream=True)
        with httpx.Client(transport=self.transport, timeout=60) as client:
            with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={
                    "api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line.removeprefix("data: ").strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    content = chunk["choices"][0].get("delta", {}).get("content")
                    if content:
                        yield content

    def synthesize_speech(
        self,
        model: str,
        text: str,
        voice: str,
        audio_format: str,
        style_prompt: str = "温暖、清晰、自然的中文景区导游语气。",
    ) -> bytes:
        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": style_prompt},
                {"role": "assistant", "content": text},
            ],
            "audio": {
                "format": audio_format,
                "voice": voice,
            },
        }
        response = self._post_chat_completions(payload)
        audio_data = response["choices"][0]["message"]["audio"]["data"]
        return base64.b64decode(audio_data)

    def _post_chat_completions(self, payload: dict, timeout: float = 60) -> dict:
        with httpx.Client(transport=self.transport, timeout=timeout) as client:
            response = client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "api-key": self.api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    def _chat_payload(
        self,
        model: str,
        system_prompt: str,
        user_prompt: str,
        stream: bool,
    ) -> dict:
        return {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_completion_tokens": 4096,
            "temperature": 0.7,
            "top_p": 0.95,
            "stream": stream,
        }
