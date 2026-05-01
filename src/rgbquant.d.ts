declare module 'rgbquant' {
    interface RgbQuantOptions {
        colors?: number;
        dithKern?: string;
        dithDelta?: number;
    }
    export default class RgbQuant {
        constructor(opts?: RgbQuantOptions);
        sample(img: HTMLCanvasElement | HTMLImageElement): void;
        palette(tuples?: boolean, noSort?: boolean): Uint8Array;
        reduce(img: HTMLCanvasElement | HTMLImageElement, retType?: number): Uint8Array;
    }
}
