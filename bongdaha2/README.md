# bongdaha – Environment Setup Guide

This project uses **Node.js + Git**.  
Please follow the steps below when setting up on a new computer.

---

## 1. One-time Requirements

Install the following tools:

- **Git**  
  https://git-scm.com

- **Node.js (LTS version)**  
  https://nodejs.org

- **VS Code**  
  https://code.visualstudio.com

Make sure you are logged in to your **GitHub account**.

---

## 2. Clone the Repository (First Time Only)

Open **VS Code → Terminal**, then run:

```bash
git clone https://github.com/msmythicals2/bongdaha.git
cd bongdaha
npm install

node_modules is generated locally by npm install
and is NOT tracked by Git.

3. Create .env File (Required)

Create a file named .env in the project root directory.

Example:

API_KEY=your_api_key_here


⚠️ Important:

.env is NOT tracked by Git

Each developer must create their own .env

DO NOT commit .env

4. Run the Project

Depending on the setup, run one of the following:

node server.js


or

npm run dev

5. Daily Development Workflow (IMPORTANT)

Always follow this order:

git pull        # before starting work
# make changes
git add .
git commit -m "describe your change"
git push

6. Rules (Must Follow)

Always run git pull before coding

Never commit .env

Never commit node_modules

Do not push directly to main without approval

If Git conflicts appear, STOP and ask

Summary

Git tracks source code only

Dependencies come from npm install

Secrets go in .env, not in Git

If something does not work, check:

Did you run npm install?

Did you create .env?

Did you restart the server?
