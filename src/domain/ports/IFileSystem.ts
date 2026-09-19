export interface IFileSystem {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive: boolean }): void;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding?: string): void;
  readdirSync(path: string, options?: { withFileTypes: true }): import('fs').Dirent[];
  rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}
