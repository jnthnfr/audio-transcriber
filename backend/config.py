from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    openai_api_key: str = ""
    google_application_credentials: str = ""
    whisper_cache_dir: str = "./models"
    default_whisper_model: str = "base"
    max_upload_size_mb: int = 500
    temp_dir: str = "./backend/temp"
    max_concurrent_chunks: int = 1
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
