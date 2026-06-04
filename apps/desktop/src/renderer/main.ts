import type { CommandResult } from "@tooldeck/protocol";

import type { CommandRunRecord, DesktopCommand } from "../shared/desktop-api";

import "./styles.css";

const state: {
  commands: DesktopCommand[];
  selectedCommandId?: string;
  result?: CommandResult;
  history: CommandRunRecord[];
  isLoadingData: boolean;
  isRunning: boolean;
  loadError?: string;
  runError?: string;
} = {
  commands: [],
  history: [],
  isLoadingData: false,
  isRunning: false,
};

const elements = createLayout();

render();
void loadInitialData();

async function loadInitialData(): Promise<void> {
  state.isLoadingData = true;
  state.loadError = undefined;
  render();

  try {
    const [commands, history] = await Promise.all([
      window.tooldeck.listCommands(),
      window.tooldeck.listCommandRuns(25),
    ]);

    state.commands = commands;
    state.selectedCommandId = resolveSelectedCommandId(commands, state.selectedCommandId);
    state.history = history;
  } catch (error) {
    state.loadError = getErrorMessage(error);
  } finally {
    state.isLoadingData = false;
    render();
  }
}

async function runSelectedCommand(): Promise<void> {
  if (!state.selectedCommandId || state.isLoadingData || state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.runError = undefined;
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
    state.runError = getErrorMessage(error);
  }

  try {
    state.history = await window.tooldeck.listCommandRuns(25);
  } catch (error) {
    state.loadError = getErrorMessage(error);
  }

  state.isRunning = false;
  render();
}

function render(): void {
  renderAppNotice();
  renderCommandList();
  renderCommandDetails();
  renderResult();
  renderHistory();
}

function renderAppNotice(): void {
  elements.appNotice.hidden = state.loadError === undefined;
  elements.appNotice.textContent = state.loadError
    ? `Failed to load desktop data: ${state.loadError}`
    : "";
}

function renderCommandList(): void {
  if (state.commands.length === 0) {
    const message = state.isLoadingData
      ? "Loading commands..."
      : state.loadError
        ? "Unable to load commands."
        : "No commands found.";

    elements.commandList.replaceChildren(createEmptyState(message));
    return;
  }

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

  if (command) {
    elements.commandTitle.textContent = command.title;
    elements.commandDescription.textContent = command.description ?? command.id;
  } else if (state.isLoadingData) {
    elements.commandTitle.textContent = "Loading commands";
    elements.commandDescription.textContent = "Scanning trusted local plugins.";
  } else {
    elements.commandTitle.textContent = "No command available";
    elements.commandDescription.textContent = state.loadError
      ? "Command loading failed."
      : "No commands were found in the configured plugin directories.";
  }

  elements.runButton.disabled = !state.selectedCommandId || state.isLoadingData || state.isRunning;
  elements.runButton.textContent = state.isRunning ? "Running" : "Run";
  elements.refreshButton.disabled = state.isLoadingData;
  elements.refreshButton.textContent = state.isLoadingData ? "Refreshing" : "Refresh";
}

function renderResult(): void {
  elements.statusPill.className = `status-pill ${state.result?.status ?? "idle"}`;
  elements.statusPill.textContent = state.result?.status ?? "idle";
  elements.errorBox.hidden = state.runError === undefined;
  elements.errorBox.textContent = state.runError ?? "";

  if (!state.result) {
    elements.blocks.replaceChildren(
      createEmptyState(
        state.runError ? "Command failed. See the error above." : "Run a command to see output.",
      ),
    );
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
    elements.historyList.replaceChildren(
      createEmptyState(state.isLoadingData ? "Loading command history..." : "No command runs yet."),
    );
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
  appNotice: HTMLElement;
  commandList: HTMLElement;
  commandTitle: HTMLElement;
  commandDescription: HTMLElement;
  jsonInput: HTMLTextAreaElement;
  indentInput: HTMLInputElement;
  runButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
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
        <div class="notice-box" data-app-notice hidden></div>

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
    appNotice: requireElement("[data-app-notice]"),
    commandList: requireElement("[data-command-list]"),
    commandTitle: requireElement("[data-command-title]"),
    commandDescription: requireElement("[data-command-description]"),
    jsonInput: requireElement("[data-json-input]"),
    indentInput: requireElement("[data-indent-input]"),
    runButton,
    refreshButton,
    statusPill: requireElement("[data-status-pill]"),
    errorBox: requireElement("[data-error-box]"),
    blocks: requireElement("[data-blocks]"),
    historyList: requireElement("[data-history-list]"),
  };
}

function resolveSelectedCommandId(
  commands: DesktopCommand[],
  selectedCommandId: string | undefined,
): string | undefined {
  if (selectedCommandId && commands.some((command) => command.id === selectedCommandId)) {
    return selectedCommandId;
  }

  return commands[0]?.id;
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
