// components/CreditLZA.tsx
// Kredit pembuat aplikasi — tampil di halaman login.
// Ganti nilai di bawah sesuai kebutuhan.

const PEMBUAT = "LZA Apps";
const NAMA = "Lutfi";
const LINK = "https://wa.me/62xxxxxxxxxx"; // ganti: nomor WA atau link galeri LZA

export default function CreditLZA() {
  return (
    <div
      style={{
        marginTop: 24,
        textAlign: "center",
        fontSize: 12,
        color: "#888",
        lineHeight: 1.6,
      }}
    >
      <div>
        Powered by{" "}
        <a
          href={LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0d9488", fontWeight: 600, textDecoration: "none" }}
        >
          {PEMBUAT}
        </a>
      </div>
      <div style={{ fontSize: 11 }}>
        Dibuat oleh {NAMA} · Mau aplikasi seperti ini? Hubungi kami
      </div>
    </div>
  );
}
