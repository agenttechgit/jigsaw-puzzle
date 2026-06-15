# 🧩 Ghép Hình · Puzzle Atelier

Trò chơi ghép hình (jigsaw) chạy trên trình duyệt. Tải ảnh tuỳ thích, chọn số
mảnh và kiểu dáng, rồi **kéo–thả** các mảnh đã xáo trộn ngay trên cùng một màn
để ghép lại. Ghép xong sẽ có âm **"ting ting"** và thông báo chúc mừng.

Không cần build, không phụ thuộc — chỉ là HTML/CSS/JS tĩnh.

## ✨ Tính năng

- **Tải ảnh của bạn**: từ tệp (kéo–thả hoặc chọn) hoặc dán đường dẫn ảnh.
- **Chọn số mảnh**: 12 / 24 / 48 / 96 (tự chia lưới theo tỉ lệ ảnh).
- **4 kiểu mảnh ghép thật sự khớp nhau**: Jigsaw, Sao, Lá, Vuông.
- **Không lộ ảnh gốc**: chỉ hiện viền khung ngoài; các mảnh được xáo trộn và rải
  rác ngẫu nhiên trên bàn chơi.
- **Kéo–thả trên một màn duy nhất** (chuột & cảm ứng). Thả gần đúng chỗ → mảnh tự
  "hít" vào và khoá lại kèm tiếng "tách".
- **Âm thanh** tạo bằng Web Audio API (không cần tệp âm thanh).
- Đồng hồ, số mảnh đã ghép, số nước đi; nút **Trộn lại**, **Gợi ý** (giữ để xem
  ảnh mờ), **Ván mới**.

## ▶️ Chạy thử

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy một máy chủ tĩnh:

```bash
cd jigsaw-puzzle
python3 -m http.server 5173
# rồi mở http://localhost:5173
```

> Với ảnh tải từ **đường dẫn (URL)**, máy chủ ảnh cần cho phép CORS thì mới hiển
> thị được. Tải ảnh từ **tệp** thì luôn hoạt động.

## 🚀 Deploy

Đây là site tĩnh nên deploy thẳng được:

- **Vercel**: trỏ project vào thư mục `jigsaw-puzzle/` (không cần lệnh build).
  ```bash
  npx vercel deploy --prod
  ```
- **GitHub Pages**: đẩy thư mục này lên nhánh và bật Pages, hoặc đặt ở `/docs`.

## 🗂 Cấu trúc

| Tệp | Vai trò |
|-----|---------|
| `index.html` | Khung giao diện: modal tạo ván, thanh trạng thái, canvas bàn chơi |
| `style.css`  | Giao diện "puzzle atelier" (Fraunces + DM Sans, nền vân giấy) |
| `game.js`    | Sinh mảnh khớp, render, kéo–thả, snap, âm thanh, thắng cuộc |

## 🧠 Cơ chế mảnh khớp

Ảnh được chia thành lưới `hàng × cột`. Mỗi cạnh trong có khớp lồi/lõm bù nhau
(`phải = -trái` của mảnh kế bên). Một hàm vẽ cạnh dùng chung, đổi *hình dạng tab*
theo kiểu đã chọn, nên cả 4 kiểu đều khít hoàn hảo. Mỗi mảnh được vẽ ra một canvas
riêng (nền trong suốt); việc bắt điểm chạm dùng `isPointInPath` đúng theo hình
mảnh nên kéo rất chính xác.
