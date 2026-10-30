import sqlite3
from contextlib import contextmanager
from datetime import date, timedelta

from domain import Admin, HocVien, HuanLuyenVien, MonAn


class Database:
    def __init__(self, path: str = "fitness.sqlite3"):
        self.path = path
        self.initialize()

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self):
        schema = """
        CREATE TABLE IF NOT EXISTS nguoidung (
            MaND TEXT PRIMARY KEY, HoTen TEXT NOT NULL, Email TEXT NOT NULL UNIQUE,
            SoDienThoai TEXT NOT NULL DEFAULT '', ChieuCao REAL NOT NULL DEFAULT 170,
            CanNang REAL NOT NULL DEFAULT 70,
            VaiTro TEXT NOT NULL CHECK (VaiTro IN ('HocVien', 'HLV', 'Admin'))
        );
        CREATE TABLE IF NOT EXISTS hocvien (
            MaND TEXT PRIMARY KEY REFERENCES nguoidung(MaND) ON DELETE CASCADE,
            Tuoi INTEGER NOT NULL, GioiTinh TEXT NOT NULL CHECK (GioiTinh IN ('Nam', 'Nữ')),
            HeSoVongDong REAL NOT NULL CHECK (HeSoVongDong BETWEEN 1.2 AND 1.725), MucTieu TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS huanluyenvien (
            MaND TEXT PRIMARY KEY REFERENCES nguoidung(MaND) ON DELETE CASCADE,
            ChuyenMon TEXT NOT NULL DEFAULT 'Fitness'
        );
        CREATE TABLE IF NOT EXISTS monan (
            MaMon INTEGER PRIMARY KEY AUTOINCREMENT, TenMon TEXT NOT NULL UNIQUE,
            CaloPer100g REAL NOT NULL CHECK (CaloPer100g >= 0), Protein REAL NOT NULL CHECK (Protein >= 0),
            Carb REAL NOT NULL CHECK (Carb >= 0), Fat REAL NOT NULL CHECK (Fat >= 0)
        );
        CREATE TABLE IF NOT EXISTS nhatkydinhduong (
            MaNK INTEGER PRIMARY KEY AUTOINCREMENT, MaND TEXT NOT NULL REFERENCES hocvien(MaND),
            NgayGhi TEXT NOT NULL, TongCaloNap REAL NOT NULL DEFAULT 0,
            UNIQUE (MaND, NgayGhi)
        );
        CREATE TABLE IF NOT EXISTS chitietbuaan (
            MaNK INTEGER NOT NULL REFERENCES nhatkydinhduong(MaNK) ON DELETE CASCADE,
            MaMon INTEGER NOT NULL REFERENCES monan(MaMon), BuoiAn TEXT NOT NULL
                CHECK (BuoiAn IN ('Sáng', 'Trưa', 'Tối', 'Phụ')),
            KhoiLuongGram REAL NOT NULL CHECK (KhoiLuongGram > 0), PRIMARY KEY (MaNK, MaMon)
        );
        CREATE TABLE IF NOT EXISTS baitap (
            MaBT INTEGER PRIMARY KEY AUTOINCREMENT, TenBaiTap TEXT NOT NULL UNIQUE, NhomCo TEXT NOT NULL,
            LoaiBaiTap TEXT NOT NULL CHECK (LoaiBaiTap IN ('Cardio', 'Strength')),
            CaloPerMinute REAL NOT NULL CHECK (CaloPerMinute >= 0)
        );
        CREATE TABLE IF NOT EXISTS kehoachtapluyen (
            MaKH INTEGER PRIMARY KEY AUTOINCREMENT,
            MaND_HocVien TEXT NOT NULL REFERENCES hocvien(MaND),
            MaND_HLV TEXT NOT NULL REFERENCES huanluyenvien(MaND), TenKeHoach TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chitietkehoach (
            MaKH INTEGER NOT NULL REFERENCES kehoachtapluyen(MaKH) ON DELETE CASCADE,
            MaBT INTEGER NOT NULL REFERENCES baitap(MaBT), ThuTrongTuan INTEGER NOT NULL CHECK (ThuTrongTuan BETWEEN 1 AND 7),
            ThoiGianPhut INTEGER NOT NULL CHECK (ThoiGianPhut > 0), PRIMARY KEY (MaKH, MaBT)
        );
        """
        with self.connect() as connection:
            connection.executescript(schema)
            self._seed(connection)

    def _seed(self, connection):
        users = [
            ("HV001", "Nguyễn Minh Anh", "minhanh@example.com", "0901234567", 170, 70, "HocVien"),
            ("PT001", "Trần Quốc Bảo", "quocbao@example.com", "0902345678", 175, 75, "HLV"),
            ("AD001", "Lê Thu Hà", "admin@example.com", "0903456789", 165, 58, "Admin"),
            ("HV002", "Phạm Gia Linh", "gialinh@example.com", "0904567890", 162, 55, "HocVien"),
        ]
        connection.executemany("INSERT OR IGNORE INTO nguoidung VALUES (?, ?, ?, ?, ?, ?, ?)", users)
        connection.execute("INSERT OR IGNORE INTO hocvien VALUES ('HV001', 25, 'Nam', 1.55, 'Tăng cơ')")
        connection.execute("INSERT OR IGNORE INTO hocvien VALUES ('HV002', 29, 'Nữ', 1.375, 'Giảm mỡ')")
        connection.execute("INSERT OR IGNORE INTO huanluyenvien VALUES ('PT001', 'Sức mạnh & thể lực')")
        foods = [
            ("Ức gà luộc", 165, 31, 0, 3.6), ("Cơm trắng", 130, 2.7, 28, 0.3),
            ("Trứng ốp la", 196, 13.6, 0.8, 15), ("Phở bò", 115, 8, 14, 3.5),
            ("Chuối", 89, 1.1, 22.8, 0.3), ("Sữa chua Hy Lạp", 97, 9, 3.9, 5),
        ]
        connection.executemany("INSERT OR IGNORE INTO monan (TenMon, CaloPer100g, Protein, Carb, Fat) VALUES (?, ?, ?, ?, ?)", foods)
        exercises = [
            ("Chạy bộ máy", "Toàn thân", "Cardio", 10), ("Hít đất", "Ngực, tay sau", "Strength", 7),
            ("Gập bụng", "Cơ bụng", "Strength", 5), ("Đạp xe", "Chân, tim mạch", "Cardio", 8),
        ]
        connection.executemany("INSERT OR IGNORE INTO baitap (TenBaiTap, NhomCo, LoaiBaiTap, CaloPerMinute) VALUES (?, ?, ?, ?)", exercises)
        today = date.today()
        for offset in range(7):
            day = today - timedelta(days=6 - offset)
            target = connection.execute("SELECT 1 FROM nhatkydinhduong WHERE MaND = 'HV001' AND NgayGhi = ?", (day.isoformat(),)).fetchone()
            if not target:
                calories = [1870, 2050, 1760, 2180, 1940, 2010, 0][offset]
                connection.execute("INSERT INTO nhatkydinhduong (MaND, NgayGhi, TongCaloNap) VALUES ('HV001', ?, ?)", (day.isoformat(), calories))
        today_log = connection.execute("SELECT MaNK FROM nhatkydinhduong WHERE MaND='HV001' AND NgayGhi=?", (today.isoformat(),)).fetchone()
        meal_count = connection.execute("SELECT COUNT(*) FROM chitietbuaan WHERE MaNK=?", (today_log["MaNK"],)).fetchone()[0]
        if not meal_count:
            sample_meals = [("Ức gà luộc", "Trưa", 200), ("Cơm trắng", "Trưa", 150), ("Trứng ốp la", "Sáng", 100)]
            for food_name, meal_name, grams in sample_meals:
                food = connection.execute("SELECT MaMon FROM monan WHERE TenMon=?", (food_name,)).fetchone()
                connection.execute("INSERT INTO chitietbuaan (MaNK, MaMon, BuoiAn, KhoiLuongGram) VALUES (?, ?, ?, ?)", (today_log["MaNK"], food["MaMon"], meal_name, grams))
            connection.execute("UPDATE nhatkydinhduong SET TongCaloNap=(SELECT SUM(m.CaloPer100g*c.KhoiLuongGram/100) FROM chitietbuaan c JOIN monan m ON m.MaMon=c.MaMon WHERE c.MaNK=?) WHERE MaNK=?", (today_log["MaNK"], today_log["MaNK"]))
        if not connection.execute("SELECT 1 FROM kehoachtapluyen WHERE MaND_HocVien = 'HV001'").fetchone():
            plan_id = connection.execute("INSERT INTO kehoachtapluyen (MaND_HocVien, MaND_HLV, TenKeHoach) VALUES ('HV001', 'PT001', 'Nền tảng sức mạnh')").lastrowid
            connection.executemany("INSERT INTO chitietkehoach VALUES (?, ?, ?, ?)", [
                (plan_id, 1, 1, 30), (plan_id, 2, 2, 25), (plan_id, 3, 4, 15), (plan_id, 4, 6, 30)
            ])

    def get_user(self, user_id):
        with self.connect() as connection:
            row = connection.execute("""SELECT u.*, h.Tuoi, h.GioiTinh, h.HeSoVongDong, h.MucTieu
                FROM nguoidung u LEFT JOIN hocvien h ON h.MaND = u.MaND WHERE u.MaND = ?""", (user_id,)).fetchone()
        if row and row["VaiTro"] == "HocVien":
            return HocVien(row["MaND"], row["HoTen"], row["Email"], row["ChieuCao"], row["CanNang"], row["Tuoi"], row["GioiTinh"] == "Nam", row["HeSoVongDong"], row["MucTieu"])
        if row and row["VaiTro"] == "HLV":
            return HuanLuyenVien(row["MaND"], row["HoTen"], row["Email"], row["ChieuCao"], row["CanNang"])
        if row:
            return Admin(row["MaND"], row["HoTen"], row["Email"], row["ChieuCao"], row["CanNang"])
        return None

    def list_foods(self, search=""):
        with self.connect() as connection:
            return [dict(row) for row in connection.execute("SELECT * FROM monan WHERE TenMon LIKE ? ORDER BY TenMon", (f"%{search}%",))]

    def list_exercises(self, search=""):
        with self.connect() as connection:
            return [dict(row) for row in connection.execute("SELECT * FROM baitap WHERE TenBaiTap LIKE ? ORDER BY TenBaiTap", (f"%{search}%",))]

    def list_users(self):
        with self.connect() as connection:
            return [dict(row) for row in connection.execute("SELECT MaND, HoTen, Email, SoDienThoai, VaiTro FROM nguoidung ORDER BY VaiTro, HoTen")]

    def dashboard(self, user_id="HV001"):
        user = self.get_user(user_id)
        if not isinstance(user, HocVien):
            user = self.get_user("HV001")
        today = date.today().isoformat()
        with self.connect() as connection:
            row = connection.execute("SELECT MaNK, TongCaloNap FROM nhatkydinhduong WHERE MaND = ? AND NgayGhi = ?", (user.maND, today)).fetchone()
            macros = connection.execute("""SELECT SUM(m.Protein*c.KhoiLuongGram/100) protein,
                SUM(m.Carb*c.KhoiLuongGram/100) carb, SUM(m.Fat*c.KhoiLuongGram/100) fat
                FROM chitietbuaan c JOIN monan m ON m.MaMon=c.MaMon JOIN nhatkydinhduong n ON n.MaNK=c.MaNK
                WHERE n.MaND=? AND n.NgayGhi=?""", (user.maND, today)).fetchone()
            recent = connection.execute("SELECT NgayGhi, TongCaloNap FROM nhatkydinhduong WHERE MaND=? ORDER BY NgayGhi DESC LIMIT 7", (user.maND,)).fetchall()
            meal_rows = []
            if row:
                meal_rows = connection.execute("""SELECT c.BuoiAn, c.KhoiLuongGram, m.TenMon, m.CaloPer100g,
                    m.Protein, m.Carb, m.Fat FROM chitietbuaan c JOIN monan m ON m.MaMon=c.MaMon WHERE c.MaNK=? ORDER BY c.rowid DESC""", (row["MaNK"],)).fetchall()
        return {
            "user": {"id": user.maND, "name": user.hoTen, "email": user.email, "height": user.chieuCaoCm, "weight": user.canNangKg, "age": user.tuoi, "gender": "Nam" if user.laNam else "Nữ", "goal": user.mucTieu},
            "bmi": round(user.tinhBMI(), 1), "bmr": round(user.tinhBMR()), "tdee": round(user.tinhTDEE()),
            "todayCalories": round(row["TongCaloNap"] if row else 0),
            "macros": {key: round(macros[key] or 0, 1) for key in ("protein", "carb", "fat")},
            "week": [{"date": item["NgayGhi"], "calories": round(item["TongCaloNap"])} for item in reversed(recent)],
            "meals": [dict(item) for item in meal_rows],
        }

    def add_meal(self, user_id, food_id, grams, meal):
        today = date.today().isoformat()
        with self.connect() as connection:
            food = connection.execute("SELECT * FROM monan WHERE MaMon=?", (food_id,)).fetchone()
            if not food:
                raise ValueError("Không tìm thấy món ăn")
            log = connection.execute("SELECT MaNK FROM nhatkydinhduong WHERE MaND=? AND NgayGhi=?", (user_id, today)).fetchone()
            if log is None:
                log_id = connection.execute("INSERT INTO nhatkydinhduong (MaND, NgayGhi) VALUES (?, ?)", (user_id, today)).lastrowid
            else:
                log_id = log["MaNK"]
            connection.execute("INSERT INTO chitietbuaan (MaNK, MaMon, BuoiAn, KhoiLuongGram) VALUES (?, ?, ?, ?)", (log_id, food_id, meal, grams))
            calories = food["CaloPer100g"] * grams / 100
            connection.execute("UPDATE nhatkydinhduong SET TongCaloNap=TongCaloNap+? WHERE MaNK=?", (calories, log_id))
            return {"calories": round(calories, 1), "food": food["TenMon"]}

    def reports(self, user_id="HV001"):
        data = self.dashboard(user_id)
        return {"week": data["week"], "tdee": data["tdee"], "macros": data["macros"]}

    def plans(self, student_id="HV001"):
        with self.connect() as connection:
            rows = connection.execute("""SELECT p.MaKH, p.TenKeHoach, u.HoTen AS HLV, d.ThuTrongTuan, d.ThoiGianPhut,
                b.TenBaiTap, b.NhomCo, b.LoaiBaiTap, b.CaloPerMinute
                FROM kehoachtapluyen p JOIN nguoidung u ON u.MaND=p.MaND_HLV
                LEFT JOIN chitietkehoach d ON d.MaKH=p.MaKH LEFT JOIN baitap b ON b.MaBT=d.MaBT
                WHERE p.MaND_HocVien=? ORDER BY p.MaKH, d.ThuTrongTuan""", (student_id,)).fetchall()
        plans = {}
        day_names = {1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật"}
        for row in rows:
            plan = plans.setdefault(row["MaKH"], {"id": row["MaKH"], "name": row["TenKeHoach"], "trainer": row["HLV"], "items": []})
            if row["TenBaiTap"]:
                plan["items"].append({"exercise": row["TenBaiTap"], "muscle": row["NhomCo"], "type": row["LoaiBaiTap"], "day": row["ThuTrongTuan"], "dayName": day_names[row["ThuTrongTuan"]], "minutes": row["ThoiGianPhut"], "calories": round(row["CaloPerMinute"] * row["ThoiGianPhut"])})
        return list(plans.values())

    def students(self):
        with self.connect() as connection:
            rows = connection.execute("""SELECT u.MaND, u.HoTen, u.ChieuCao, u.CanNang, h.Tuoi, h.GioiTinh, h.HeSoVongDong,
                h.MucTieu, COALESCE(n.TongCaloNap, 0) calories
                FROM nguoidung u JOIN hocvien h ON h.MaND=u.MaND
                LEFT JOIN nhatkydinhduong n ON n.MaND=u.MaND AND n.NgayGhi=? ORDER BY u.HoTen""", (date.today().isoformat(),)).fetchall()
        result = []
        for row in rows:
            student = HocVien(row["MaND"], row["HoTen"], "", row["ChieuCao"], row["CanNang"], row["Tuoi"], row["GioiTinh"] == "Nam", row["HeSoVongDong"], row["MucTieu"])
            result.append({"id": row["MaND"], "name": row["HoTen"], "goal": row["MucTieu"], "weight": row["CanNang"], "tdee": round(student.tinhTDEE()), "calories": round(row["calories"]), "progress": min(round(row["calories"] / student.tinhTDEE() * 100), 100)})
        return result

    def create_plan(self, trainer_id, student_id, name, items):
        with self.connect() as connection:
            plan_id = connection.execute("INSERT INTO kehoachtapluyen (MaND_HocVien, MaND_HLV, TenKeHoach) VALUES (?, ?, ?)", (student_id, trainer_id, name)).lastrowid
            connection.executemany("INSERT INTO chitietkehoach (MaKH, MaBT, ThuTrongTuan, ThoiGianPhut) VALUES (?, ?, ?, ?)", [(plan_id, item["exercise_id"], item["day"], item["minutes"]) for item in items])
        return plan_id

    def save_catalog(self, table, values, item_id=None):
        allowed = {"monan": ("TenMon", "CaloPer100g", "Protein", "Carb", "Fat", "MaMon"), "baitap": ("TenBaiTap", "NhomCo", "LoaiBaiTap", "CaloPerMinute", "MaBT")}
        columns = allowed[table]
        fields = columns[:-1]
        if item_id is None:
            with self.connect() as connection:
                cursor = connection.execute(f"INSERT INTO {table} ({', '.join(fields)}) VALUES ({', '.join('?' for _ in fields)})", [values[field] for field in fields])
                return cursor.lastrowid
        with self.connect() as connection:
            connection.execute(f"UPDATE {table} SET {', '.join(f'{field}=?' for field in fields)} WHERE {columns[-1]}=?", [values[field] for field in fields] + [item_id])

    def delete_catalog(self, table, item_id):
        keys = {"monan": "MaMon", "baitap": "MaBT"}
        with self.connect() as connection:
            connection.execute(f"DELETE FROM {table} WHERE {keys[table]}=?", (item_id,))

    def create_user(self, data):
        with self.connect() as connection:
            connection.execute("INSERT INTO nguoidung (MaND, HoTen, Email, SoDienThoai, ChieuCao, CanNang, VaiTro) VALUES (?, ?, ?, ?, ?, ?, ?)", (data["id"], data["name"], data["email"], data.get("phone", ""), data.get("height", 170), data.get("weight", 70), data["role"]))
            if data["role"] == "HocVien":
                connection.execute("INSERT INTO hocvien VALUES (?, ?, ?, ?, ?)", (data["id"], data["age"], data["gender"], data["activity"], data["goal"]))
            elif data["role"] == "HLV":
                connection.execute("INSERT INTO huanluyenvien (MaND) VALUES (?)", (data["id"],))