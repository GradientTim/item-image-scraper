import fs from "fs";
import path from "path";
import axios from "axios";
import { type CheerioAPI, load } from "cheerio";
import { input, select } from "@inquirer/prompts";

type MaterialType = "blocks" | "items";

type Answers = {
  type: MaterialType;
  output: string;
  resolution: string;
};

const urls: Map<MaterialType, string> = new Map([
  ["blocks", "https://minecraft.wiki/w/Block"],
  ["items", "https://minecraft.wiki/w/Item"],
]);

const answers: Answers = {
  type: await select<MaterialType>({
    message: "What type do you want to export?",
    choices: [
      { name: "Blocks", value: "blocks" },
      { name: "Items", value: "items" },
    ],
  }),
  output: await input({
    message: "Where should the images be exported to?",
    default: "./assets/",
  }),
  resolution: await input({
    message: "How should the resolution be?",
    default: "60px",
  }),
};

const output: string = answers.output;
const url: string = urls.get(answers.type)!!;

if (!fs.existsSync(output)) {
  fs.mkdirSync(output);
}

const imageUrls: Map<string, string> = new Map();

const { data: html } = await axios.get(url);
const $ = load(html);

switch (answers.type) {
  case "items":
    await exportItems($);
    break;
  case "blocks":
    await exportBlocks($);
    break;
}

async function exportItems($: CheerioAPI) {
  $("div.div-col.columns.column-width:lt(4)")
    .find("ul li")
    .each((_, element) => {
      const imgTag = $(element).find("img.mw-file-element");
      const src = imgTag.attr("src");
      const name = $(element).find("a").text();

      if (src && (name && name.length > 0)) {
        const sanitizedName: string = "item.minecraft." + name.replace(/\s+/g, "_").toLowerCase();
        imageUrls.set(
          `https://minecraft.wiki${src}`,
          `${sanitizedName}.png`
        );
        console.log(`${sanitizedName} -> ${src}`);
      }
    });

  imageUrls.entries().forEach(([imageUrl, name]) => {
    const filePath = path.join(answers.output, name);
    console.log(`[ITEM] ${name}: ${imageUrl}`);
    fetch(imageUrl).then((response) => {
      Bun.write(filePath, response);
    });
  });
}

async function exportBlocks($: CheerioAPI) {
  $("div.div-col.columns.column-width")
    .first()
    .find("ul li")
    .each((_, element) => {
      const imgTag = $(element).find("a.mw-file-description img");
      const srcSet = imgTag.attr("srcset");
      const name = $(element).find("a").text();

      if (srcSet && (name && name.length > 0)) {
        const highResUrl = srcSet.split(",")[0].trim().split(" ")[0];
        const updatedUrl = highResUrl.replace(
          /\/\d+px-/,
          `/${answers.resolution}-`
        );

        if (updatedUrl) {
          const sanitizedName: string = "block.minecraft." + name.replace(/\s+/g, "_").toLowerCase();
          imageUrls.set(
            `https://minecraft.wiki${updatedUrl}`,
            `${sanitizedName}.png`
          );
        }
      }
    });

  imageUrls.entries().forEach(([imageUrl, name]) => {
    const filePath = path.join(answers.output, name);
    console.log(`[BLOCK] ${name}: ${imageUrl}`);
    fetch(imageUrl).then((response) => {
      Bun.write(filePath, response);
    });
  });
}
