import { ArduinoCreateSketch } from "./arduino-create-service";
import { injectable } from "inversify";

@injectable()
export class ArduinoCreateSketchManager {
    protected sketches: ArduinoCreateSketch[] = [];

    setSketches(sketches: ArduinoCreateSketch[]) {
        this.sketches = sketches;
    }

    addSketch(sketch: ArduinoCreateSketch) {
        this.sketches.push(sketch);
    }

    getSketchByName(name: string): ArduinoCreateSketch | undefined {
        return this.sketches.find(sketch => name === sketch.name);
    }
}
