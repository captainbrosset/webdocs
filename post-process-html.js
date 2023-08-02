import fs from "fs/promises";
import { rimraf } from "rimraf";
import { glob } from "glob";
import { parse } from 'node-html-parser';
import METADATA from "./tmp/metadata.json" assert { type: "json" };

const MDN_WEBSITE_ROOT = "https://developer.mozilla.org";
const SRC_DIR = "./tmp/html/";
const DIST_DIR = "./docs/";
const DIST_FEATURE_DIR = "./docs/features/";
const TEMPLATE_FEATURE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>__TITLE__</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <main>
    __CONTENT__
  </main>
  <aside>
  </aside>
</body>
</html>
`;
const TEMPLATE_INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Web Docs</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <h1>Web Docs</h1>
  <main>
    __CONTENT__
  </main>
</body>
</html>
`;

const escapeHTML = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

function findMetadataFromMdnUrl(url) {
  for (const path in METADATA) {
    if (METADATA[path].mdnURL === url) {
      return METADATA[path];
    }
  }
  return null;
}

function rewriteLink(link) {
  if (link.startsWith("/en-US/docs/")) {
    link = MDN_WEBSITE_ROOT + link;
    const feature = findMetadataFromMdnUrl(link);
    return feature ? `./${feature.path}.html` : link;
  }
  
  // Both these MDN links work, but it'd be great if there was only one type.
  if (link.startsWith("/Web/")) {
    link = MDN_WEBSITE_ROOT + "/en-US/docs" + link;
    const feature = findMetadataFromMdnUrl(link);
    return feature ? `./${feature.path}.html` : link;
  }

  return link;
}

async function getSourceFiles() {
  const files = await glob("*.html", { cwd: SRC_DIR });
  return files;
}

async function main() {
  // Cleanup the output dir.
  await rimraf(DIST_FEATURE_DIR);
  await fs.mkdir(DIST_FEATURE_DIR);

  // Get all html source files.
  const files = await getSourceFiles();

  for (const file of files) {
    console.log(`Post-processing: ${file}`);

    const filePath = `${SRC_DIR}${file}`;
    const fileContent = await fs.readFile(filePath, "utf8");
    const featurePath = file.replace(".html", "");
    const metadata = METADATA[featurePath];

    // Move the content into the template.
    const title = escapeHTML(metadata.title);
    const html = TEMPLATE_FEATURE.replace("__TITLE__", title).replace("__CONTENT__", fileContent);

    // Parse the HTML into a DOM so we can move things around and rewrite links easily.
    const dom = parse(html);

    // Move the h1 heading.
    const body = dom.querySelector("body");
    const h1 = dom.querySelector("h1");
    const main = dom.querySelector("main");
    const aside = dom.querySelector("aside");
    body.appendChild(h1);
    body.appendChild(main);
    body.appendChild(aside);

    // Find the compat h2 and section.
    const compatSection = dom.querySelector("section.compat-data");
    if (compatSection) {
      const compatH2 = compatSection.previousElementSibling;
      aside.appendChild(compatH2);
      aside.appendChild(compatSection);
    }

    // Same for the spec section.
    const specSection = dom.querySelector("section.spec");
    if (specSection) {
      const specH2 = specSection.previousElementSibling;
      aside.appendChild(specH2);
      aside.appendChild(specSection);
    }

    // Remove headings for empty sections.
    const headings = dom.querySelectorAll("h2, h3, h4, h5, h6");
    for (const heading of headings) {
      const currentLevel = parseInt(heading.tagName[1]);
      const next = heading.nextElementSibling;
      const isNextHeading = heading.tagName.startsWith("H");
      const nextLevel = next ? parseInt(next.tagName[1]) : 0;

      if (!next || (isNextHeading && nextLevel <= currentLevel)) {
        heading.remove();
      }
    }

    // Process all links.
    const links = dom.querySelectorAll("a");
    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href) {
        continue;
      }
      link.setAttribute("href", rewriteLink(href));
    }

    // Process all images.
    const images = dom.querySelectorAll("img");
    for (const image of images) {
      const src = image.getAttribute("src");
      if (!src) {
        continue;
      }
      if (!src.startsWith("http")) {
        // FIXME: WHAT SHOULD HAPPEN WITH IMAGES? EXPORTED TOO?
        image.setAttribute("src", `${metadata.mdnURL}/${src}`);
      }
    }

    const newFileContent = dom.toString();

    const newFilePath = `${DIST_FEATURE_DIR}${file}`;
    await fs.writeFile(newFilePath, newFileContent);
  }

  // Generate an index.html file that lists all of the generate feature pages.
  let featureList = "<ul>";
  for (const featurePath in METADATA) {
    const feature = METADATA[featurePath];
    featureList += `<li><a href="features/${feature.path}.html">${escapeHTML(feature.title)}</a></li>`;
  }
  featureList += "</ul>";

  const indexHtml = TEMPLATE_INDEX.replace("__CONTENT__", featureList);
  await fs.writeFile(`${DIST_DIR}index.html`, indexHtml);
}

main();
