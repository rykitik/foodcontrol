from app.routes.categories import categories_bp
from app.routes.auth import auth_bp
from app.routes.cashier_terminals import cashier_terminals_bp
from app.routes.holidays import holidays_bp
from app.routes.imports import imports_bp
from app.routes.logs import logs_bp
from app.routes.meals import meals_bp
from app.routes.reports import reports_bp
from app.routes.students import students_bp
from app.routes.tickets import tickets_bp
from app.routes.users import users_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(cashier_terminals_bp, url_prefix="/api/cashier-terminals")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(tickets_bp, url_prefix="/api/tickets")
    app.register_blueprint(holidays_bp, url_prefix="/api/holidays")
    app.register_blueprint(imports_bp, url_prefix="/api/imports")
    app.register_blueprint(meals_bp, url_prefix="/api/meals")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(logs_bp, url_prefix="/api/logs")
