# 🧩 Puzzle Atelier — bộ sưu tập trò chơi ghép hình

Bộ sưu tập game ghép hình chạy trên trình duyệt, viết bằng HTML/CSS/JS thuần —
không cần build, không phụ thuộc. Trang chủ (`index.html`) cho phép chọn game.

**Live:** https://agenttechgit.github.io/jigsaw-puzzle/

## 🎮 Các trò chơi

### 1. Ghép Hình (`/jigsaw`)
Trò ghép hình cổ điển. Tải ảnh tuỳ thích, chọn số mảnh (4–96) và kiểu dáng
(Jigsaw / Sao / Lá / Vuông), rồi kéo–thả các mảnh **khớp lồi–lõm thật sự** trên
cùng một màn để hoàn thiện. Ghép xong phát âm *"ting ting"* và chúc mừng.
Chi tiết: [`jigsaw/README.md`](jigsaw/README.md).

### 2. Lật Mảnh Đố Vui (`/reveal`)
Trò đố vui dạng lật mảnh. Ảnh bị che bởi các mảnh; **bạn tự soạn câu hỏi & đáp
án** cho từng mảnh và một **câu hỏi chung** cho cả bức tranh.

- Người chơi bấm một mảnh → trả lời câu hỏi của mảnh đó. **Đúng** thì mảnh lật mở
  ra một góc ảnh (tiếng *"ting"*); **sai** thì mảnh vẫn che (tiếng *"buzz"*), được
  thử lại bất cứ lúc nào.
- Trả lời đúng **câu hỏi chung** → **thắng ngay** dù chưa mở hết mảnh (đoán tranh).
- **3 kiểu câu hỏi**: một đáp án (radio), nhiều đáp án (checkbox), nhập chữ.
- **Lưu & chia sẻ**: tự lưu nháp (localStorage) · **Tạo link ngắn** dạng
  `…/reveal/#id=abc123` (lưu bộ đố lên jsonbin.io qua Access Key công khai). Ảnh
  tải lên được tự thu nhỏ + nén JPEG để vừa giới hạn 100KB/bin. Nếu jsonbin lỗi
  (mạng/ảnh quá nặng) sẽ tự fallback link `#q=` nhúng dữ liệu (dài hơn).

## ▶️ Chạy thử

```bash
python3 -m http.server 5173
# mở http://localhost:5173
```

> Ảnh tải từ **URL** cần máy chủ ảnh cho phép CORS; ảnh tải từ **tệp** luôn chạy.

## 🚀 Deploy

Site tĩnh — deploy thẳng:

- **GitHub Pages**: source = nhánh `main`, thư mục `/` (gốc).
- **Vercel**: trỏ vào thư mục dự án, không cần lệnh build.

## 🗂 Cấu trúc

```
index.html        Trang chủ chọn game
jigsaw/           Game ghép hình (index.html · style.css · game.js)
reveal/           Game lật mảnh đố vui (index.html · style.css · game.js)
vercel.json       Cấu hình deploy tĩnh
```
