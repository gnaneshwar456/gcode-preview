export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export enum MoveType {
    Print,
    Travel
}

export interface GCodeCommand {
    type: MoveType;
    start: Point3D;
    end: Point3D;
    layerIndex: number;
    extruding: boolean;
}

export interface GCodeLayer {
    index: number;
    zHeight: number;
    commands: GCodeCommand[];
}

export interface GCodeParsedData {
    layers: GCodeLayer[];
    boundingBox: { min: Point3D, max: Point3D };
}

export interface PreviewConfig {
    bedSize: number;
    theme: 'dark' | 'light';
    extrusionColor: string;
}
