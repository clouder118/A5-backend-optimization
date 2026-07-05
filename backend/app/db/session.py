from pathlib import Path

from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    if not database_url.startswith("sqlite:///"):
        return

    db_location = database_url.removeprefix("sqlite:///")
    if db_location in {"", ":memory:"}:
        return

    Path(db_location).parent.mkdir(parents=True, exist_ok=True)


def create_database_engine(database_url: str) -> Engine:
    _ensure_sqlite_parent_dir(database_url)
    return create_engine(
        database_url,
        connect_args={"check_same_thread": False}
        if database_url.startswith("sqlite")
        else {},
    )


def create_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def initialize_database(engine: Engine) -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_chat_message_columns(engine)
    _ensure_sqlite_route_columns(engine)
    _ensure_sqlite_route_draft_columns(engine)
    _ensure_sqlite_avatar_active_index(engine)
    _ensure_sqlite_knowledge_fts(engine)


def _ensure_sqlite_chat_message_columns(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    columns = {
        column["name"]
        for column in inspect(engine).get_columns("chat_message")
    }
    if "metrics_json" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE chat_message ADD COLUMN metrics_json JSON DEFAULT '{}'")
            )


def _ensure_sqlite_route_columns(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    columns = {
        column["name"]
        for column in inspect(engine).get_columns("route")
    }
    if "map_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE route ADD COLUMN map_id VARCHAR(64) "
                    "DEFAULT 'ling-shan'"
                )
            )
            connection.execute(
                text(
                    "UPDATE route SET map_id = 'ling-shan' "
                    "WHERE map_id IS NULL OR map_id = ''"
                )
            )


def _ensure_sqlite_route_draft_columns(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    columns = {
        column["name"]
        for column in inspect(engine).get_columns("route_draft")
    }
    if "preference_json" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE route_draft ADD COLUMN "
                    "preference_json JSON DEFAULT '{}'"
                )
            )


def _ensure_sqlite_avatar_active_index(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS "
                "uq_digital_human_avatar_active "
                "ON digital_human_avatar (is_active) "
                "WHERE is_active = 1"
            )
        )


def _ensure_sqlite_knowledge_fts(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
                        row_key UNINDEXED,
                        source_kind UNINDEXED,
                        ref_id UNINDEXED,
                        title,
                        spot_id UNINDEXED,
                        spot_name,
                        section,
                        source_type UNINDEXED,
                        source_url UNINDEXED,
                        source_level UNINDEXED,
                        snippet,
                        search_text,
                        tokenize='unicode61'
                    )
                    """
                )
            )
    except Exception:
        return


engine = create_database_engine(settings.database_url)
SessionLocal = create_session_factory(engine)
