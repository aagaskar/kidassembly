/**
 * Save/open files on local disk. Uses the File System Access API where
 * available (Chromium); falls back to anchor-download and <input type=file>
 * everywhere else (Firefox, Safari, iPads). The fallback is a first-class
 * path, not an afterthought (§8.3).
 */

interface SaveFilePickerWindow extends Window {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  showOpenFilePicker?: (opts: {
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ getFile: () => Promise<File> }[]>;
}

export async function saveTextFile(
  suggestedName: string,
  content: string,
  mime = "application/json"
): Promise<void> {
  const w = window as SaveFilePickerWindow;
  const blob = new Blob([content], { type: mime });
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({ suggestedName });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return; // user cancelled
      // fall through to anchor download on any other failure
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openTextFile(accept: string): Promise<string | null> {
  const w = window as SaveFilePickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({});
      return await (await handle.getFile()).text();
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return null;
      // fall through to the input fallback
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    // If the user closes the picker without choosing, resolve null on refocus.
    window.addEventListener("focus", () => setTimeout(() => resolve(null), 500), { once: true });
    input.click();
  });
}
