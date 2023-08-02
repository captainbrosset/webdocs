import fs from "fs/promises";
import { rimraf } from "rimraf";
import { glob } from "glob";
import { render } from "mdn-kumascript";

const SRC_DIR_HTML = "./tmp/html-with-macros/";
const DIST_DIR_HTML = "./tmp/html/";

import METADATA from "./tmp/metadata.json" assert { type: "json" };

const escapeHTML = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MACROS = {
  cssinfo: function(metadata) {
    if (!metadata.specData) {
      return "";
    }
    const data = metadata.specData;

    let output = `<section class="formal-definition"><table><tbody>`;

    if (data.initial) {
      output += `<tr><th scope="row">Initial value</th><td>${escapeHTML(data.initial)}</td></tr>`;
    }

    if (data.appliesTo) {
      output += `<tr><th scope="row">Applies to</th><td>${escapeHTML(data.appliesTo)}</td></tr>`;
    }

    if (data.inherited) {
      output += `<tr><th scope="row">Inherited</th><td>${escapeHTML(data.inherited)}</td></tr>`;
    }

    if (data.computedValue) {
      output += `<tr><th scope="row">Computed value</th><td>${escapeHTML(data.computedValue)}</td></tr>`;
    }

    if (data.animationType) {
      output += `<tr><th scope="row">Animation type</th><td>${escapeHTML(data.animationType)}</td></tr>`;
    }

    output += `</tbody></table></section>`;

    return output;
  },
  csssyntax: function(metadata) {  
    if (!metadata.specData || !metadata.specData.syntax) {
      return "";
    }

    const syntax = escapeHTML(metadata.specData.syntax);

    return `<section class="formal-syntax"><pre>${syntax}</pre></section>`;
  },
  compat: function(metadata) {
    const compat = metadata.compat;
    if (!compat) {
      return "";
    }
    
    let output = `<section class="compat-data">`;

    if (compat.status) {
      let flags = "";
      if (compat.status.deprecated) {
        flags += `<li>Deprecated feature.</li>`;
      }
      if (compat.status.experimental) {
        flags += `<li>Experimental feature.</li>`;
      }
      if (!compat.status.standard_track) {
        flags += `<li>Non-standard feature.</li>`;
      }
      if (flags) {
        output += `<ul class="flags">${flags}</ul>`;
      }
    }

    output += `<ul>`;

    for (const browser in compat.support) {
      const data = compat.support[browser];

      output += `<li><strong>${browser}</strong>: `;
      if (data.version_added) {
        output += `${data.version_added}</li>`;
      } else {
        output += `FIXME: either multiple values, or unsupported</li>`;
      }
    }

    output += `</ul></section>`;

    return output;
  },
  specifications: function(metadata) {
    return `<section class="spec"><p>Specification: <a href="${metadata.specURL}">${metadata.specURL}</a></p></section>`;
  }
};

async function getSourceFiles() {
  const files = await glob("*.html", { cwd: SRC_DIR_HTML });
  return files;
}

function expandOtherMacros(html, metadata) {
  // Find all instances of {{...}} in the html.
  const regex = /{{(.*?)}}/g;
  const matches = html.match(regex);
  if (!matches) {
    return html;
  }

  // Replace each match with the macro's result.
  for (const match of matches) {
    const macroName = match.replace("{{", "").replace("}}", "");
    const macro = MACROS[macroName.toLowerCase()];
    if (!macro) {
      continue;
    }

    const result = macro(metadata);
    html = html.replace(match, result);
  }

  return html;
}

async function main() {
  // Cleanup the output dirs.
  await rimraf(DIST_DIR_HTML);
  await fs.mkdir(DIST_DIR_HTML);

  // Get all html source files.
  const files = await getSourceFiles();

  for (const file of files) {
    console.log(`Expanding macros in: ${file}`);

    const filePath = `${SRC_DIR_HTML}${file}`;
    const fileContent = await fs.readFile(filePath, "utf8");
    const featurePath = file.replace(".html", "");
    const metadata = METADATA[featurePath];

    // Some macros are not handled by the mdn kumacript lib. Handle them first.
    const html = expandOtherMacros(fileContent, metadata);

    // Use the kumascript lib to expand most macros.
    const { markup, errors } = await render(html, { frontMatter: metadata.frontMatter });
    
    if (errors.length) {
      console.warn(`Errors in ${file}`);
      console.warn(errors);
    }

    const newFilePath = `${DIST_DIR_HTML}${file}`;
    await fs.writeFile(newFilePath, markup);
  }
}

main();
