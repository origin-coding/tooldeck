import type { CommandResult } from "@tooldeck/protocol";

import type { CommandRunRecord, DesktopCommand } from "../shared/desktop-api";

import "./styles.css";

const state: {
  commands: DesktopCommand[];
  selectedCommandId?: string;
  result?: CommandResult;
  history: CommandRunRecord[];
  isRunning: boolean;
  error?: string;
} = {
  commands: [],
  history: [],
  isRunning: false,
};

const elements = createLayout();

void loadInitialData();

async function loadInitialData(): Promise<void> {
  try {
    const [commands, history] = await Promise.all([
      window.tooldeck.listCommands(),
      window.tooldeck.listCommandRuns(25),
    ]);

    state.commands = commands;
    state.selectedCommandId ??= commands[0]?.id;
    state.history = history;
    state.error = undefined;
  } catch (error) {
    state.error = getErrorMessage(error);
  }

  render();
}

async function runSelectedCommand(): Promise<void> {
  if (!state.selectedCommandId || state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.error = undefined;
  render();

  try {
    state.result = await window.tooldeck.runCommand({
      commandId: state.selectedCommandId,
      input: {
        text: elements.jsonInput.value,
        indent: Number(elements.indentInput.value),
      },
    });
  } catch (error) {
    state.error = getErrorMessage(error);
  }

  state.history = await window.tooldeck.listCommandRuns(25);
  state.isRunning = false;
  render();
}

function render(): void {
  renderCommandList();
  renderCommandDetails();
  renderResult();
  renderHistory();
}

function renderCommandList(): void {
  elements.commandList.replaceChildren(
    ...state.commands.map((command) => {
      const button = document.createElement("button");
      button.className = `command-item ${command.id === state.selectedCommandId ? "selected" : ""}`;
      button.type = "button";

      const title = document.createElement("span");
      title.textContent = command.title;

      const id = document.createElement("small");
      id.textContent = command.id;

      button.append(title, id);
      button.addEventListener("click", () => {
        state.selectedCommandId = command.id;
        render();
      });

      return button;
    }),
  );
}

function renderCommandDetails(): void {
  const command = state.commands.find((item) => item.id === state.selectedCommandId);

  elements.commandTitle.textContent = command?.title ?? "No command available";
  elements.commandDescription.textContent =
    command?.description ?? "Scan trusted local plugins to list commands.";
  elements.runButton.disabled = !state.selectedCommandId || state.isRunning;
  elements.runButton.textContent = state.isRunning ? "Running" : "Run";
}

function renderResult(): void {
  elements.statusPill.className = `status-pill ${state.result?.status ?? "idle"}`;
  elements.statusPill.textContent = state.result?.status ?? "idle";
  elements.errorBox.hidden = state.error === undefined;
  elements.errorBox.textContent = state.error ?? "";

  if (!state.result) {
    elements.blocks.replaceChildren(createEmptyState("Run a command to see ContentBlock output."));
    return;
  }

  elements.blocks.replaceChildren(
    ...state.result.blocks.map((block) => {
      const pre = document.createElement("pre");
      pre.textContent = block.text;
      return pre;
    }),
  );
}

function renderHistory(): void {
  if (state.history.length === 0) {
    elements.historyList.replaceChildren(createEmptyState("No command runs yet."));
    return;
  }

  elements.historyList.replaceChildren(
    ...state.history.map((run) => {
      const row = document.createElement("div");
      row.className = "history-row";

      const meta = document.createElement("div");
      const commandId = document.createElement("strong");
      commandId.textContent = run.commandId;
      const createdAt = document.createElement("span");
      createdAt.textContent = new Date(run.createdAt).toLocaleString();
      meta.append(commandId, createdAt);

      const status = document.createElement("span");
      status.className = `status-pill ${run.status}`;
      status.textContent = run.status;

      const duration = document.createElement("span");
      duration.textContent = `${run.durationMs ?? 0} ms`;

      row.append(meta, status, duration);
      return row;
    }),
  );
}

function createLayout(): {
  commandList: HTMLElement;
  commandTitle: HTMLElement;
  commandDescription: HTMLElement;
  jsonInput: HTMLTextAreaElement;
  indentInput: HTMLInputElement;
  runButton: HTMLButtonElement;
  statusPill: HTMLElement;
  errorBox: HTMLElement;
  blocks: HTMLElement;
  historyList: HTMLElement;
} {
  const root = document.querySelector("#app");

  if (!root) {
    throw new Error("Missing #app root element.");
  }

  root.innerHTML = `
    <main class="app-shell">
      <aside class="sidebar" aria-label="Commands">
        <div class="brand">Tooldeck</div>
        <div class="section-title">Commands</div>
        <div class="command-list" data-command-list></div>
      </aside>

      <section class="workspace">
        <header class="workspace-header">
          <div>
            <h1 data-command-title>No command available</h1>
            <p data-command-description>Scan trusted local plugins to list commands.</p>
          </div>
          <button class="primary-action" data-run-button type="button">Run</button>
        </header>

        <div class="main-grid">
          <section class="panel command-panel">
            <div class="panel-header">
              <h2>Input</h2>
              <label>
                Indent
                <input data-indent-input max="8" min="0" type="number" value="2" />
              </label>
            </div>
            <textarea aria-label="JSON text" class="json-input" data-json-input spellcheck="false">{"a":1}</textarea>
          </section>

          <section class="panel result-panel">
            <div class="panel-header">
              <h2>Output</h2>
              <span class="status-pill idle" data-status-pill>idle</span>
            </div>
            <div class="error-box" data-error-box hidden></div>
            <div class="blocks" data-blocks></div>
          </section>
        </div>

        <section class="history-section">
          <div class="panel-header">
            <h2>Command History</h2>
            <button data-refresh-button type="button">Refresh</button>
          </div>
          <div class="history-list" data-history-list></div>
        </section>
      </section>
    </main>
  `;

  const runButton = requireElement<HTMLButtonElement>("[data-run-button]");
  const refreshButton = requireElement<HTMLButtonElement>("[data-refresh-button]");

  runButton.addEventListener("click", () => void runSelectedCommand());
  refreshButton.addEventListener("click", () => void loadInitialData());

  return {
    commandList: requireElement("[data-command-list]"),
    commandTitle: requireElement("[data-command-title]"),
    commandDescription: requireElement("[data-command-description]"),
    jsonInput: requireElement("[data-json-input]"),
    indentInput: requireElement("[data-indent-input]"),
    runButton,
    statusPill: requireElement("[data-status-pill]"),
    errorBox: requireElement("[data-error-box]"),
    blocks: requireElement("[data-blocks]"),
    historyList: requireElement("[data-history-list]"),
  };
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element as T;
}

function createEmptyState(text: string): HTMLElement {
  const element = document.createElement("span");
  element.className = "empty-state";
  element.textContent = text;

  return element;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
