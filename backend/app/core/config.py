from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Application
    APP_NAME: str = "Nearly"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production"

    # Base de données
    DATABASE_URL: str = "postgresql+asyncpg://nearly:nearly_dev@localhost:5432/nearly"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # URL du frontend (pour les liens dans les emails)
    FRONTEND_URL: str = "http://localhost:5173"

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@nearly.app"

    # Paiements (Stripe)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""          # ID du prix mensuel Premium dans Stripe

    # Sentry
    SENTRY_DSN: str = ""

    # Stockage fichiers (Hetzner Object Storage, compatible S3)
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_PRIVATE: str = "nearly-private"
    S3_BUCKET_PUBLIC: str = "nearly-public"


settings = Settings()
