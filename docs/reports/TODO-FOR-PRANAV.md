# TODO for Pranav

Things that need your accounts, devices or judgement. In order.

## 1. Put the code on GitHub (the `gh` CLI isn't installed on this PC)

Create an **empty private** repo called `liftlog` at https://github.com/new (no README, no .gitignore), then in this folder:

```bash
git remote add origin https://github.com/<your-username>/liftlog.git
git push -u origin main
```

Or install the GitHub CLI (`winget install GitHub.cli`), run `gh auth login`, then:

```bash
gh repo create liftlog --private --source . --push
```

After the push, the **CI** workflow runs automatically (Actions tab).

## 2. Connect Vercel to GitHub (optional, for deploy-on-push)

The app is already deployed from this PC with the Vercel CLI to **https://liftlog-jade.vercel.app** (project `liftlog`, team `ed-i-th`).
To deploy on every push instead: Vercel → project **liftlog** → Settings → Git → Connect Git Repository → pick `liftlog`.
