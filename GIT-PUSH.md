# Push to GitHub - Commands

## Step-by-step commands

Run these in PowerShell from the project root (`g:\whatsapp-clone`):

### 1. Initialize git (if not already done)

```powershell
cd g:\whatsapp-clone
git init
```

### 2. Add remote repository

```powershell
git remote add origin https://github.com/graheetphartyal23/whatsapp-clone.git
```

If remote already exists, update it:
```powershell
git remote set-url origin https://github.com/graheetphartyal23/whatsapp-clone.git
```

### 3. Stage all files

```powershell
git add .
```

### 4. Commit

```powershell
git commit -m "Initial commit: WhatsApp clone with React, Express, PostgreSQL, Socket.io"
```

### 5. Push to GitHub

```powershell
git branch -M main
git push -u origin main
```

If you get authentication errors, use a Personal Access Token instead of password:
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- Use the token as password when prompted

---

## Quick one-liner (if git is already initialized)

```powershell
cd g:\whatsapp-clone
git add .
git commit -m "Initial commit: WhatsApp clone"
git branch -M main
git push -u origin main
```

---

## Important: What's excluded from git

The `.gitignore` file ensures these are **NOT** committed:
- ✅ `backend/.env` (your database password and secrets)
- ✅ `node_modules/` (dependencies)
- ✅ `dist/` (build files)
- ✅ `.vscode/` (IDE settings)

Only `.env.example` (with placeholders) will be committed, not your real `.env`.
