import ejs from 'ejs';
import fs, { StatsBase, StatsFs } from 'fs';
import MarkdownIt from 'markdown-it';
import highlightjs from 'markdown-it-highlightjs';
import { CheatsheetContext } from './cheatsheet-context.interface.ts';
import { TemplateType } from './templates/template.type.ts';

const templatesDir: string = './src/templates/';
const cheatsheetDir: string = './cheatsheets/';
const outDir: string = './dist/';
const ejsDefaultConfig: ejs.Options & { async: false } = { root: `${templatesDir}`, async: false };
const maxGeneratedCheatsheets: number = 10;

/**
 * Get list of available cheatsheets
 */
export function getCheatsheetsList(): string[] {
  return fs.readdirSync(cheatsheetDir, {withFileTypes: true})
    .filter((dirent: any) => dirent.isDirectory())
    .map((dir: any) => dir.name);
}

/**
 * Remove old dist folder and create new empty one
 */
export function clearDist(): void {
  fs.rmSync('./dist', { recursive: true, force: true });
  fs.mkdirSync('./dist');
}

export function cleanGenerated() {
  const files: string[] = fs.readdirSync(`${outDir}/`)
    .filter((dirent: string) => dirent.startsWith('generated-'));
  if (files.length > maxGeneratedCheatsheets) {
    const sortedFiled: string[] = files.map((dirent: string) => [dirent, fs.statSync(`${outDir}/${dirent}`)] as [string, fs.Stats])
      .sort((file1: [string, fs.Stats], file2: [string, fs.Stats]) => file1[1].birthtimeMs - file2[1].birthtimeMs)
      .map((dirent: [string, fs.Stats]) => dirent[0]);

    while(sortedFiled.length > maxGeneratedCheatsheets) {
      const file: string = sortedFiled.shift() as string;
      fs.rmSync(`${outDir}/${file}`, {recursive: true, force: true});
    }
  }
}

/**
 * Create specific markdown html generator for the template
 * @param template template name
 */
export async function createMarkdownEngine(template: string): Promise<MarkdownIt> {
  const markdown = new MarkdownIt({}).use(highlightjs);
  console.log(`Initialize ${template} template.`);
  // get template specific scripts and run it
  const templateScript: TemplateType = (await import(`.${templatesDir}${template}/index.ts`)).default;
  templateScript.initializeTemplate(markdown);
  return markdown;
}

/**
 * create template driven markdownit instance
 * @param cheatsheet name of the cheatsheet to build
 */
export async function computeCheatsheet(cheatsheet: string): Promise<any> {
  console.log(`${cheatsheet} cheatsheet.`);
  // load cheatsheet configuration
  const config = JSON.parse(fs.readFileSync(`${cheatsheetDir}${cheatsheet}/config.json`).toString());
  const templateConfiguration: TemplateType = (await import(`.${templatesDir}${config.template}/index.ts`)).default;

  const markdown = await createMarkdownEngine(config.template);

  console.log(`Render ${config.template} template.`);
  // render html body with markdownit
  const rendered = markdown.render(fs.readFileSync(`${cheatsheetDir}${cheatsheet}/index.md`).toString());

  const context: CheatsheetContext = {
    cheatsheet,
    title: config.name,
    description: config.description,
    mainColor: config.mainColor,
    secondaryColor: config.secondaryColor,
    content: rendered,
    icon: config.icon,
    templateParams: { ...templateConfiguration.defaultParams, ...config.templateParams }
  };

  // create cheatsheet package with html page and assets
  generateCheatsheet(config.template, cheatsheet, context);
  return context;
}

/**
 * Generate cheatsheet files
 * @param template template name
 * @param cheatsheetOutDir name of the output folder
 * @param context cheatsheet context @see CheatsheetContext object
 */
export function generateCheatsheet(template: string, cheatsheetOutDir: string, context: CheatsheetContext) {
  console.log(`Create ${context.title} HTML page.`);
  fs.mkdirSync(`${outDir}${cheatsheetOutDir}`);
  const html: string = ejs.render(fs.readFileSync(`${templatesDir}${template}/index.ejs`).toString(), context, ejsDefaultConfig);
  fs.writeFileSync(`${outDir}${cheatsheetOutDir}/cheatsheet.html`, html);
  fs.cpSync(`${templatesDir}${template}/style.css`, `${outDir}${cheatsheetOutDir}/style.css`);
  if (fs.existsSync(`${cheatsheetDir}${context.cheatsheet}/assets`)) {
    fs.cpSync(`${cheatsheetDir}${context.cheatsheet}/assets`, `${outDir}${cheatsheetOutDir}/assets`, { recursive: true });
  }

  // copy common files
  fs.cpSync(`${templatesDir}/common.css`, `${outDir}/common.css`);
}

export function buildIndex(cheatsheetsContext: any[]): void {
  const templates = fs.readdirSync(templatesDir, {withFileTypes: true})
    .filter((dirent: any) => dirent.isDirectory())
    .filter((dir: any) => !['main', 'partials'].includes(dir.name))
    .map((dir: any) => dir.name);

  const context: any = {
    cheatsheetsContext,
    templates
  };
  console.log('Build index file');
  fs.readdirSync(`${templatesDir}/main/`)
    .filter((dirent: string) => dirent.endsWith('.ejs'))
    .forEach((dirent: string) => {
      const html: string = ejs.render(fs.readFileSync(`${templatesDir}/main/${dirent}`).toString(), context, ejsDefaultConfig);
      fs.writeFileSync(`${outDir}/${dirent.substring(0, dirent.length - 3)}html`, html);
    });
  fs.readdirSync(`${templatesDir}/main/`)
    .filter((dirent: string) => !dirent.endsWith('.ejs'))
    .forEach((dirent: string) => fs.cpSync(`${templatesDir}/main/${dirent}`, `${outDir}/${dirent}`));
}
