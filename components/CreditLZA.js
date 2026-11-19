// components/CreditLZA.js
// Kredit pembuat aplikasi — tampil di halaman login.
// Pakai <CreditLZA gelap /> kalau background-nya gelap.

const PEMBUAT = "LZA Apps";
const NAMA = "Lutfi";
const LINK = "https://wa.me/62xxxxxxxxxx"; // ganti: nomor WA atau link galeri LZA

export default function CreditLZA({ gelap = false }) {
  return (
    <div
      style={{
        marginTop: 24,
        textAlign: "center",
        fontSize: 12,
        color: gelap ? "rgba(255,255,255,0.6)" : "#888",
        lineHeight: 1.6,
      }}
    >
      <div>
        Powered by{" "}
        <a
          href={LINK}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: gelap ? "#5eead4" : "#0d9488",
            fontWeight: 600,
            textDecoration: "none",
          }}
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
