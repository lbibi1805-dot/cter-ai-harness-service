# Docker cho cter-ai-harness-service va cter-interview-cloak-client

## 1. Docker la gi

- **Image**: khuon mau chi doc, tao tu `Dockerfile` qua `docker build`. Chua code + deps + OS toi thieu.
- **Container**: instance chay tu image (`docker run`). Co the tao/xoa nhieu container tu 1 image.
- **Dockerfile**: tap lenh build image theo layer. Moi `RUN`/`COPY` la 1 layer duoc cache.
- **Build context**: thu muc gui len Docker daemon khi build (thu muc chua `Dockerfile`). File trong `.dockerignore` se khong gui.

## 2. cter-ai-harness-service (Node.js, chay duoc tren Linux container)

Da co `Dockerfile` 2 stage va `docker-compose.yml`.

### 2.1 Build image

```bash
cd cter-ai-harness-service

# Build thu cong
docker build -t cter-harness:latest .

# Hoac qua compose (tu build)
docker compose build
```

Giai thich: `builder` cai deps va `npm run build` ra `dist/`, `runner` chi copy `dist` + deps production + `system-prompt.md`/`knowledge.md`/`documents-vault` de giam kich thuoc.

### 2.2 Chay container

```bash
# Can .env da dien CANVAS_URL_1, CANVAS_KEY_1, CLAUDE_API_KEY...
# Chay bang docker run
docker run -d --name cter-harness -p 3000:3000 --env-file .env -v ./data:/app/data cter-harness:latest

# Hoac bang compose (khuyen nghi)
docker compose up -d
```

- `-d`: chay nen
- `-p 3000:3000`: map port host:container (`src/bootstrap/httpServer.ts:41` listen 3000)
- `--env-file .env`: nap bien moi truong theo `src/bootstrap/config/loadConfig.ts`
- `-v ./data:/app/data`: mount de `data/processed.json` khong mat khi container xoa

### 2.3 Quan ly

```bash
docker ps                 # xem container dang chay
docker logs -f cter-harness
docker exec -it cter-harness sh
curl http://localhost:3000/       # health check
curl http://localhost:3000/start  # bat polling
docker stop cter-harness
docker rm cter-harness
docker images             # xem image
docker rmi cter-harness:latest
docker compose down
```

### 2.4 Luu y

- `data/processed.json` phai persistent qua volume, neu khong se poll lai file cu
- `PUPPETEER_EXECUTABLE_PATH` da tro toi `/usr/bin/chromium-browser` cai trong image

## 3. cter-interview-cloak-client (WPF, net10.0-windows)

`InterviewCloak.csproj:5` `net10.0-windows` + `UseWPF=true` nen **khong chay duoc tren Linux container**. Docker o day chi dung de build.

### 3.1 Build tren Windows (khuyen nghi, khong can Docker)

```bash
cd cter-interview-cloak-client
dotnet publish -c Release -o publish
# Chay: publish/InterviewCloak.exe
```

### 3.2 Build bang Docker Windows container (tuy chon)

Yeu cau: Windows 10/11 + Docker Desktop da chuyen sang `Windows containers`.

```bash
cd cter-interview-cloak-client
docker build -t interview-cloak:build .

# Lay file exe ra host
docker create --name tmp interview-cloak:build
docker cp tmp:/app/publish ./publish
docker rm tmp
```

Khong dung `docker run` de chay app vi WPF can desktop GUI, container Windows nanoserver khong co GUI.

## 4. So sanh nhanh

| Du an | Chay trong Linux container duoc khong | Dockerfile de lam gi |
|---|---|---|
| cter-ai-harness-service | Co, chay `node dist/index.js` | Dong goi de deploy Render/Cloud Run/VPS |
| cter-interview-cloak-client | Khong (WPF) | Chi de build ra exe, van chay native tren Windows |
