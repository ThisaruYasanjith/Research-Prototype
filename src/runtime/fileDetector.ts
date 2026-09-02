import * as vscode from 'vscode';

export class FileDetector {
  /**
   * Returns true ONLY if FileProcessor.java is actively open and focused
   * (or currently visible in one of the split editor columns).
   */
  public static getActiveFileProcessor(): { detected: boolean; targetInfo: string } {
    // 1. Check the currently focused editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && this.isTargetFile(activeEditor.document.fileName)) {
      const line = activeEditor.selection.active.line + 1;
      const fileName = this.extractFileName(activeEditor.document.fileName);
      return { detected: true, targetInfo: `${fileName}:${line}` };
    }

    // 2. Check any currently visible editor column (e.g., when the webview has focus)
    for (const editor of vscode.window.visibleTextEditors) {
      if (this.isTargetFile(editor.document.fileName)) {
        const line = editor.selection.active.line + 1;
        const fileName = this.extractFileName(editor.document.fileName);
        return { detected: true, targetInfo: `${fileName}:${line}` };
      }
    }

    return { detected: false, targetInfo: '' };
  }

  private static isTargetFile(filePath: string): boolean {
    // Matches FileProcessor.java (case-insensitive, cross-platform slashes)
    return /(?:^|[\\/])FileProcessor\.java$/i.test(filePath);
  }

  private static extractFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || 'FileProcessor.java';
  }
}