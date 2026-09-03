# Hướng dẫn Set-up Service Net

## 1. Cấu hình `startup.sh` (dòng 45)

```bash
io-pkt-v6-hc -U 33:33 -d e1000 -p qnet
```

> Phải thêm `-p qnet`

## 2. Chạy các lệnh trong VM

```bash
mqueue
io-pkt-v6-hc
mount -T io-pkt lsm-qnet.so
```
