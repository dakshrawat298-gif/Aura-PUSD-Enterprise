# Aura PUSD Enterprise - Master Architecture & Vibe Rules

1. Core Philosophy (The Vibe):
- Design: Absolute "Apple-level" premium design. Extreme minimalism, dark mode by default, high-quality glassmorphism, subtle animations, and zero clutter. 
- Layout: Strictly Mobile-First. The UI must look like a native iOS Web3 application.

2. Tech Stack Constraint:
- Backend: Node.js + Express (No Next.js).
- Frontend: Pure Vanilla HTML, CSS, and Client-side JavaScript.
- Web3: `@solana/web3.js` and `@solana/spl-token`.

3. Strict Directory Structure:
- `/public/` -> All frontend assets (`index.html`, `style.css`, `app.js`).
- `/src/` -> Secure backend logic (e.g., `solanaPayroll.js`).
- `server.js` -> The main Express server file.

4. Coding Rules for AI:
- Never write random or boilerplate code. 
- Wait for explicit step-by-step instructions before coding any component.
- Always refer back to this document before generating new logic.
