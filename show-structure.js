// show-structure.js
import fs from "fs";
import path from "path";

function showTree(dir, indent = "") {
  for (const item of fs.readdirSync(dir)) {
    if (item === "node_modules") continue;
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    console.log(indent + (stats.isDirectory() ? "📁 " : "📄 ") + item);
    if (stats.isDirectory()) showTree(fullPath, indent + "   ");
  }
}

showTree(".");