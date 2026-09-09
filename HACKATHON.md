# AgentArbiter - Hackathon Submission Guide

## سریعترین راه: Studionet (بدون نصب هیچ‌چیز)

1. باز کن: https://studio.genlayer.com
2. اکانت خودکار با GEN رایگان ساخته میشود
3. فایل `contracts/agent_arbiter.py` را در Studio آپلود کن
4. Deploy کن — آدرس قرارداد را کپی کن
5. آدرس را در `frontend/.env.local` با `VITE_NETWORK=testnet` بگذار

## راه اصلی: Testnet Bradbury

### مرحله ۱: حساب بسازید
```bash
# نصب genlayer CLI
npm install -g genlayer@latest

# ساخت حساب جدید
genlayer account create
```

یا از MetaMask استفاده کنید:
- chain id: 4221
- RPC: https://rpc-bradbury.genlayer.com

### مرحله ۲: GEN تهیه کنید
- فاست: https://testnet-faucet.genlayer.foundation
- آدرس حساب خود را وارد کنید
- ۱۰۰+ GEN رایگان دریافت کنید

### مرحله ۳: Deploy کنید
```bash
# از طریق genlayer CLI
genlayer network    # Bradbury را انتخاب کنید
genlayer deploy

# یا از طریق JavaScript
node scripts/deploy.mjs  # با اتصال به testnet
```

### مرحله ۴: در Agent Tank ثبت کنید
- آدرس قرارداد را کپی کنید
- به https://portal.genlayer.foundation/agent-tank/hackathon برو
- ثبت‌نام کنید

## نکته مهم
پروژه **کاملاً آماده** است. فقط نیاز به یک شبکه واقعی + حساب با GEN دارد.
