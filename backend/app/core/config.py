from dataclasses import dataclass, field
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(BACKEND_ROOT / ".env")


DEFAULT_SOURCE_PACKAGE_PATH = (
    BACKEND_ROOT.parent / "Scenic Area Public Information Package"
)
DEFAULT_DERIVED_KNOWLEDGE_PATH = BACKEND_ROOT.parent / "knowledge"


def env_value(name: str, default: str = ""):
    return field(default_factory=lambda: os.getenv(name, default))


def env_value_with_alias(name: str, alias: str, default: str = ""):
    return field(default_factory=lambda: os.getenv(name) or os.getenv(alias) or default)


@dataclass(frozen=True)
class Settings:
    app_name: str = "A5 Scenic Area AI Guide Backend"
    app_env: str = env_value("APP_ENV", "dev")
    database_url: str = env_value("DATABASE_URL", "sqlite:///./data/app.db")
    source_package_path: str = field(
        default_factory=lambda: os.getenv(
            "SOURCE_PACKAGE_PATH",
            str(DEFAULT_SOURCE_PACKAGE_PATH),
        )
    )
    derived_knowledge_path: str = field(
        default_factory=lambda: os.getenv(
            "DERIVED_KNOWLEDGE_PATH",
            str(DEFAULT_DERIVED_KNOWLEDGE_PATH),
        )
    )
    llm_mode: str = env_value("LLM_MODE", "openai_compatible")
    llm_provider: str = env_value("LLM_PROVIDER", "mimo")
    llm_base_url: str = env_value("LLM_BASE_URL", "https://api.xiaomimimo.com/v1")
    llm_api_key: str = env_value_with_alias("LLM_API_KEY", "MIMO_API_KEY")
    llm_model: str = env_value("LLM_MODEL", "mimo-v2.5")
    rag_retrieval_mode: str = env_value("RAG_RETRIEVAL_MODE", "keyword")
    web_search_mode: str = env_value("WEB_SEARCH_MODE", "mimo")
    web_search_endpoint: str = env_value("WEB_SEARCH_ENDPOINT", "")
    web_search_api_key: str = env_value("WEB_SEARCH_API_KEY", "")
    web_search_timeout_seconds: float = field(
        default_factory=lambda: float(os.getenv("WEB_SEARCH_TIMEOUT_SECONDS", "20.0"))
    )
    web_search_max_results: int = field(
        default_factory=lambda: int(os.getenv("WEB_SEARCH_MAX_RESULTS", "3"))
    )
    tts_mode: str = env_value("TTS_MODE", "provider")
    tts_provider: str = env_value("TTS_PROVIDER", "mimo")
    tts_base_url: str = env_value("TTS_BASE_URL", "https://api.xiaomimimo.com/v1")
    tts_api_key: str = env_value_with_alias("TTS_API_KEY", "MIMO_API_KEY")
    tts_model: str = env_value("TTS_MODEL", "mimo-v2.5-tts")
    tts_voice: str = env_value("TTS_VOICE", "mimo_default")
    tts_audio_format: str = env_value("TTS_AUDIO_FORMAT", "mp3")
    tts_output_dir: str = env_value("TTS_OUTPUT_DIR", "./data/tts")
    cors_origins: str = env_value(
        "CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,"
        "http://127.0.0.1:5174,http://localhost:5174,"
        "http://127.0.0.1:5175,http://localhost:5175",
    )
    admin_token: str = env_value("ADMIN_TOKEN", "")
    enable_admin_token: str = env_value("ENABLE_ADMIN_TOKEN", "false")
    admin_default_username: str = env_value("ADMIN_DEFAULT_USERNAME", "admin")
    admin_default_password: str = env_value("ADMIN_DEFAULT_PASSWORD", "123456")
    auth_token_secret: str = env_value("AUTH_TOKEN_SECRET", "a5-local-dev-auth-secret")
    auth_token_ttl_seconds: int = field(
        default_factory=lambda: int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "604800"))
    )


settings = Settings()
