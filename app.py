import json
import mimetypes
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from database import Database


ROOT = Path(__file__).parent
STATIC = ROOT / "static"
database = Database(str(ROOT / "fitness.sqlite3"))


class FitnessHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

    def _json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def _static(self, path):
        if path == "/":
            target = STATIC / "index.html"
        elif path.startswith("/static/"):
            target = (STATIC / unquote(path.removeprefix("/static/"))).resolve()
        else:
            self.send_error(404)
            return
        if not target.is_relative_to(STATIC.resolve()) or not target.is_file():
            self.send_error(404)
            return
        content = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        try:
            if path == "/api/health":
                self._json({"ok": True})
            elif path == "/api/dashboard":
                self._json(database.dashboard(query.get("user", ["HV001"])[0]))
            elif path == "/api/reports":
                self._json(database.reports(query.get("user", ["HV001"])[0]))
            elif path == "/api/foods":
                self._json(database.list_foods(query.get("search", [""])[0]))
            elif path == "/api/exercises":
                self._json(database.list_exercises(query.get("search", [""])[0]))
            elif path == "/api/plans":
                self._json(database.plans(query.get("student", ["HV001"])[0]))
            elif path == "/api/students":
                self._json(database.students())
            elif path == "/api/users":
                self._json(database.list_users())
            else:
                self._static(path)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self._json({"error": str(error)}, 400)
        except Exception as error:
            self._json({"error": str(error)}, 500)

    def do_POST(self):
        try:
            data = self._body()
            if self.path == "/api/meals":
                grams = float(data["grams"])
                if grams <= 0 or grams > 3000:
                    raise ValueError("Khối lượng phải từ 1 đến 3000 gram")
                if data["meal"] not in ("Sáng", "Trưa", "Tối", "Phụ"):
                    raise ValueError("Bữa ăn không hợp lệ")
                result = database.add_meal(data.get("user_id", "HV001"), int(data["food_id"]), grams, data["meal"])
                self._json(result, 201)
            elif self.path == "/api/plans":
                items = data["items"]
                if not items or len(items) > 40:
                    raise ValueError("Kế hoạch cần có từ 1 đến 40 bài tập")
                for item in items:
                    item["day"] = int(item["day"])
                    item["minutes"] = int(item["minutes"])
                    item["exercise_id"] = int(item["exercise_id"])
                    if not 1 <= item["day"] <= 7 or not 1 <= item["minutes"] <= 300:
                        raise ValueError("Ngày tập hoặc thời lượng không hợp lệ")
                plan_id = database.create_plan(data.get("trainer_id", "PT001"), data["student_id"], data["name"].strip(), items)
                self._json({"id": plan_id}, 201)
            elif self.path == "/api/users":
                database.create_user(data)
                self._json({"id": data["id"]}, 201)
            elif self.path in ("/api/foods", "/api/exercises"):
                table = "monan" if self.path.endswith("foods") else "baitap"
                item_id = database.save_catalog(table, data)
                self._json({"id": item_id}, 201)
            else:
                self._json({"error": "Endpoint không tồn tại"}, 404)
        except sqlite3.IntegrityError:
            message = "Món ăn này đã được ghi trong nhật ký hôm nay." if self.path == "/api/meals" else "Dữ liệu bị trùng hoặc không hợp lệ."
            self._json({"error": message}, 409)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self._json({"error": str(error)}, 400)
        except Exception as error:
            self._json({"error": str(error)}, 500)

    def do_PUT(self):
        try:
            data = self._body()
            parts = self.path.strip("/").split("/")
            if len(parts) != 3 or parts[0] != "api" or parts[1] not in ("foods", "exercises"):
                self._json({"error": "Endpoint không tồn tại"}, 404)
                return
            table = "monan" if parts[1] == "foods" else "baitap"
            database.save_catalog(table, data, int(parts[2]))
            self._json({"ok": True})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self._json({"error": str(error)}, 400)
        except Exception as error:
            self._json({"error": str(error)}, 500)

    def do_DELETE(self):
        try:
            parts = self.path.strip("/").split("/")
            if len(parts) != 3 or parts[0] != "api" or parts[1] not in ("foods", "exercises"):
                self._json({"error": "Endpoint không tồn tại"}, 404)
                return
            table = "monan" if parts[1] == "foods" else "baitap"
            database.delete_catalog(table, int(parts[2]))
            self._json({"ok": True})
        except (ValueError, TypeError) as error:
            self._json({"error": str(error)}, 400)
        except Exception as error:
            self._json({"error": str(error)}, 409)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), FitnessHandler)
    print("Fitness & Nutrition đang chạy tại http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng máy chủ.")
        server.server_close()