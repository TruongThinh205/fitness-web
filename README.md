# Form & Fuel

Ứng dụng quản lý dinh dưỡng và tập luyện với domain OOP Python, API HTTP và SQLite. Backend dùng thư viện chuẩn Python; giao diện dùng HTML/CSS/JavaScript, Tailwind CDN và Chart.js.

## Chạy ứng dụng

Yêu cầu Python 3.10 trở lên. Không cần cài package.

```powershell
python app.py
```

Mở http://127.0.0.1:8000. Database `fitness.sqlite3` và dữ liệu mẫu được tạo tự động khi khởi chạy lần đầu. Chọn vai trò ở góc trên bên phải để chuyển giữa các màn hình.

Tài khoản demo:

| Vai trò | Mã | Email |
| --- | --- | --- |
| Học viên | `HV001` | `minhanh@example.com` |
| Huấn luyện viên | `PT001` | `quocbao@example.com` |
| Quản trị viên | `AD001` | `admin@example.com` |

Đây là bản demo chuyển vai trò phía giao diện, chưa có đăng nhập/xác thực người dùng.

## Cấu trúc

- `domain.py`: lớp domain OOP, công thức BMI/BMR/TDEE, đa hình bài tập và các đối tượng nhật ký/kế hoạch.
- `database.py`: SQLite access layer, schema 3NF, seed data và truy vấn nghiệp vụ.
- `app.py`: HTTP server và JSON API.
- `static/`: dashboard responsive, biểu đồ và điều khiển theo vai trò.
- `tests/`: kiểm thử unit bằng `unittest`.

Schema có thêm `VaiTro` trong `nguoidung` và bảng `huanluyenvien` để hỗ trợ phân quyền và khóa ngoại kế hoạch. `TongCaloNap` được lưu theo yêu cầu báo cáo; mọi thông tin dinh dưỡng chi tiết vẫn tham chiếu món ăn qua khóa ngoại.

## Kiểm thử

```powershell
python -m unittest discover -s tests -v
```

API chính: `GET /api/dashboard`, `GET /api/reports`, `GET /api/foods`, `POST /api/meals`, `GET/POST /api/plans`, `GET /api/students`, `GET/POST /api/users`; danh mục món ăn và bài tập hỗ trợ `GET/POST/PUT/DELETE`.