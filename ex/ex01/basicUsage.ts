import { SceneConfig, Scene, ArkFile, ArkNamespace, ArkClass, ArkField, ArkMethod, Cfg } from "../../src/bundle";

const config_path = "ex/resources/basicUsage/demoProject/project_config.json";
let config: SceneConfig = new SceneConfig();
config.buildFromJson(config_path);

let scene: Scene = new Scene(config);

//ex01.1：获取所有文件
let files: ArkFile[] = scene.getFiles();
let fileNames: string[] = files.map(file => file.name);
console.log(fileNames);

//ex01.2：获取命名空间
let namespaces: ArkNamespace[] = scene.getNamespaces();
let namespaceNames: string[] = namespaces.map(ns => ns.name);
console.log(namespaceNames);

let namespaces2: ArkNamespace[] = files[1].getNamespaces();
let namespaceNames2: string[] = namespaces2.map(ns => ns.name);
console.log(namespaceNames2);

//ex01.3：获取所有类
let classes: ArkClass[] = scene.getClasses();
let classNames: string[] = classes.map(cls => cls.name);
console.log(classNames);

let classes2: ArkClass[] = files[2].getClasses();
let classNames2: string[] = classes2.map(cls => cls.name);
console.log(classNames2);

let classes3: ArkClass[] = namespaces[0].getClasses();
let classNames3: string[] = classes3.map(cls => cls.name);
console.log(classNames3);

//ex01.4：获取所有属性
let bookClass: ArkClass = classes[3];
let fields: ArkField[] = bookClass.getFields();
let fieldNames: string[] = fields.map(fld => fld.name);
console.log(fieldNames);

//ex01.5：获取所有方法
let serviceClass: ArkClass = classes[5];
let methods: ArkMethod[] = serviceClass.getMethods();
let methodNames: string[] = methods.map(mthd => mthd.name);
console.log(methodNames);

let methods1: ArkMethod[] = scene.getMethods();
let methodNames1: string[] = methods1.map(mthd => mthd.name);
console.log(methodNames1);

//ex01.6：获取方法CFG
let addBookMethod: ArkMethod = methods[0];
let addBookCfg: Cfg = addBookMethod.getBody().getCfg();

console.log("finish")