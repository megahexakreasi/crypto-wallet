# EVM Local Web Wallet (ETH, BSC & MTT Network)

Aplikasi Web Wallet EVM Non-Custodial lokal yang dirancang khusus untuk penggunaan pribadi (local use), dengan integrasi **Blockscout RPC & REST API**, multi-chain support (Ethereum, BSC, MTT Network), manajemen token ERC-20 / BEP-20, serta pencatatan riwayat transaksi masuk dan keluar.

---

## 🌟 Fitur Utama

1. **Pembuatan & Manajemen Wallet (100% Non-Custodial)**:
   - **Buat Wallet Baru**: Menghasilkan 12 kata Secret Seed Phrase (BIP-39) dan private key dengan satu klik.
   - **Impor Wallet**: Mendukung pemulihan akun melalui 12/24 kata mnemonic atau langsung melalui Private Key (`0x...`).
   - **Backup & Ekspor Kunci**: Lihat seed phrase dan private key kapan saja secara lokal.
   - **Multi-Akun**: Kelola beberapa wallet sekaligus dan beralih antar akun dengan cepat.

2. **Dukungan Multi-Chain (EVM)**:
   - **BNB Smart Chain (BSC Mainnet & Testnet)**
   - **Ethereum (Mainnet & Sepolia Testnet)**
   - **MTT Network** (Tersedia opsi edit RPC URL, Chain ID, Symbol, dan Blockscout API URL)
   - **Kustom Network**: Tambahkan jaringan EVM baru secara mandiri.

3. **Integrasi Blockscout API**:
   - Berdasarkan dokumentasi resmi [Blockscout RPC & REST API](https://docs.blockscout.com/devs/apis/rpc).
   - Mendukung modul:
     - `?module=account&action=balance`: Pengecekan saldo native coin koin secara cepat (dengan fallback otomatis ke RPC JSON-RPC `eth_getBalance`).
     - `?module=account&action=txlist`: Riwayat transaksi masuk (*incoming*) dan keluar (*outgoing*) koin native.
     - `?module=account&action=tokentx`: Riwayat transfer token ERC-20 / BEP-20.

4. **Kirim & Terima Aset (Send & Receive)**:
   - **Terima (Receive)**: Menampilkan QR code alamat wallet EVM dan tombol salin 1-klik.
   - **Kirim (Send)**:
     - Pilih aset (Koin Utama atau Token Custom seperti USDT, USDC, MTT Token).
     - Validasi alamat penerima (checksum EVM).
     - Estimasi biaya gas real-time (*gas limit & gas price*).
     - Tombol MAX saldo dengan perhitungan margin gas otomatis.
     - Penandatanganan transaksi secara lokal (*offline signing*) sebelum disiarkan (*broadcast*).

5. **Manajemen Custom Token**:
   - Cukup masukkan Contract Address token.
   - Sistem otomatis mendeteksi Nama Token, Simbol, dan Desimal langsung dari blockchain.

---

## 🚀 Cara Menjalankan

Aplikasi saat ini telah aktif di komputer lokal Anda:

```bash
# Jalankan development server
npm run dev
```

Buka browser dan akses:
👉 **[http://localhost:5173/](http://localhost:5173/)**

Untuk membuat versi produksi (*bundle*):
```bash
npm run build
```

---

## 🔒 Catatan Keamanan
- Aplikasi ini **100% client-side**. Seluruh private key dan seed phrase tersimpan hanya di memori browser lokal (*LocalStorage*) dan tidak pernah dikirim ke server manapun.
