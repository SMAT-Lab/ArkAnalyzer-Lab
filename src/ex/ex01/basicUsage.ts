import { SceneConfig, Scene, ArkFile, ArkNamespace, ArkClass, ArkField, ArkMethod, Cfg, DotMethodPrinter, PrinterBuilder } from 'arkanalyzer';

const projectRoot = 'src/ex/resources/basicUsage/demoProject';
let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir(projectRoot);

let scene: Scene = new Scene();
scene.buildSceneFromProjectDir(config);
scene.inferTypes();

//ex01.1：获取所有文件
let files: ArkFile[] = scene.getFiles();
let fileNames: string[] = files.map((file) => file.getName());
console.log(fileNames);

//ex01.2：获取命名空间
let namespaces: ArkNamespace[] = scene.getNamespaces();
let namespaceNames: string[] = namespaces.map((ns) => ns.getName());
console.log(namespaceNames);

let namespaces2: ArkNamespace[] = files[1].getNamespaces();
let namespaceNames2: string[] = namespaces2.map((ns) => ns.getName());
console.log(namespaceNames2);

//ex01.3：获取所有类
let classes: ArkClass[] = scene.getClasses();
let classNames: string[] = classes.map((cls) => cls.getName());
console.log(classNames);

let classes2: ArkClass[] = files[2].getClasses();
let classNames2: string[] = classes2.map((cls) => cls.getName());
console.log(classNames2);

let classes3: ArkClass[] = namespaces[0].getClasses();
let classNames3: string[] = classes3.map((cls) => cls.getName());
console.log(classNames3);

//ex01.4：获取Book所有属性
let bookClass: ArkClass = classes.filter((value) => value.getName() == 'Book')[0];
let fields: ArkField[] = bookClass.getFields();
let fieldNames: string[] = fields.map((fld) => fld.getName());
console.log(fieldNames);

//ex01.5：获取BookService方法
let serviceClass: ArkClass = classes.filter((value) => value.getName() === 'BookService')[0];
let methods: ArkMethod[] = serviceClass.getMethods();
let methodNames: string[] = methods.map((mthd) => mthd.getName());
console.log(methodNames);

let methods1: ArkMethod[] = scene.getMethods();
let methodNames1: string[] = methods1.map((mthd) => mthd.getName());
console.log(methodNames1);

//ex01.6：获取方法getBooksByAuthor的CFG
let method = serviceClass.getMethodWithName('getBooksByAuthor');
let cfg: Cfg | undefined = method?.getBody()?.getCfg();
let dotMethodPrinter = new DotMethodPrinter(method!);
PrinterBuilder.dump(dotMethodPrinter, 'out/getBooksByAuthor_cfg.dot');

console.log('finish');
