import { SceneConfig, Scene, ArkFile, PrinterBuilder } from "arkanalyzer";

const projectRoot = "ex/resources/basicUsage/cfgDot";
let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir(projectRoot);

let scene: Scene = new Scene();
scene.buildSceneFromProjectDir(config);

let files: ArkFile[] = scene.getFiles();

let printer = new PrinterBuilder('out');
for ( const arkFile of files ) {
    printer.dumpToDot(arkFile);
}