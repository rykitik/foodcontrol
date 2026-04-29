from app import create_app
from app.runtime_bootstrap import bootstrap_runtime_environment

app = create_app()


def main() -> None:
    bootstrap_runtime_environment(app)
    app.run(
        host=app.config["APP_HOST"],
        port=app.config["APP_PORT"],
        debug=app.config.get("DEBUG", False),
    )


if __name__ == "__main__":
    main()
