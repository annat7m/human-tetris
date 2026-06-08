# Body Blocks

A lively, fun, and silly interactive game built in under 3 hours!

The application uses a computer's camera to track multiple body parts via **MediaPipe Tasks Vision** pose detection and recognition. It displays a time limit during which the user must contort their body into one of 7 random "body block" shapes appearing on the screen. Once successfully matched, they point to the corner they want it to go into. Over time, layering of multiple body blocks brings them closer and closer to the person.

The ultimate reward for us as engineers was watching a smiling 7-year-old stand up, move around, and play with the game to see how it works!

---

## Hackathon & Submission Details

This project was built as part of the **3-hour Hackathon** [**"Claude for Everyone: Community Build"**](https://luma.com/rvxe5jki?tk=u8yzXm) on Saturday, June 6th, 2026, held at the Upstart Collective in Portland, Oregon, US.

### Timeline & Branch

- **First Commit:** `2026-06-06 12:35:44` (PDT)
- **Last Commit:** `2026-06-06 15:14:14` (PDT)
- **Total Duration:** 158 minutes (2 hours, 38 minutes)

The final submission code is locked into the **`done-in-158-minutes`** branch.

- **Branch Link:** [done-in-158-minutes branch](https://github.com/annat7m/body-blocks/tree/done-in-158-minutes)

---

## The Team

- **Anna Tymoshenko** - [GitHub](https://github.com/annat7m) · [LinkedIn](https://www.linkedin.com/in/anna-tymoshenko-b803172b6/)
- **Fedya Semenov** - [GitHub](https://github.com/FedyaS) · [LinkedIn](https://www.linkedin.com/in/fedor-semenov-ml/)
- **David Schargel** - [GitHub](https://github.com/DavidSchargel) · [LinkedIn](https://www.linkedin.com/in/davidschargel/)
- **Isak Dzhumaliev** - [GitHub](https://github.com/dzhumaliev/) · [LinkedIn](https://www.linkedin.com/in/isak-dzhumaliev/)

---

## Key Technologies

### Core Features & Pose Recognition

- **MediaPipe Tasks Vision** - Pose detection and recognition for body gestures.

### Frontend Framework & Routing

- **React 19** - UI framework for building the application.
- **TanStack Start** - Full-stack React framework with SSR support.
- **TanStack Router** - File-based routing system.
- **TypeScript** - Type-safe JavaScript development.

### Styling & Assets

- **Tailwind CSS v4** - Utility-first CSS framework for styling.
- **Lucide React** - Icon library.

### Shortcuts & Configuration

- **TanStack React Hotkeys** - Keyboard shortcut handling.

### Tooling & Infrastructure

- **Vite** - Build tool and development server.
- **pnpm** - Package manager.
- **Vitest** - Testing framework.
- **ESLint** - Code linting.
- **Prettier** - Code formatting.
- **@tanstack/devtools-vite** - Development tools integration _(installed but not used in hackathon)_.
- **Cloudflare Workers** - Serverless deployment platform _(installed but not used in hackathon)_.
- **Wrangler** - Cloudflare CLI tool for deployment _(installed but not used in hackathon)_.

### AI Assistance

- **Claude Code** - Agentic CLI tool by Anthropic for terminal-based code editing, testing, and execution.
- **pi Coding Agent** - Agent used with [Nico Balion's pi-interview-tool](https://github.com/nicobailon/pi-interview-tool) to refine development tasks.
- **RepoPrompt** - Context builder and prompt utility for supplying codebase context to LLMs.
- **VS Code** - IDE/text editor used for writing code and debugging the project.
- **GPT 5.5** - LLM model used for architectural planning and code generation.
- **Opus 4.8** - LLM model used for advanced reasoning and structural guidance.
- **Sonnet 4.6** - LLM model used for React UI design and state management logic.

---

## Supporting Media

There are some supporting media files in [docs/media/](https://github.com/annat7m/body-blocks/tree/main/docs/media) that were not part of the project itself, but are highly worth seeing, especially the 7-year-old playing with it:

- **7-Year-Old Playing the Game:**
  - File: [7-year-old-using-the-app.mp4](https://github.com/annat7m/body-blocks/blob/main/docs/media/7-year-old-using-the-app.mp4)
- **3 of the 7 Shapes:**
  - File: [3-of-7-shapes.jpg](https://github.com/annat7m/body-blocks/blob/main/docs/media/3-of-7-shapes.jpg)
- **Fedya at the Whiteboard as We Started:**
  - File: [fedya-at-whiteboard.jpg](https://github.com/annat7m/body-blocks/blob/main/docs/media/fedya-at-whiteboard.jpg)
- **Fedya Standing In Winco at 11pm the Night Before the Hackathon:**
  - File: [2026-06-05-fedya-winco-demo.mov](https://github.com/annat7m/body-blocks/blob/main/docs/media/2026-06-05-fedya-winco-demo.mov)


## Development Commands

To run this application locally:

```bash
pnpm install
pnpm dev
```

### Production Build

To build the application for production:

```bash
pnpm build
```

### Testing

This project uses [Vitest](https://vitest.dev/) for testing:

```bash
pnpm test
```

### Linting and Formatting

```bash
pnpm lint
pnpm lint:fix
pnpm format:check
pnpm format
```
