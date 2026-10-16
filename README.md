# GM World market breadth

A one-page view of the Chartink dashboard "Atlas GM WORLD" (chartink.com/dashboard/499165).
GitHub Actions refreshes it every weekday at about 5:30 PM IST, and GitHub Pages hosts it.
Your computer does not need to be on.

## What's in here

- `index.html`: the page. Its numbers sit between `/*DATA-START*/` and `/*DATA-END*/`.
- `scripts/update.mjs`: opens the dashboard in a headless browser, reads the latest data and rewrites that block.
- `.github/workflows/update.yml`: runs the script on schedule and saves the updated page.

## One-time setup (about 5 minutes)

1. Sign in at github.com (create a free account if needed).
2. Create a new repository, for example `gm-world`. Choose **Public** (free GitHub Pages needs a public repository on the free plan).
3. Upload everything in this folder, keeping the folder structure (including the hidden `.github` folder).
   Easiest: on the new repository's page click **uploading an existing file**, drag the whole folder's contents in, then **Commit changes**.
4. **Settings → Actions → General → Workflow permissions**: choose **Read and write permissions**, then **Save**.
5. **Settings → Pages**: Source **Deploy from a branch**, Branch **main**, folder **/ (root)**, then **Save**.
   After a minute the page is live at `https://<your-username>.github.io/gm-world/`.
6. Test it now: **Actions → Update GM World breadth → Run workflow**. A green tick means it worked.
   Click the run to see the day's summary.

## Daily email with the page as a PDF (optional)

On each new trading day the workflow saves the page as a PDF and emails it with a one-line summary.
It sends from a Gmail account using an app password (your normal Gmail password won't work here).

1. Turn on 2-Step Verification for your Google account, if it isn't already: myaccount.google.com → Security.
2. Create an app password: myaccount.google.com/apppasswords → name it `GM World` → **Create**. Copy the 16-character password.
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**, and add three secrets:
   - `MAIL_USERNAME`: the Gmail address that sends the email
   - `MAIL_PASSWORD`: the 16-character app password
   - `MAIL_TO`: where to send it (can be the same address; separate several with commas)
4. Test it: **Actions → Update GM World breadth → Run workflow**. A manual run always sends the email, even when there is no new data.

Without these secrets the workflow still updates the page and simply skips the email.

## If the run fails with "Dashboard widgets did not load"

Chartink is only showing the data to logged-in users. Give the workflow your Chartink login cookie:

1. Log in at chartink.com in Chrome on your computer and open your dashboard.
2. Press F12, go to **Application → Cookies → https://chartink.com**.
3. Copy the cookie names and values in this form: `name1=value1; name2=value2` (the session cookies, usually named like `ci_session`, `remember_web_...` and `XSRF-TOKEN`).
4. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   Name `CHARTINK_COOKIE`, value the text from step 3. Save, then run the workflow again.

The cookie stays private to your repository. If Chartink logs you out later, repeat these steps.

## Good to know

- On market holidays the run finds no new trading day and leaves the page unchanged.
- GitHub emails you automatically if a run fails.
- GitHub can start scheduled runs a few minutes late at busy times.
- GitHub pauses scheduled workflows in repositories with no activity for 60 days; the daily data commits keep this one active.
