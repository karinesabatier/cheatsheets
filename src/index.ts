import ejs from 'ejs';
import fs from 'fs';
import MarkdownIt from 'markdown-it';
import highlightjs from 'markdown-it-highlightjs';
import { TemplateType } from './templates/template.type';

const templatesDir: string = './src/templates/';
const cheatsheetDir: string = './cheatsheets/';
const outDir: string = './dist/';


/**
 * Get list of available cheatsheets
 */
function getCheatsheetsList(): string[] {
  return fs.readdirSync(cheatsheetDir, {withFileTypes: true})
    .filter((dirent: any) => dirent.isDirectory())
    .map((dir: any) => dir.name);
}

/**
 * Remove old dist folder and create new empty one
 */
function clearDist(): void {
  fs.rmSync('./dist', { recursive: true, force: true });
  fs.mkdirSync('./dist');
}

/**
 * create template driven markdownit instance
 * @param cheatsheet name of the cheatsheet to build
 */
async function computeCheatsheet(cheatsheet: string): Promise<any> {
  const markdown = new MarkdownIt({}).use(highlightjs);

  console.log(`${cheatsheet} cheatsheet.`);
  // load cheatsheet configuration
  const config = JSON.parse(fs.readFileSync(`${cheatsheetDir}${cheatsheet}/config.json`).toString());

  console.log(`Initialize ${config.template} template.`);
  // get template specific scripts and run it
  const templateScript: TemplateType = (await import(`.${templatesDir}${config.template}/index.ts`)).default;
  templateScript.initializeTemplate(markdown);

  console.log(`Render ${config.template} template.`);
  // render html body with markdownit
  const rendered = markdown.render(fs.readFileSync(`${cheatsheetDir}${cheatsheet}/index.md`).toString());

  const context: any = {
    title: config.name,
    description: config.description,
    mainColor: config.mainColor,
    secondaryColor: config.secondaryColor,
    content: rendered,
    icon: config.icon
  };

  console.log(`Create ${config.template} HTML page.`);
  // create cheatsheet package with html page and assets
  fs.mkdirSync(`${outDir}${cheatsheet}`);
  const html: string = ejs.render(fs.readFileSync(`${templatesDir}${config.template}/index.ejs`).toString(), context);
  fs.writeFileSync(`${outDir}${cheatsheet}/cheatsheet.html`, html);
  fs.cpSync(`${templatesDir}${config.template}/style.css`, `${outDir}${cheatsheet}/style.css`);
  if (fs.existsSync(`${cheatsheetDir}${cheatsheet}/assets`)) {
    fs.cpSync(`${cheatsheetDir}${cheatsheet}/assets`, `${outDir}${cheatsheet}/assets`, { recursive: true });
  }

  // copy common files
  fs.cpSync(`${templatesDir}/common.css`, `${outDir}/common.css`);
  return context;
}

function buildIndex(cheatsheetsContext: any[]): void {
  const context: any = {
    cheatsheetsContext
  };
  console.log('Build index file');
  const html: string = ejs.render(fs.readFileSync(`${templatesDir}/main/index.ejs`).toString(), context);
  fs.writeFileSync(`${outDir}/index.html`, html);
  fs.readdirSync(`${templatesDir}/main/`)
    .forEach((dirent: string) => fs.cpSync(`${templatesDir}/main/${dirent}`, `${outDir}/${dirent}`));
}

// main code
clearDist();

const cheatsheetsContext: any[] = [];
const cheatsheets: string[] = getCheatsheetsList();
for (let cheatsheet of cheatsheets) {
  cheatsheetsContext.push(await computeCheatsheet(cheatsheet));
}

buildIndex(cheatsheetsContext);