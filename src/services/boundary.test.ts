import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const APP_DIR = join(__dirname, "..", "..", "app");
const MOCK_IMPORT_PATTERN = /from\s+["'](?:@\/mocks|(?:\.\.\/)+(?:src\/)?mocks)/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

describe("architecture boundary: app/ must not import src/mocks", () => {
  it("finds zero mock imports in app screens", () => {
    const violations = collectSourceFiles(APP_DIR).filter((file) =>
      MOCK_IMPORT_PATTERN.test(readFileSync(file, "utf8"))
    );

    expect(violations).toEqual([]);
  });
});
