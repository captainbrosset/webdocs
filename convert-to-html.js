import fs from "fs/promises";
import { rimraf } from "rimraf";
import { glob } from "glob";
import { m2h } from "mdn-flavored-markdown";

const SRC_DIR_MD = "./tmp/md/";
const DIST_DIR_HTML = "./tmp/html-with-macros/";

async function getSourceMDFiles() {
  const files = await glob("*", { cwd: SRC_DIR_MD });
  return files;
}

async function main() {
  // Cleanup the output dirs.
  await rimraf(DIST_DIR_HTML);
  await fs.mkdir(DIST_DIR_HTML);

  const files = await getSourceMDFiles();

  for (const file of files) {
    console.log(`Converting to HTML: ${file}`);

    const filePath = `${SRC_DIR_MD}${file}`;
    const fileContent = await fs.readFile(filePath, "utf8");

    const html = await m2h(fileContent, { locale: "en-US" });

    const htmlFilePath = `${DIST_DIR_HTML}${file.replace(".md", ".html")}`;
    await fs.writeFile(htmlFilePath, html);
  }
}

main();
