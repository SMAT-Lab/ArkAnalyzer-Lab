import { SceneConfig, Scene, ArkFile, PrinterBuilder } from "../../src/bundle";

const config_path = "ex/resources/basicUsage/cfgDot/project_config.json";
let config: SceneConfig = new SceneConfig();
config.buildFromJson(config_path);

let scene: Scene = new Scene(config);

let files: ArkFile[] = scene.getFiles();

for ( const arkFile of files ) {
    let printer = new PrinterBuilder();
    printer.dumpToDot(arkFile);
}